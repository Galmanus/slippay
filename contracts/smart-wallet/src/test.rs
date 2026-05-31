//! M2 + M3 spike tests for slippay-smart-wallet.
//!
//! Public-surface tests (init / install / revoke / get) use
//! `mock_all_auths` so the wallet's `__check_auth` is bypassed and we
//! exercise only the storage logic. The policy-match path (M3) is tested
//! directly against the `try_match_policy` helper, with `env.as_contract`
//! to put the wallet's storage in scope. Real secp256r1 signature
//! verification is exercised in the M4 testnet end-to-end run.

#![cfg(test)]
use super::*;
use soroban_sdk::{
    auth::{Context, ContractContext},
    testutils::{Address as _, Ledger as _},
    vec, Address, BytesN, Env, IntoVal, Symbol, Vec,
};

fn deploy(env: &Env) -> (Address, SmartWalletClient<'_>) {
    let id = env.register(SmartWallet, ());
    let client = SmartWalletClient::new(env, &id);
    (id, client)
}

fn dummy_pubkey(env: &Env) -> BytesN<65> {
    // First byte 0x04 = uncompressed X9.62 prefix; remaining 64 bytes are
    // garbage X||Y. Tests that exercise the policy-match path never invoke
    // secp256r1_verify so the value is irrelevant beyond shape.
    let mut bytes = [0u8; 65];
    bytes[0] = 0x04;
    for i in 1..65 {
        bytes[i] = i as u8;
    }
    BytesN::from_array(env, &bytes)
}

fn dummy_cred_id(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[2u8; 32])
}

// ──────────────────────────────────────────────────────────────────────
// M2 public-surface tests
// ──────────────────────────────────────────────────────────────────────

#[test]
fn init_persists_passkey() {
    let env = Env::default();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    let res = wallet.try_init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    assert!(res.is_err(), "second init must reject");
}

#[test]
fn install_and_get_policy() {
    let env = Env::default();
    env.mock_all_auths();

    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(
        &merchant,
        &token,
        &29_000_000,            // 29.0 USDC (7 decimals)
        &35_000_000,            // cap 35.0 USDC
        &(30 * 24 * 60 * 60),   // 30 days
        &0,                      // no expiry
    );

    let policy = wallet.get_policy(&merchant);
    assert_eq!(policy.merchant, merchant);
    assert_eq!(policy.token, token);
    assert_eq!(policy.amount_per_charge, 29_000_000);
    assert_eq!(policy.max_per_charge, 35_000_000);
    assert_eq!(policy.interval_seconds, 2_592_000);
    assert_eq!(policy.expires_at, 0);
    assert_eq!(policy.last_charge_at, 0);
    assert!(!policy.revoked);
}

#[test]
fn revoke_flips_flag() {
    let env = Env::default();
    env.mock_all_auths();

    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &10, &10, &60, &0);

    wallet.revoke_policy(&merchant);
    let policy = wallet.get_policy(&merchant);
    assert!(policy.revoked, "revoke_policy must set revoked=true");
}

#[test]
fn install_with_invalid_config_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);

    assert!(wallet.try_install_policy(&merchant, &token, &0, &10, &60, &0).is_err());
    assert!(wallet.try_install_policy(&merchant, &token, &10, &5, &60, &0).is_err());
    assert!(wallet.try_install_policy(&merchant, &token, &10, &10, &30, &0).is_err());
}

#[test]
fn revoke_nonexistent_policy_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    assert!(wallet.try_revoke_policy(&merchant).is_err());
}

// ──────────────────────────────────────────────────────────────────────
// M3 policy-match tests (direct against try_match_policy)
// ──────────────────────────────────────────────────────────────────────

fn make_transfer_ctx(
    env: &Env,
    token: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) -> ContractContext {
    ContractContext {
        contract: token.clone(),
        fn_name: Symbol::new(env, "transfer"),
        args: vec![&env, from.into_val(env), to.into_val(env), amount.into_val(env)],
    }
}

#[test]
fn policy_match_authorizes_within_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &60, &0);

    let ctx = make_transfer_ctx(&env, &token, &id, &merchant, 100);
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Ok(true)), "expected Ok(true), got {:?}", r);
    });
}

