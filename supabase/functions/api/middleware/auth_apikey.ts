import type { Context, Next } from "hono";
import { serviceClient } from "../lib/supabase.ts";
import { hashApiKey, prefixOf } from "../lib/apikey.ts";

export async function requireApiKey(c: Context, next: Next) {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer sk_live_")) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  const plain = auth.slice("Bearer ".length);
  const hash = await hashApiKey(plain);
  const sb = serviceClient();
  const { data, error } = await sb
    .from("merchants")
    .select("*")
    .eq("api_key_hash", hash)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) {
    return c.json({ error: "unauthenticated" }, 401);
  }
  c.set("merchant", data);
  c.set("supabase", sb);
  await next();
}
