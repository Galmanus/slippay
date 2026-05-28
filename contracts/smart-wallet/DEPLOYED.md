# Slippay Smart Wallet Contract — deployed

## v0.1 · TESTNET (M4 spike verification · 2026-05-28)

**Template contract address**: `CAAS2RFE7UQGZBEXJRAO7RKW33GMRGMKPJ6JZAAI27JYTU4PYGYWP26V`
**Stellar.expert**: https://stellar.expert/explorer/testnet/contract/CAAS2RFE7UQGZBEXJRAO7RKW33GMRGMKPJ6JZAAI27JYTU4PYGYWP26V
**Wasm hash**: `7c6849618c659421fb04b165490fbca6845e9300cc4bce9aded5a8c86c2e8477`
**Wasm size**: 11569 bytes (lean — single passkey signer, single token type per policy, no recovery, no quorum)
**Deployer**: `GDYKSPEDSST4YSSMNW6LMK27XN6YMM4SEN4RAKCCFT3N74GWPGXAJPQT` (slippay-deployer · same key as subscription deploy)
**Soroban SDK**: 26 · **Stellar protocol**: 26
**Build target**: `wasm32v1-none` (mandatory for soroban-sdk 26 + Rust 1.82+)
**Unit tests**: 13/13 passing (`cargo test --release`)

## Per-user instance model

The template contract above is a single deployed instance, kept for
verification. Per-user wallets are instantiated client-side: the frontend
deploys a fresh contract instance of the same wasm hash, then calls
`init(passkey_pubkey: BytesN<65>, passkey_cred_id: BytesN<32>)` with the
user's freshly-created WebAuthn credential. Each user gets a unique
contract id; the wasm bytecode is shared.

## Contract surface

| function | auth | effect |
|---|---|---|
| `init(passkey_pubkey, passkey_cred_id)` | none (one-shot) | persists passkey for this wallet, emits `wallet_initialized` |
| `install_policy(merchant, token, amount, max, interval, expires_at)` | wallet (passkey sig) | grants merchant pull rights bounded by the policy, emits `policy_installed` |
| `revoke_policy(merchant)` | wallet (passkey sig) | flips `revoked=true`, all future pulls under that policy fail, emits `policy_revoked` |
| `get_policy(merchant)` | none (read) | returns the Policy struct for the frontend's guarantee panel |
| `__check_auth(payload, sig, contexts)` | (custom account interface) | authorizes context-by-context: policy-matched contexts skip the passkey, anything else requires a valid secp256r1 signature |

## Composition with `slippay-subscription` v0.2

This wallet is designed to be the `buyer` argument in calls to the
production-deployed slippay-subscription mainnet contract
(`CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN`). When the
merchant calls `slippay-subscription.charge(id)`, the nested
`token.transfer(buyer, merchant, amount)` triggers this wallet's
`__check_auth`. If a matching policy exists, the pull is authorized
without consulting the passkey — that is the "no extra tap" property
that satisfies the Pix-tier UX bar of the
[policy-checkout product spec](../../docs/product/policy-checkout-spec.md).

## Properties enforced on-chain (the moat over Stripe)

- **Per-merchant exact-match**: only the address stored in `policy.merchant`
  may pull. Other addresses fall through to passkey signature requirement.
- **Per-charge hard cap**: `amount > policy.max_per_charge` → reject
  (`AmountExceedsCap`).
- **Interval enforcement**: pulls within `interval_seconds` of the previous
  successful pull → reject (`PeriodNotElapsed`).
- **User-only revocation**: `policy.revoked = true` is settable only via
  `revoke_policy` which requires the wallet's own auth (i.e., passkey).
  Slippay backend, merchant, and validators cannot flip this flag.
- **Optional expiry**: `policy.expires_at` auto-revokes after the timestamp.
- **TTL extension**: every persistent `set` extends TTL to ~31 days (host
  clamps to network max), mirroring the audit-002 F1 pattern from
  slippay-subscription.

## v0.1 limitations (explicitly deferred)

- Single signer (one passkey per wallet). v0.2 will add multi-signer +
  weighted quorums + recovery via secondary passkey.
- WebAuthn unwrapping (authenticatorData + clientDataJSON binding) is
  deferred to v0.2. The v0.1 frontend passes a raw secp256r1 signature
  over the host-provided payload digest.
- No multi-token-per-policy. One policy authorizes one (merchant, token)
  pair. v0.2 may add allowlists.
- No audit (third-party or OpenZeppelin). v0.1 is a spike — not for
  mainnet funds with live customers.

## Reproduce

```sh
cd contracts/smart-wallet
bash deploy-testnet.sh
# .testnet-deploy.env will hold CONTRACT_ID + WASM_HASH for backend integration.
```

## Status this is enabling

This deploy is M4a + M4b of the policy-checkout sprint (see
`docs/product/policy-checkout-spec.md`). M4c (apps/web checkout page) and
M4d (WebAuthn flow + per-user instance deploy from the browser) follow.
Rio Stellar 37 Graus demo target: 2026-06-08.
