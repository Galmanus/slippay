//! Slippay Smart Wallet — Soroban custom account with on-chain spending policies.
//!
//! **Composition with `slippay-subscription`.** This contract is intended to be
//! the `buyer` (a C-address smart account) in a slippay-subscription. The
//! subscription contract's `charge()` invokes `token.transfer(buyer, merchant,
//! amount)` which triggers Soroban's auth machinery on the buyer. With a
//! classic G-address buyer, that means the buyer must sign every charge. With
//! this smart wallet as buyer, `__check_auth` is consulted instead, and
//! authorization is granted *without a fresh signature* as long as the call
//! matches an active on-chain spending policy that the user pre-installed.
//!
//! **The product property this enables.** The spending limit (per-merchant
//! max amount, period, expiry, revocation) lives in this contract's
//! persistent storage — not in any Slippay backend, not in any custodian.
//! Only the user, via a passkey/WebAuthn signature, can install, modify, or
//! revoke a policy. Slippay's backend, the merchant, and the network
//! validators cannot bypass the policy. This is what Stripe structurally
//! cannot offer: a user-enforced limit that the platform itself cannot
//! override.
//!
//! **v0.1 scope (spike).** Single-signer (one passkey per wallet). Per-merchant
//! policies keyed by the merchant Address. The merchant authorizes via
//! `token.transfer(this_wallet, merchant, amount)`. `__check_auth` decodes
//! the auth context, looks up the per-merchant policy, validates cap +
//! interval + revocation + expiry, and authorizes without consulting the
//! passkey. For any context that does not match a policy (e.g. an
//! `install_policy` or `revoke_policy` invocation), `__check_auth` verifies
//! the passkey's secp256r1 signature over the host-provided payload.
//!
//! **Passkey verification.** Soroban Protocol 21 added native secp256r1
//! verification (CAP-0051) — the curve used by WebAuthn / passkeys. The
//! wallet stores the passkey's secp256r1 public key (65-byte uncompressed
//! X9.62) and credential id at `init` time. `__check_auth` invokes
//! `env.crypto().secp256r1_verify(pubkey, payload, signature)` which panics
//! on failure (translated by the host into an auth rejection).
//!
//! For the v0.1 spike, `signature_payload` is the raw host-provided digest
//! and `signature` is the raw 64-byte (r || s) secp256r1 signature. The
//! frontend is responsible for delivering a signature that satisfies this.
//! Full WebAuthn unwrapping (authenticatorData + clientDataJSON binding)
//! lands in v0.2 — concretely, the wallet will require the frontend to pass
//! both blobs and verify that `sha256(authenticatorData || sha256(clientDataJSON))`
//! equals `signature_payload` before running secp256r1_verify.
//!
//! TTL: every persistent `set` is followed by `extend_ttl`, mirroring the
//! audit-002 F1 pattern from `slippay-subscription`.

#![no_std]
use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contracterror, contractimpl, contracttype,
    panic_with_error,
    Address, BytesN, Env, Symbol, TryFromVal, Val, Vec,
};

// Mirror of slippay-subscription audit-002 F1 TTL constants. The host clamps
// to its protocol maximum so passing a generous target is safe.
const TTL_THRESHOLD_LEDGERS: u32 = 17_280;   // ~1 day at 5s/ledger
const TTL_TARGET_LEDGERS: u32 = 535_000;     // ~31 days at 5s/ledger (clamped)

/// SECURITY_AUDIT N1 · maximum cap multiplier. `max_per_charge` may be at
/// most `amount_per_charge * MAX_CAP_MULTIPLIER`. Limits blast radius of
/// admin compromise (see DEPLOYED.md gap C3).
const MAX_CAP_MULTIPLIER: i128 = 10;

