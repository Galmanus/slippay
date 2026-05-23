#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Ledger as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, IntoVal,
};

const DAY: u64 = 86_400;

struct Fixture<'a> {
    env: Env,
    contract: SubscriptionContractClient<'a>,
    buyer: Address,
    merchant: Address,
    token: Address,
    token_admin: Address,
    sac_admin: StellarAssetClient<'a>,
    sac_user: TokenClient<'a>,
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    // mock_all_auths_allowing_non_root_auth permits nested contract auth like
    // SAC.transfer requiring the buyer's auth — mock_all_auths alone only
    // mocks root-level calls and rejects sub-invocations.
    env.mock_all_auths_allowing_non_root_auth();

    let buyer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Issue a SAC-style asset (testutils mints freely via admin client).
    let issuer = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_addr = issuer.address();
    let sac_admin = StellarAssetClient::new(&env, &token_addr);
    let sac_user = TokenClient::new(&env, &token_addr);

    // Mint 1000 tokens to buyer so charges have funds.
    sac_admin.mint(&buyer, &1_000_000_000_i128); // 100 with 7 decimals

    let contract_id = env.register_contract(None, SubscriptionContract);
    let contract = SubscriptionContractClient::new(&env, &contract_id);

    Fixture {
        env, contract, buyer, merchant,
        token: token_addr, token_admin, sac_admin, sac_user,
    }
}

#[test]
fn create_then_charge_then_cancel() {
    let f = setup();
    let id = BytesN::from_array(&f.env, &[1u8; 32]);

    f.env.ledger().with_mut(|l| { l.timestamp = 1_000_000; });

    let returned_id = f.contract.create(
        &f.buyer, &f.merchant, &f.token,
        &10_000_000_i128, // 1.0 token
        &(30 * DAY), &12, &0, &id,
    );
    assert_eq!(returned_id, id);

    // First charge succeeds because last_charge_at is initialized to (now - period).
    let next = f.contract.charge(&id);
    assert_eq!(next, 1_000_000 + 30 * DAY);

    // Second charge same instant fails (PeriodNotElapsed).
    let res = f.contract.try_charge(&id);
    assert!(res.is_err());

    // Advance ledger 30 days.
    f.env.ledger().with_mut(|l| { l.timestamp += 30 * DAY; });
    let next2 = f.contract.charge(&id);
    assert_eq!(next2, 1_000_000 + 60 * DAY);

    // Buyer cancels.
    f.contract.cancel(&id);
    let sub = f.contract.get(&id);
    assert_eq!(sub.status, Status::Cancelled);
    assert_eq!(sub.charges_done, 2);

    // Charge after cancel fails.
    let res = f.contract.try_charge(&id);
    assert!(res.is_err());
}

#[test]
fn max_periods_caps_charges() {
    let f = setup();
    let id = BytesN::from_array(&f.env, &[2u8; 32]);

    f.env.ledger().with_mut(|l| { l.timestamp = 1_000_000; });

    f.contract.create(
        &f.buyer, &f.merchant, &f.token,
        &1_000_000_i128, &(7 * DAY), &3, &0, &id,
    );

    // 3 successful charges, then expiry.
    f.contract.charge(&id);
    f.env.ledger().with_mut(|l| { l.timestamp += 7 * DAY; });
    f.contract.charge(&id);
    f.env.ledger().with_mut(|l| { l.timestamp += 7 * DAY; });
    f.contract.charge(&id);

    let sub = f.contract.get(&id);
    assert_eq!(sub.charges_done, 3);
    assert_eq!(sub.status, Status::Expired);

    // Fourth charge fails.
    f.env.ledger().with_mut(|l| { l.timestamp += 7 * DAY; });
    let res = f.contract.try_charge(&id);
    assert!(res.is_err());
}

#[test]
fn pause_blocks_charge_then_resume_unblocks() {
    let f = setup();
    let id = BytesN::from_array(&f.env, &[3u8; 32]);

    f.env.ledger().with_mut(|l| { l.timestamp = 1_000_000; });
    f.contract.create(
        &f.buyer, &f.merchant, &f.token,
        &500_000_i128, &(14 * DAY), &0, &0, &id,
    );

    f.contract.charge(&id);

    // Merchant pauses.
    f.contract.pause(&id);
    f.env.ledger().with_mut(|l| { l.timestamp += 14 * DAY; });
    let res = f.contract.try_charge(&id);
    assert!(res.is_err());

    // Merchant resumes; charge succeeds again.
    f.contract.resume(&id);
    f.contract.charge(&id);
    let sub = f.contract.get(&id);
    assert_eq!(sub.charges_done, 2);
}