#[test]
fn policy_match_rejects_over_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &60, &0);

    let ctx = make_transfer_ctx(&env, &token, &id, &merchant, 200);
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Err(Error::AmountExceedsCap)));
    });
}

#[test]
fn policy_match_rejects_revoked() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &60, &0);
    wallet.revoke_policy(&merchant);

    let ctx = make_transfer_ctx(&env, &token, &id, &merchant, 100);
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Err(Error::PolicyRevoked)));
    });
}

#[test]
fn policy_match_rejects_expired() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    env.ledger().with_mut(|li| { li.timestamp = 1_000; });
    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &60, &2_000);

    // Advance past expiry.
    env.ledger().with_mut(|li| { li.timestamp = 3_000; });

    let ctx = make_transfer_ctx(&env, &token, &id, &merchant, 100);
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Err(Error::PolicyExpired)));
    });
}

#[test]
fn policy_match_enforces_interval() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    env.ledger().with_mut(|li| { li.timestamp = 1_000; });
    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &600, &0);

    let ctx = make_transfer_ctx(&env, &token, &id, &merchant, 100);

    // First call succeeds and bumps last_charge_at.
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Ok(true)), "first call must succeed: {:?}", r);
    });

    // Immediate second call: interval not elapsed.
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Err(Error::PeriodNotElapsed)), "second call must reject: {:?}", r);
    });

    // Advance past interval.
    env.ledger().with_mut(|li| { li.timestamp = 1_000 + 700; });
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Ok(true)), "third call after interval must succeed: {:?}", r);
    });
}

#[test]
fn policy_match_returns_false_for_unknown_merchant() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let unknown_merchant = Address::generate(&env);
    let token = Address::generate(&env);
    let ctx = make_transfer_ctx(&env, &token, &id, &unknown_merchant, 100);
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Ok(false)), "unknown merchant must return Ok(false): {:?}", r);
    });
}

#[test]
fn policy_match_returns_false_for_wrong_token() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    let other_token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &60, &0);

    // Same merchant + amount, but the transfer is on a different token —
    // policy must not authorize cross-asset transfers.
    let ctx = make_transfer_ctx(&env, &other_token, &id, &merchant, 100);
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Ok(false)));
    });
}

#[test]
fn install_rejects_max_above_multiplier() {
    // SECURITY_AUDIT N1: cap on max_per_charge prevents a compromised
    // admin from installing max=i128::MAX and draining the wallet in one
    // transfer.
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    // amount=100, max=2000 → max == amount * 20, must reject (10x cap)
    let r = wallet.try_install_policy(&merchant, &token, &100, &2_000, &60, &0);
    assert!(r.is_err(), "max > amount*10 must be rejected");
    // amount=100, max=1000 → max == amount * 10, must accept (boundary)
    wallet.install_policy(&merchant, &token, &100, &1_000, &60, &0);
}

#[test]
fn install_rejects_merchant_equals_admin() {
    // SECURITY_AUDIT H3: refuse to install a policy where the admin is
    // also the merchant — would let a compromised admin drain the wallet
    // to themselves.
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    let admin = Address::generate(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &admin);

    let token = Address::generate(&env);
    // merchant == admin → must reject
    let r = wallet.try_install_policy(&admin, &token, &10, &10, &60, &0);
    assert!(r.is_err(), "merchant==admin must be rejected");
}

#[test]
fn install_rejects_merchant_equals_wallet_self() {
    // SECURITY_AUDIT H3: same guard, but for the wallet's own contract
    // address. Would let an attacker route funds in a self-loop pattern.
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let token = Address::generate(&env);
    let r = wallet.try_install_policy(&id, &token, &10, &10, &60, &0);
    assert!(r.is_err(), "merchant==wallet must be rejected");
}

#[test]
fn policy_match_returns_false_for_non_transfer_fn() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&merchant, &token, &100, &150, &60, &0);

    let ctx = ContractContext {
        contract: token,
        fn_name: Symbol::new(&env, "burn"),
        args: vec![&env, id.into_val(&env), 100i128.into_val(&env)],
    };
    env.as_contract(&id, || {
        let r = super::try_match_policy(&env, &ctx);
        assert!(matches!(r, Ok(false)));
    });
}

