# Arc agent payments: on-chain metrics (mainnet)

Generated 2026-10-20T16:17:52.801Z from Arc mainnet (chain 5042) at block 26970296.
Every number is derived from `AgentSpend` events of the vaults in `docs/arc/vaults.json`.
Reproduce: `node packages/arc-agent/scripts/arc-metrics.mjs --network mainnet`.

## Summary

| metric | all registered vaults | external (pilot) vaults |
|---|---:|---:|
| agent payments (AgentSpend events) | 2 | 0 |
| active wallets (vaults with >= 1 payment, all time) | 1 | 0 |
| active wallets, last 28 days | 1 | 0 |
| active days (distinct UTC dates with >= 1 payment) | 2 | 0 |
| volume (USDC) | 0.22 | 0 |

Of these, 1 payment(s), 0.12 USDC, went to a vault's own wallet (the agent's x402 float, `internalRecipients` in the registry): internal transfers, not payments to a counterparty.

28-day window: 2026-09-22T16:17:52.801Z to 2026-10-20T16:17:52.801Z. Active UTC dates: 2026-10-19, 2026-10-20.

## Per vault

| vault | label | external | owner | payments | volume (USDC) | active days | first payment | last payment |
|---|---|---|---|---:|---:|---:|---|---|
| [`0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8`](https://explorer.arc.io/address/0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8) | slippay-mainnet-pilot | no | `0xbB2822AcaF9196dAD98E24e4AaA6cFCb915c8F2c` | 2 | 0.22 | 2 | 2026-10-19T20:47:57.000Z | 2026-10-20T12:21:34.000Z |

## Payments

| time (UTC) | vault | tx | log | block | agentId | to | USDC |
|---|---|---|---:|---:|---:|---|---:|
| 2026-10-19T20:47:57.000Z | slippay-mainnet-pilot | [`0xd4fb46df…ac7b`](https://explorer.arc.io/tx/0xd4fb46dfe0d5322ef0274709208bee79ecbf3dfeee7928fbb86f225e1565ac7b) | 0 | 26831834 | 2579 | `0xe8BaF2DE286bbef788A97Bd30B34DD927683D239` | 0.1 |
| 2026-10-20T12:21:34.000Z | slippay-mainnet-pilot | [`0xf822f25c…f49f`](https://explorer.arc.io/tx/0xf822f25c3cfd611ffac1f42f6f9f8853d85753ef869f926e848e5d12b41ff49f) | 3 | 26942327 | 2579 | `0xe75D597f414EBa88Bf4226a3Ad8e0FAe46B1edC1` (agent's float, internal) | 0.12 |

## Method

- One payment = one `AgentSpend` log, keyed by (txHash, logIndex); duplicates are dropped. Reverted transactions emit no logs, so they never count.
- USDC `Transfer` logs are never read (on Arc one transfer emits two: the 18-decimal native log and the 6-decimal ERC-20 log). Amounts are `AgentSpend.amount`, 6 decimals.
- `eth_getLogs` per vault from its registry `fromBlock` to the latest block, 10000 blocks per call, filtered on topic0 `0x9ea5d6476f343b4e6156c9888553bf6c5c6cc7bc3da0f648a0b8bba450c013a8` (current AgentVault) and `0xb23766a70bdcd5c077e8109059bcb7d83253800574f0306b6f7d954160830602` (first deployed version, no `attested` field).
- Active wallet = vault with at least one payment. Active day = distinct UTC date (block timestamp) with at least one payment.
- `external: false` marks Slippay-owned vaults (demo, e2e, adversarial cases). They are listed for transparency and excluded from the external column.
- Before reading logs, each vault's code and immutable `owner()` are checked against the registry; a mismatch aborts the run.
