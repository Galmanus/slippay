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
    vec, Address, BytesN, Env, IntoVal, Symbol,
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
