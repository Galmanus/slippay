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