// ──────────────────────────────────────────────────────────────────────
// Agent session tests (delegated push grant with windowed budget)
// ──────────────────────────────────────────────────────────────────────

fn agent_pk(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

/// A non-empty allowlist with a single fresh recipient. A2 forbids installing
/// with an empty allowlist, so every install helper now threads a recipient.
/// Tests that need to assert on the recipient build their own and pass it
/// through `install_session_to`.
fn one_recipient(env: &Env) -> (Address, Vec<Address>) {
    let to = Address::generate(env);
    (to.clone(), vec![env, to])
}

#[test]
fn install_and_get_agent_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let token = Address::generate(&env);
    let (recipient, allow) = one_recipient(&env);
    wallet.install_agent_session(
        &agent_pk(&env),
        &token,
        &10_000_000,   // per_tx_cap 10 USDC
        &86_400,       // 24h window
        &50_000_000,   // window_cap 50 USDC
        &0,            // no expiry
        &allow,
    );

    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.session_pubkey, agent_pk(&env));
    assert_eq!(s.token, token);
    assert_eq!(s.per_tx_cap, 10_000_000);
    assert_eq!(s.window_seconds, 86_400);
    assert_eq!(s.window_cap, 50_000_000);
    assert_eq!(s.cur_spent, 0);
    assert_eq!(s.prev_spent, 0);
    assert_eq!(s.expires_at, 0);
    assert!(!s.revoked);
    assert_eq!(s.allow_recipients.len(), 1, "allowlist threaded through");
    assert_eq!(s.allow_recipients.get(0).unwrap(), recipient);
}

/// Install with a single fresh recipient in the allowlist; returns the
/// recipient so the caller can build matching transfer contexts.
fn install_session(env: &Env, wallet: &SmartWalletClient, token: &Address, per_tx: i128, window_s: u64, window_cap: i128, expires_at: u64) -> Address {
    let (to, allow) = one_recipient(env);
    wallet.install_agent_session(&agent_pk(env), token, &per_tx, &window_s, &window_cap, &expires_at, &allow);
    to
}

/// Install with a caller-supplied recipient allowlist.
fn install_session_to(env: &Env, wallet: &SmartWalletClient, token: &Address, per_tx: i128, window_s: u64, window_cap: i128, expires_at: u64, allow: &Vec<Address>) {
    wallet.install_agent_session(&agent_pk(env), token, &per_tx, &window_s, &window_cap, &expires_at, allow);
}

#[test]
fn agent_authorizes_within_caps_and_tracks_spend() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10);
        assert!(matches!(r, Ok(true)), "within caps must authorize: {:?}", r);
    });
    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.cur_spent, 10, "spend must be tracked");
    assert_eq!(s.epoch_start, 1_000);
}

#[test]
fn agent_rejects_over_per_tx_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 11);
        assert!(matches!(r, Err(Error::AmountExceedsCap)), "got {:?}", r);
    });
}

#[test]
fn agent_rejects_over_window_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10), Ok(true)));
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10), Ok(true)));
        // 20 + 10 = 30 > window_cap 25 → reject, leaving spent at 20.
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10);
        assert!(matches!(r, Err(Error::WindowCapExceeded)), "got {:?}", r);
    });
    assert_eq!(wallet.get_agent_session(&agent_pk(&env)).cur_spent, 20, "rejected charge must not be counted");
}

#[test]
fn agent_window_resets_after_window_elapses() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10), Ok(true)));
    });
    // Advance >= 2W so the sliding window resets cleanly (prev_spent dropped).
    env.ledger().with_mut(|li| li.timestamp = 1_000 + 1_201);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10);
        assert!(matches!(r, Ok(true)), "new window must authorize: {:?}", r);
    });
    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.cur_spent, 10, "spend must reset on new window");
    assert_eq!(s.prev_spent, 0, "prev_spent must be dropped after >= 2W");
    assert_eq!(s.epoch_start, 1_000 + 1_201, "epoch must roll to current time");
}

