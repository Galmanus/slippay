// x402 protocol integration for Slippay (HTTP 402 Payment Required).
//
// Flow:
//   1. Merchant registers a gated resource via POST /v1/x402-resources
//      (authed by API key). Returns the resource id + slug.
//   2. Client (browser, agent, anything) GETs /v1/x402/:slug.
//   3. On first hit with no X-PAYMENT header → server creates a pending
//      order (memo bound to this client's IP) and replies 402 with
//      Coinbase x402-style payment requirements in the body.
//   4. Client signs a Stellar USDC payment to the merchant address with
//      the issued memo. The existing Slippay listener picks it up and
//      marks the order paid via the standard matcher pipeline.
//   5. Client retries GET. Server sees orders.status='paid' for this
//      (resource, client) tuple → returns the gated content with 200.
//
// What this re-uses (everything load-bearing is already audited):
//   - orders table + memo discipline
//   - matcher.ts (memo→order linking + asset+address validation)
//   - reconciler.ts (transitions status to 'paid')
//   - listener manager + horizon stream
//
// What's new: only this route + an x402_resources table + two FK
// columns on orders. Total ~150 LOC. Audit-002/003/004 fixes apply
// unchanged.

import { Hono } from "hono";
import type { SupabaseClient } from "supabase";
import { z } from "zod";
import { NETWORK, ORDER_DEFAULT_EXPIRY_MINUTES } from "@slippay/shared";
import { requireApiKey } from "../middleware/auth_apikey.ts";
import { rateLimit } from "../middleware/rate_limit.ts";
import { serviceClient } from "../lib/supabase.ts";
import { generateMemo } from "../lib/memo.ts";
import { mapDbError } from "../lib/db-error.ts";

type Vars = { merchant: { id: string; [k: string]: unknown }; supabase: SupabaseClient };
const r = new Hono<{ Variables: Vars }>();

const STELLAR_NETWORK = (Deno.env.get("STELLAR_NETWORK") ?? "testnet") as "testnet" | "mainnet";

const RegisterResourceSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9-_]{0,119}$/),
  usd_amount: z.string().regex(/^\d{1,9}\.\d{1,7}$/, "decimal with up to 7 fractional digits"),
  inline_content: z.string().max(8192).optional(),
  inline_mime: z.string().max(120).optional(),
  redirect_url: z.string().url().optional(),
  description: z.string().max(512).optional(),
}).refine(
  (v) => Boolean(v.inline_content) !== Boolean(v.redirect_url),
  "exactly one of inline_content or redirect_url must be set",
);

// Audit-004 C6/C7 + x402 specific: this route is unauthenticated for the
// payer side, so a per-IP limiter blocks abuse. The merchant-side write
// path already runs under requireApiKey.
r.use("/:slug", rateLimit({ capacity: 30, refillPerSec: 0.5, scope: "x402_payer" }));

// POST /v1/x402-resources — merchant registers a gated resource
r.post("/", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  let input: z.infer<typeof RegisterResourceSchema>;
  try {
    input = RegisterResourceSchema.parse(await c.req.json());
  } catch (e: unknown) {
    const issues = (e as { issues?: unknown }).issues ?? [];
    return c.json({ error: "validation_error", issues }, 400);
  }
  const { data, error } = await sb.from("x402_resources").insert({
    merchant_id: merchant.id,
    slug: input.slug,
    usd_amount: input.usd_amount,
    inline_content: input.inline_content ?? null,
    inline_mime: input.inline_mime ?? "application/json",
    redirect_url: input.redirect_url ?? null,
    description: input.description ?? null,
  }).select("id, slug, usd_amount, description").single();
  if (error) {
    const m = mapDbError(error);
    return c.json({ error: m.code }, m.status as 400 | 409);
  }
  const base = Deno.env.get("CHECKOUT_BASE_URL") ?? "https://api.slippay.cc";
  return c.json({
    resource: data,
    url: `${base}/api/v1/x402/${data.slug}`,
  }, 201);
});

