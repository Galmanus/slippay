# Slippay Subscription Contract — deployed Stellar testnet

**Deployed**: 2026-05-10
**Contract address**: `CBWJ3LQGO7HBZBQK2MGS75EK266HNW4RJS77BVZIGZGDUUENXQMSHRHA`
**Stellar.expert**: https://stellar.expert/explorer/testnet/contract/CBWJ3LQGO7HBZBQK2MGS75EK266HNW4RJS77BVZIGZGDUUENXQMSHRHA
**Wasm hash**: `dbf7633d724ca1ed23d9ee1452fe182bd5da627ff6db73fe296ea0c55b09e465`
**Soroban SDK**: 26 · **Stellar protocol**: 26
**Source**: `contracts/subscription/src/lib.rs`
**Unit tests**: 5/5 passing (`cargo test --release`)

## Live demo proof

Verified end-to-end on Stellar testnet:

| operation | tx hash | events emitted |
|---|---|---|
| deploy | [`fbfdbb66...`](https://stellar.expert/explorer/testnet/tx/fbfdbb66b8894539f8db2a928f8925f3bb47903ede65d4541b939d6568b545df) | contract instantiated |
| `create()` | [`8ed4fa21...`](https://stellar.expert/explorer/testnet/tx/8ed4fa21923d5433c31663a5e6b43cea8490844682682ba91e228683beedea4a) | `subscription_created(buyer, [nonce, amount, period])` |
| `charge()` | [`688c985a...`](https://stellar.expert/explorer/testnet/tx/688c985a4508ce9599a6430b1a004e265e7d60ca20eb28f4b605700b0dd5980b) | `transfer(buyer, merchant, 10000000, native)` from SAC<br>`subscription_charged(buyer, merchant, [nonce, amount, charges_done=1, next_due])` from contract |

### Demo parameters

```
buyer:       GC6HUYDR3N5PGR2ONPYA5G54HHTGT3PN4X4Q2YZELA4F7QSPHMOUQWXP
merchant:    GAE5HOWKZVVL5AOZQVJOZFY2ZB7Z2YK6PV4UKWOWB3KQWQCHY2PBVJMM
token:       CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC  (native XLM SAC)
amount:      10_000_000  (1.0 XLM with 7 decimals)
period:      86400 seconds (1 day)
max_periods: 12
```

### Balance proof

```
                  before charge        after charge       delta
buyer:    9999.9871928 XLM   →   9998.9852335 XLM   -1.0019593 (1.0 payment + 0.0019593 fee)
merchant: 10000.0000000 XLM  →   10001.0000000 XLM  +1.0000000 (received exactly)
```

The contract atomically debits buyer and credits merchant in a single
transaction. No off-chain reconciliation needed.

## Reproduce

```sh
# 1. Install stellar-cli 26+
# (precompiled binary from github.com/stellar/stellar-cli/releases/v26.0.0)
curl -fsSL -o /tmp/stellar-cli.tar.gz \
  https://github.com/stellar/stellar-cli/releases/download/v26.0.0/stellar-cli-26.0.0-x86_64-unknown-linux-gnu.tar.gz
tar xzf /tmp/stellar-cli.tar.gz -C ~/.local/bin/

# 2. Add wasm target
rustup target add wasm32v1-none

# 3. Build + deploy
cd contracts/subscription
cargo build --target wasm32v1-none --release
WASM=$(pwd)/target/wasm32v1-none/release/slippay_subscription.wasm
stellar keys generate slippay-deployer --network testnet --fund
CONTRACT=$(stellar contract deploy --network testnet --source slippay-deployer --wasm "$WASM" 2>&1 | tail -1)
echo $CONTRACT

# 4. Demo: buyer + merchant + native XLM SAC
stellar keys generate buyer --network testnet --fund
stellar keys generate merchant --network testnet --fund
BUYER=$(stellar keys address buyer)
MERCHANT=$(stellar keys address merchant)
NATIVE_SAC=$(stellar contract id asset --asset native --network testnet)
NONCE=$(openssl rand -hex 32)

# create()
stellar contract invoke --network testnet --source buyer --id $CONTRACT \
  -- create --buyer $BUYER --merchant $MERCHANT --token $NATIVE_SAC \
  --amount 10000000 --period_seconds 86400 --max_periods 12 \
  --expires_at 0 --nonce $NONCE

# charge()
stellar contract invoke --network testnet --source buyer --id $CONTRACT \
  -- charge --id $NONCE
```

## Contract surface

| function | auth | effect |
|---|---|---|
| `create(buyer, merchant, token, amount, period_seconds, max_periods, expires_at, nonce)` | buyer | persists subscription, emits `subscription_created` |
| `charge(id)` | buyer | calls `token.transfer(buyer, merchant, amount)`, bumps `charges_done`, emits `subscription_charged` |
| `cancel(id)` | buyer | sets status=Cancelled, emits `subscription_cancelled` |
| `pause(id)` / `resume(id)` | merchant | flips status Active ↔ Paused |
| `mark_expired(id)` | anyone (idempotent) | sets status=Expired if expires_at passed or max_periods reached |
| `get(id)` | none (read) | returns Subscription struct |

### Idempotency contract

- `charge()` panics with `PeriodNotElapsed` if called before `last_charge_at + period_seconds`. Re-running the scheduler within the same period is safe — no double charge.
- `cancel()` returns silently if already cancelled.
- `mark_expired()` returns `false` if no terminal condition holds (status preserved).

## Security notes

- v0.1: buyer signs each charge (top-level `require_auth` on charge).
  Buyer UX requires wallet interaction per cycle.
- v0.2 plan: replace top-level buyer auth with pre-authorization signature
  attached to the contract invocation, allowing the off-chain scheduler
  (slippay backend) to call charge without buyer wallet interaction.
- Contract has NOT been audited. Do not use with mainnet funds until
  audit is complete (see SCF M4 deliverable in `docs/scf/`).
- All state mutations follow Soroban panic-reverts-state semantics:
  status changes that need to persist when conditions are bad (expiry,
  max_periods reached) are exposed via separate `mark_expired` rather
  than baked into `charge`.

## Status this is enabling

This deploy is the M1 deliverable (contract + tests + on-chain proof) of
the Soroban subscription roadmap documented in
`docs/scf/soroban-subscription-proposal.md`. M2 (TypeScript SDK +
wallet matrix), M3 (mainnet + 5 demo merchants), M4 (audit + open-source)
remain.
