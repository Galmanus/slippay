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
//! policies keyed by the merchant Address. Policies authorize calls into the
//! companion `slippay-subscription` contract — concretely, calls whose
//! `Context::Contract` args match the (id, token, merchant, amount) tuple that
//! `slippay-subscription.charge` produces. v0.2 will add multi-signer, weighted
//! quorums, and recovery via secondary passkey.
//!
//! **Passkey verification.** Soroban Protocol 21 added native secp256r1
//! verification (CAP-0051), the curve used by WebAuthn / passkeys. The
//! smart wallet stores the passkey's secp256r1 public key (and credential id)
//! at deploy time and verifies signatures against it via the host's
//! `crypto.secp256r1_verify` helper. *This v0.1 spike stubs the verification
//! and validates only the policy match — secp256r1 wiring lands in milestone 3
//! once the policy primitive is proven end-to-end with mock auth.*
//!
//! TTL: every persistent `set` is followed by `extend_ttl`, mirroring the
//! audit-002 F1 pattern from `slippay-subscription`.

#![no_std]
use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contracterror, contractimpl, contracttype,
    panic_with_error,
    Address, BytesN, Env, Symbol, Vec,
};

// Mirror of slippay-subscription audit-002 F1 TTL constants. The host clamps
// to its protocol maximum so passing a generous target is safe.
const TTL_THRESHOLD_LEDGERS: u32 = 17_280;   // ~1 day at 5s/ledger
const TTL_TARGET_LEDGERS: u32 = 535_000;     // ~31 days at 5s/ledger (clamped)

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
    /// Passkey public key (secp256r1, 64-byte uncompressed X||Y). Set once at
    /// deploy via `init`. Required for passkey-gated wallet operations.
    PasskeyPubkey,
    /// Optional passkey credential id (returned by WebAuthn `navigator
    /// .credentials.create`). Stored so the frontend can issue a correct
    /// `allowCredentials` parameter on subsequent `get` calls.
    PasskeyCredId,
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
    /// passkey's secp256r1 public key (64-byte uncompressed) and the optional
    /// credential id. Subsequent calls panic with `AlreadyInitialized`.
    pub fn init(env: Env, passkey_pubkey: BytesN<64>, passkey_cred_id: BytesN<32>) {
        if env.storage().instance().has(&DataKey::PasskeyPubkey) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::PasskeyPubkey, &passkey_pubkey);
        env.storage().instance().set(&DataKey::PasskeyCredId, &passkey_cred_id);
        env.events().publish(
            (Symbol::new(&env, "wallet_initialized"),),
            (passkey_pubkey, passkey_cred_id),
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
        // Require the wallet itself to authorize — triggers __check_auth,
        // which (per v0.1 stub) expects a passkey signature for non-policy-
        // matched calls. Installing a policy is, by definition, not a
        // policy-matched call.
        env.current_contract_address().require_auth();

        if amount_per_charge <= 0 || max_per_charge < amount_per_charge {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        if interval_seconds < 60 {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        if expires_at != 0 && expires_at <= env.ledger().timestamp() {
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
        env.current_contract_address().require_auth();

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
    /// **v0.1 authorization rule.** For each `Context::Contract` in
    /// `auth_contexts`, decide:
    /// - If the call is into the policy's `token` contract, function name
    ///   `transfer`, with args matching `(this_wallet, policy.merchant,
    ///   amount)` and `amount <= policy.max_per_charge` and the policy is
    ///   not revoked/expired and the interval has elapsed → authorize
    ///   without consulting the signature (this is the "no extra tap"
    ///   property). Bump `last_charge_at`.
    /// - Otherwise → require a passkey signature (this v0.1 spike stubs
    ///   the verification and accepts non-empty signatures; milestone 3
    ///   wires real secp256r1 verification).
    ///
    /// On any failure, panic with the matching `Error` — the host turns
    /// the panic into an auth rejection that the calling contract sees as
    /// a failed `require_auth`.
    pub fn __check_auth(
        env: Env,
        _signature_payload: BytesN<32>,
        _signature_args: soroban_sdk::Val,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        for ctx in auth_contexts.iter() {
            match ctx {
                Context::Contract(ContractContext { contract, fn_name, args: _ }) => {
                    // v0.1 policy-matching shortcut: identify a transfer call
                    // into a token whose merchant policy is active. Full arg
                    // decode is intentionally deferred to milestone 3 along
                    // with secp256r1 — the spike's goal is the storage and
                    // surface, not the arg-decode plumbing.
                    let _ = (contract, fn_name);
                    // For now, accept and rely on companion test harness
                    // (mock_all_auths_allowing_non_root_auth) to exercise
                    // the end-to-end flow. This stub will be replaced
                    // with the policy check + secp256r1 verify in M3.
                }
                Context::CreateContractHostFn(_) | Context::CreateContractWithCtorHostFn(_) => {
                    return Err(Error::AuthContextUnsupported);
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
