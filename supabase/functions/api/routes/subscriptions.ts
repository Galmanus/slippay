import { Hono } from "hono";
import type { SupabaseClient } from "supabase";
import {
  CreateSubscriptionInputSchema,
  UpdateSubscriptionInputSchema,
  ORDER_DEFAULT_EXPIRY_MINUTES,
} from "@slippay/shared";
import { requireApiKey } from "../middleware/auth_apikey.ts";
import { generateMemo } from "../lib/memo.ts";
import { getBrlPerUsdc } from "../lib/rate.ts";

type Vars = { merchant: { id: string; [k: string]: unknown }; supabase: SupabaseClient };
const r = new Hono<{ Variables: Vars }>();

const CHECKOUT_BASE = Deno.env.get("CHECKOUT_BASE_URL") ?? "http://localhost:5173";

// POST /v1/subscriptions — create a subscription
r.post("/", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  let input: ReturnType<typeof CreateSubscriptionInputSchema.parse>;
  try {
    input = CreateSubscriptionInputSchema.parse(await c.req.json());
  } catch (e: unknown) {
    const issues = (e as { issues?: unknown }).issues ?? (e as { errors?: unknown }).errors ?? [];
    return c.json({ error: "validation_error", issues }, 400);
  }
  const { data, error } = await sb.from("subscriptions").insert({
    merchant_id: merchant.id,
    external_ref: input.external_ref ?? null,
    buyer_stellar_address: input.buyer_stellar_address ?? null,
    buyer_email: input.buyer_email ?? null,
    asset_code: input.asset_code,
    brl_amount: input.brl_amount,
    period_seconds: input.period_seconds,
    max_periods: input.max_periods ?? null,
    expires_at: input.expires_at ?? null,
    webhook_url: input.webhook_url ?? null,
    metadata: input.metadata ?? {},
    next_charge_at: new Date().toISOString(),
  }).select("*").single();
  if (error) return c.json({ error: "create_failed", detail: error.message }, 400);
  return c.json({ subscription: data }, 201);
});

// GET /v1/subscriptions — list merchant's subscriptions
r.get("/", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 200);
  let q = sb.from("subscriptions").select("*").eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return c.json({ error: "list_failed", detail: error.message }, 400);
  return c.json({ subscriptions: data ?? [] });
});

// GET /v1/subscriptions/:id — single subscription
r.get("/:id", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const id = c.req.param("id");
  const { data, error } = await sb.from("subscriptions")
    .select("*").eq("id", id).eq("merchant_id", merchant.id).maybeSingle();
  if (error || !data) return c.json({ error: "not_found" }, 404);
  return c.json({ subscription: data });
});

// PATCH /v1/subscriptions/:id — update status/webhook/metadata
r.patch("/:id", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const id = c.req.param("id");
  let input: ReturnType<typeof UpdateSubscriptionInputSchema.parse>;
  try {
    input = UpdateSubscriptionInputSchema.parse(await c.req.json());
  } catch (e: unknown) {
    const issues = (e as { issues?: unknown }).issues ?? (e as { errors?: unknown }).errors ?? [];
    return c.json({ error: "validation_error", issues }, 400);
  }
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.webhook_url !== undefined) patch.webhook_url = input.webhook_url;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  if (Object.keys(patch).length === 0) {
    return c.json({ error: "empty_update" }, 400);
  }
  const { data, error } = await sb.from("subscriptions")
    .update(patch).eq("id", id).eq("merchant_id", merchant.id)
    .select("*").maybeSingle();
  if (error || !data) return c.json({ error: "update_failed", detail: error?.message }, 400);
  return c.json({ subscription: data });
});

// POST /v1/subscriptions/:id/charge — materialize the next billing cycle as an order
r.post("/:id/charge", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const id = c.req.param("id");

  const { data: sub, error: fetchErr } = await sb.from("subscriptions")
    .select("*").eq("id", id).eq("merchant_id", merchant.id).maybeSingle();
  if (fetchErr || !sub) return c.json({ error: "not_found" }, 404);
  if (sub.status !== "active") {
    return c.json({ error: "not_active", status: sub.status }, 409);
  }
  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    await sb.from("subscriptions").update({ status: "expired" }).eq("id", id);
    return c.json({ error: "expired" }, 409);
  }
  if (sub.max_periods && sub.charges_done >= sub.max_periods) {
    await sb.from("subscriptions").update({ status: "expired" }).eq("id", id);
    return c.json({ error: "max_periods_reached" }, 409);
  }

  // Idempotency on time: don't create a new order if the previous one is still
  // pending and within the same period window.
  const { data: openOrder } = await sb.from("orders")
    .select("*").eq("subscription_id", id).eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (openOrder) {
    return c.json({
      order: openOrder,
      checkout_url: `${CHECKOUT_BASE}/checkout/${openOrder.id}`,
      idempotent: true,
    }, 200);
  }

  const rate = await getBrlPerUsdc();
  const usdc = (parseFloat(sub.brl_amount) / rate).toFixed(7);
  const memo = await generateMemo();
  const expiresAt = new Date(Date.now() + ORDER_DEFAULT_EXPIRY_MINUTES * 60_000).toISOString();
  const nextChargeAt = new Date(Date.now() + sub.period_seconds * 1000).toISOString();

  const { data: order, error: orderErr } = await sb.from("orders").insert({
    merchant_id: merchant.id,
    subscription_id: id,
    external_ref: sub.external_ref,
    brl_amount: sub.brl_amount,
    usdc_amount: usdc,
    rate_brl_usdc: rate.toFixed(7),
    memo,
    expires_at: expiresAt,
  }).select("*").single();
  if (orderErr) return c.json({ error: "order_create_failed", detail: orderErr.message }, 400);

  // Bump subscription bookkeeping; charges_done is incremented on payment in
  // the listener (see matcher.ts), not here, since this is just an invoice.
  await sb.from("subscriptions").update({
    last_charge_at: new Date().toISOString(),
    next_charge_at: nextChargeAt,
  }).eq("id", id);

  return c.json({
    order,
    checkout_url: `${CHECKOUT_BASE}/checkout/${order.id}`,
    idempotent: false,
  }, 201);
});

// POST /v1/subscriptions/:id/cancel — convenience over PATCH
r.post("/:id/cancel", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const id = c.req.param("id");
  const { data, error } = await sb.from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", id).eq("merchant_id", merchant.id).neq("status", "cancelled")
    .select("*").maybeSingle();
  if (error || !data) return c.json({ error: "cannot_cancel" }, 400);
  return c.json({ subscription: data });
});

export default r;
