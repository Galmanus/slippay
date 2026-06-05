# SlipPay

Non-custodial USDC payments and agent-payment integrity on Stellar.

SlipPay has two surfaces over one settlement core:

- **Human "dollar account"** — receive USDC by QR, verify a payment on chain, and
  pay with a passkey (Face/Touch ID). No seed phrase in the user's hands.
- **Agent / builder** — autonomous agent payments bounded by an on-chain spend
  policy, a fail-closed integrity attestation, and an offline-checkable proof of
  the spending bound.

Non-custodial is precise: the buyer's or agent's wallet signs funds directly to
the recipient. SlipPay never holds funds and never has signing authority over
user funds.

## Status (verified on chain, 2026-06-05)

Mainnet is Stellar `PUBLIC`. Honest testnet/mainnet seam:

| Component | Network | Address / status |
|---|---|---|
| Subscription v0.1 (buyer signs each charge) | **mainnet** | `CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN` (wasm `1dbda19a…`, 2026-05-16) |
| Subscription v0.2 autocharge (SEP-41 allowance, no per-period signature) | **mainnet** | `CAQZECYTKQGUJETQRRBONGQA2DJBNQVYCSKBYCKXOVQOEEOMHKBTJZEP` (wasm `f8cfed71…`, 2026-06-03) |
| **Subscription v0.4** (autocharge + attestation gate + 2.97% on-chain platform fee) — the live rail | **mainnet** | `CD2RFNOLMIKZN4EETDCGULGMD4ANS56IIUDIBLOE24P4JRZM2GCVFV2U` (wasm `4312612c…`, 2026-06-05; fee proven on testnet `CDO4DEBW…`) |
| Smart wallet (WebAuthn/passkey custom account) | testnet only | template `CAQZWVRPWW7UBCKPFECNGAZW7YDRVSRWP6FVA4V32Q74ZCNVIPOVK4OM` |
| Checkout (atomic fee split) | testnet only | `CBO2COBZUTHH4II4JCQRZVO4RKDUIUH4MXZTAWOYVUZIVYI47UIDQCWQ` (no tests yet) |
| `@slippay/mcp` (agent MCP server) | npm | v0.2.0 |
| `@slippay/attester` (integrity oracle) | npm | v0.1.0 |
| AXL compiler (proof-carrying certs) | — | build/test only, no on-chain artifact |

Live services: `https://app.slippay.cc` (web) and `https://app.slippay.cc/api/health`.

There are no traction or GMV claims in this repository. The deployed contracts are
not third-party audited (the WooCommerce plugin audits 001–006 cover only that plugin).

## How the layers compose

```
agent commits a tool/recipient/amount surface
        │
        ▼
@slippay/attester  ── ed25519 verdict over 44 bytes (id‖charges_done‖not_after), fail-closed
        │                                   (off-chain; signs only if the action is in-surface)
        ▼
subscription contract  autocharge_attested ── on-chain ed25519_verify (fail-closed)  [testnet]
        │              autocharge           ── pulls via the buyer's one SEP-41 allowance [mainnet v0.2]
        ▼
relayer (fee-payer only, never custodies) runs the off-chain autocharge scheduler
        │
        ▼
@slippay/mcp exposes the whole rail as agent verbs behind a role membrane

AXL is an orthogonal layer: the spending bound itself is a theorem (z3), re-checkable
offline via a proof-carrying certificate.
```

See [`docs/concepts/architecture.md`](./docs/concepts/architecture.md) for the full picture.

## Documentation

Start here: [`docs/README.md`](./docs/README.md).

