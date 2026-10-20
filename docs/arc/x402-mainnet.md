# Vault-funded x402 on Arc mainnet (2026-10-20)

An agent bought pay-per-call (x402) services on Arc mainnet with money that came out of its
AgentVault, through the MCP tool `slippay_arc_x402_fetch`, called over stdio the way Claude Code
or Codex would call it.

Circle Gateway nanopayments need an EOA signature and the vault is a contract, so the session
allowlists one float EOA. The vault funds the float only with ordinary attested agent spends; the
float deposits into the Gateway Wallet and signs the nanopayments. Everything the float ever
receives went through the vault's caps.

## Setup

| what | value |
| --- | --- |
| vault | [`0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8`](https://explorer.arc.io/address/0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8) |
| agent (session 2) | `0xE4C31bA5cEb9229A9dc365D15bc6d75c681565fF`, ERC-8004 agent id 2579 |
| float | `0xe75D597f414EBa88Bf4226a3Ad8e0FAe46B1edC1` |
| session install (allowlist = merchant + float, 0.20/tx, 0.30/day, attester on every spend) | [`0x4d7bb876…c8ec`](https://explorer.arc.io/tx/0x4d7bb8761eeaa18a6b3de52ec50878a69a6a5bd34fd786dac6d25ba11cffc8ec), block 26942261 |

## First purchase: 24.2 s end to end

1. The float had no Gateway balance. The vault topped it up with an attested AgentSpend of
   0.12 USDC: [`0xf822f25c…f49f`](https://explorer.arc.io/tx/0xf822f25c3cfd611ffac1f42f6f9f8853d85753ef869f926e848e5d12b41ff49f), block 26942327.
2. The float deposited 0.10 USDC into the Gateway Wallet:
   [`0xfb68a2fc…9f08`](https://explorer.arc.io/tx/0xfb68a2fc6a6a948c3252232fc38c6498041e9413c2130b34ed2a318d19d09f08), block 26942348.
3. The float paid an A-Identity `risk_check` (0.005 USDC) with a Gateway nanopayment. The seller
   confirmed it: Gateway transfer `54f13826-4e98-4fd6-a7ae-1f02011000c4`, outcome `credited`.

## Second purchase: 2.5 s, no on-chain step

The float paid from its Gateway balance: Gateway transfer `f8b53da9-06c6-4576-add0-84cc25e88235`,
outcome `credited`. The float's Gateway balance went 0.100 → 0.095 → 0.090 (Gateway `/balances`).

## Reproduce

```
node packages/slippay-mcp/scripts/arc-mcp-call.mjs slippay_arc_x402_fetch \
  '{"url":"https://a-identity-backend.onrender.com/api/x402/gateway/tools/risk_check","method":"POST","body":"{\"agentId\":\"0x…\",\"txContext\":{\"amountUsd\":0.1}}","maxUsdc":"0.01"}' \
  --network mainnet --vault 0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8 \
  --agent-key-file <agent key> --float-key-file <float key>
```

## What is on-chain and what is not

- On-chain (the vault): the total the float can ever receive, through perTxCap, the window cap,
  the allowlist, expiry, revocation and the attester gate.
- In the MCP process: the per-call price cap (`SLIPPAY_ARC_X402_MAX_USDC`), the optional payee
  allowlist (`SLIPPAY_ARC_X402_PAYTO`) and the "session still live" check (Gateway balances already
  deposited cannot be revoked on-chain). Exposure at any moment is the float wallet plus its
  Gateway balance, normally at most one top-up plus the gas reserve.
- The seller cannot choose the network, the token, the Gateway contract or an over-long
  authorization validity (`maxTimeoutSeconds` is bounded to 30 days); a call is never paid twice.
