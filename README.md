<div align="center">

# SlipPay

**Non-custodial dollar settlement — for people, for agents, for companies.**

USDC payments where the user's own wallet signs funds *directly* to the recipient.
SlipPay never holds funds and never has signing authority over them. The settlement
core is one rail; three surfaces sit on top of it.

`Stellar mainnet` · `Solana (migration)` · `non-custodial` · `Apache-2.0`

[Live](https://app.slippay.cc) · [Docs](./docs/README.md) · [Architecture](./docs/concepts/architecture.md) · [Security model](#security-model)

</div>

---

## What this is

SlipPay turns "holding dollars and moving them" into a touch, without ever taking
custody. *Non-custodial* is used precisely here, not as a slogan:

> The buyer's, agent's, or company's wallet signs the transaction. SlipPay builds
> the **unsigned** transaction, the user signs it client-side, and the funds go
> straight to the recipient. SlipPay's servers never hold a key with authority
> over user funds. The gas-sponsor relayer is a **fee-payer only** — it pays
> network fees and cannot move a cent of user money.

Everything in this repository is meant to be verifiable against the code. There
are **no traction or GMV claims** here. On-chain artifacts list their network and
address so you can check them yourself. If a doc says something the code does not
do, that is a bug worth an issue.

---

## Three surfaces, one core

| Surface | Who it's for | What it does | State |
|---|---|---|---|
| **Dollar account** | a normal person | receive USDC by QR, verify a payment on-chain, pay with a passkey (Face/Touch ID) — no seed phrase in the user's hands | live on Stellar mainnet |
| **Agent / builder** | autonomous agents | agent payments bounded by an on-chain spend policy, a fail-closed integrity attestation, and an offline-checkable proof of the spending bound | rail live (mainnet); attested gate on testnet |
| **Comex treasury** | import/export companies | a corporate (non-biometric, multi-user) account that holds USD, converts R$↔USD through a licensed partner, sends/receives, and earns yield on idle dollars | built, gated; ships with the Solana cutover ([go-live checklist](./docs/comex-go-live-checklist.md)) |

The three surfaces never fork the money path: they all reduce to *build an unsigned
transfer → the user verifies what they sign → the user signs → submit*. The same
[security gate](#security-model) protects all three.

---

## Why it's different

Most "crypto payment" UX asks the user to trust a screen and then sign an opaque
blob. SlipPay's design rule is the opposite — **what you see is what you sign
(WYSIWYS)**, enforced in code on every money path:

1. The app builds the transaction.
2. It **decodes that exact transaction** and shows the real destination + amount + asset.
3. It **asserts** the decoded destination/amount match what the user intended (catches receiver-substitution and amount-drift even from a compromised backend).
4. Only after explicit human confirmation does it **re-derive the hash locally** and sign.

A compromised server, a man-in-the-middle, or a buggy API cannot make a user sign
a payment they did not see. This is the property that makes "non-custodial" actually
mean something at the moment of signing — and it is the same gate on the human
checkout, the agent rail, and the comex treasury.

Security is done **before** code, not after deploy: each money path goes through a
written threat model and an adversarial review pass before it ships. See
[Security model](#security-model).

---

## Status (verified on chain)

Mainnet is Stellar `PUBLIC`. The testnet/mainnet seam is stated explicitly — nothing
below is dressed up as live when it isn't.

| Component | Network | Address / status |
|---|---|---|
| Subscription v0.2 autocharge (SEP-41 allowance, no per-period signature) | **mainnet** | `CAQZECYTKQGUJETQRRBONGQA2DJBNQVYCSKBYCKXOVQOEEOMHKBTJZEP` (wasm `f8cfed71…`) |
| Subscription v0.4 (autocharge + attestation gate + 2.97% on-chain platform fee) — the live rail | **mainnet** | `CD2RFNOLMIKZN4EETDCGULGMD4ANS56IIUDIBLOE24P4JRZM2GCVFV2U` (wasm `4312612c…`) |
| Smart wallet (WebAuthn/passkey custom account) | **mainnet** | wasm `8e9b6760…`; per-user instances deployed on demand by the gas-sponsor relayer |
| Checkout (atomic fee split) | testnet | `CBO2COBZUTHH4II4JCQRZVO4RKDUIUH4MXZTAWOYVUZIVYI47UIDQCWQ` — client flow now WYSIWYS-gated |
| ZK proof-of-mandate + proof-of-KYC (Groth16) | **mainnet** | verified, zero-PII (age + sanctions); generic verifier live |
| Comex treasury (Privy non-custodial wallet + 4P câmbio + DeFindex yield) | Solana, gated | built + adversarially reviewed; awaits partner keys + Solana cutover |
| `@slippay/mcp` (agent MCP server) · `@slippay/attester` (integrity oracle) | npm | v0.2.0 · v0.1.0 |
| AXL compiler (proof-carrying certs) | — | build/test only, no on-chain artifact |

Live services: `https://app.slippay.cc` (web) · `https://app.slippay.cc/api/health` (api).
The deployed contracts are **not** third-party audited.

---

## How the layers compose

```
agent / human / company commits a recipient + amount + (for agents) a tool surface
        │
        ▼
WYSIWYS gate ── decode the built tx → assert destination/amount → human confirm
        │        → re-derive hash locally → sign client-side   (never blind-sign)
        ▼
@slippay/attester ── ed25519 verdict over 44 bytes (id‖charges_done‖not_after),
        │              fail-closed, off-chain; signs only if the action is in-surface
        ▼
subscription contract  autocharge_attested ── on-chain ed25519_verify (fail-closed) [testnet]
        │              autocharge           ── pulls via the buyer's one SEP-41 allowance [mainnet]
        ▼
relayer (fee-payer only, never custodies) runs the off-chain autocharge scheduler
        │
        ▼
@slippay/mcp exposes the whole rail as agent verbs behind a role membrane

AXL is orthogonal: the spending bound itself is a theorem (z3), re-checkable
offline via a proof-carrying certificate.
```

Full picture: [`docs/concepts/architecture.md`](./docs/concepts/architecture.md).

---

## Multi-chain

Stellar is the live settlement chain. Solana is being brought up in parallel,
non-destructively, behind a chain-agnostic adapter so the live product is never at
risk during the migration.

- **`ChainAdapter`** (`apps/web/src/lib/chain`) — pages talk to one interface
  (`payOneTime`, `approveRecurring`, address checks); the active chain is chosen by
  `VITE_CHAIN`. Stellar and Solana adapters implement it side by side.
- **Comex on Solana** — the corporate treasury surface targets Solana because the
  licensed câmbio partner (4P) settles there. Wallet = Privy embedded Solana wallet
  (email + MFA, non-custodial, non-biometric); yield = DeFindex; the WYSIWYS gate is
  ported to Solana (`apps/web/src/lib/solanaAuthorize.ts`).
- **CCTP** — Circle's Cross-Chain Transfer Protocol is live on Stellar mainnet,
  giving native USDC movement between Stellar and Solana without wrapped-token bridges
  when cross-chain settlement is needed.

---

## Security model

Non-custodial is only as strong as the signing moment. SlipPay treats that moment
as the threat surface and hardens it the same way everywhere.

**The WYSIWYS signing gate** — every money path runs `decode → assert → human
confirm → local hash → sign`:
- `apps/web/src/lib/txguard.ts` (Stellar): decode an XDR, re-derive its hash
  locally, assert a single payment matches `{destination, amount, asset}` (rejects
  NaN, multi-payment smuggling, wrong asset, receiver substitution, amount drift).
- `apps/web/src/lib/authorizeTx.ts` / `solanaAuthorize.ts`: the orchestrator the UI
  must call for any signature. Signing is unreachable without an explicit confirm.

**Non-custodial guarantees, enforced:**
- the client never holds a server-side signing/authorization key (CI-checkable: no
  `AUTHORIZATION_PRIVATE` / service-role secret in the web bundle);
- the relayer sponsors gas only and validates sponsorable ops fail-closed;
- corporate (comex) wallets are user-owned (Privy embedded), not server wallets.

**Process, not vibes:**
- a written **threat model** precedes each money path (STRIDE pre-mortem, ranked,
  with concrete mitigations) — see [`docs/superpowers/specs`](./docs/superpowers/specs) and the comex design doc;
- an **adversarial review** pass attacks each path before it ships; findings are
  fixed and re-verified (the live checkout's blind-signing gap and the Solana
  câmbio's receiver-pinning gap were both caught and closed this way);
- **edge hardening**: HTTPS-only with HSTS, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`; zero external render-blocking CDN
  dependencies (fonts self-hosted) so a CDN outage can never blank or hang the app.

Contract-level audits and the key-custody model live in
[`docs/security`](./docs/security/key-custody.md).

---

## Repo layout

```
slippay/
  apps/
    web/             react SPA · three surfaces (human · agent · comex), checkout, dashboard
    listener/        node + stellar-sdk · Horizon SSE watcher + webhook delivery
    shopify-connector/ · vtex-connector/   commerce integrations
  packages/
    shared/          ts types + zod schemas + chain constants (USDC issuers/mints)
    slippay-mcp/     @slippay/mcp · MCP server, agent verbs behind a role membrane
    slippay-attester/@slippay/attester · agent-integrity attestation oracle (AIA)
  contracts/
    subscription/    recurring debit: v0.2 autocharge (mainnet), v0.4 attested gate
    smart-wallet/    WebAuthn/passkey custom account + agent session keys
    checkout/        atomic fee-split payment
    receipt/         payment receipt primitive
  axl-compiler/      rust · AXL DSL → proof-carrying certificates (z3)
  supabase/
    functions/api/   deno + hono REST endpoints (build unsigned XDR; never custodial)
    migrations/      schema, RLS, pg_cron, subscriptions
  scripts/           e2e + deploy + autocharge scheduler
  docs/              full documentation (start at docs/README.md)
```

---

## Quickstart

```sh
# Pre-reqs: node 22+, pnpm 9, deno 2.x, supabase CLI, rust + soroban (for contracts)
git clone git@github.com:Galmanus/slippay.git
cd slippay && pnpm install

pnpm supabase:start && pnpm supabase:reset          # local postgres + auth + schema

# in separate terminals:
cd supabase/functions/api && deno run --allow-all --watch index.ts   # API (Deno + Hono)
cd apps/listener && pnpm dev                                          # Horizon listener
cd apps/web && pnpm dev                                               # web → http://localhost:5173
```

Tests:

```sh
pnpm -r test                                  # listener + packages + web unit tests
pnpm api:test                                 # deno API tests
cd contracts/subscription && cargo test --release
cd axl-compiler && cargo test
```

Path-specific quickstarts: [human](./docs/quickstart-human.md) · [agent](./docs/quickstart-agent.md).

---

## Documentation

Start at [`docs/README.md`](./docs/README.md). Highlights:

- **Concepts** — [architecture](./docs/concepts/architecture.md) · [non-custodial settlement](./docs/concepts/non-custodial-settlement.md) · [proof-bounded settlement](./docs/concepts/proof-bounded-settlement.md) · [agent-integrity attestation](./docs/concepts/agent-integrity-attestation.md) · [regulatory](./docs/concepts/regulatory.md)
- **Contracts** — [overview](./docs/contracts/README.md) · [subscription](./docs/contracts/subscription.md) · [smart wallet](./docs/contracts/smart-wallet.md) · [checkout](./docs/contracts/checkout.md)
- **AXL** — [language](./docs/axl/README.md) · [compiler](./docs/axl/compiler.md) · [proofs and limits](./docs/axl/proofs-and-limits.md)
- **Packages** — [`@slippay/mcp`](./docs/packages/slippay-mcp.md) · [`@slippay/attester`](./docs/packages/slippay-attester.md)
- **Comex** — [go-live checklist](./docs/comex-go-live-checklist.md) · [4P Solana ramp](./docs/4P_SOLANA_RAMP.md)
- **Security** — [key custody](./docs/security/key-custody.md) · audits [001](./docs/security/audit-001.md)–[006](./docs/security/audit-006.md)
- **API** — [authentication](./docs/api-reference/authentication.md) · [orders](./docs/api-reference/orders.md) · [subscriptions](./docs/api-reference/subscriptions.md) · [merchants](./docs/api-reference/merchants.md) · [webhooks](./docs/api-reference/webhooks.md) · [errors](./docs/api-reference/errors.md) · [OpenAPI](./docs/openapi.yaml)
- **Ops** — [deploy](./docs/ops/deploy.md)

---

## Deploy

`app.slippay.cc` and `api.slippay.cc` run on a single VPS under PM2 + nginx (Deno
serves the API and the built web `dist/`). The web app is built locally and
rsync'd to the server — not Vercel, not GitHub Actions. See
[`docs/ops/deploy.md`](./docs/ops/deploy.md).

## License

Apache-2.0 for the open-source contracts and packages (see
[`docs/scf/OPEN_SOURCE.md`](./docs/scf/OPEN_SOURCE.md)). Authorship and IP:
[`IP_OWNERSHIP.md`](./IP_OWNERSHIP.md).

## Contributing

Solo-founder repo. Issues and PRs welcome at
[github.com/Galmanus/slippay/issues](https://github.com/Galmanus/slippay/issues).
Every claim in these docs should be verifiable against the code; if a doc says
something the code does not do, that is a bug worth an issue.