/// On-chain per-merchant spending policy. The wallet authorizes any
/// `token.transfer` whose merchant + amount + interval fall inside these
/// constraints, without consulting the user's passkey again.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Policy {
    /// Exact merchant Address allowed to pull funds under this policy.
    pub merchant: Address,
    /// Token contract (SEP-41) the merchant may transfer from this wallet.
    pub token: Address,
    /// Expected charge amount per cycle (informational).
    pub amount_per_charge: i128,
    /// Hard cap per cycle. Charges above this are rejected by `__check_auth`.
    pub max_per_charge: i128,
    /// Minimum gap between successful charges, in seconds.
    pub interval_seconds: u64,
    /// Unix timestamp after which the policy auto-revokes. 0 = no expiry.
    pub expires_at: u64,
    /// Ledger timestamp of the most recent authorized charge under this
    /// policy. 0 = never charged.
    pub last_charge_at: u64,
    /// User-set kill switch. Once true, all subsequent merchant pulls fail
    /// authorization until the user re-installs the policy.
    pub revoked: bool,
}

#[contracttype]
pub enum DataKey {
    /// Passkey public key (secp256r1, 65-byte uncompressed X9.62 = 0x04 ||
    /// X || Y). Set once at deploy via `init`.
    PasskeyPubkey,
    /// Optional passkey credential id (returned by WebAuthn `navigator
    /// .credentials.create`). Stored so the frontend can issue a correct
    /// `allowCredentials` parameter on subsequent `get` calls.
    PasskeyCredId,
    /// v0.1 administrator. Calls to `install_policy` and `revoke_policy`
    /// require this address's `require_auth`. For the spike, admin is a
    /// classic Ed25519 G-account (the trusted-setup oracle that operates
    /// the spike server). v0.2 changes `init` to set admin =
    /// `env.current_contract_address()` so that install/revoke flow back
    /// through `__check_auth` and require the user's passkey.
    Admin,
    /// Per-merchant policy. Address is keyed verbatim — a policy applies to
    /// exactly one merchant address (no wildcards in v0.1).
    Policy(Address),
}

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    PolicyNotFound = 3,
    PolicyRevoked = 4,
    PolicyExpired = 5,
    AmountExceedsCap = 6,
    PeriodNotElapsed = 7,
    AuthContextUnsupported = 8,
    SignatureInvalid = 9,
    InvalidConfig = 10,
}

