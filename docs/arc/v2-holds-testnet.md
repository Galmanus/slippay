# AgentVaultV2 holds on Arc testnet (2026-10-20)

Pay-on-delivery holds, run end to end on Arc testnet (chain id 5042002) with real
transactions against the deployed AgentVaultV2, by
`packages/arc-agent/scripts/arc-v2-holds-testnet.mjs`. V2 stays testnet-only until it has an
outside audit.

## Setup

| what | value |
| --- | --- |
| vault (AgentVaultV2) | [`0x82e79aa48ea9cbdfcbae5c97f3a38bcfb3bcd202`](https://explorer.testnet.arc.io/address/0x82e79aa48ea9cbdfcbae5c97f3a38bcfb3bcd202) |
| owner | `0x1cDB3F62257De815DDdAd3176e37Ff1F1916A735` |
| agent | `0x9DD720d18a3B785697eEF6DdaA378831aCb74306`, ERC-8004 agent id 897402 (registered in this run, owned by the vault owner) |
| payee (the only allowlisted recipient) | `0xF1BDC24A437440803107616058F3C0497a8d733a` |
| session | 0.10 USDC per hold, 0.30 per day, attester on every hold and every agent release |

The agent, payee, stranger and attester keys were throwaway, generated in the script's process.
The attester was a local P-256 key, signed with the same library as the production attester:
the production attester only signs spend digests today, not hold or release digests.

## Transactions

| step | tx | block |
| --- | --- | --- |
| ERC-8004 register | [`0xf721f0ec…dfaf`](https://explorer.testnet.arc.io/tx/0xf721f0ecbb9501ac4c37e7f80b97489eafa1feb90cf1cdc92fbdde36fbc2dfaf) | 68223188 |
| fund vault 0.20 | [`0xb9b9fe45…7aa2`](https://explorer.testnet.arc.io/tx/0xb9b9fe45eb58b6da96f83ff2b74aba7ae3d04bed2d1b5afd3b9b3641f5a77aa2) | 68223191 |
| payee gas 0.01 | [`0x38d050d0…2090`](https://explorer.testnet.arc.io/tx/0x38d050d0d1a3b71cbcd78ddb2f07b99f567292caf6e62d29c4918637efa42090) | 68223194 |
| stranger gas 0.01 | [`0xf16192d6…a482`](https://explorer.testnet.arc.io/tx/0xf16192d68855a4c57e831b088990b882d67379f6e14ec21962fcc9892dcba482) | 68223196 |
| install session | [`0x96c984f9…29fe`](https://explorer.testnet.arc.io/tx/0x96c984f9ead1ab12b00ff7bda9b1239827e53e69e6bbac901215945fa7ed29fe) | 68223197 |
| hold A 0.05 | [`0x5c50b4d2…f951`](https://explorer.testnet.arc.io/tx/0x5c50b4d2fedf66d910c526bb3e05b6e7eba2f3089a6adb362cb795b57aadf951) | 68223201 |
| release A (agent-signed) | [`0xa979dc0a…71b4`](https://explorer.testnet.arc.io/tx/0xa979dc0aef5f1cefaba7128f6c02ff894b2ebe615fc189611172a7e0468d71b4) | 68223207 |
| hold B 0.04 | [`0xe09d5c70…caea`](https://explorer.testnet.arc.io/tx/0xe09d5c70e35663df44f0d35c3439cb4bcc7484a6dcc67f9110605b0eca3acaea) | 68223212 |
| refund B (payee, early) | [`0xe6643572…f1d8`](https://explorer.testnet.arc.io/tx/0xe6643572ede6dca331d7fbd0b5e7f664918d9ed22e6e937916ee1cf5dd99f1d8) | 68223214 |
| hold C 0.03 | [`0x7c499216…f937`](https://explorer.testnet.arc.io/tx/0x7c4992166b784ff7da7d738e5d71544a3c12e62d77f9732d242cf408c391f937) | 68223218 |
| refund C (stranger, after releaseBy) | [`0x8ffec730…e66c`](https://explorer.testnet.arc.io/tx/0x8ffec73053fa0473f27d7cb57d1da3e51785dc730a4ea30f0bb73f653cb2e66c) | 68223312 |

- Hold A (0.05): released with the agent's signature and an attestation, relayed by a third
  address (an owner-sent release skips the agent signature, so it would prove nothing). The payee
  received the 0.05.
- Hold B (0.04): refunded early by the payee.
- Hold C (0.03): refunded by the third address once `releaseBy` had passed.

After the run: hold A `Released`, holds B and C `Refunded`, `totalHeld` 0, vault 0.15
USDC, all free. The session's window shows 0.12 spent: a refund returns the money
to the vault but not the day's budget, by design.

## Refused (eth_call against the live vault, same block state)

| attempt | vault error |
| --- | --- |
| owner withdraws the held funds | `InsufficientFreeBalance` |
| release signed by a stranger | `BadSignature` |
| release with no attestation | `BadAttestation` |
| owner refunds before releaseBy | `HoldNotExpired` |
| release A twice | `HoldNotOpen` |
| hold longer than 30 days | `BadReleaseWindow` |
| stranger refunds C before releaseBy | `HoldNotExpired` |

## Not covered here

- The production attester does not sign hold or release digests yet; a V2 session gated by it
  would need that endpoint first.
- The owner release path and the release refusal after revoke or expiry are covered by the unit
  tests (`contracts-evm/test/AgentVaultV2.t.sol`), not by this run.
