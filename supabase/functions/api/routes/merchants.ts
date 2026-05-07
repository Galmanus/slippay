import { Hono } from "hono";
import type { SupabaseClient } from "supabase";
import { CreateMerchantInputSchema, type Merchant } from "@slippay/shared";
import { requireJwt } from "../middleware/auth_jwt.ts";
import { generateApiKey, hashApiKey, prefixOf } from "../lib/apikey.ts";

// Hono v4 requires Variables typed on the instance for c.get/c.set.
// Using a typed Hono instance avoids `c.get("key")` returning `never`.
type AppUser = { id: string; email: string; [k: string]: unknown };
type Vars = { user: AppUser; supabase: SupabaseClient };

const r = new Hono<{ Variables: Vars }>();

r.post("/", requireJwt, async (c) => {
  const user = c.get("user");
  const sb = c.get("supabase");
  const input = CreateMerchantInputSchema.parse(await c.req.json());
  const apiKey = generateApiKey();
  const hash = await hashApiKey(apiKey.plain);
  const prefix = prefixOf(apiKey.plain);
  const webhookSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await sb
    .from("merchants")
    .insert({
      auth_user_id: user.id,
      display_name: input.display_name,
      email: user.email,
      stellar_address: input.stellar_address ?? null,
      webhook_url: input.webhook_url ?? null,
      api_key_hash: hash,
      api_key_prefix: prefix,
      webhook_secret: webhookSecret,
    })
    .select("*")
    .single();
  if (error) return c.json({ error: "create_failed", detail: error.message }, 400);
  const { api_key_hash: _h, webhook_secret: _s, ...safe } = data;
  return c.json({ merchant: safe as Merchant, api_key: apiKey.plain }, 201);
});

r.get("/me", requireJwt, async (c) => {
  const sb = c.get("supabase");
  const { data, error } = await sb.from("merchants").select("*").maybeSingle();
  if (error || !data) return c.json({ error: "not_found" }, 404);
  const { api_key_hash: _h, webhook_secret: _s, ...safe } = data;
  return c.json({ merchant: safe as Merchant });
});

export default r;