#[test]
fn agent_rejects_revoked_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 10, 600, 25, 0);
    wallet.revoke_agent_session(&agent_pk(&env));

    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10);
        assert!(matches!(r, Err(Error::SessionRevoked)), "got {:?}", r);
    });
}

#[test]
fn install_agent_session_rejects_invalid_config() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let pk = agent_pk(&env);

    // A2: a non-empty allowlist is now mandatory, so config-invalidity tests
    // thread a valid recipient to isolate the config check under test.
    let (_to, allow) = one_recipient(&env);
    // per_tx_cap <= 0
    assert!(wallet.try_install_agent_session(&pk, &token, &0, &600, &25, &0, &allow).is_err());
    // window_cap < per_tx_cap (a single allowed tx can't fit the window)
    assert!(wallet.try_install_agent_session(&pk, &token, &10, &600, &5, &0, &allow).is_err());
    // window_seconds below floor — would silently disable the aggregate cap
    // (window rolls every call), collapsing to per-tx-only enforcement
    assert!(wallet.try_install_agent_session(&pk, &token, &10, &30, &25, &0, &allow).is_err());
    // expires_at already in the past
    assert!(wallet.try_install_agent_session(&pk, &token, &10, &600, &25, &500, &allow).is_err());
    // boundary valid config is accepted (window_cap == per_tx_cap, floor window)
    wallet.install_agent_session(&pk, &token, &10, &60, &10, &0, &allow);
}

// ──────────────────────────────────────────────────────────────────────
// A2: install_agent_session admin-blast-radius parity with the policy path
// ──────────────────────────────────────────────────────────────────────

#[test]
fn install_agent_session_rejects_empty_allowlist() {
    // A2.1: an open allowlist + a stolen hot key = drain to any address.
    // Reject an empty allowlist at install time.
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let pk = agent_pk(&env);

    let empty = Vec::new(&env);
    let r = wallet.try_install_agent_session(&pk, &token, &10, &600, &25, &0, &empty);
    assert!(r.is_err(), "empty allowlist must be rejected");
}

#[test]
fn install_agent_session_rejects_admin_in_allowlist() {
    // A2.2 (H3 analog): a compromised admin must not name itself as a
    // recipient and drain the wallet to itself via the agent path.
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    let admin = Address::generate(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &admin);
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let pk = agent_pk(&env);

    let allow = vec![&env, admin.clone()];
    let r = wallet.try_install_agent_session(&pk, &token, &10, &600, &25, &0, &allow);
    assert!(r.is_err(), "admin in allowlist must be rejected");
}

#[test]
fn install_agent_session_rejects_self_in_allowlist() {
    // A2.2 (H3 analog): the wallet's own address must not be an allowed
    // recipient (self-loop drain pattern).
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let pk = agent_pk(&env);

    let allow = vec![&env, id.clone()];
    let r = wallet.try_install_agent_session(&pk, &token, &10, &600, &25, &0, &allow);
    assert!(r.is_err(), "wallet self in allowlist must be rejected");
}

#[test]
fn install_agent_session_rejects_window_cap_above_multiplier() {
    // A2.3: a window can't be unboundedly larger than a single transfer.
    // window_cap <= per_tx_cap * MAX_WINDOW_MULTIPLIER (100).
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let pk = agent_pk(&env);
    let (_to, allow) = one_recipient(&env);

    // per_tx=10, window_cap=1001 → 1001 > 10*100, must reject.
    let r = wallet.try_install_agent_session(&pk, &token, &10, &600, &1_001, &0, &allow);
    assert!(r.is_err(), "window_cap > per_tx_cap*100 must be rejected");
    // per_tx=10, window_cap=1000 → boundary == 10*100, must accept.
    wallet.install_agent_session(&pk, &token, &10, &600, &1_000, &0, &allow);
}

#[test]
fn install_agent_session_accepts_valid_nonempty_allowlist() {
    // A2: the happy path — a valid non-empty allowlist install succeeds.
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let pk = agent_pk(&env);
    let (recipient, allow) = one_recipient(&env);

    wallet.install_agent_session(&pk, &token, &10, &600, &25, &0, &allow);
    let s = wallet.get_agent_session(&pk);
    assert_eq!(s.allow_recipients.len(), 1);
    assert_eq!(s.allow_recipients.get(0).unwrap(), recipient);
}

