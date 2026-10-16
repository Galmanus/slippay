# Arc agent payments: on-chain metrics (testnet)

Generated 2026-10-16T12:22:15.700Z from Arc testnet (chain 5042002) at block 67498302.
Every number is derived from `AgentSpend` events of the vaults in `docs/arc/vaults.json`.
Reproduce: `node packages/arc-agent/scripts/arc-metrics.mjs --network testnet`.

## Summary

| metric | all registered vaults | external (pilot) vaults |
|---|---:|---:|
| agent payments (AgentSpend events) | 2 | 0 |
| active wallets (vaults with >= 1 payment, all time) | 1 | 0 |
| active wallets, last 28 days | 1 | 0 |
| active days (distinct UTC dates with >= 1 payment) | 1 | 0 |
| volume (USDC) | 2.5 | 0 |

28-day window: 2026-09-18T12:22:15.700Z to 2026-10-16T12:22:15.700Z. Active UTC dates: 2026-10-13.

## Per vault

| vault | label | external | owner | payments | volume (USDC) | active days | first payment | last payment |
|---|---|---|---|---:|---:|---:|---|---|
| [`0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2`](https://explorer.testnet.arc.io/address/0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2) | slippay-e2e | no | `0x1cDB3F62257De815DDdAd3176e37Ff1F1916A735` | 2 | 2.5 | 1 | 2026-10-13T16:48:09.000Z | 2026-10-13T16:48:14.000Z |

## Payments

| time (UTC) | vault | tx | log | block | agentId | to | USDC |
|---|---|---|---:|---:|---:|---|---:|
| 2026-10-13T16:48:09.000Z | slippay-e2e | [`0x8cb9df02…5bbb`](https://explorer.testnet.arc.io/tx/0x8cb9df02fc39a4733f861ae30c22a2cc783806a6e2de44832d1fe50427aa5bbb) | 28 | 67019327 | 897273 | `0xb83a837083100c0A99bfc44693c177Ba0b31b393` | 0.5 |
| 2026-10-13T16:48:14.000Z | slippay-e2e | [`0x4c10777d…9691`](https://explorer.testnet.arc.io/tx/0x4c10777d86b8093d26e01905de7e4ce203912dd1e731989f27cd427f52ee9691) | 12 | 67019337 | 897273 | `0xb83a837083100c0A99bfc44693c177Ba0b31b393` | 2 |

## Method

- One payment = one `AgentSpend` log, keyed by (txHash, logIndex); duplicates are dropped. Reverted transactions emit no logs, so they never count.
- USDC `Transfer` logs are never read (on Arc one transfer emits two: the 18-decimal native log and the 6-decimal ERC-20 log). Amounts are `AgentSpend.amount`, 6 decimals.
- `eth_getLogs` per vault from its registry `fromBlock` to the latest block, 10000 blocks per call, filtered on topic0 `0x9ea5d6476f343b4e6156c9888553bf6c5c6cc7bc3da0f648a0b8bba450c013a8` (current AgentVault) and `0xb23766a70bdcd5c077e8109059bcb7d83253800574f0306b6f7d954160830602` (first deployed version, no `attested` field).
- Active wallet = vault with at least one payment. Active day = distinct UTC date (block timestamp) with at least one payment.
- `external: false` marks Slippay-owned vaults (demo, e2e, adversarial cases). They are listed for transparency and excluded from the external column.
- Before reading logs, each vault's code and immutable `owner()` are checked against the registry; a mismatch aborts the run.
