# Architecture

SlipPay is three runtime processes plus a Postgres database, all on a single
VPS. Each process is small, supervised by PM2, and restarts independently.

## High-level

```
                buyer browser                    merchant server
                      |                                |
                      v                                ^
              hosted checkout (web)             merchant REST API
                      |                                |
                      v                                v
            +--------------------------------------------+
            |  api (Deno + Hono) :8080                   |
            |  - /api/* routes (orders, subs, merchants) |
            |  - / static SPA fallback (apps/web/dist)   |
            +--------------------------------------------+
                                |
              +-----------------+-----------------+
              |                                   |
              v                                   v
      +---------------+                  +-------------------+
      |  Postgres     | <--- listener --|  Stellar Horizon  |
      |  (Supabase)   |                  |  (SSE + REST)     |
      +---------------+                  +-------------------+
              ^
              |
       webhook delivery (HMAC + retries)
              |
              v
       merchant webhook URL
```

## Runtime processes

| process | runtime | port | lines of code |
|---|---|---|---|
| slippay-api | Deno 2.7 | 8080 | ~600 |
| slippay-listener | Node 20 | (no port) | ~800 |
| Postgres | Supabase | 5432 (managed) | n/a |

PM2 supervises both Node processes. Nginx terminates TLS and proxies
`api.slippay.cc` and `app.slippay.cc` (alias) to `localhost:8080`.

### slippay-api

A Hono server running on Deno. Routes:

- `/api/v1/merchants/*` — merchant CRUD, JWT auth (Supabase).
- `/api/v1/orders/*` — order CRUD, API key auth.
- `/api/v1/subscriptions/*` — subscription CRUD + charge, API key auth.
- `/api/health` — liveness probe.
- `/*` (catch-all) — static file fallback serving `apps/web/dist/index.html`
  for SPA routes and the landing page.

Key modules:

- `supabase/functions/api/middleware/auth_apikey.ts` — verifies `sk_live_...`
  via SHA-256 lookup, attaches `c.var.merchant`.
- `supabase/functions/api/middleware/auth_jwt.ts` — verifies Supabase JWT,
  attaches `c.var.user`.
- `supabase/functions/api/lib/memo.ts` — generates 32-byte memos via
  `crypto.subtle.digest("SHA-256", random_seed)`.
- `supabase/functions/api/lib/rate.ts` — fetches BRL/USDC rate from
  CoinGecko (or `RATE_BRL_USDC` env override for tests).

### slippay-listener

A long-running Node process that:

1. Polls `merchants` every 30s for active addresses.
2. Opens a Horizon SSE stream per address (`/payments?cursor=...`).
3. On each payment event, looks up an order by `memo`, runs the matcher,
   updates the order status, and enqueues a webhook delivery.
4. A worker thread drains `webhook_deliveries`, signs each payload with
   HMAC, POSTs to the merchant URL, and reschedules failures.

Key modules:

- `apps/listener/src/manager.ts` — merchant poll cycle.
- `apps/listener/src/horizon.ts` — SSE stream wrapper with cursor persistence.
- `apps/listener/src/matcher.ts` — pure function: payment event + order -> outcome.
- `apps/listener/src/reconciler.ts` — applies outcome to DB, fires webhook.
- `apps/listener/src/webhook.ts` — delivery worker with retry schedule.
- `apps/listener/src/ssrf.ts` — validates webhook URLs against private ranges.

### Postgres schema

| table | purpose |
|---|---|
| `merchants` | one row per merchant, includes API key hash and webhook secret |
| `orders` | one-shot and subscription-derived orders |
| `subscriptions` | recurring billing relationships |
| `webhook_deliveries` | event queue + retry state |
| `listener_state` | per-account paging cursor for resumable SSE |

Plus `pg_cron` jobs:

- Every 5 minutes: expire pending orders past `expires_at`.

Migrations live in `supabase/migrations/`.