#[test]
fn agent_rejects_expired_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 10, 600, 25, 2_000);

    env.ledger().with_mut(|li| li.timestamp = 3_000);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 10);
        assert!(matches!(r, Err(Error::SessionExpired)), "got {:?}", r);
    });
}

fn session_with_allowlist(env: &Env, allow: Vec<Address>) -> super::AgentSession {
    super::AgentSession {
        session_pubkey: agent_pk(env),
        token: Address::generate(env),
        per_tx_cap: 10,
        window_seconds: 600,
        window_cap: 25,
        epoch_start: 0,
        cur_spent: 0,
        prev_spent: 0,
        expires_at: 0,
        revoked: false,
        allow_recipients: allow,
    }
}

#[test]
fn recipient_allowed_open_list_allows_any() {
    let env = Env::default();
    let s = session_with_allowlist(&env, Vec::new(&env));
    let anyone = Address::generate(&env);
    assert!(super::recipient_allowed(&s, &anyone), "empty allowlist must allow any recipient");
}

#[test]
fn recipient_allowed_restricts_to_listed() {
    let env = Env::default();
    let listed = Address::generate(&env);
    let other = Address::generate(&env);
    let s = session_with_allowlist(&env, vec![&env, listed.clone()]);
    assert!(super::recipient_allowed(&s, &listed), "listed recipient must be allowed");
    assert!(!super::recipient_allowed(&s, &other), "unlisted recipient must be rejected");
}

#[test]
fn agent_context_authorizes_allowed_recipient_within_budget() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = Address::generate(&env);
    wallet.install_agent_session(&agent_pk(&env), &token, &10, &600, &25, &0, &vec![&env, to.clone()]);

    let ctx = make_transfer_ctx(&env, &token, &id, &to, 10);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_context(&env, &agent_pk(&env), &ctx);
        assert!(matches!(r, Ok(true)), "allowed recipient within budget must authorize: {:?}", r);
    });
}

#[test]
fn agent_context_rejects_unlisted_recipient() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let listed = Address::generate(&env);
    let unlisted = Address::generate(&env);
    wallet.install_agent_session(&agent_pk(&env), &token, &10, &600, &25, &0, &vec![&env, listed.clone()]);

    let ctx = make_transfer_ctx(&env, &token, &id, &unlisted, 10);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_context(&env, &agent_pk(&env), &ctx);
        assert!(matches!(r, Err(Error::RecipientNotAllowed)), "got {:?}", r);
    });
}

#[test]
fn agent_context_ignores_non_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    install_session(&env, &wallet, &token, 10, 600, 25, 0);

    let ctx = ContractContext {
        contract: token,
        fn_name: Symbol::new(&env, "burn"),
        args: vec![&env, id.into_val(&env), 100i128.into_val(&env)],
    };
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_context(&env, &agent_pk(&env), &ctx);
        assert!(matches!(r, Ok(false)), "non-transfer must fall through: {:?}", r);
    });
}

// ──────────────────────────────────────────────────────────────────────
// A5: allowlist enforced AT the budget chokepoint, not only in the wrapper
// ──────────────────────────────────────────────────────────────────────

#[test]
fn agent_transfer_chokepoint_rejects_unlisted_recipient_directly() {
    // A5: even calling the budget chokepoint directly (bypassing the
    // context wrapper), a non-allowlisted recipient must be rejected.
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let listed = Address::generate(&env);
    let unlisted = Address::generate(&env);
    install_session_to(&env, &wallet, &token, 10, 600, 25, 0, &vec![&env, listed.clone()]);

    env.as_contract(&id, || {
        // listed recipient authorizes
        let ok = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &listed, 10);
        assert!(matches!(ok, Ok(true)), "listed recipient must authorize: {:?}", ok);
        // unlisted recipient rejected at the chokepoint itself
        let bad = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &unlisted, 10);
        assert!(matches!(bad, Err(Error::RecipientNotAllowed)), "got {:?}", bad);
    });
    // the rejected unlisted transfer must not have consumed budget
    assert_eq!(wallet.get_agent_session(&agent_pk(&env)).cur_spent, 10, "only the listed transfer counts");
}

