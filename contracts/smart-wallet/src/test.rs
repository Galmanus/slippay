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
    auth::ContractContext,
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

#[test]
fn install_and_get_agent_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));

    let token = Address::generate(&env);
    wallet.install_agent_session(
        &agent_pk(&env),
        &token,
        &10_000_000,   // per_tx_cap 10 USDC
        &86_400,       // 24h window
        &50_000_000,   // window_cap 50 USDC
        &0,            // no expiry
        &Vec::new(&env),
    );

    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.session_pubkey, agent_pk(&env));
    assert_eq!(s.token, token);
    assert_eq!(s.per_tx_cap, 10_000_000);
    assert_eq!(s.window_seconds, 86_400);
    assert_eq!(s.window_cap, 50_000_000);
    assert_eq!(s.window_spent, 0);
    assert_eq!(s.expires_at, 0);
    assert!(!s.revoked);
    assert_eq!(s.allow_recipients.len(), 0, "default allowlist is open");
}

fn install_session(env: &Env, wallet: &SmartWalletClient, token: &Address, per_tx: i128, window_s: u64, window_cap: i128, expires_at: u64) {
    wallet.install_agent_session(&agent_pk(env), token, &per_tx, &window_s, &window_cap, &expires_at, &Vec::new(env));
}

#[test]
fn agent_authorizes_within_caps_and_tracks_spend() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10);
        assert!(matches!(r, Ok(true)), "within caps must authorize: {:?}", r);
    });
    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.window_spent, 10, "spend must be tracked");
    assert_eq!(s.window_start, 1_000);
}

#[test]
fn agent_rejects_over_per_tx_cap() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 11);
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
    install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10), Ok(true)));
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10), Ok(true)));
        // 20 + 10 = 30 > window_cap 25 → reject, leaving spent at 20.
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10);
        assert!(matches!(r, Err(Error::WindowCapExceeded)), "got {:?}", r);
    });
    assert_eq!(wallet.get_agent_session(&agent_pk(&env)).window_spent, 20, "rejected charge must not be counted");
}

#[test]
fn agent_window_resets_after_window_elapses() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    install_session(&env, &wallet, &token, 10, 600, 25, 0);

    env.as_contract(&id, || {
        assert!(matches!(super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10), Ok(true)));
    });
    // Advance past the window.
    env.ledger().with_mut(|li| li.timestamp = 1_000 + 601);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10);
        assert!(matches!(r, Ok(true)), "new window must authorize: {:?}", r);
    });
    let s = wallet.get_agent_session(&agent_pk(&env));
    assert_eq!(s.window_spent, 10, "spend must reset on new window");
    assert_eq!(s.window_start, 1_601, "window must roll to current time");
}

#[test]
fn agent_rejects_revoked_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    install_session(&env, &wallet, &token, 10, 600, 25, 0);
    wallet.revoke_agent_session(&agent_pk(&env));

    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10);
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

    let open = Vec::new(&env);
    // per_tx_cap <= 0
    assert!(wallet.try_install_agent_session(&pk, &token, &0, &600, &25, &0, &open).is_err());
    // window_cap < per_tx_cap (a single allowed tx can't fit the window)
    assert!(wallet.try_install_agent_session(&pk, &token, &10, &600, &5, &0, &open).is_err());
    // window_seconds below floor — would silently disable the aggregate cap
    // (window rolls every call), collapsing to per-tx-only enforcement
    assert!(wallet.try_install_agent_session(&pk, &token, &10, &30, &25, &0, &open).is_err());
    // expires_at already in the past
    assert!(wallet.try_install_agent_session(&pk, &token, &10, &600, &25, &500, &open).is_err());
    // boundary valid config is accepted (window_cap == per_tx_cap, floor window)
    wallet.install_agent_session(&pk, &token, &10, &60, &10, &0, &open);
}

#[test]
fn agent_rejects_expired_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (id, wallet) = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env), &Address::generate(&env));
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let token = Address::generate(&env);
    install_session(&env, &wallet, &token, 10, 600, 25, 2_000);

    env.ledger().with_mut(|li| li.timestamp = 3_000);
    env.as_contract(&id, || {
        let r = super::try_authorize_agent_transfer(&env, &agent_pk(&env), &token, 10);
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
        window_start: 0,
        window_spent: 0,
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
