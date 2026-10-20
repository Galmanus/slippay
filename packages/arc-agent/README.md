# @slippay/arc-agent

Agent-side SDK for Slippay's **AgentVault** on [Arc](https://arc.io), Circle's network for money.

An AgentVault holds USDC and lets an AI agent spend it inside limits the contract enforces:
per-payment cap, sliding daily cap, recipient allowlist, expiry, revocation, and (per session) a
P-256 integrity attestation and a post-quantum SLH-DSA signature above set amounts.

- `signSpend`, `spendDigest`, `encodeSpendCall`: EIP-712 spend intents, hybrid ECDSA + SLH-DSA.
- `x402Fetch`: an x402 buyer over Circle Gateway nanopayments that pins network, Gateway Wallet,
  USDC, price cap and validity before anything is signed, and never pays twice.
- `ensureGatewayFloat`, `liveFloatDeps`: the float that lets a vault pay x402 sellers, topped up
  only by ordinary (bounded, attested) vault spends.
- `aggregate`, `parseVaultRegistry`: on-chain AgentSpend metrics.

Live on Arc mainnet: vault `0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8`. The contract has no
third-party audit yet. Source: https://github.com/Galmanus/slippay (packages/arc-agent).

The MCP server that exposes these to agents is [`@slippay/mcp`](https://www.npmjs.com/package/@slippay/mcp).
