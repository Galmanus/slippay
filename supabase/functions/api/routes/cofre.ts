// Cofre yield surface. Proxies the DeFindex indexer for the vault's APY so the
// SECRET api key (sk_…) stays server-side — a VITE_ env would ship it in the
// browser bundle to every visitor. The frontend calls GET /api/v1/cofre/apy and
// gets back only a number (or null while the fresh vault has no history yet).
//
// The APY is a forward ESTIMATE shown as "varia, não garantido". The concrete,
// unarguable earnings a user sees ("guardou X, vale Y, rendeu Z") are computed
// client-side from on-chain share value — they never depend on this endpoint.
import { Hono } from "hono";

const r = new Hono();

const DEFINDEX_KEY = (Deno.env.get("DEFINDEX_API_KEY") ?? "").trim();
const DEFINDEX_BASE = Deno.env.get("DEFINDEX_BASE") ?? "https://api.defindex.io";
const VAULT = (Deno.env.get("DEFINDEX_USDC_VAULT") ?? "").trim();
const NETWORK = (Deno.env.get("DEFINDEX_NETWORK") ?? "mainnet").trim();

// APY moves slowly; cache in-process to avoid hammering the indexer (and to
// stay well under any rate limit on the key).
let cache: { apy: number | null; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

r.get("/apy", async (c) => {
  if (!DEFINDEX_KEY || !VAULT) return c.json({ apy: null, reason: "not_configured" });
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return c.json({ apy: cache.apy, cached: true });
  try {
    const resp = await fetch(
      `${DEFINDEX_BASE}/vault/${VAULT}/apy?network=${NETWORK}`,
      { headers: { Authorization: `Bearer ${DEFINDEX_KEY}` } },
    );
    if (!resp.ok) return c.json({ apy: cache?.apy ?? null, stale: Boolean(cache) });
    const j = await resp.json().catch(() => ({}));
    const apy = typeof j.apy === "number" ? j.apy : null;
    cache = { apy, at: now };
    return c.json({ apy });
  } catch (_e) {
    return c.json({ apy: cache?.apy ?? null, stale: Boolean(cache) });
  }
});

export default r;
