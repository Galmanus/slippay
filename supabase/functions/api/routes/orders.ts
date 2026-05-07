import { Hono } from "hono";
import type { SupabaseClient } from "supabase";
import { CreateOrderInputSchema, ORDER_DEFAULT_EXPIRY_MINUTES } from "@slippay/shared";
import { requireApiKey } from "../middleware/auth_apikey.ts";
import { generateMemo } from "../lib/memo.ts";
import { getBrlPerUsdc } from "../lib/rate.ts";

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

export default r;