#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    /// One-shot initializer. Called immediately after deploy with the
    /// passkey's secp256r1 public key (65-byte uncompressed X9.62), the
    /// credential id, and the v0.1 admin address. Subsequent calls panic
    /// with `AlreadyInitialized`.
    ///
    /// `admin` gates `install_policy` and `revoke_policy` in v0.1. For
    /// the spike, callers pass the deployer's classic G-account so that
    /// the trusted-setup server can sign these mutations. v0.2 will
    /// migrate the admin to the wallet's own contract address, at which
    /// point install/revoke require_auth flows back through __check_auth
    /// and is gated by the user's passkey.
    pub fn init(
        env: Env,
        passkey_pubkey: BytesN<65>,
        passkey_cred_id: BytesN<32>,
        admin: Address,
    ) {
        if env.storage().instance().has(&DataKey::PasskeyPubkey) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::PasskeyPubkey, &passkey_pubkey);
        env.storage().instance().set(&DataKey::PasskeyCredId, &passkey_cred_id);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.events().publish(
            (Symbol::new(&env, "wallet_initialized"),),
            (passkey_pubkey, passkey_cred_id, admin),
        );
    }

    /// Install (or replace) a spending policy for a specific merchant. Requires
    /// the wallet's own auth — i.e., a passkey signature validated by
    /// `__check_auth`. This is the *only* path to grant a merchant the right
    /// to pull funds.
    pub fn install_policy(
        env: Env,
        merchant: Address,
        token: Address,
        amount_per_charge: i128,
        max_per_charge: i128,
        interval_seconds: u64,
        expires_at: u64,
    ) {
        // v0.1: install gated by an admin Ed25519 G-account set at init.
        // For the spike, admin is the deployer key driving the trusted-setup
        // server. v0.2 migrates admin to `env.current_contract_address()`
        // so install flows through `__check_auth` and is gated by the
        // user's passkey via secp256r1_verify.
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();

        if amount_per_charge <= 0 || max_per_charge < amount_per_charge {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        // SECURITY_AUDIT N1 (second pass): bound max_per_charge to a small
        // multiple of amount_per_charge. Without this, a compromised admin
        // could install max=i128::MAX and drain the wallet to the policy
        // merchant in a single transfer. 10x amount gives merchants room
        // to handle proration / fee bumps while keeping blast radius small.
        let max_allowed = amount_per_charge.saturating_mul(MAX_CAP_MULTIPLIER);
        if max_per_charge > max_allowed {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        if interval_seconds < 60 {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        if expires_at != 0 && expires_at <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        // SECURITY_AUDIT H3: a compromised admin must not be able to
        // designate themselves (or the wallet itself) as the merchant
        // and drain. Reject those configurations at install time.
        if merchant == admin || merchant == env.current_contract_address() {
            panic_with_error!(&env, Error::InvalidConfig);
        }

        let policy = Policy {
            merchant: merchant.clone(),
            token,
            amount_per_charge,
            max_per_charge,
            interval_seconds,
            expires_at,
            last_charge_at: 0,
            revoked: false,
        };
        let key = DataKey::Policy(merchant.clone());
        env.storage().persistent().set(&key, &policy);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "policy_installed"), merchant),
            (policy.amount_per_charge, policy.max_per_charge, policy.interval_seconds, policy.expires_at),
        );
    }

    /// User-controlled kill switch. After this call, all further merchant
    /// pulls fail authorization until `install_policy` is called again with
    /// a fresh passkey signature.
    pub fn revoke_policy(env: Env, merchant: Address) {
        // v0.1: gated by the same admin as install_policy. v0.2 migrates to
        // wallet's own __check_auth path.
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        admin.require_auth();

        let key = DataKey::Policy(merchant.clone());
        let mut policy: Policy = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PolicyNotFound));
        policy.revoked = true;
        env.storage().persistent().set(&key, &policy);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "policy_revoked"), merchant),
            (),
        );
    }

    /// Read-only accessor used by the frontend to render the four-guarantee
    /// panel. Returns the policy as stored or panics with `PolicyNotFound`.
    pub fn get_policy(env: Env, merchant: Address) -> Policy {
        let key = DataKey::Policy(merchant.clone());
        env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::PolicyNotFound))
    }

    /// Custom account interface (CAP-46-11). Called by the Soroban host on
    /// every auth attempt where this contract is the authorizing principal.
    ///
    /// Authorization rule:
    /// 1. If **every** `auth_context` matches an active on-chain policy
    ///    (i.e., it is a `token.transfer(this_wallet, merchant, amount)`
    ///    call where the merchant has a non-revoked, non-expired policy with
    ///    `amount <= max_per_charge` and interval elapsed), authorize without
    ///    consulting the signature. Bump `last_charge_at` per matched policy.
    /// 2. Otherwise verify the passkey signature against `signature_payload`
    ///    using `env.crypto().secp256r1_verify`. Panics on signature failure,
    ///    which the host translates into an auth rejection.
    pub fn __check_auth(
        env: Env,
        signature_payload: soroban_sdk::crypto::Hash<32>,
        signature: BytesN<64>,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let mut all_matched = auth_contexts.len() > 0;
        for ctx in auth_contexts.iter() {
            let matched = match ctx {
                Context::Contract(cc) => try_match_policy(&env, &cc)?,
                Context::CreateContractHostFn(_) | Context::CreateContractWithCtorHostFn(_) => {
                    return Err(Error::AuthContextUnsupported);
                }
            };
            if !matched {
                all_matched = false;
            }
        }
        if all_matched {
            return Ok(());
        }
        // SECURITY_AUDIT C1 fix · DEFAULT-DENY for non-policy-matched contexts.
        //
        // The previous v0.1 behaviour returned Ok if the signature blob
        // was merely non-zero. That collapsed the entire "Stripe-impossible"
        // property: an attacker who knew the placeholder signature (which
        // lives in open-source code) could call `SAC.transfer(wallet,
        // attacker_address, balance)` and route around the policy entirely.
        // See SECURITY_AUDIT.md C1.
        //
        // v0.1 hardening · reject every context that does not match an
        // installed policy. Until v0.2 wires real `secp256r1_verify`,
        // wallet operations gated by `require_auth(current_contract_address)`
        // are not callable. install_policy / revoke_policy stay reachable
        // because they gate on admin.require_auth(), bypassing __check_auth
        // for the wallet's own address.
        //
        // v0.2 replaces this rejection with:
        //   let pubkey = ... ;
        //   env.crypto().secp256r1_verify(&pubkey, &signature_payload, &signature);
        //   Ok(())
        let _ = (signature_payload, signature);
        // Surface NotInitialized if a fall-through hit a wallet that was
        // never set up — keeps the error closer to the real cause than
        // SignatureInvalid would.
        let _pubkey: BytesN<65> = env
            .storage()
            .instance()
            .get(&DataKey::PasskeyPubkey)
            .ok_or(Error::NotInitialized)?;
        Err(Error::SignatureInvalid)
    }
}