#[test]
fn expiry_terminates_subscription() {
    let f = setup();
    let id = BytesN::from_array(&f.env, &[4u8; 32]);
    f.env.ledger().with_mut(|l| { l.timestamp = 1_000_000; });

    let expires_at = 1_000_000 + 10 * DAY;
    f.contract.create(
        &f.buyer, &f.merchant, &f.token,
        &100_000_i128, &(2 * DAY), &0, &expires_at, &id,
    );

    f.contract.charge(&id);
    f.env.ledger().with_mut(|l| { l.timestamp = expires_at + 1; });

    // charge() panics with Expired but cannot persist status (panic reverts).
    let res = f.contract.try_charge(&id);
    assert!(res.is_err());

    // Sub status remains Active in storage; explicit mark_expired() persists.
    let changed = f.contract.mark_expired(&id);
    assert!(changed);
    let sub = f.contract.get(&id);
    assert_eq!(sub.status, Status::Expired);

    // mark_expired is idempotent.
    assert!(!f.contract.mark_expired(&id));
}

#[test]
fn charge_auth_binds_to_transfer_tuple() {
    // SOROBAN_SECURITY_v1 N3 (escalation of audit-002 F5):
    // buyer.require_auth_for_args at charge() binds the buyer's signed
    // payload to (id, token, merchant, amount). A wallet that signs the
    // wrong amount — even if the rest of the auth tree is correct — must
    // be rejected at the host level before token.transfer is reached.
    //
    // This test does NOT prove wallet UIs render the amount; that's the
    // mainnet sign-off step (real wallet, testnet charge). It proves the
    // contract-side binding is in place so a wallet bug cannot let a
    // mutated nested transfer payload succeed under a "looks-correct"
    // top-level sig.
    let f = setup();
    let id = BytesN::from_array(&f.env, &[7u8; 32]);

    f.env.ledger().with_mut(|l| { l.timestamp = 1_000_000; });

    // Create remains under the permissive env mock.
    let amount: i128 = 10_000_000;
    f.contract.create(
        &f.buyer, &f.merchant, &f.token,
        &amount, &(30 * DAY), &0, &0, &id,
    );

    // Strict auth: wrong amount in the signed payload — must reject.
    let bad_args = (
        id.clone(),
        f.token.clone(),
        f.merchant.clone(),
        amount + 1,
    ).into_val(&f.env);
    let res = f.contract
        .mock_auths(&[MockAuth {
            address: &f.buyer,
            invoke: &MockAuthInvoke {
                contract: &f.contract.address,
                fn_name: "charge",
                args: bad_args,
                sub_invokes: &[MockAuthInvoke {
                    contract: &f.token,
                    fn_name: "transfer",
                    args: (
                        f.buyer.clone(),
                        f.merchant.clone(),
                        amount,
                    ).into_val(&f.env),
                    sub_invokes: &[],
                }],
            },
        }])
        .try_charge(&id);
    assert!(res.is_err(), "auth bound to wrong amount must reject");

    // Strict auth: correct (id, token, merchant, amount) tuple + nested
    // transfer sub-invocation — must succeed.
    let good_args = (
        id.clone(),
        f.token.clone(),
        f.merchant.clone(),
        amount,
    ).into_val(&f.env);
    f.contract
        .mock_auths(&[MockAuth {
            address: &f.buyer,
            invoke: &MockAuthInvoke {
                contract: &f.contract.address,
                fn_name: "charge",
                args: good_args,
                sub_invokes: &[MockAuthInvoke {
                    contract: &f.token,
                    fn_name: "transfer",
                    args: (
                        f.buyer.clone(),
                        f.merchant.clone(),
                        amount,
                    ).into_val(&f.env),
                    sub_invokes: &[],
                }],
            },
        }])
        .charge(&id);

    let sub = f.contract.get(&id);
    assert_eq!(sub.charges_done, 1);
}

#[test]
fn invalid_config_rejected() {
    let f = setup();
    let id = BytesN::from_array(&f.env, &[5u8; 32]);
    let res = f.contract.try_create(
        &f.buyer, &f.merchant, &f.token,
        &0_i128, &(30 * DAY), &0, &0, &id,
    );
    assert!(res.is_err());

    let id2 = BytesN::from_array(&f.env, &[6u8; 32]);
    let res2 = f.contract.try_create(
        &f.buyer, &f.merchant, &f.token,
        &1_000_i128, &(60), &0, &0, &id2, // period < 1 day
    );
    assert!(res2.is_err());
}