// GET /v1/x402-resources — merchant lists own resources
r.get("/", requireApiKey, async (c) => {
  const merchant = c.get("merchant");
  const sb = c.get("supabase");
  const { data, error } = await sb.from("x402_resources")
    .select("id, slug, usd_amount, description, created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });
  if (error) {
    const m = mapDbError(error);
    return c.json({ error: m.code }, m.status as 400 | 409);
  }
  return c.json({ resources: data ?? [] });
});

// Helper: derive a stable-ish client id. v0.1 = first hop of XFF or socket
// IP; v0.2 can switch to a buyer-provided X-PAYMENT-INTENT header.
function clientIdOf(c: Parameters<Parameters<typeof r.get>[1]>[0]): string {
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return c.req.header("x-real-ip") ?? "anon";
}

// GET /v1/x402/:slug — the x402 endpoint itself
r.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const clientId = clientIdOf(c);
  const sb = serviceClient();

  // Resolve the resource. 404 if unknown.
  const { data: res, error: resErr } = await sb.from("x402_resources")
    .select("id, merchant_id, usd_amount, inline_content, inline_mime, redirect_url, description, merchants ( stellar_address, network )")
    .eq("slug", slug)
    .maybeSingle();
  if (resErr || !res) return c.json({ error: "resource_not_found" }, 404);

  const merchantRel = (res as any).merchants as { stellar_address?: string; network?: string };
  if (!merchantRel?.stellar_address) {
    return c.json({ error: "merchant_not_configured" }, 503);
  }
  const merchantNetwork = (merchantRel.network as "testnet" | "mainnet") ?? STELLAR_NETWORK;
  const net = NETWORK[merchantNetwork];

  // Find the current open intent for (resource, client). If one exists and
  // is paid → serve content. If pending → re-emit the 402 with the same
  // memo (idempotent retry). If none → create a new pending order.
  const { data: existing } = await sb.from("orders")
    .select("id, status, memo, expires_at, paid_at")
    .eq("x402_resource_id", res.id)
    .eq("x402_client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "paid") {
    return serveContent(c, res as any);
  }

  // Either no open intent, or it's expired/underpaid/cancelled — create fresh.
  const stillOpen = existing && existing.status === "pending"
    && existing.expires_at && new Date(existing.expires_at as string) > new Date();

  let memo: string;
  if (stillOpen) {
    memo = existing.memo as string;
  } else {
    memo = await generateMemo();
    const expiresAt = new Date(Date.now() + ORDER_DEFAULT_EXPIRY_MINUTES * 60_000).toISOString();
    const { error: ordErr } = await sb.from("orders").insert({
      merchant_id: res.merchant_id,
      // Pin the consented recipient (the address quoted in this 402) so the
      // listener matches against it even if the merchant later rotates.
      merchant_stellar_address: merchantRel.stellar_address ?? null,
      external_ref: `x402:${slug}:${clientId}`,
      usd_amount: res.usd_amount,
      usdc_amount: res.usd_amount, // 1:1 with USD by Slippay convention
      memo,
      expires_at: expiresAt,
      x402_resource_id: res.id,
      x402_client_id: clientId,
    });
    if (ordErr) {
      const m = mapDbError(ordErr);
      return c.json({ error: m.code }, m.status as 400 | 409);
    }
  }

  // x402 payment requirements body. Schema follows the Coinbase x402
  // reference (https://github.com/coinbase/x402 · scheme="exact").
  const body = {
    x402Version: 1,
    accepts: [{
      scheme: "exact",
      network: merchantNetwork === "mainnet" ? "stellar" : "stellar-testnet",
      asset: `USDC:${net.usdc_issuer}`,
      payTo: merchantRel.stellar_address,
      maxAmountRequired: res.usd_amount,
      resource: `/api/v1/x402/${slug}`,
      description: (res.description as string) ?? "Slippay x402 gated resource",
      mimeType: (res.inline_mime as string) ?? "application/json",
      payload: {
        memo,              // 32-byte hex MEMO_HASH — required at signing time
        memoType: "hash",
        recipient: merchantRel.stellar_address,
        amount: res.usd_amount,
        assetCode: "USDC",
        assetIssuer: net.usdc_issuer,
        horizon: net.horizon,
      },
    }],
    error: null,
  };
  return c.json(body, 402, {
    "x-payment-required": "true",
    "x-payment-memo": memo,
    "x-payment-network": merchantNetwork,
  });
});

function serveContent(c: Parameters<Parameters<typeof r.get>[1]>[0], res: {
  inline_content?: string | null;
  inline_mime?: string | null;
  redirect_url?: string | null;
}) {
  if (res.redirect_url) {
    return c.redirect(res.redirect_url, 302);
  }
  const mime = res.inline_mime ?? "application/json";
  if (mime === "application/json") {
    try { return c.json(JSON.parse(res.inline_content ?? "{}")); }
    catch { /* fall through to plain */ }
  }
  return new Response(res.inline_content ?? "", {
    status: 200,
    headers: { "content-type": mime },
  });
}

export default r;