// ──────────────────────────────────────────────────────────────────────
// A3: sliding-window counter bounds the 2x-burst across an epoch boundary
// ──────────────────────────────────────────────────────────────────────

#[test]
fn agent_sliding_window_bounds_2x_burst_across_boundary() {
    // Spend window_cap near the end of an epoch, then immediately after the
    // boundary a second window_cap must be REJECTED: the weighted estimate
    // from the previous epoch still counts at the start of the new epoch.
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    // W = 600, window_cap = 100, per_tx = 100.
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 100, 600, 100, 0);

    // Spend the full window_cap at the very start of epoch [1000, 1600).
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 100);
        assert!(matches!(r, Ok(true)), "first full spend must authorize: {:?}", r);
    });

    // Cross the boundary into the adjacent epoch. At now=1600 the epoch rolls
    // (elapsed = 600 >= W, < 2W): prev_spent <- 100, cur_spent <- 0,
    // epoch_start <- 1600, elapsed_in_epoch = 0, weighted_prev = 100 at full
    // weight → estimate = 100, projected = 200 > window_cap 100 → must reject.
    // This is the core A3 guarantee: the immediate post-boundary burst is
    // bounded by the previous epoch's spend (no clean 2x).
    env.ledger().with_mut(|li| li.timestamp = 1_600);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 100);
        assert!(matches!(r, Err(Error::WindowCapExceeded)), "2x burst across boundary must be bounded: {:?}", r);
    });
    // A full window_cap remains inadmissible right up until the previous epoch
    // fully decays (>= 2W from the original spend at 1000).
    env.ledger().with_mut(|li| li.timestamp = 2_199); // elapsed 1199 < 2W
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 100);
        assert!(matches!(r, Err(Error::WindowCapExceeded)),
            "full window_cap before 2W must still be bounded: {:?}", r);
    });
}

#[test]
fn agent_sliding_window_decays_prev_epoch_linearly() {
    // Prove the weighted estimate decays linearly across the adjacent epoch:
    // a charge that crosses the boundary rolls the epoch (prev_spent carries
    // the old spend), then a partial charge that fits the *decayed* estimate
    // is admitted partway through the new epoch.
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    // W = 1000, window_cap = 100, per_tx = 100.
    env.ledger().with_mut(|li| li.timestamp = 0);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 100, 1_000, 100, 0);

    // Spend 80 in epoch [0, 1000).
    env.as_contract(&id, || {
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 80), Ok(true)));
    });

    // At now=1500: elapsed=1500 >= W, < 2W → roll: prev_spent=80, cur_spent=0,
    // epoch_start=1500. elapsed_in_epoch=0 → weighted_prev = 80*(1000-0)/1000 =
    // 80. A 20-unit charge: projected = 80 + 20 = 100 == cap → admitted; a
    // 21-unit charge would be 101 > 100 → rejected. Test the boundary by first
    // rejecting 21, then admitting 20.
    env.ledger().with_mut(|li| li.timestamp = 1_500);
    env.as_contract(&id, || {
        // 21 over the decayed budget at fraction 0 → reject (does not roll/persist)
        let over = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 21);
        assert!(matches!(over, Err(Error::WindowCapExceeded)), "got {:?}", over);
        // 20 exactly fits → admit, rolls epoch and persists
        let ok = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 20);
        assert!(matches!(ok, Ok(true)), "20 fits decayed budget: {:?}", ok);
    });
    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.prev_spent, 80, "prev epoch carried");
    assert_eq!(s.cur_spent, 20, "current epoch charged");
    assert_eq!(s.epoch_start, 1_500);

    // Now at now=2000 (halfway into epoch [1500,2500), elapsed_in_epoch=500):
    // weighted_prev = 80 * (1000-500)/1000 = 40; estimate = 40 + 20 = 60;
    // a 40-unit charge → projected 100 == cap → admitted (decay freed budget).
    env.ledger().with_mut(|li| li.timestamp = 2_000);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 40);
        assert!(matches!(r, Ok(true)), "decayed prev weight frees budget mid-epoch: {:?}", r);
    });
}

