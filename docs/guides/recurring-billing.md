# Recurring billing

Subscriptions in SlipPay are **off-chain orchestrated relationships** that
materialize into on-chain orders each cycle. This guide walks through the
end-to-end flow.

## Mental model

A subscription is a **template** for orders, plus bookkeeping on cycles
done. It does not auto-charge by itself. A scheduler (yours or a
SlipPay-side scheduler in v0.2) calls `POST /:id/charge` each period,
which creates an order; the buyer pays the order; the listener confirms
and bumps `charges_done`.

> **Why off-chain orchestration**: the buyer signs each order. This is
> worse UX than card-on-file recurring, but it's the safest path before
> we ship the v0.2 Soroban contract that pre-authorizes future debits.
> See the [SCF proposal](../scf/soroban-subscription-proposal.md) for v0.2.

## Step-by-step

### 1. Create the subscription

```sh
curl -X POST https://api.slippay.cc/api/v1/subscriptions \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "brl_amount": "29.90",
    "period_seconds": 2592000,
    "asset_code": "USDC",
    "max_periods": 12,
    "buyer_email": "buyer@example.com",
    "external_ref": "customer_42_pro_plan"
  }'
```

`period_seconds: 2592000` = 30 days. Other common values:

| period | seconds |
|---|---|
| 1 day | 86400 |
| 1 week | 604800 |
| 30 days | 2592000 |
| 90 days | 7776000 |
| 365 days | 31536000 |

`max_periods: 12` caps at 12 charges then expires automatically.

### 2. Trigger the first charge

```sh
curl -X POST https://api.slippay.cc/api/v1/subscriptions/<sub_id>/charge \
  -H "Authorization: Bearer sk_live_..."
```

Returns:

```json
{
  "order": {
    "id": "ord_...",
    "memo": "ce230c...",
    "usdc_amount": "5.44",
    "status": "pending",
    "subscription_id": "sub_..."
  },
  "checkout_url": "https://api.slippay.cc/checkout/ord_...",
  "idempotent": false
}
```

### 3. Buyer pays the order

Either:

- **Email the buyer the `checkout_url`** (use `buyer_email` from step 1
  to send a "your subscription is due" email)
- **Embed the SDK on a billing portal** (see [drop-in SDK](./drop-in-sdk.md))
- **Buyer manually opens the checkout URL** from a portal you provide

The buyer signs once with their Stellar wallet. Standard hosted checkout
flow.

### 4. Listener confirms, bookkeeping bumps

When the on-chain payment lands:

- `orders.status` flips to `paid`
- `subscriptions.charges_done` bumps
- `subscriptions.last_charge_at` set
- if `charges_done >= max_periods`, `subscriptions.status` flips to `expired`
- `subscription.charged` webhook fires to your URL

```json
{
  "type": "subscription.charged",
  "data": {
    "id": "ord_...",
    "subscription_id": "sub_...",
    "external_ref": "customer_42_pro_plan",
    "brl_amount": "29.90",
    "usdc_amount": "5.44",
    "tx_hash": "20655a78...",
    "memo": "ce230c...",
    "paid_at": "2026-05-10T14:00:06Z"
  }
}
```

### 5. Trigger subsequent charges

Set up a daily cron on your side:

```ts
// every day at 02:00 UTC, run this:
const due = await fetch(API + "/v1/subscriptions?status=active", { headers });
const now = new Date();
for (const sub of due.subscriptions) {
  if (new Date(sub.next_charge_at) > now) continue;
  // charge is due
  await fetch(`${API}/v1/subscriptions/${sub.id}/charge`, { method: "POST", headers });
}
```

The `/charge` call is idempotent on time:

- If you already triggered a charge this period and the order is still
  pending, the same order is returned with `idempotent: true`.
- If the previous order was paid, calling charge again creates the next
  cycle's order.

This means re-running the cron is safe even if it overlaps with a previous
run.

## Idempotency in detail

The endpoint returns:

| condition | status | idempotent | order.id |
|---|---|---|---|
| no pending order in current period | 201 | false | new |
| pending order in current period (still within `expires_at`) | 200 | true | existing |
| previous order paid, period has elapsed | 201 | false | new |
| subscription not active | 409 | n/a | n/a |
| max_periods reached | 409 | n/a | n/a |

Use `idempotent` to decide whether to send a new email to the buyer.
Sending one for `true` would mean re-emailing the same checkout URL,
which is fine but redundant.

## Pause / resume

```sh
# pause (no further charges can be created)
curl -X PATCH .../v1/subscriptions/<id> \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{ "status": "paused" }'

# resume
curl -X PATCH .../v1/subscriptions/<id> \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{ "status": "active" }'
```

Pause does not refund the current period; if you want pro-rated refunds,
that's manual via your own logic for now.

## Cancel

```sh
curl -X POST .../v1/subscriptions/<id>/cancel \
  -H "Authorization: Bearer ..."
```

Sets status to `cancelled`. No further charges can be created. Pending
orders for this subscription stay pending until they expire (30 min default).

## Edge cases

### Buyer never pays a charge

The order expires after 30 minutes (`expires_at`). The subscription's
`charges_done` does **not** bump (only confirmed payments do). The
subscription's `next_charge_at` already advanced when the charge was
created. If you want to retry, call `/charge` again — but be aware:

- if the previous order is still pending, you'll get the **same** order
  back (`idempotent: true`)
- if the previous order has expired, a new order is created and the
  cycle restarts

### Buyer pays an underpaid amount

The order goes to `underpaid` (not `paid`). `charges_done` does **not**
bump. You'll need to manually reconcile or refund the partial payment.

### Subscription expires mid-charge

If `expires_at` passes while a pending order is open, the order can still
be paid (orders aren't subject to the subscription's `expires_at`, only
their own `expires_at`). The subscription is marked `expired` after the
payment confirms; no further charges can be created.

### Switching asset code

You can't change `asset_code` on an existing subscription. Cancel and
create a new one if the merchant wants to switch USDC → PYUSD.

## Schema reference

See [api-reference/subscriptions](../api-reference/subscriptions.md) for the
full Subscription object shape and endpoint details.

## v0.2 preview: Soroban-native subscriptions

The off-chain orchestration approach has UX friction: the buyer signs each
cycle. v0.2 ships a Soroban contract that pre-authorizes future debits
once. After buyer signs the authorization, the backend (or anyone) calls
`charge(id)` on the contract; the contract pulls the amount from buyer to
merchant in one transaction. No buyer signature per cycle.

When v0.2 ships:

- the API surface stays the same
- `subscriptions.soroban_contract_id` populates with the on-chain id
- the listener watches contract events instead of memo-matched payments
- `subscription.charged` webhooks fire identically

Migration path will be documented when v0.2 lands. Expected: 2026-Q3.
