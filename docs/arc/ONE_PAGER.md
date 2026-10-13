# Slippay on Arc — one-pager

**Arc Acceleration Season · Deliverable 1 · 2026-10-13**

Team: Manuel Guilherme (founder, engineering) · Mário Ferreira (commercial)

Repository: https://github.com/Galmanus/slippay (Arc work on branch `feat/arc-agent-vault`)

## What Slippay is

**The Arc dollar, in Pix.** Slippay is a non-custodial dollar account on Arc for people and for the AI agents that work for them. It does four things:

1. **Pix in and out.** Brazil's instant payment system is the door. Reais become USDC on Arc, and USDC goes back to reais.
2. **Move dollars.** Send, receive and get paid in USDC, settled on Arc with sub-second finality.
3. **Earn.** Idle dollars can sit in a USDC yield vault on Arc (App Kits Earn, Morpho vaults) without leaving the user's control.
4. **Agents.** Each AI agent gets its own dollar sub-wallet with an identity and a spending limit that the network enforces. A compromised or tricked agent still cannot spend past it.

## Before September 28 vs. now

| | Before the season | Built during the season (from 2026-10-13) |
|---|---|---|
| Network | Slippay live on another network: Pix↔USDC accounts through licensed partners, plus checkout connectors for Shopify, WooCommerce and VTEX | Arc-first. AgentVault contract, relayer, MCP tools and SDK on Arc testnet. The web interface was rebuilt around Arc. |
| Arc code | None | The full agent-wallet stack below |

## Architecture

```
AI agent (Claude, ChatGPT, n8n, company bot)
   │  MCP tools: slippay_arc_session (read balance + limits) · slippay_arc_pay
   ▼
Slippay agent SDK (@slippay/arc-agent)
   │  EIP-712 "Spend" signed by the agent key (ECDSA)
   │  + SLH-DSA-SHA2-128s signature above the session's pqThreshold
   │  + P-256 integrity attestation above attestThreshold (Slippay attester)
   │  every refusal (cap, window, recipient, expiry) happens BEFORE signing
   ▼
Slippay relayer API  POST /v1/arc/:network/spend
   │  pays gas only (in USDC). Pinned vaults, eth_call simulation first,
   │  gas and fee caps, 25 gwei floor (Arc drops < 20 gwei silently)
   ▼
AgentVault (Arc) ──► USDC transfer to the recipient
   owner installs a session per agent: per-tx cap, window cap with a hard
   2× ceiling, recipient allowlist, expiry, revocation, single-use nonces,
   ERC-8004 agentId
```

## What runs onchain (Arc)

- **AgentVault.sol.** Holds the owner's USDC. It verifies every spend on-chain:
  - EIP-712 domain "SlippayAgentVault" v1, with a low-s ECDSA recover;
  - caps, sliding window and hard ceiling;
  - allowlist, expiry, revocation and replay protection.
- **Arc precompiles the vault calls.**
  - SLH-DSA-SHA2-128s verify at `0x1800…0004`: post-quantum co-signature on large payments. This is Arc-native.
  - P-256 verify at `0x100`: the integrity attester's signature.
- **ERC-8004 IdentityRegistry on Arc.** Each agent session is bound to a registered agentId. Every `AgentSpend` event carries it.
- **USDC as gas.** The relayer sponsors gas in USDC, so agents never hold a second token.

## Off-chain components

- Relayer API (gas sponsor only, non-custodial).
- Integrity attester. It runs the integrity check on the spend, signs with P-256, and refuses any deadline more than 15 minutes ahead.
- MCP server (`@slippay/mcp`).
- Agent SDK (`@slippay/arc-agent`).
- Web app.

## User-facing feature

1. A person or company opens a dollar account and funds it by Pix.
2. They send, receive and get paid in dollars. Idle dollars can be moved into a yield vault with one tap and back out at any time.
3. In **Agents** they create a sub-wallet for an AI agent and set what it may spend per payment and per period, until when, and to whom.
4. They paste a connection code into their agent.
5. The agent pays on its own inside the limit. The network refuses anything above it, and every payment is tied to the agent's identity.

## Circle products

