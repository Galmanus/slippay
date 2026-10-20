# @slippay/mcp

A Model Context Protocol server that gives an AI agent the SlipPay payment rail as
tools: pay, set up a recurring subscription, arm and use the integrity gate, and
re-verify a spending-bound certificate offline.

Non-custodial and backend-free. The agent holds its own wallet secret
(`SLIPPAY_SIGNER_SECRET`), which never leaves the process. Each spending tool builds,
signs, and submits a Soroban/Stellar transaction directly to an RPC. No SlipPay
backend is in the path. SlipPay never holds funds and never has signing authority.

## Install

The server runs over stdio. Configure it in any MCP client under `mcpServers`:

```jsonc
{
  "mcpServers": {
    "slippay": {
      "command": "npx",
      "args": ["-y", "@slippay/mcp"],
      "env": {
        "SLIPPAY_SIGNER_SECRET": "S...",   // agent wallet secret (required to sign)
        "SLIPPAY_CONTRACT": "C...",        // subscription contract id
        "SLIPPAY_NETWORK": "testnet"       // testnet | public
      }
    }
  }
}
```

`slippay_verify` needs no key and no network. It works the moment the server loads.

## Environment variables

| var | default | used by |
|---|---|---|
| `SLIPPAY_SIGNER_SECRET` | — | every tool that signs a tx |
| `SLIPPAY_CONTRACT` | — | subscribe / approve / autocharge / charge_attested / arm_gate |
| `SLIPPAY_NETWORK` | `testnet` | all chain ops (`testnet` or `public`) |
| `SLIPPAY_ROLE` | `agent` | tool surface (`agent` or `principal`) |
| `SLIPPAY_RPC_URL` | network default | Soroban RPC override |
| `SLIPPAY_HORIZON_URL` | network default | Horizon override |
| `SLIPPAY_USDC_ISSUER` | network default | USDC issuer override |

## Tools (role membrane)

The tool surface depends on `SLIPPAY_ROLE` (default `agent`). The agent role is
deliberately minimal; `principal` adds the trust-establishing verbs. More tools mean
more injection paths, so an agent gets only what it needs to operate inside an
already-established trust relationship. A compromised agent cannot obtain a fresh
integrity attestation, so it cannot settle a charge, and it has no raw-pay escape
hatch and no setup verbs.

| tool | agent | principal | what it does |
|---|---|---|---|
| `slippay_verify` | yes | yes | Re-verify a proof-carrying spending-bound certificate offline. No key, no network. |
| `slippay_whoami` | yes | yes | Return the wallet address, network, and configured contract. No transaction. |
| `slippay_charge_attested` | yes | yes | Autonomous charge that settles only with a fresh, single-use ed25519 integrity attestation, verified on-chain. |
| `slippay_status` | yes | yes | Look up a tx hash on Horizon; return settlement status and explorer link. |
| `slippay_pay` | no | yes | Raw SEP-41/SAC transfer (default USDC) to a recipient. Ungated. |
| `slippay_subscribe` | no | yes | Create an on-chain recurring subscription. Returns the 32-byte hex subscription id. |
| `slippay_approve` | no | yes | Approve the contract as a SEP-41 spender up to a capped, expiring allowance. Arms autonomous debit. |
| `slippay_autocharge` | no | yes | Trigger an autonomous charge via the standing allowance, no attestation. Submittable by any relayer. |
| `slippay_arm_gate` | no | yes | Bind an ed25519 attester public key to a subscription (`set_attester`). |
| `slippay_arc_session` | yes | yes | Arc: read this agent's AgentVault session — caps, remaining window budget, post-quantum threshold, expiry, ERC-8004 agent id. No transaction. |
| `slippay_arc_pay` | yes | yes | Arc: pay USDC from the AgentVault inside its on-chain bounds. Signs locally (ECDSA, plus SLH-DSA above the PQ threshold) and sends the intent to the SlipPay relayer, which pays gas only. |
| `slippay_arc_x402_fetch` | yes | yes | Arc: buy an x402 resource (Circle Gateway nanopayment) with vault-bounded USDC. The float EOA that signs is funded only by AgentVault spends; price capped, paid at most once. |
| `slippay_arc_receipts` | yes | yes | Arc: this agent's latest AgentSpend events from the chain (tx, recipient, amount, attested, PQ). No transaction. |

### Arc rail

`contracts-evm/src/AgentVault.sol` enforces the bound on Arc (Circle's L1): per-tx cap, sliding
window, recipient allowlist, expiry, revocation, and an SLH-DSA-SHA2-128s signature (Arc
precompile) above the session's threshold. Env: `SLIPPAY_ARC_VAULT`, `SLIPPAY_ARC_AGENT_KEY`,
`SLIPPAY_ARC_SLH_SECRET` (needed only above the threshold), `SLIPPAY_ARC_NETWORK`
(`testnet`|`mainnet`), `SLIPPAY_ARC_RELAYER_URL`, `SLIPPAY_ARC_RPC_URL`.
`scripts/arc-e2e-testnet.mjs` runs the whole flow (deploy, ERC-8004 identity, fund, session,
classical + post-quantum spend) from one funded testnet key.

**x402 on Arc.** Circle Gateway nanopayments need an EOA signature and the vault is a contract, so
the session allowlists one float EOA. When its Gateway balance can't cover a call, the vault tops
it up with an ordinary attested spend and the float deposits into Gateway. Every dollar the float
holds came through the vault's caps. Env: `SLIPPAY_ARC_FLOAT_KEY`, `SLIPPAY_ARC_X402_MAX_USDC`
(per-call ceiling, default `0.05`), `SLIPPAY_ARC_FLOAT_TOPUP_USDC` (default `0.10`),
`SLIPPAY_ARC_FROM_BLOCK` (vault deploy block, floor for receipts).
`scripts/arc-mcp-call.mjs <tool> '<json>' …` calls any tool over stdio, like an MCP client.

The membrane is a surface restriction enforced by this server process, not a
chain-level guarantee. The hard guarantee for attested charges is the contract's
on-chain `ed25519_verify` check.

## Status

The on-chain integrity gate (`autocharge_attested` / `ed25519_verify`) is proven on
**testnet only**. Stellar mainnet currently runs the subscription contract version
without the gate (allowance-only `autocharge`). The new contracts have no third-party
audit.

## Docs

- `docs/packages/slippay-mcp.md` — full reference.
- `docs/packages/slippay-attester.md` — the integrity attester.
- `docs/concepts/agent-integrity-attestation.md` — the two questions and how they are
  enforced.

---

Built on [Stellar](https://stellar.org). Part of [SlipPay](https://slippay.cc). MIT.