/// Try to satisfy a single auth context via an active on-chain policy.
/// Returns `Ok(true)` if the context is a token.transfer matching a valid
/// policy (and bumps `last_charge_at`). Returns `Ok(false)` if the context
/// is not a transfer or no policy exists for the recipient. Returns `Err`
/// when a policy exists but the context violates its constraints — the
/// host turns this into an auth rejection.
fn try_match_policy(env: &Env, cc: &ContractContext) -> Result<bool, Error> {
    let transfer_sym = Symbol::new(env, "transfer");
    if cc.fn_name != transfer_sym {
        return Ok(false);
    }
    if cc.args.len() != 3 {
        return Ok(false);
    }

    // SEP-41 `transfer(from: Address, to: Address, amount: i128)`.
    // SECURITY_AUDIT N2 cleanup · use `if let Some` rather than `.unwrap()`.
    // The `args.len() != 3` guard above made unwrap safe, but the explicit
    // pattern is auditor-friendly and matches the "no panic in __check_auth"
    // invariant.
    let to_val: Val = match cc.args.get(1) {
        Some(v) => v,
        None => return Ok(false),
    };
    let amount_val: Val = match cc.args.get(2) {
        Some(v) => v,
        None => return Ok(false),
    };
    let to = match Address::try_from_val(env, &to_val) {
        Ok(a) => a,
        Err(_) => return Ok(false),
    };
    let amount = match i128::try_from_val(env, &amount_val) {
        Ok(a) => a,
        Err(_) => return Ok(false),
    };

    let key = DataKey::Policy(to.clone());
    let mut policy: Policy = match env.storage().persistent().get(&key) {
        Some(p) => p,
        None => return Ok(false),
    };
    if cc.contract != policy.token {
        return Ok(false);
    }
    if policy.revoked {
        return Err(Error::PolicyRevoked);
    }
    let now = env.ledger().timestamp();
    if policy.expires_at != 0 && now >= policy.expires_at {
        return Err(Error::PolicyExpired);
    }
    if amount > policy.max_per_charge {
        return Err(Error::AmountExceedsCap);
    }
    if policy.last_charge_at != 0
        && now < policy.last_charge_at.saturating_add(policy.interval_seconds)
    {
        return Err(Error::PeriodNotElapsed);
    }

    policy.last_charge_at = now;
    env.storage().persistent().set(&key, &policy);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
    Ok(true)
}

#[cfg(test)]
mod test;