- Quickstarts: [human](./docs/quickstart-human.md) · [agent](./docs/quickstart-agent.md)
- Concepts: [architecture](./docs/concepts/architecture.md) · [two narratives](./docs/concepts/two-narratives.md) · [proof-bounded settlement](./docs/concepts/proof-bounded-settlement.md) · [agent-integrity attestation](./docs/concepts/agent-integrity-attestation.md) · [non-custodial settlement](./docs/concepts/non-custodial-settlement.md) · [regulatory](./docs/concepts/regulatory.md)
- Contracts: [overview](./docs/contracts/README.md) · [subscription](./docs/contracts/subscription.md) · [smart wallet](./docs/contracts/smart-wallet.md) · [checkout](./docs/contracts/checkout.md)
- AXL: [language](./docs/axl/README.md) · [compiler](./docs/axl/compiler.md) · [proofs and limits](./docs/axl/proofs-and-limits.md)
- Packages: [`@slippay/mcp`](./docs/packages/slippay-mcp.md) · [`@slippay/attester`](./docs/packages/slippay-attester.md)
- Guides: [biometric pay](./docs/guides/biometric-pay.md) · [receive USDC by QR](./docs/guides/receive-usdc-qr.md) · [verify a cert](./docs/guides/verify-a-cert.md) · [recurring billing](./docs/guides/recurring-billing.md) · [drop-in SDK](./docs/guides/drop-in-sdk.md) · [WooCommerce](./docs/guides/woocommerce.md)
- API reference: [authentication](./docs/api-reference/authentication.md) · [orders](./docs/api-reference/orders.md) · [subscriptions](./docs/api-reference/subscriptions.md) · [merchants](./docs/api-reference/merchants.md) · [webhooks](./docs/api-reference/webhooks.md) · [errors](./docs/api-reference/errors.md)
- Operations: [deploy](./docs/ops/deploy.md)

## Repo layout

```
slippay/
  apps/
    listener/        node + stellar-sdk · Horizon SSE watcher + webhook delivery
    web/             react SPA · two surfaces (human + agent), checkout, dashboard
  packages/
    shared/          ts types + zod schemas + Stellar constants (USDC issuers)
    slippay-mcp/     @slippay/mcp · MCP server, agent verbs behind a role membrane
    slippay-attester/@slippay/attester · agent-integrity attestation oracle (AIA)
  contracts/
    subscription/    recurring debit: v0.1 (per-period sig), v0.2 autocharge, v0.3 gate
    smart-wallet/    WebAuthn/passkey custom account + agent session keys
    checkout/        atomic fee-split payment
    receipt/         payment receipt primitive (source; verify deployment before claiming)
  axl-compiler/      rust · AXL DSL → proof-carrying certificates (z3)
  supabase/
    functions/api/   deno + hono REST endpoints
    migrations/      schema, RLS, pg_cron, subscriptions
  scripts/           e2e + deploy + autocharge scheduler
  docs/              full documentation (see docs/README.md)
```

## Local development

```sh
# Pre-reqs: node 22+, pnpm 9, deno 2.x, supabase CLI, rust + soroban (for contracts)
git clone git@github.com:Galmanus/slippay.git
cd slippay
pnpm install

pnpm supabase:start          # local postgres + auth
pnpm supabase:reset          # apply migrations

# API (Deno + Hono)
cd supabase/functions/api && deno run --allow-all --watch index.ts

# Listener (separate terminal)
cd apps/listener && pnpm dev

# Web (separate terminal)
cd apps/web && pnpm dev      # http://localhost:5173
```

Tests:

```sh
pnpm -r test                                # listener + packages
pnpm api:test                               # deno API tests
cd contracts/subscription && cargo test --release
cd axl-compiler && cargo test
```

## Deploy

`app.slippay.cc` and `api.slippay.cc` run on a single VPS under PM2 + nginx. The
web app is built locally and the `dist/` is rsync'd to the server; it is not on
Vercel or GitHub Actions. See [`docs/ops/deploy.md`](./docs/ops/deploy.md).

## License

Apache-2.0 for the open-source contracts and packages (see
[`docs/scf/OPEN_SOURCE.md`](./docs/scf/OPEN_SOURCE.md)). Authorship and IP:
[`IP_OWNERSHIP.md`](./IP_OWNERSHIP.md).

## Contributing

Solo-founder repo. Issues and PRs welcome at
[github.com/Galmanus/slippay/issues](https://github.com/Galmanus/slippay/issues).
Every claim in these docs should be verifiable against the code; if a doc says
something the code does not do, that is a bug worth an issue.