#[test]
fn agent_sliding_window_resets_after_two_windows() {
    // A full window later (>= 2W elapsed), prev_spent is dropped and the
    // window resets cleanly.
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    let to = install_session(&env, &wallet, &token, 100, 600, 100, 0);

    env.as_contract(&id, || {
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 100), Ok(true)));
    });
    // Jump >= 2W ahead: 1000 + 1200 = 2200.
    env.ledger().with_mut(|li| li.timestamp = 2_200);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, 100);
        assert!(matches!(r, Ok(true)), "clean reset after >=2W must authorize: {:?}", r);
    });
    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.cur_spent, 100);
    assert_eq!(s.prev_spent, 0, "prev_spent dropped after >= 2W");
    assert_eq!(s.epoch_start, 2_200);
}

#[test]
fn agent_sliding_window_hard_ceiling_caps_delayed_straddle() {
    // N-A3. The weighted estimate counts cur_spent at full weight regardless of
    // *when* in the epoch it was spent, so a "delayed straddle" (spend late in
    // one epoch, roll, spend early in the next) places spend > window_cap into a
    // single real W-length interval while the weighted estimate stays <= cap.
    // The fix adds a hard UN-weighted ceiling: prev_spent + cur_spent + amount
    // <= 2 * window_cap, making the worst-case real-window spend provably bounded
    // by 2 * window_cap.
    //
    // Part 1 — public-API reproduction of the auditor's exact delayed-straddle
    // schedule (W=12, cap=12, per_tx=12, scaled x5 because install enforces
    // window_seconds >= 60: W=60, timestamps x5, amounts unchanged). It confirms
    // the under-bound (real-window spend 6+1+6=13 > cap=12) AND that the on-chain
    // un-weighted state never exceeds 2*cap.
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    let token = Address::generate(&env);
    env.ledger().with_mut(|li| li.timestamp = 60);
    let to = install_session(&env, &wallet, &token, 12, 60, 12, 0);

    // Auditor steps, scaled x5: t=60 amt=1, t=110 amt=6, t=125 amt=1 (rolls into
    // epoch2: prev<-7), t=145 amt=6. All admitted by the weighted estimate.
    for (t, a) in [(60u64, 1i128), (110, 6), (125, 1), (145, 6)] {
        env.ledger().with_mut(|li| li.timestamp = t);
        env.as_contract(&id, || {
            let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, &to, a);
            assert!(matches!(r, Ok(true)), "straddle step t={} amt={} must admit: {:?}", t, a, r);
        });
    }
    let s = wallet.get_agent_session(&agent_pk(&env));
    // Real-time window [110,170) (width W=60) captured 6 + 1 + 6 = 13 > cap 12:
    // the documented under-bound. But prev+cur stays well inside 2*cap.
    assert_eq!(s.prev_spent, 7, "epoch1 spend carried");
    assert_eq!(s.cur_spent, 7, "epoch2 spend accumulated");
    assert!(
        s.prev_spent + s.cur_spent <= 2 * s.window_cap,
        "un-weighted state must stay <= 2*window_cap: {} > {}",
        s.prev_spent + s.cur_spent,
        2 * s.window_cap
    );

    // Part 2 — the hard ceiling REJECTS. Through valid install+authorize the
    // invariants prev<=cap, cur<=cap, amount<=cap keep prev+cur+amount <= 2*cap,
    // so the ceiling is a defense-in-depth guard: it bites only if some state has
    // prev_spent above window_cap. Construct exactly that state directly (the same
    // direct-struct pattern used elsewhere in this file) — far into the epoch so
    // the weighted estimate has decayed to ~0 and would ADMIT, while the
    // un-weighted ceiling must REJECT. Pre-fix (no ceiling) this returned Ok(true);
    // post-fix it must be WindowCapExceeded.
    let (to2, allow2) = one_recipient(&env);
    let token2 = Address::generate(&env);
    let straddled = super::AgentSession {
        session_pubkey: agent_pk(&env),
        token: token2.clone(),
        per_tx_cap: 12,
        window_seconds: 60,
        window_cap: 12,
        epoch_start: 1_000,
        cur_spent: 0,
        // prev_spent inflated above window_cap (the only way the ceiling binds
        // tighter than the weighted check): models a worst-case straddle residue
        // the ceiling must contain.
        prev_spent: 20,
        expires_at: 0,
        revoked: false,
        allow_recipients: allow2,
    };
    env.as_contract(&id, || {
        let key = super::DataKey::AgentSession(agent_pk(&env));
        env.storage().persistent().set(&key, &straddled);
    });
    // now = 1_059: elapsed_in_epoch = 59, remaining = 1, weighted_prev =
    // floor(20*1/60) = 0 → weighted estimate = 0 + 12 = 12 == cap → ADMITS.
    // Un-weighted: prev+cur+amount = 20 + 0 + 12 = 32 > 2*cap (24) → ceiling REJECTS.
    env.ledger().with_mut(|li| li.timestamp = 1_059);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token2, &to2, 12);
        assert!(
            matches!(r, Err(Error::WindowCapExceeded)),
            "hard 2x ceiling must reject the over-2*window_cap straddle the weighted check admits: {:?}",
            r
        );
    });
    // Boundary: a charge that lands exactly at 2*cap is admitted (steady-state
    // sits at the ceiling). prev+cur+amount = 20 + 0 + 4 = 24 == 2*cap → admit.
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token2, &to2, 4);
        assert!(matches!(r, Ok(true)), "exactly 2*window_cap must admit: {:?}", r);
    });
}

