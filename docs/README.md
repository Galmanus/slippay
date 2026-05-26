# SlipPay Documentation

Stellar-native commerce stack for Brazilian merchants billing globally.
Pix in, USDC out (PYUSD coming), no chargebacks.

> **Status**: **live on Stellar mainnet** since 2026-05-16.
> Subscription contract `CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN`
> on [stellar.expert/explorer/public](https://stellar.expert/explorer/public/contract/CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN).
> API at [api.slippay.cc](https://api.slippay.cc/api/health).

> **Ask Slippay** — the support agent on the bottom-right of every page
> is **Concierge**, governed by the
> [**Bluewave Soul Specification Language v7**](https://galmanus.github.io/ssl-spec/).
> The full open spec is at `galmanus.github.io/ssl-spec`. See
> [concierge-ssl](./integrations/concierge-ssl.md) for how the soul
> file constrains the agent — doc-grounded answers, inline citations,
> "I don't have that information" honesty, full audit chain on every
> reply.

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

## Integrations

| | |
|---|---|
| [x402 protocol](./integrations/x402.md) | Pay-per-call resources gated by Stellar USDC. Shipped 2026-05-16. |
| [Ask Slippay · SSL v7](./integrations/concierge-ssl.md) | The Concierge agent is built on the open [Bluewave Soul Specification Language v7](https://galmanus.github.io/ssl-spec/). Doc-grounded, cited, auditable. |

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