## Data flow: a payment, end to end

```
  1. POST /v1/orders                                       <-- merchant
     |
     v
  2. orders row (status=pending, memo=<sha256>)            <-- api
     |
     v
  3. checkout_url returned                                 <-- api
     |
     v
  4. buyer opens hosted checkout                           <-- web
     |
     v
  5. wallet flow signs Stellar tx with Memo.hash(memo)     <-- web -> wallet
     |
     v
  6. tx submitted to Horizon                               <-- wallet -> Stellar
     |
     v
  7. Horizon broadcasts via SSE                            <-- Stellar -> listener
     |
     v
  8. matcher: asset_code, asset_issuer, to, memo, amount   <-- listener
     |
     v
  9. orders.update status=paid, tx_hash=...                <-- listener
     |
     v
 10. webhook_deliveries.insert (HMAC-signed payload)       <-- listener
     |
     v
 11. delivery worker POSTs to merchant.webhook_url         <-- listener
     |
     v
 12. merchant fulfills order in their system               <-- merchant
```

Average end-to-end time from buyer signature to webhook delivery:
~6–8 seconds (one Stellar ledger close + listener SSE round trip + HTTP POST).

## Why three separate processes

Each has different scaling and failure characteristics:

- **api** is request-scoped and stateless. Crashes don't lose work — the
  client retries.
- **listener** is long-lived and has cursor state. Crashes resume from the
  last persisted cursor in `listener_state`, so payments aren't missed
  during downtime — they're processed late.
- **DB** is the source of truth. Both api and listener can be replaced
  without touching it.

Each process can be scaled, deployed, and debugged independently.

## Why Stellar (and not EVM)

Three properties matter for subscription unit economics:

1. **Deterministic gas**. Stellar charges 0.00001 XLM per operation
   (~$0.0001 USD). EVM gas spikes to $1–$50 during NFT/memecoin events,
   which kills $5/mo subscription margins.
2. **Fast finality**. ~6 seconds, deterministic. Ethereum mainnet is ~12s
   probabilistic with reorg risk; Base is ~2s soft but reorg-prone during
   sequencer failures.
3. **MoneyGram cash off-ramp**. Live in 180+ countries on Stellar since
   2022. No EVM-based competitor has comparable cash rails.

The trade-off: Stellar's DeFi composability is thin compared to Ethereum.
SlipPay isn't using DeFi, so this isn't a constraint we feel.

## Why Soroban for v0.2 subscriptions

The v0.1 subscription primitive is **off-chain orchestrated**: SlipPay
backend triggers each charge by creating an order, the buyer signs each
order individually. That's a worse UX than card-on-file recurring billing.

The v0.2 design uses a Soroban contract that the buyer pre-authorizes once
to debit their wallet at a configured period. After authorization, the
backend (or anyone) calls `charge(id)` on the contract; the contract
verifies time elapsed and pulls the amount from buyer to merchant in a
single transaction. No buyer signature per cycle.

See [SCF proposal](../scf/soroban-subscription-proposal.md) for the
full M1-M4 deliverable plan.

## What's not in this architecture (yet)

- **Pix-in flow** — currently buyers must already hold USDC. The Pix-in
  leg requires a partnership with a licensed BR anchor (Transfero, Bitso,
  or equivalent). When the partnership lands, the architecture extends:
  buyer pays BRL via Pix on the anchor's flow, anchor mints USDC against
  the merchant's address on Stellar, listener confirms as usual.
- **Multichain** — Solana support is in roadmap but not in code. The
  listener and matcher are Stellar-specific (Horizon SSE, Stellar memo
  semantics, Circle USDC issuer).
- **Refunds** — no on-chain refund flow yet. Manual merchant-initiated USDC
  return is on the v0.4 roadmap.
- **Backups** — Supabase auto-backs the DB; no application-level backup
  job. For mainnet, this needs hardening.
