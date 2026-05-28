# Slippay Smart Wallet Contract — deployed

## v0.1 · TESTNET (M4d e2e proof · 2026-05-28)

**Template wasm hash**: `036fcfcb551fea56d88d1f0b8848535281b38cea3c97680187f77d8226e3c8cd`
**Template contract**: `CDC2OJU3RJSDCMWORR2UCYGRAWSGX7ZABFBOK7YYJATJEMKKGTVPRUDU`
**Stellar.expert**: https://stellar.expert/explorer/testnet/contract/CDC2OJU3RJSDCMWORR2UCYGRAWSGX7ZABFBOK7YYJATJEMKKGTVPRUDU
**Wasm size**: 11569 bytes
**Deployer**: `GDYKSPEDSST4YSSMNW6LMK27XN6YMM4SEN4RAKCCFT3N74GWPGXAJPQT`
**Soroban SDK**: 26 · **Stellar protocol**: 26 · **Build target**: `wasm32v1-none`
**Unit tests**: 13/13 passing (`cargo test --release`)

### Live e2e proof on testnet

End-to-end transaction trail demonstrating per-user wallet deploy +
init + policy install + on-chain read, all using the template wasm above:

| step | tx / contract | observable |
|---|---|---|
| `init(pubkey, cred_id)` on template | [tx `b4d8c5fe...`](https://stellar.expert/explorer/testnet/tx/b4d8c5fede2a80ec7e78f2da7fc017bd42315502d4fc4e9d40da4da548c0e3bd) | event `wallet_initialized(pubkey, cred_id)` |
| `install_policy(merchant, token, ...)` | [tx `8a526d2d...`](https://stellar.expert/explorer/testnet/tx/8a526d2dceb898cfbbdff8a2f02bcf06670e02106f9e5059aa71240369922532) | event `policy_installed(merchant, amount=29M, max=35M, interval=2592000, expires=0)` |
| `get_policy(merchant)` read | (simulation, no tx) | Policy struct returned: amount=29M, max=35M, interval=2592000, revoked=false, last_charge_at=0, expires_at=0, merchant=GAE5HOWK..., token=CDLZFC3S... |

The `policy_installed` event encodes the parameters that constrain the
merchant's future pulls. Any third party can index this event from the
contract address and reconstruct the active policy at any ledger.

## Per-user instance model

The template contract above is one deployed instance (used for the e2e
proof). Production per-user wallets are deployed by re-running
`deploy` against the same wasm hash; each user receives a unique
contract id but identical bytecode. See `demo-testnet.sh` for the full
flow.

## Contract surface

| function | v0.1 auth | effect |
|---|---|---|
| `init(passkey_pubkey, passkey_cred_id)` | none (one-shot) | persists the user's passkey material |
| `install_policy(merchant, token, amount, max, interval, expires_at)` | **none in v0.1 spike** (gap) | persists a per-merchant policy, emits `policy_installed` |
| `revoke_policy(merchant)` | **none in v0.1 spike** (gap) | flips `revoked=true`, emits `policy_revoked` |
| `get_policy(merchant)` | none (read) | returns the Policy struct |
| `__check_auth(payload, sig, contexts)` | (custom account interface) | policy-matched contexts return Ok without sig; everything else falls through to a v0.1 stub that checks `signature != 0` |

## ⚠️ v0.1 SPIKE GAPS · do not deploy to mainnet

Two cryptographic gaps are explicitly deferred to v0.2. **Mainnet
deployment is not authorized until both close.**

1. **install_policy / revoke_policy do not require_auth.** Anyone can
   install a policy on any wallet contract. The demo flow gates these
   calls at the application layer (`demo-testnet.sh` is the trusted
   setup oracle). v0.2 restores `env.current_contract_address().require_auth()`
   in both functions.

2. **`__check_auth` does not run `secp256r1_verify`.** Non-transfer
   contexts (i.e., calls that don't policy-match) are authorized as
   long as the signature blob is non-zero. v0.2 wires real WebAuthn
   passkey verification + secp256r1 over the host-provided payload.

What v0.1 already proves on-chain (and 13 unit tests cover):

- Per-merchant policy storage
- Per-charge hard cap enforcement (transfer above `max_per_charge` → reject)
- Interval enforcement (transfer before `last_charge_at + interval` → reject)
- Revoked policies block all subsequent merchant pulls
- Optional expiry auto-revokes
- Wrong-token transfers under same merchant → fall through (no policy match)
- Unknown-merchant transfers → fall through

These properties are the "Stripe-impossible" enforcement the policy-checkout
spec depends on. They are enforced by Soroban host execution semantics, not
by Slippay backend code.

## Composition with `slippay-subscription` v0.2

This wallet is intended to be the `buyer` argument in calls to the
production-deployed slippay-subscription mainnet contract
(`CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN`). When the
merchant calls `slippay-subscription.charge(id)`, the nested
`token.transfer(buyer, merchant, amount)` triggers this wallet's
`__check_auth`. If a matching policy exists, the pull is authorized
without consulting the passkey — that is the "no extra tap" property
demanded by the [policy-checkout product spec](../../docs/product/policy-checkout-spec.md).

## Reproduce

```sh
cd contracts/smart-wallet
bash deploy-testnet.sh        # uploads + deploys template, writes .testnet-deploy.env
bash demo-testnet.sh          # deploys a fresh per-user instance, init, install_policy, get_policy
```

## Status this is enabling

This deploy is M4a + M4b + M4d (e2e proof) of the policy-checkout
sprint. M4c (apps/web scaffold of `/s/:subId`) shipped separately.
M5 will wire the web page to an HTTP endpoint that runs the equivalent
of `demo-testnet.sh` per user. Rio Stellar 37 Graus demo target:
2026-06-08.
