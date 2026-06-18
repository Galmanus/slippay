// Active chain adapter, chosen by VITE_CHAIN (default "stellar"). Pages import
// `getChainAdapter()` and never touch a chain SDK. Stellar stays the default so
// the live product is unchanged until Solana is proven and cutover is flipped.

import type { ChainAdapter, ChainId } from "./types.ts";
import { stellarAdapter } from "./stellar/adapter.ts";

export * from "./types.ts";

export function activeChainId(): ChainId {
  return ((import.meta.env.VITE_CHAIN ?? "stellar").toLowerCase()) as ChainId;
}

let cached: ChainAdapter | null = null;

export function getChainAdapter(): ChainAdapter {
  if (cached) return cached;
  const id = activeChainId();
  switch (id) {
    case "stellar":
      cached = stellarAdapter;
      return cached;
    case "solana":
      // Wired in increment 3 (lib/chain/solana/adapter.ts).
      throw new Error("solana adapter not yet wired — set VITE_CHAIN=stellar");
    default:
      throw new Error(`unknown VITE_CHAIN: ${id}`);
  }
}
