# @slippay/ramp-kit

LATAM fiat on/off-ramp kit for Stellar. One `Anchor` interface, multiple
providers, and a router that picks the best ramp per currency/rail — with live
quote fan-out across anchors.

Built for the **Brazil Ramps and Regional Kits** lane at Stellar Summit SP 2026.
Extracted from Slippay's production ramp surface (the code that powers
[slippay.cc](https://slippay.cc)'s Pix→USDC flow), reworked into a standalone,
runtime-agnostic package: no Deno, no Supabase, no env coupling — you inject
config, it does ramps.

## What's inside

| Module | What it does |
|---|---|
| `Anchor` interface | One TypeScript contract for any fiat ramp provider: customers, KYC, quotes, on-ramp, off-ramp, fiat accounts. 700 lines of documented types. |
| `EtherfuseClient` | Full client for [Etherfuse](https://etherfuse.com) stablebonds — **TESOURO** (BRL, Tesouro Direto) via **Pix** and CETES (MXN) via SPEI, settling on Stellar. Customer + KYC (hosted iframe) + quote + on/off-ramp + order polling. |
| `CriptoPixClient` | Charge-model Pix provider (BRL → USDT/USDC), webhook-based status. |
| `RampRouter` | Multi-anchor router: `resolve({currency, rail, token})` picks a provider; `bestQuote(...)` fans a quote out to every capable anchor in parallel and returns the best rate, plus the full comparison and per-provider failures. |
| `applyMargin` | Transparent platform spread (bps-capped) with gross/fee breakdown for your ledger. |

## Install

```sh
npm i @slippay/ramp-kit
# or, in this monorepo
pnpm --filter @slippay/ramp-kit build
```

## Quickstart: BRL → TESOURO via Pix

```ts
import { EtherfuseClient, RampRouter, applyMargin } from '@slippay/ramp-kit';

const etherfuse = new EtherfuseClient({
  apiKey: process.env.ETHERFUSE_API_KEY!,          // server-side only
  baseUrl: 'https://api.sand.etherfuse.com',       // sandbox; drop .sand for prod
});

const router = new RampRouter([etherfuse /*, criptopix, manteca... */]);
const anchor = router.resolve({ currency: 'BRL', rail: 'pix', token: 'TESOURO' })!;

const customer = await anchor.createCustomer({ email, publicKey: wallet });
const quote = await anchor.getQuote({
  fromCurrency: 'BRL', toCurrency: 'TESOURO',
  fromAmount: '100', customerId: customer.id, stellarAddress: wallet,
});
const priced = applyMargin(quote, 190); // your 1.9% spread, shown to the user

const order = await anchor.createOnRamp({
  customerId: customer.id, quoteId: quote.id, stellarAddress: wallet,
  fromCurrency: 'BRL', toCurrency: 'TESOURO', amount: '100',
});
// order.paymentInstructions -> Pix copia-e-cola / QR
// poll anchor.getOnRampTransaction(order.id) until status === 'completed'
// -> order.stellarTxHash: TESOURO on-chain
```

Off-ramp is symmetric: `getQuote({ fromCurrency: 'TESOURO', toCurrency: 'BRL' })`
→ `createOffRamp(...)` → BRL lands via Pix.

## Multi-anchor: one API, live quotes

```ts
const router = new RampRouter([etherfuse, criptopix]);

// best rate across every provider that supports the route, in parallel:
const { best, all, failed } = await router.bestQuote({
  fromCurrency: 'BRL', toCurrency: 'USDC', fromAmount: '500',
});
console.log(best.anchor.displayName, best.quote.toAmount);
// `all` = full comparison for your UI; `failed` = providers that errored
// (one broken provider never kills the quote).
```

Adding a provider = implementing `Anchor` and appending it to the array.
The router selects by each anchor's declared `supportedCurrencies`,
`supportedRails`, and `supportedTokens` — no central registry to edit.

## E2E demo

```sh
ETHERFUSE_API_KEY=... DEMO_WALLET=G... DEMO_EMAIL=you@x.com npm run demo
```

Walks the full cycle against the Etherfuse sandbox: router selection →
customer + KYC → BRL→TESOURO quote with margin breakdown → Pix payment
instructions → on-chain settlement polling → TESOURO→BRL off-ramp quote.
Sandbox keys: [devnet.etherfuse.com](https://devnet.etherfuse.com).

## Tests

```sh
npm test   # 11 tests: router selection, quote fan-out, failure isolation, margin math
```

## Security posture

- Clients are **server-side only** — API keys never reach the browser.
- Off-ramp receiver addresses should be pinned client-side (see Slippay's
  `VITE_4P_OFFRAMP_RECEIVER` pattern) so a compromised backend can't redirect
  funds silently.
- The margin is capped at 1000 bps in code — config typos can't 100x the fee.
- Non-custodial: the kit never holds keys or signs — the user's wallet does.

## License

MIT
