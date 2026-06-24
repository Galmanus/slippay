// Solana USDC config + amount math. USDC has 6 decimals on Solana (same as the
// program's base units). Network + mint + RPC are env-driven; mainnet mint is
// the canonical Circle USDC and is never overridable.

import { PublicKey } from "@solana/web3.js";

export type SolNet = "mainnet" | "devnet";

export function solNet(): SolNet {
  return ((import.meta.env.VITE_SOLANA_NETWORK ?? "devnet").toLowerCase()) as SolNet;
}

const MINTS: Record<SolNet, string> = {
  // Circle USDC, canonical. Mainnet is fixed; devnet is overridable for a
  // self-controlled test mint via VITE_SOLANA_USDC_MINT.
  mainnet: "EPjFWaJGqicjsAE6b8V9bJU5kVJ86RHRK6Vbp4grmGp2",
  devnet: (import.meta.env.VITE_SOLANA_USDC_MINT as string | undefined) ??
          "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

const RPCS: Record<SolNet, string> = {
  mainnet: (import.meta.env.VITE_SOLANA_RPC as string | undefined) ??
           "https://api.mainnet-beta.solana.com",
  devnet: (import.meta.env.VITE_SOLANA_RPC as string | undefined) ??
          "https://api.devnet.solana.com",
};

export const USDC_DECIMALS = 6;

export function usdcMint(net: SolNet = solNet()): PublicKey {
  return new PublicKey(MINTS[net]);
}

export function rpcUrl(net: SolNet = solNet()): string {
  return RPCS[net];
}

/** Human USDC string ("12.50") → integer base units (bigint). Throws on junk.
 *
 * Gate (applied in order):
 *   1. Strict decimal regex — rejects scientific notation ("1e3"), leading/trailing
 *      junk, empty string, and anything that isn't /^\d+(\.\d+)?$/.
 *   2. More than 6 decimal places → invalid (USDC has 6 on Solana).
 *   3. Value must be > 0.
 */
export function toBaseUnits(human: string): bigint {
  const trimmed = human.trim();
  // [FIX-1] Strict decimal gate — must be digits, optional dot + digits, nothing else.
  // Rejects: "1e3", "1E6", "abc", "1.2.3", "", "  ", "-1", "+1", etc.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("invalid_amount");
  const [whole = "0", frac = ""] = trimmed.split(".");
  // [FIX-1] Reject more than 6 decimal places (USDC precision on Solana).
  if (frac.length > USDC_DECIMALS) throw new Error("invalid_amount");
  const fracPadded = (frac + "000000").slice(0, USDC_DECIMALS);
  const units = BigInt(whole) * 1_000_000n + BigInt(fracPadded || "0");
  if (units <= 0n) throw new Error("invalid_amount");
  return units;
}

/** Split a total (base units) into merchant + platform fee by basis points.
 *  Integer math: fee = floor(total*bp/10000), merchant = total - fee. The two
 *  ALWAYS sum to total exactly (no dust), unlike float toFixed splitting. */
export function splitFee(totalBaseUnits: bigint, platformFeeBp: number): { merchant: bigint; fee: bigint } {
  if (!Number.isInteger(platformFeeBp) || platformFeeBp < 0 || platformFeeBp > 10_000) {
    throw new Error("invalid_fee_bp");
  }
  const fee = (totalBaseUnits * BigInt(platformFeeBp)) / 10_000n;
  return { merchant: totalBaseUnits - fee, fee };
}
