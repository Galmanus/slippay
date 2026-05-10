# slippay

Stellar-native checkout SDK for Brazilian merchants billing globally. Pix in,
USDC or PYUSD out, optional cash-out via MoneyGram in 180+ countries. Six-second
deterministic finality, no chargebacks, non-custodial settlement to merchant.

**Status**: testnet live · mainnet planned 2026-Q3 · partnership-with-licensed-VASP architecture

```
backend       https://api.slippay.cc/api/health -> {"ok":true}
landing live  https://api.slippay.cc/  (app.slippay.cc soon, after vhost+SSL)
preview demo  https://api.slippay.cc/preview
```

---

## What slippay actually is

A merchant gateway that lets Brazilian e-commerce, SaaS, and exporters accept
USD-denominated stablecoin payments without ever touching custody themselves
or running a regulated FX leg. The buyer pays in BRL via Pix (mediated by a
licensed BR anchor); the merchant receives USDC or PYUSD on Stellar in their
own wallet, instantly.

Two surfaces, one architecture:

- **For buyers** — a hosted checkout that handles the wallet flow. Pick wallet,
  approve the payment, done. Currently 5 Stellar wallets supported (Freighter,
  Lobstr, xBull, Albedo, Hana). Solana on roadmap (not in code yet).
- **For merchants** — a REST API and a web dashboard. Sign up, drop a Stellar
  receive address, get an API key, post an order, fire an iframe checkout, get
  a webhook on payment.

The wedge that survives competitive scrutiny is **not** "1% non-custodial USDC"
(Coinbase Commerce ships that, Yodl undercuts at 0.2% on EVM). It is:

1. Stellar's deterministic 6-second finality and sub-cent fees, which keep
   subscription unit economics viable where Ethereum gas variance kills them.
2. MoneyGram cash-out in 180+ countries, a rail no EVM-based competitor has.
3. Pix-BRL-in to merchant-USDC-out as a single atomic flow, mediated by a
   licensed BR anchor, which closes the regulatory gap created by BCB
   Resoluções 519/520/521 (effective February 2026).
4. PYUSD support alongside USDC (PayPal's stablecoin live on Stellar since
   June 2025), giving merchants two USD options instead of one.

---

## Architecture

```
                 buyer                            merchant
                   |                                  |
                   v                                  ^
            +-------------+                    +-------------+
            |  /checkout  |                    |  dashboard  |
            |  (slippay   |                    |  + REST API |
            |   web)      |                    |  + webhooks |
            +------+------+                    +------+------+
                   |                                  |
                   |  signs USDC / PYUSD payment      |
                   |  to merchant address with        |
                   |  hash memo = order.id           |
                   v                                  ^
            +------+----------------------------------+------+
            |  Stellar mainnet / testnet                     |
            |  USDC issuer GA5ZSE...4KZVN  (Circle, mainnet)|
            |  PYUSD issuer (verify on-chain at deploy)     |
            +------+----------------------------------+------+
                   |                                  |
                   v                                  ^
            +------+---------+                +-------+-------+
            | Horizon SSE    | -- payment --> | listener      |
            | server.payments| event w/ memo  | (Node)        |
            +----------------+                +-------+-------+
                                                      |
                                                      v
                                         +------------+-----------+
                                         | matcher                |
                                         | - asset_code USDC      |
                                         | - asset_issuer = expected
                                         | - to == merchant addr  |
                                         | - memo == order.memo   |
                                         | - amount >= expected   |
                                         +------------+-----------+
                                                      |
                                                      v
                                         +------------+-----------+
                                         | reconciler             |
                                         | - update orders.status |
                                         | - bump charges_done    |
                                         |   (if subscription)    |
                                         | - enqueue webhook      |
                                         +------------+-----------+
                                                      |
                                                      v
                                         +------------+-----------+
                                         | webhook delivery       |
                                         | HMAC-SHA256 + retries  |
                                         | 1m 5m 30m 2h 12h 24h   |
                                         +------------------------+
```

Three runtime processes, all on a single VPS:

| process       | runtime  | role                                    |
|---------------|----------|-----------------------------------------|
| slippay-api   | Deno 2.7 | REST endpoints + hosted SPA (Hono)       |
| slippay-listener | Node 20  | Horizon SSE watcher + webhook delivery  |
| postgres      | Supabase | merchants, orders, subscriptions, webhook_deliveries, listener_state |

PM2 supervises both processes. Nginx terminates SSL and proxies api.slippay.cc
to localhost:8080.

---

## Documentation

Full docs are in [`docs/`](./docs/README.md). Highlights:

- [Quickstart](./docs/quickstart.md) — first paid order in five minutes
- [API reference](./docs/README.md#api-reference) — orders, subscriptions, merchants, webhooks
- [Architecture](./docs/concepts/architecture.md) — the three-process picture
- [Non-custodial settlement](./docs/concepts/non-custodial-settlement.md) — what we mean precisely
- [Regulatory framing](./docs/concepts/regulatory.md) — BCB Res 519/520/521 and the partnership-with-VASP model
- [Drop-in SDK guide](./docs/guides/drop-in-sdk.md) — two lines of JS
- [Recurring billing](./docs/guides/recurring-billing.md) — subscriptions end-to-end
- [WooCommerce plugin](./docs/guides/woocommerce.md) — install, configure, ship
- [Webhook handler](./docs/guides/webhooks-handler.md) — verify HMAC, idempotency, retries

## Quickstart

### Create an order (one-shot payment)

```sh
curl -X POST https://api.slippay.cc/api/v1/orders \
  -H "Authorization: Bearer sk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "brl_amount": "99.90",
    "external_ref": "cart_42",
    "expires_in_minutes": 30
  }'
```

Response:

```json
{
  "order": {
    "id": "ord_uuid",
    "memo": "ce230c...",
    "usdc_amount": "18.16",
    "rate_brl_usdc": "5.50",
    "expires_at": "2026-05-10T14:30:00Z",
    "status": "pending"
  },
  "checkout_url": "https://api.slippay.cc/checkout/ord_uuid"
}
```

The buyer opens `checkout_url` and signs once. When the on-chain payment
confirms (~6 seconds), the listener fires `order.paid` to your webhook URL.

### Create a subscription (recurring billing)

```sh
curl -X POST https://api.slippay.cc/api/v1/subscriptions \
  -H "Authorization: Bearer sk_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "brl_amount": "29.90",
    "period_seconds": 2592000,
    "asset_code": "USDC",
    "max_periods": 12,
    "external_ref": "customer_42_pro"
  }'
```

Then trigger each cycle:

```sh
curl -X POST https://api.slippay.cc/api/v1/subscriptions/<id>/charge \
  -H "Authorization: Bearer sk_live_your_key"
```

The charge call is **idempotent on time** — calling twice within the same period
returns the same pending order. Each successful payment fires
`subscription.charged` to the merchant webhook with `subscription_id` set.

A Soroban-native subscription contract (no off-chain trigger needed) is in
scaffolding under `contracts/subscription/`. v0.1 ships off-chain orchestration;
v0.2 will pre-authorize the contract to debit the buyer wallet automatically.

### Drop-in checkout SDK

```html
<script src="https://api.slippay.cc/sdk.js"></script>
<script>
  Slippay.open({
    orderId: "<order.id from POST /v1/orders>",
    onPaid:      ({ txHash }) => location.href = "/thanks",
    onCancelled: () => { /* user closed modal */ },
    onExpired:   () => { /* 30 min passed */ },
  });
</script>
```

See the live integration: [api.slippay.cc/demo](https://api.slippay.cc/demo)

---

## Live endpoints

| URL                                          | what it is                          |
|----------------------------------------------|-------------------------------------|
| `GET  https://api.slippay.cc/api/health`     | `{"ok":true}` liveness               |
| `POST https://api.slippay.cc/api/v1/merchants` | create merchant (JWT auth)        |
| `GET  https://api.slippay.cc/api/v1/merchants/me` | current merchant                |
| `POST https://api.slippay.cc/api/v1/orders`  | create one-shot order               |
| `GET  https://api.slippay.cc/api/v1/orders`  | list merchant orders                |
| `GET  https://api.slippay.cc/api/v1/orders/:id` | public order read for checkout   |
| `POST https://api.slippay.cc/api/v1/orders/:id/cancel` | cancel pending order      |
| `POST https://api.slippay.cc/api/v1/subscriptions` | create subscription           |
| `GET  https://api.slippay.cc/api/v1/subscriptions` | list subscriptions            |
| `GET  https://api.slippay.cc/api/v1/subscriptions/:id` | single subscription       |
| `PATCH https://api.slippay.cc/api/v1/subscriptions/:id` | status / webhook / metadata |
| `POST https://api.slippay.cc/api/v1/subscriptions/:id/charge` | materialize next charge as order |
| `POST https://api.slippay.cc/api/v1/subscriptions/:id/cancel` | cancel subscription |

API keys are `Bearer sk_live_<32 random hex bytes>` (256 bits, SHA-256
fingerprinted in DB). JWT routes require a Supabase auth session.

---

## What is shipped

| feature                                   | status   | location                                       |
|-------------------------------------------|----------|------------------------------------------------|
| One-shot order checkout (BRL -> USDC)     | live     | `supabase/functions/api/routes/orders.ts`      |
| Stellar Horizon SSE watcher               | live     | `apps/listener/src/horizon.ts`                 |
| Memo-matched payment reconciler           | live     | `apps/listener/src/matcher.ts`, `reconciler.ts`|
| HMAC-signed webhook delivery + retries    | live     | `apps/listener/src/webhook.ts`                 |
| pg_cron stale-order expiry                | live     | `supabase/migrations/20260507120000_pg_cron_expire.sql` |
| Subscription primitive (CRUD + charge)    | live     | `supabase/functions/api/routes/subscriptions.ts`|
| Subscription bookkeeping in reconciler    | live     | `apps/listener/src/reconciler.ts`              |
| Merchant dashboard (orders + subscriptions + settings) | live | `apps/web/src/pages/Dashboard*.tsx`     |
| Hosted checkout SPA + drop-in SDK         | live     | `apps/web/src/pages/Checkout.tsx`, `public/sdk.js` |
| Buyer-flow preview (Netshoes-style mock)  | live     | `apps/web/src/pages/Preview.tsx`               |
| Soroban subscription contract scaffold    | scaffold | `contracts/subscription/`                      |
| PYUSD asset config                        | structural, issuer pending verify | `packages/shared/src/constants.ts` |
| BR anchor partnership (Pix in)            | drafted, not signed | `docs/outreach/{transfero,bitso}.md` |

---

## Stack

```
backend       Deno 2.7 + Hono 4 + zod
                node 20 + tsx + vitest (listener)
                @stellar/stellar-sdk ^15
                @supabase/supabase-js ^2.45
contracts     Rust 1.92 + soroban-sdk 21.7
db            Postgres 17 (Supabase) + pg_cron
infra         Ubuntu 24.04 droplet (DigitalOcean NYC1)
                nginx + Let's Encrypt
                PM2 7 (single-host process supervisor)
frontend      React 18 + Vite 5 + tailwind
                react-router-dom 6
                @stellar/stellar-wallets-kit
package mgmt  pnpm 10 workspaces
```

The deliberate choice to stay PM2-native instead of docker-compose is
documented: 2 GB RAM on the droplet, container overhead would eat ~21% of
usable memory before the apps run, and the OS-level stack (nginx, fail2ban,
UFW, certbot auto-renew) was already curated for direct localhost processes.
See `ecosystem.config.cjs`.

---

## Repo layout

```
slippay/
  apps/
    listener/        node + stellar-sdk · Horizon SSE watcher + webhook delivery
    web/             react SPA · dashboard + checkout + landing + preview + SDK
  packages/
    shared/          ts types + zod schemas + Stellar constants (USDC/PYUSD issuers)
  supabase/
    migrations/      4 sql files: schema, RLS, pg_cron, subscriptions
    functions/api/   deno + hono REST endpoints
  contracts/
    subscription/    rust soroban contract (compiles to wasm32, 1/5 tests pass on M1)
  docs/
    outreach/        partnership pitch drafts (transfero, bitso)
    scf/             SCF grant proposal v0.1
    deploy-secrets.md, mainnet-readiness.md, superpowers/
  scripts/
    platform-setup.mjs     testnet keypair + friendbot + USDC trustline
    e2e-subscriptions.mjs  full API surface validator (8/8 PASS in prod)
    e2e-payment-testnet.mjs full on-chain validator (script ready, listener pickup needs investigation)
  ecosystem.config.cjs     PM2 process config
```

---

## Local development

```sh
# Pre-reqs: node 20+, pnpm 10, deno 2.x, supabase CLI, docker (for supabase start)

git clone git@github.com:Galmanus/slippay.git
cd slippay
pnpm install

# Spin up local Supabase (postgres + auth + studio)
pnpm supabase:start
pnpm supabase:reset    # apply migrations to fresh db

# Backend (Deno + Hono)
cd supabase/functions/api
deno run --allow-all --watch index.ts
# api on http://localhost:8000/api

# Listener (separate terminal)
cd apps/listener
pnpm dev
# watches Horizon testnet SSE for any active merchant address

# Frontend (separate terminal)
cd apps/web
pnpm dev
# spa on http://localhost:5173
```

Run unit tests:

```sh
pnpm -r test                              # everything
pnpm --filter @slippay/listener test      # matcher, reconciler, webhook, ssrf
pnpm api:test                             # deno tests
cd contracts/subscription && cargo test --release
```

---

## Production deploy (current)

The live stack on `165.22.10.194` is provisioned PM2-native:

```sh
# server prereqs (one-time, root): nginx, certbot, node 20, pm2, ufw, fail2ban
# deploy user prereqs (one-time, user-space): pnpm via npm, deno binary

# from the laptop:
rsync -az --exclude node_modules/ --exclude .git/ --exclude '.env*' \
  --exclude 'apps/*/dist/' --exclude 'packages/*/dist/' \
  ./ deploy@host:/opt/slippay-backend/

ssh deploy@host '
  cd /opt/slippay-backend
  pnpm install --frozen-lockfile
  pnpm -r build
  cd supabase/functions/api && deno cache index.ts && cd /opt/slippay-backend
  pm2 reload ecosystem.config.cjs --update-env
'
```

Secrets live in `/opt/slippay-backend/.env` (mode 600), never committed:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLIPPAY_DB_SCHEMA=public
API_PORT=8080
CHECKOUT_BASE_URL=https://app.slippay.cc
RATE_BRL_USDC=          # optional override; else CoinGecko
STELLAR_NETWORK=TESTNET
MERCHANT_POLL_MS=30000
```

Detailed mainnet-readiness checklist: `docs/mainnet-readiness.md`.

---

## Roadmap (falsifiable milestones)

These are the predictions the project should be measured against. Failures
should be flagged, not glossed over.

### 90 days (by 2026-08-10)

- BRL -> USDC conversion rate >= 30% on first 5 merchants once a BR anchor
  partnership lands. Below 30% means buyer-side Pix friction is higher than
  estimated and the architecture needs a rethink.
- Subscription primitive used by >= 3 paying merchants on mainnet (recurring
  charges actually fire). Below 3 means subscription was over-engineered.
- Open-source `stellar-payment-watcher` (extract from `apps/listener`) reaches
  >= 50 GitHub stars within 90 days of release. Below 50 means dev demand
  for the abstraction is weaker than predicted.

### 12 months (by 2027-02-10)

- If at least one of {Bitso, Foxbit, Mercado Bitcoin, Conduit/Braza} launches
  a competing BRL -> USDC merchant checkout at scale, slippay's wedge is
  closed by an incumbent. The bet is that the incumbents target B2B
  cross-border and miss the e-commerce checkout layer.
- BRZ-on-Stellar circulating supply remains <\$5M USD through 2026 (verifiable
  at app.rwa.xyz/assets/BRZ), confirming that BR-Stellar is functionally
  greenfield for the foreseeable window.

### Soroban subscription contract (M1-M4 deliverables)

See `docs/scf/soroban-subscription-proposal.md` for milestone-locked tranche
plan and audit prep. Summary:

- M1 (weeks 1-3, contract spec + scaffold + 30+ unit tests on testnet)
- M2 (weeks 4-6, mainnet-ready code + JS/TS SDK + wallet matrix)
- M3 (weeks 7-9, mainnet deployment + 5 demo merchants + slippay backend)
- M4 (weeks 10-16, third-party audit + open-source release + dev rel)

---

## Honest disclosures

The "non-custodial" property is precise: slippay never holds buyer funds at
any instant. But under BCB Resolução 521, the BRL -> USDC leg is FX-classified
and requires a licensed counterparty. Slippay sits on top of a licensed BR
anchor (Transfero, Bitso, or equivalent) that handles the regulated flow.
Slippay handles the merchant API, settlement matching, webhook delivery, and
hosted checkout. Without that partnership in place, mainnet launch is blocked
by regulation, not by code.

The "Stellar + MoneyGram cash-out 180+ countries" line is structural, not
volume-based. MoneyGram-on-Stellar processes roughly \$30M cumulative since
2022 launch — small in absolute terms but unique to Stellar. No EVM-based
competitor has comparable cash rails.

The competitive landscape is honestly crowded:

- Coinbase Commerce ships 1% non-custodial USDC (sunsetting their international
  self-custodial product in 2025, which is the open window).
- Yodl runs 0.2% non-custodial EVM checkout — 5x cheaper than slippay.
- Stripe (Bridge.xyz, $1.1B Feb 2025) ships USDC checkout to Shopify in 34
  countries.
- Circle Payments Network (CPN, launched May 2025) is becoming the rails of
  rails; slippay needs to be a CPN node when CPN opens.
- PayKit (`usepaykit/stellartools`) is a direct Stellar-native competitor in
  pre-GTM stage; we're racing the same niche.

If the partnership and SCF tracks both stall, slippay collapses to "yet another
crypto checkout" and competes on price against opponents with 100x the
distribution. The bet is that the partnership lands within 90 days.

---

## Contributing

This is a solo-founder repo at the moment. Issues and PRs welcome; the
maintainer is the author. License Apache-2.0 for the contract; backend / web
will be relicensed when the commercial wrapper is finalized (currently
unlicensed in this repo, treat as source-available for review purposes).

For partnership conversations (BR anchors, Stellar ecosystem, audit firms),
see `docs/outreach/` for outreach drafts and contact below.

