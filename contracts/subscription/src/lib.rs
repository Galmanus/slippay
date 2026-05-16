//! Slippay Subscription Contract — Soroban primitive for recurring payments on Stellar.
//!
//! **v0.1 operating model.** The buyer must sign each `charge` invocation
//! (see `charge()` below — calls `buyer.require_auth()`). An off-chain
//! scheduler alone cannot trigger a charge; it must coordinate with the
//! buyer's wallet (smart-wallet session signer, WalletConnect, or equivalent)
//! to produce a fresh signature for every period. v0.2 will introduce a
//! pre-authorization primitive so the scheduler can charge autonomously
//! within a buyer-defined allowance — see audit-002 F4 for the rationale.
//!
//! The contract enforces:
//!   - status = Active
//!   - current ledger time >= last_charge_at + period_seconds
//!   - charges_done < max_periods (if set)
//!   - current ledger time < expiry (if set)
//!   - the buyer's auth chain on `charge` itself AND on the nested SEP-41
//!     `token.transfer` invocation
//!
//! Only the buyer can `cancel`. Only the merchant can `pause` / `resume`.
//!
//! TTL: every persistent `set` is followed by `extend_ttl` so a long-period
//! subscription survives idle gaps between charges (audit-002 F1). The
//! network host clamps to its protocol maximum; subs with periods longer
//! than that maximum require an external touch to keep the entry alive.
//!
//! v0.1 — single-asset, single-merchant subscription. v0.2 will add
//! pre-auth, multi-asset routing, and pause-with-prorate.

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    Address, BytesN, Env, Symbol,
    token,
};

