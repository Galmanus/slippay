# SlipPay Documentation

Stellar-native checkout SDK for Brazilian merchants billing globally.
Pix in, USDC or PYUSD out, no chargebacks.

> **Status**: testnet live at [api.slippay.cc](https://api.slippay.cc/api/health) ·
> mainnet planned 2026-Q3

## Get started

| | |
|---|---|
| [**Quickstart**](./quickstart.md) | Create your first order in five minutes. |
| [**Architecture**](./concepts/architecture.md) | The three-tier picture: api, listener, contracts. |
| [**Authentication**](./api-reference/authentication.md) | API keys, JWT sessions, webhook HMAC. |

## API reference

| resource | description |
|---|---|
| [Merchants](./api-reference/merchants.md) | Sign up, manage settings, rotate API key. |
| [Orders](./api-reference/orders.md) | One-shot payments. Buyer pays, you get a webhook. |
| [Subscriptions](./api-reference/subscriptions.md) | Recurring billing. Idempotent on time. |
| [Webhooks](./api-reference/webhooks.md) | Event types, retry semantics, HMAC verification. |
| [Errors](./api-reference/errors.md) | Status codes and error shapes. |

## Guides

| | |
|---|---|
| [BR-export merchants](./guides/br-export-merchants.md) | Stop the 6% leak: invoice in USD, settle in USDC. |
| [Drop-in checkout SDK](./guides/drop-in-sdk.md) | Two lines of JavaScript on your site. |
| [Recurring billing](./guides/recurring-billing.md) | Subscriptions end-to-end. |
| [WooCommerce plugin](./guides/woocommerce.md) | Install + configure on any WC store. |
| [Handle webhooks](./guides/webhooks-handler.md) | Verify HMAC, idempotency, retry windows. |

## Concepts

| | |
|---|---|
| [Architecture](./concepts/architecture.md) | How the three runtime processes fit. |
| [Non-custodial settlement](./concepts/non-custodial-settlement.md) | What "non-custodial" actually means here. |
| [Regulatory framing](./concepts/regulatory.md) | BCB Res 519/520/521 and the partnership-with-VASP model. |

## Where to next

- See live: [api.slippay.cc/preview](https://api.slippay.cc/preview) — buyer-flow simulation
- SDK demo: [api.slippay.cc/demo](https://api.slippay.cc/demo) — drop-in checkout in action
- Sign up: [api.slippay.cc/signup](https://api.slippay.cc/signup) — get a testnet API key
- Issues / questions: [github.com/Galmanus/slippay/issues](https://github.com/Galmanus/slippay/issues)

## Stay close to the runtime

Every claim in this documentation should be verifiable against the code. If you
find a doc that says something the code doesn't do, file an issue — that's a
bug, not an aspiration. The honest disclosures section in the
[top-level README](../README.md#honest-disclosures) is the canonical place for
known gaps between marketing and runtime.
