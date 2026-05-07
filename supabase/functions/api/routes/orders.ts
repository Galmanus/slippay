import { Hono } from "hono";
import type { SupabaseClient } from "supabase";
import { CreateOrderInputSchema, ORDER_DEFAULT_EXPIRY_MINUTES } from "@slippay/shared";
import { requireApiKey } from "../middleware/auth_apikey.ts";
import { generateMemo } from "../lib/memo.ts";
import { getBrlPerUsdc } from "../lib/rate.ts";
import { serviceClient } from "../lib/supabase.ts";

type Vars = { merchant: { id: string; [k: string]: unknown }; supabase: SupabaseClient };
const r = new Hono<{ Variables: Vars }>();

const CHECKOUT_BASE = Deno.env.get("CHECKOUT_BASE_URL") ?? "http://localhost:5173";

r.post("/", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  let input: ReturnType<typeof CreateOrderInputSchema.parse>;
  try {
    input = CreateOrderInputSchema.parse(await c.req.json());
  } catch (e: unknown) {
    const issues = (e as { issues?: unknown }).issues ?? (e as { errors?: unknown }).errors ?? [];
    return c.json({ error: "validation_error", issues }, 400);
  }
  const rate = await getBrlPerUsdc();
  const usdc = (parseFloat(input.brl_amount) / rate).toFixed(7);
  const memo = await generateMemo();
  const minutes = input.expires_in_minutes ?? ORDER_DEFAULT_EXPIRY_MINUTES;
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data, error } = await sb.from("orders").insert({
    merchant_id: merchant.id,
    external_ref: input.external_ref ?? null,
    brl_amount: input.brl_amount,
    usdc_amount: usdc,
    rate_brl_usdc: rate.toFixed(7),
    memo,
    expires_at: expiresAt,
  }).select("*").single();
  if (error) return c.json({ error: "create_failed", detail: error.message }, 400);
  return c.json({
    order: data,
    checkout_url: `${CHECKOUT_BASE}/checkout/${data.id}`,
  }, 201);
});

r.get("/", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 200);
  let q = sb.from("orders").select("*").eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return c.json({ error: "list_failed", detail: error.message }, 400);
  const orders = (data ?? []).map((o: Record<string, unknown>) => ({
    ...o,
    brl_amount: typeof o.brl_amount === "number"
      ? o.brl_amount.toFixed(2)
      : o.brl_amount,
  }));
  return c.json({ orders });
});

r.get("/:id", async (c) => {
  const id = c.req.param("id");
  const sb = serviceClient();
  const { data, error } = await sb.from("orders")
    .select(`
      id, merchant_id, brl_amount, usdc_amount, memo, status,
      expires_at, paid_at, tx_hash, created_at, external_ref,
      merchants ( stellar_address )
    `)
    .eq("id", id).maybeSingle();
  if (error || !data) return c.json({ error: "not_found" }, 404);
  const merchantSubrow = (data as unknown as { merchants?: { stellar_address: string | null } | null }).merchants;
  const merchant_stellar_address = merchantSubrow?.stellar_address ?? null;
  // strip the embedded relation; flatten to a single field
  const { merchants: _ignored, ...rest } = data as unknown as Record<string, unknown> & { merchants?: unknown };
  return c.json({ order: { ...rest, merchant_stellar_address } });
});

r.post("/:id/cancel", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const id = c.req.param("id");
  const { data, error } = await sb.from("orders")
    .update({ status: "cancelled" })
    .eq("id", id).eq("merchant_id", merchant.id).eq("status", "pending")
    .select("*").maybeSingle();
  if (error || !data) return c.json({ error: "cannot_cancel" }, 400);
  return c.json({ order: data });
});

export default r;
