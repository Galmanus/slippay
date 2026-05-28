//! M2 spike tests for slippay-smart-wallet.
//!
//! These tests use `mock_all_auths_allowing_non_root_auth` so the v0.1
//! `__check_auth` stub is exercised without a real secp256r1 signature.
//! Real signature verification lands in M3.

#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn deploy(env: &Env) -> SmartWalletClient {
    let id = env.register(SmartWallet, ());
    SmartWalletClient::new(env, &id)
}

fn dummy_pubkey(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, &[1u8; 64])
}

fn dummy_cred_id(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[2u8; 32])
}

#[test]
fn init_persists_passkey() {
    let env = Env::default();
    let wallet = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env));
    // A second init must panic.
    let res = wallet.try_init(&dummy_pubkey(&env), &dummy_cred_id(&env));
    assert!(res.is_err());
}

#[test]
fn install_and_get_policy() {
    let env = Env::default();
    env.mock_all_auths();

    let wallet = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env));

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

    let wallet = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env));

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
    let wallet = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env));

    let merchant = Address::generate(&env);
    let token = Address::generate(&env);

    // amount <= 0
    assert!(wallet.try_install_policy(&merchant, &token, &0, &10, &60, &0).is_err());
    // max < amount
    assert!(wallet.try_install_policy(&merchant, &token, &10, &5, &60, &0).is_err());
    // interval too short
    assert!(wallet.try_install_policy(&merchant, &token, &10, &10, &30, &0).is_err());
}

#[test]
fn revoke_nonexistent_policy_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let wallet = deploy(&env);
    wallet.init(&dummy_pubkey(&env), &dummy_cred_id(&env));

    let merchant = Address::generate(&env);
    assert!(wallet.try_revoke_policy(&merchant).is_err());
}
