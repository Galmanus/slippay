//! Slippay Subscription Contract — Soroban primitive for recurring payments on Stellar.
//!
//! The buyer pre-authorizes the contract to debit a fixed amount of a SEP-41
//! token from their account at a configured period. Anyone can call `charge`
//! at or after the next due timestamp; the contract enforces:
//!   - status = Active
//!   - current ledger time >= last_charge_at + period_seconds
//!   - charges_done < max_periods (if set)
//!   - current ledger time < expiry (if set)
//!   - the buyer's auth chain on the underlying token.transfer
//!
//! Only the buyer can `cancel`. Only the merchant can `pause` / `resume`.
//!
//! v0.1 — single-asset, single-merchant subscription. v0.2 will add multi-asset
//! routing and pause-with-prorate.

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    Address, BytesN, Env, Symbol, IntoVal,
    token,
};

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
            // Initialize last_charge_at so that first charge is immediately
            // chargeable (caller decides whether to invoice now or wait).
            last_charge_at: env.ledger().timestamp().saturating_sub(period_seconds),
            status: Status::Active,
        };

        env.storage().persistent().set(&key, &sub);
        env.events().publish(
            (Symbol::new(&env, "subscription_created"), buyer),
            (nonce.clone(), sub.amount, sub.period_seconds),
        );
        nonce
    }

    /// Trigger the next charge. Anyone can call (including off-chain
    /// schedulers like the slippay backend), but the underlying
    /// token.transfer requires the buyer's auth — the buyer's pre-auth
    /// signature provides this when invoked via auth_as_buyer.
    pub fn charge(env: Env, id: BytesN<32>) -> u64 {
        let key = DataKey::Sub(id.clone());
        let mut sub: Subscription = env.storage().persistent().get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        if sub.status != Status::Active {
            panic_with_error!(&env, Error::NotActive);
        }

        let now = env.ledger().timestamp();
        if sub.expires_at != 0 && now >= sub.expires_at {
            sub.status = Status::Expired;
            env.storage().persistent().set(&key, &sub);
            panic_with_error!(&env, Error::Expired);
        }
        if now < sub.last_charge_at.saturating_add(sub.period_seconds) {
            panic_with_error!(&env, Error::PeriodNotElapsed);
        }
        if sub.max_periods != 0 && sub.charges_done >= sub.max_periods {
            sub.status = Status::Expired;
            env.storage().persistent().set(&key, &sub);
            panic_with_error!(&env, Error::MaxPeriodsReached);
        }

        // Execute the SEP-41 transfer. Buyer's authorization for this
        // specific (contract, token, amount, merchant) tuple must be present
        // in the host auth context — the buyer either signs the charge
        // invocation directly or pre-authorizes via account-side smart wallet.
        let client = token::Client::new(&env, &sub.token);
        client.transfer(&sub.buyer, &sub.merchant, &sub.amount);

        sub.charges_done += 1;
        sub.last_charge_at = now;
        let next_due = now.saturating_add(sub.period_seconds);

        // If this hit max_periods, mark expired so subsequent calls fail fast.
        if sub.max_periods != 0 && sub.charges_done >= sub.max_periods {
            sub.status = Status::Expired;
        }

        env.storage().persistent().set(&key, &sub);
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
        if sub.status == Status::Cancelled {
            return;
        }
        sub.status = Status::Cancelled;
        env.storage().persistent().set(&key, &sub);
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
        env.events().publish(
            (Symbol::new(&env, "subscription_resumed"), sub.merchant.clone()),
            id,
        );
    }

    pub fn get(env: Env, id: BytesN<32>) -> Subscription {
        env.storage().persistent().get(&DataKey::Sub(id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound))
    }
}

// soroban-sdk re-exports panic_with_error via macro from the prelude
use soroban_sdk::panic_with_error;

#[cfg(test)]
mod test;