// ──────────────────────────────────────────────────────────────────────
// A1: extracted pull-policy helper, tested multi-context
// ──────────────────────────────────────────────────────────────────────

#[test]
fn pull_policy_authorizes_multi_context_all_match() {
    // Two transfer contexts, each matching its own active policy → the pull
    // path authorizes (Ok(true)).
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let m1 = Address::generate(&env);
    let m2 = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&m1, &token, &100, &150, &60, &0);
    wallet.install_policy(&m2, &token, &100, &150, &60, &0);

    let ctxs: Vec<Context> = vec![
        &env,
        Context::Contract(make_transfer_ctx(&env, &token, &id, &m1, 100)),
        Context::Contract(make_transfer_ctx(&env, &token, &id, &m2, 100)),
    ];
    env.as_contract(&id, || {
        let r = super::pull_policy_authorizes(&env, &ctxs);
        assert!(matches!(r, Ok(true)), "both contexts match → authorize: {:?}", r);
    });
}

#[test]
fn pull_policy_authorizes_multi_context_one_unmatched() {
    // One matching context + one with no policy → not all-match (Ok(false)).
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let m1 = Address::generate(&env);
    let unknown = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&m1, &token, &100, &150, &60, &0);

    let ctxs: Vec<Context> = vec![
        &env,
        Context::Contract(make_transfer_ctx(&env, &token, &id, &m1, 100)),
        Context::Contract(make_transfer_ctx(&env, &token, &id, &unknown, 100)),
    ];
    env.as_contract(&id, || {
        let r = super::pull_policy_authorizes(&env, &ctxs);
        assert!(matches!(r, Ok(false)), "one unmatched context → not all-match: {:?}", r);
    });
}

#[test]
fn pull_policy_authorizes_propagates_policy_violation_err() {
    // A context that matches a policy that EXISTS but is violated (over cap)
    // must propagate Err, not fall through to Ok(false).
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let m1 = Address::generate(&env);
    let token = Address::generate(&env);
    wallet.install_policy(&m1, &token, &100, &150, &60, &0);

    let ctxs: Vec<Context> = vec![
        &env,
        Context::Contract(make_transfer_ctx(&env, &token, &id, &m1, 500)), // over cap 150
    ];
    env.as_contract(&id, || {
        let r = super::pull_policy_authorizes(&env, &ctxs);
        assert!(matches!(r, Err(Error::AmountExceedsCap)), "policy violation must propagate Err: {:?}", r);
    });
}