// Audit-002 F1: TTL constants for persistent storage extension.
// Threshold: refresh when remaining lifetime drops below ~1 day of ledgers
// (5s ledger close). Target: extend to ~31 days — the host clamps to the
// network maximum so passing a larger value is safe.
const TTL_THRESHOLD_LEDGERS: u32 = 17_280;   // ~1 day at 5s/ledger
const TTL_TARGET_LEDGERS: u32 = 535_000;     // ~31 days at 5s/ledger (clamped by host)

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum Status {
    Active = 0,
    Paused = 1,
    Cancelled = 2,
    Expired = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Subscription {
    pub buyer: Address,
    pub merchant: Address,
    pub token: Address,        // SEP-41 token contract
    pub amount: i128,
    pub period_seconds: u64,
    pub max_periods: u32,      // 0 = unlimited until expiry
    pub expires_at: u64,       // 0 = no expiry
    pub charges_done: u32,
    pub last_charge_at: u64,
    pub status: Status,
}

#[contracttype]
pub enum DataKey {
    Sub(BytesN<32>),
    NextNonce,
    // Optional admin/fee config (left for v0.2)
}

#[contracterror]
#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    NotActive = 2,
    PeriodNotElapsed = 3,
    MaxPeriodsReached = 4,
    Expired = 5,
    Unauthorized = 6,
    InvalidConfig = 7,
}

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    /// Buyer authorizes a new subscription. Returns a deterministic 32-byte id.
    /// Both buyer and contract authentication are required at the host level
    /// (require_auth invocations).
    pub fn create(
        env: Env,
        buyer: Address,
        merchant: Address,
        token: Address,
        amount: i128,
        period_seconds: u64,
        max_periods: u32,
        expires_at: u64,
        nonce: BytesN<32>,
    ) -> BytesN<32> {
        buyer.require_auth();

        if amount <= 0 || period_seconds < 86_400 {
            panic_with_error!(&env, Error::InvalidConfig);
        }
        if expires_at != 0 && expires_at <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidConfig);
        }

        let key = DataKey::Sub(nonce.clone());
        if env.storage().persistent().has(&key) {
            // collision — caller must regenerate nonce
            panic_with_error!(&env, Error::InvalidConfig);
        }

        let sub = Subscription {
            buyer: buyer.clone(),
            merchant,
            token,
            amount,
            period_seconds,
            max_periods,
            expires_at,
            charges_done: 0,
            // 0 = sentinel "never charged" — first charge is always allowed.
            // We avoid saturating_sub here because period > now would underflow
            // and require_period_elapsed below would block the first charge.
            last_charge_at: 0,
            status: Status::Active,
        };

        env.storage().persistent().set(&key, &sub);
        // Audit-002 F1: extend TTL so long-period subs survive idle gaps.
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        // Audit-002 F8: include merchant, token, max_periods, expires_at so
        // indexers don't need a follow-up `get(id)` to reconstruct state.
        env.events().publish(
            (Symbol::new(&env, "subscription_created"), buyer),
            (nonce.clone(), sub.amount, sub.period_seconds, sub.merchant.clone(), sub.token.clone(), sub.max_periods, sub.expires_at),
        );
        nonce
    }

    /// Trigger the next charge.
    ///
    /// **v0.1 auth model (audit-002 F4):** the buyer must sign every charge.
    /// `buyer.require_auth()` is called below. An off-chain scheduler can
    /// submit the transaction, but the buyer must produce a fresh signature
    /// each time — via smart-wallet session, WalletConnect, or equivalent.
    /// v0.2 will replace this with a pre-auth allowance primitive.
    pub fn charge(env: Env, id: BytesN<32>) -> u64 {
        let key = DataKey::Sub(id.clone());
        let mut sub: Subscription = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        // Audit-002 F4 / F5: v0.1 requires the buyer to sign every charge.
        // Tests use mock_all_auths_allowing_non_root_auth which bypasses this
        // top-level requirement; mainnet sign-off must include at least one
        // end-to-end testnet charge with a real wallet signature to prove the
        // nested SAC.transfer auth chain works.
        sub.buyer.require_auth();

        if sub.status != Status::Active {
            panic_with_error!(&env, Error::NotActive);
        }

        let now = env.ledger().timestamp();
        // NOTE: panics in Soroban revert state changes. We therefore do NOT
        // try to set status=Expired before panicking — the change would be
        // rolled back. Callers who want to observe the terminal state should
        // call mark_expired(id), which mutates state without panicking when
        // the expiry conditions hold.
        if sub.expires_at != 0 && now >= sub.expires_at {
            panic_with_error!(&env, Error::Expired);
        }
        // last_charge_at == 0 → never charged → first charge always allowed.
        if sub.last_charge_at != 0 && now < sub.last_charge_at.saturating_add(sub.period_seconds) {
            panic_with_error!(&env, Error::PeriodNotElapsed);
        }
        if sub.max_periods != 0 && sub.charges_done >= sub.max_periods {
            panic_with_error!(&env, Error::MaxPeriodsReached);
        }

        // Execute the SEP-41 transfer. Buyer's authorization for this
        // specific (contract, token, amount, merchant) tuple must be present
        // in the host auth context — the buyer either signs the charge
        // invocation directly or pre-authorizes via account-side smart wallet.
        let client = token::Client::new(&env, &sub.token);
        client.transfer(&sub.buyer, &sub.merchant, &sub.amount);

        // Audit-002 F3: checked_add even with overflow-checks=true in release
        // — defends against future profile changes that flip the flag.
        sub.charges_done = sub.charges_done
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidConfig));
        sub.last_charge_at = now;
        let next_due = now.saturating_add(sub.period_seconds);

        // If this hit max_periods, mark expired so subsequent calls fail fast.
        if sub.max_periods != 0 && sub.charges_done >= sub.max_periods {
            sub.status = Status::Expired;
        }

        env.storage().persistent().set(&key, &sub);
        // Audit-002 F1: roll the TTL window forward on every successful charge.
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "subscription_charged"), sub.buyer.clone(), sub.merchant.clone()),
            (id, sub.amount, sub.charges_done, next_due),
        );
        next_due
    }

    pub fn cancel(env: Env, id: BytesN<32>) {
        let key = DataKey::Sub(id.clone());
        let mut sub: Subscription = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        sub.buyer.require_auth();
        // Audit-002 F6: cancel only transitions from Active or Paused. Both
        // Cancelled and Expired are terminal and must not emit a second event
        // or rewrite state.
        if sub.status != Status::Active && sub.status != Status::Paused {
            return;
        }
        sub.status = Status::Cancelled;
        env.storage().persistent().set(&key, &sub);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "subscription_cancelled"), sub.buyer.clone()),
            id,
        );
    }

    pub fn pause(env: Env, id: BytesN<32>) {
        let key = DataKey::Sub(id.clone());
        let mut sub: Subscription = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        sub.merchant.require_auth();
        if sub.status != Status::Active {
            panic_with_error!(&env, Error::NotActive);
        }
        sub.status = Status::Paused;
        env.storage().persistent().set(&key, &sub);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "subscription_paused"), sub.merchant.clone()),
            id,
        );
    }

    pub fn resume(env: Env, id: BytesN<32>) {
        let key = DataKey::Sub(id.clone());
        let mut sub: Subscription = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        sub.merchant.require_auth();
        if sub.status != Status::Paused {
            panic_with_error!(&env, Error::NotActive);
        }
        sub.status = Status::Active;
        env.storage().persistent().set(&key, &sub);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "subscription_resumed"), sub.merchant.clone()),
            id,
        );
    }

    pub fn get(env: Env, id: BytesN<32>) -> Subscription {
        env.storage().persistent().get(&DataKey::Sub(id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound))
    }

    /// Mark a subscription as Expired if its terminal conditions hold
    /// (expires_at passed OR max_periods reached). Anyone can call;
    /// idempotent. Returns true if state was changed, false otherwise.
    /// This exists because charge() cannot persist a status change while
    /// also panicking — Soroban panics revert state.
    pub fn mark_expired(env: Env, id: BytesN<32>) -> bool {
        let key = DataKey::Sub(id.clone());
        let mut sub: Subscription = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        if sub.status == Status::Expired || sub.status == Status::Cancelled {
            return false;
        }
        let now = env.ledger().timestamp();
        let expired_by_time = sub.expires_at != 0 && now >= sub.expires_at;
        let expired_by_count = sub.max_periods != 0 && sub.charges_done >= sub.max_periods;
        if !expired_by_time && !expired_by_count {
            return false;
        }
        sub.status = Status::Expired;
        env.storage().persistent().set(&key, &sub);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD_LEDGERS, TTL_TARGET_LEDGERS);
        env.events().publish(
            (Symbol::new(&env, "subscription_expired"), sub.buyer.clone()),
            id,
        );
        true
    }
}

// soroban-sdk re-exports panic_with_error via macro from the prelude
use soroban_sdk::panic_with_error;

#[cfg(test)]
mod test;
