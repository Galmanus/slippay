# contracts-evm — Slippay on Arc

`AgentVault` (`src/AgentVault.sol`): the owner funds a USDC vault and installs agent sessions; an
agent spends by signing an EIP-712 intent that anyone can relay. Limits live on-chain: per-tx cap,
absolute ceiling, sliding window (≤ 2 × windowCap in any real window), recipient allowlist, expiry,
revocation, single-use session keys. Spends above `pqThreshold` also need an SLH-DSA-SHA2-128s
signature (hybrid ECDSA + post-quantum) checked by Arc's precompile `0x1800…0004`. Agent identity
is an ERC-8004 `agentId`. Port of the Soroban agent-session semantics in
`contracts/smart-wallet/src/lib.rs`. Spec: `docs/arc/AGENT_VAULT_SPEC.md`.

```sh
forge test                                   # 44 tests incl. 512-run fuzz of the window bound
pnpm install --ignore-workspace              # @noble/post-quantum for the live check
forge build && node script/live-check.mjs testnet 1   # or: mainnet 1
```

`live-check.mjs` runs the full flow against a real Arc node with no funds and no deployment: it
injects `script/ArcLiveHarness.sol` via an `eth_call` state override, so the real SLH-DSA
precompile, native USDC and ERC-8004 registry are exercised. Last run (2026-10-13): 7/7 on testnet
and mainnet; internal gas 58.6k (classical spend) vs 265.9k (hybrid PQ spend); SLH-DSA signing
~2.7 s in JS (noble 0.7.1), so PQ is for high-value spends, not per-micropayment.

Arc Foundry (`arc-forge`) v0.8.0-2 needs GLIBC ≥ 2.38; unit tests use stock forge with mocks
(`test/mocks/Mocks.sol`), and real-precompile coverage comes from the live check.

## Arc testnet deployment (2026-10-13, via `packages/slippay-mcp/scripts/arc-e2e-testnet.mjs`)

| what | value |
|---|---|
| AgentVault | `0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2` (owner/relayer `0x1cDB3F62257De815DDdAd3176e37Ff1F1916A735`) |
| deploy | [0x01d19dde…211a](https://explorer.testnet.arc.io/tx/0x01d19dde48353526b67677fbf41bc54c40d394c1db8ac5fb2f5f921de797211a) — 1,685,513 gas |
| ERC-8004 agentId | 897273 — [register](https://explorer.testnet.arc.io/tx/0xa30b233af756a1f27310ddad8fc66cb96a1454bf170836530ac01dac2e3e7ea9) |
| session install | [0x6f0fed42…d71e](https://explorer.testnet.arc.io/tx/0x6f0fed429f3e8653cbe6614f4a14892eea938c4e0f929d562d82c7074a75d71e) — 221,878 gas |
| classical spend 0.5 USDC | [0x8cb9df02…5bbb](https://explorer.testnet.arc.io/tx/0x8cb9df02fc39a4733f861ae30c22a2cc783806a6e2de44832d1fe50427aa5bbb) — 112,671 gas, 0.002817 USDC at 25 gwei |
| hybrid PQ spend 2 USDC | [0x4c10777d…9691](https://explorer.testnet.arc.io/tx/0x4c10777d86b8093d26e01905de7e4ce203912dd1e731989f27cd427f52ee9691) — 452,583 gas, 0.011315 USDC at 25 gwei |

Both spends were relayed by the Slippay API route (`POST /api/v1/arc/testnet/spend`, run locally).