| Product | Status | Use |
|---|---|---|
| USDC on Arc (native gas, `0x3600…0000`) | **in use** | Balance, payments, gas sponsorship |
| Arc precompiles: SLH-DSA, P-256 | **in use** | Post-quantum co-signature; integrity attestation |
| ERC-8004 registry on Arc | **in use** | Agent identity |
| StableFX | planned this season | BRL leg: Pix → BRLA (Avenia) → USDC on Arc. Needs sandbox access. |
| Gateway | planned | AgentVault authorizes Gateway transfers via ERC-1271 (unified USDC balance for agents) |
| App Kits — Earn | planned this season | Yield on idle USDC: deposit into a Morpho USDC vault on Arc from the app, with the position held in the user's own account |
| App Kits — Swap / Bridge | planned | Swap and bridge inside the app, with a custom fee |
| CCTP | planned | Bring existing USDC balances to Arc |

## Evidence on Arc testnet (2026-10-13)

| Step | Transaction | Gas |
|---|---|---|
| Deploy AgentVault | [0x01d19dde…211a](https://explorer.testnet.arc.io/tx/0x01d19dde48353526b67677fbf41bc54c40d394c1db8ac5fb2f5f921de797211a) | 1,685,513 |
| Register agent identity (ERC-8004, agentId 897273) | [0xa30b233a…7ea9](https://explorer.testnet.arc.io/tx/0xa30b233af756a1f27310ddad8fc66cb96a1454bf170836530ac01dac2e3e7ea9) | — |
| Install session limits | [0x6f0fed42…d71e](https://explorer.testnet.arc.io/tx/0x6f0fed429f3e8653cbe6614f4a14892eea938c4e0f929d562d82c7074a75d71e) | 221,878 |
| Agent spend 0.5 USDC (relayed) | [0x8cb9df02…5bbb](https://explorer.testnet.arc.io/tx/0x8cb9df02fc39a4733f861ae30c22a2cc783806a6e2de44832d1fe50427aa5bbb) | 112,671 (0.002817 USDC at 25 gwei) |
| Agent spend 2 USDC, hybrid post-quantum (relayed) | [0x4c10777d…9691](https://explorer.testnet.arc.io/tx/0x4c10777d86b8093d26e01905de7e4ce203912dd1e731989f27cd427f52ee9691) | 452,583 (0.011315 USDC at 25 gwei) |

Latest end-to-end run, including an agent that misbehaves (`packages/slippay-mcp/scripts/arc-e2e-testnet.mjs`, vault `0x7d7969330859786bd7768bb8a69fe59ca00e78de`, agentId 897300):

| Step | Result |
|---|---|
| Agent pays 0.5 USDC | [settled](https://explorer.testnet.arc.io/tx/0xda2f50f7e97fc0803fa92404a4f93030482f15414b479b230560bbbd19f2a24e) · 117,054 gas |
| Agent pays 2 USDC, hybrid post-quantum | [settled](https://explorer.testnet.arc.io/tx/0x2e635d4f4a21c1c59a315c6204afe549c6e33c4756175bf0cd4f3ec8f5e449e8) · 457,148 gas |
| Agent signs 3 USDC (per-payment cap is 2) | refused on-chain: `AmountExceedsCap` |
| Agent pays an address the owner never approved | refused on-chain: `RecipientNotAllowed` |
| Agent replays an old order | refused on-chain: `BadSignature` |
| Agent pays 1.6 USDC that would pass the 4 USDC daily window | refused on-chain: `WindowCapExceeded` |

Contract test suite: 54 Foundry tests passing. They include a fuzzed 2×-window-ceiling property and P-256 attester tests on the real Osaka precompile. Digest vectors are pinned across Solidity, TypeScript and the attester.

## Current status and constraints

- AgentVault runs on testnet only. A mainnet deploy needs mainnet USDC for gas and a final review.
- The relayer and the attester run locally today. Production hosting is pending.
- The Pix leg on Arc depends on a licensed partner and on StableFX access, which is permissioned. Circle's Onramp does not list Brazil or Pix.
- Nanopayments and x402 batch settlement require EOA signatures, with no ERC-1271. The contract wallet therefore cannot use them yet. EOA agents can.
