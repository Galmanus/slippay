// Ramp provider factory.
//
// Returns the configured fiat on/off-ramp provider (Etherfuse today), or null
// when the integration is disabled or unconfigured. The whole off-ramp surface
// is dormant until BOTH of these are set in the API env:
//
//   ETHERFUSE_ENABLED=1
//   ETHERFUSE_API_KEY=<key from devnet.etherfuse.com or the Etherfuse team>
//
// Optional:
//   ETHERFUSE_BASE_URL   default https://api.sand.etherfuse.com (sandbox).
//                        Set to https://api.etherfuse.com for production.
//   ETHERFUSE_BLOCKCHAIN default "stellar".
//
// Swapping providers later (e.g. Copperx) means adding another `Anchor`
// implementation and branching here on an env flag — the routes in
// routes/offramp.ts depend only on the `Anchor` interface, not on Etherfuse.

import { EtherfuseClient } from "./etherfuse/index.ts";
import type { Anchor } from "./types.ts";

let cached: Anchor | null | undefined;

/** The configured ramp provider, or null when disabled/unconfigured. Memoized. */
export function getRampProvider(): Anchor | null {
  if (cached !== undefined) return cached;
  const apiKey = Deno.env.get("ETHERFUSE_API_KEY")?.trim();
  const enabled = Deno.env.get("ETHERFUSE_ENABLED") === "1";
  if (!enabled || !apiKey) {
    cached = null;
    return cached;
  }
  const baseUrl = Deno.env.get("ETHERFUSE_BASE_URL")?.trim() ||
    "https://api.sand.etherfuse.com";
  const defaultBlockchain = Deno.env.get("ETHERFUSE_BLOCKCHAIN")?.trim() ||
    "stellar";
  cached = new EtherfuseClient({ apiKey, baseUrl, defaultBlockchain });
  return cached;
}

/** True when the off-ramp integration is live (provider configured). */
export function isRampEnabled(): boolean {
  return getRampProvider() !== null;
}

/** Test seam: clear the memoized provider so env changes take effect. */
export function _resetRampProvider(): void {
  cached = undefined;
}

// ── Slippay conversion margin ───────────────────────────────────────────────
// The spread Slippay captures on every conversion, on- AND off-ramp. Set the
// number in .env (SLIPPAY_RAMP_MARGIN_BPS); default 190 bps = 1.9% — the price
// decided + shown on the landing. Capped at 1000 bps (10%) as a guardrail.
// This arms the capture: the moment a provider key is set, quotes already carry
// the spread, no further wiring needed.

/** Slippay's conversion margin in basis points (default 190 = 1.9%). */
export function getRampMarginBps(): number {
  const v = Number(Deno.env.get("SLIPPAY_RAMP_MARGIN_BPS"));
  return Number.isFinite(v) && v >= 0 && v <= 1000 ? v : 190;
}

function trimAmount(n: number): string {
  return n.toFixed(7).replace(/\.?0+$/, "");
}

/** Mark up a provider quote with Slippay's margin. The user's output amount is
 * reduced by the margin, which becomes platform revenue. Direction-agnostic:
 * `toAmount` is USDC on an on-ramp and BRL on an off-ramp — the spread applies
 * either way, so a full Pix→dollar→Pix cycle is captured on both legs. The
 * gross (provider) amount and the fee are returned for the ledger. */
export function applyMargin<T extends { toAmount: string }>(
  quote: T,
): T & { grossToAmount: string; platformFeeBps: number; platformFee: string } {
  const bps = getRampMarginBps();
  const gross = parseFloat(quote.toAmount);
  const fee = (gross * bps) / 10_000;
  const net = gross - fee;
  return {
    ...quote,
    toAmount: trimAmount(net),
    grossToAmount: quote.toAmount,
    platformFeeBps: bps,
    platformFee: trimAmount(fee),
  };
}
