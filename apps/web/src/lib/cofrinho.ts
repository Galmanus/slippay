// Cofrinho — deposit/withdraw a passkey smart-wallet's USDC into the DeFindex
// yield vault, authorized by a live Face ID / fingerprint tap and gas-sponsored
// by the relayer. This is what makes the yield vault usable by a normal person
// (the "mãe" flow): no browser extension, no seed phrase, no wallet-connect.
//
// The record-simulate → passkey-sign → relayer-submit machinery lives in
// lib/guardian.ts (`invokeSponsored`) and is shared with the guardian surface;
// this module only supplies the vault-specific op building (proven on testnet
// in scripts/e2e-cofrinho-defindex-testnet.mjs).
//
// Gated behind a pinned vault (VITE_DEFINDEX_USDC_VAULT + VITE_DEFINDEX_ENABLED)
// client-side and RELAYER_DEFINDEX_VAULT on the relayer. Fail-closed: no vault
// pinned → throws before any network call.

import { invokeSponsored } from "./guardian.ts";
import { depositArgs, withdrawArgs, vaultId } from "./defindex.ts";
import type { Account } from "./account.ts";

export type CofrinhoMode = "deposit" | "withdraw";

/** Is the passkey cofrinho path available? Requires a pinned vault (client) —
 *  the relayer side is gated independently by RELAYER_DEFINDEX_VAULT. */
export function cofrinhoPasskeyEnabled(): boolean {
  return Boolean(import.meta.env.VITE_DEFINDEX_USDC_VAULT)
    && String(import.meta.env.VITE_DEFINDEX_ENABLED ?? "") === "1";
}

/** Deposit or withdraw `usdcAmount` between the passkey wallet and the cofre,
 *  authorized by Face ID and gas-sponsored by the relayer. Returns the settled
 *  tx hash. Throws (fail-closed) unless the vault is pinned on both sides. */
export async function moveCofrinho(opts: {
  acct: Account;
  mode: CofrinhoMode;
  usdcAmount: string;
  relayerBase: string;
  sponsor: string;
  credId?: Uint8Array;
}): Promise<string> {
  if (!cofrinhoPasskeyEnabled()) throw new Error("cofre de dólar ainda não está disponível");
  const args = opts.mode === "deposit"
    ? depositArgs(opts.acct.walletId, opts.usdcAmount)
    : await withdrawArgs(opts.acct.walletId, opts.usdcAmount);
  return invokeSponsored({
    acct: opts.acct,
    contract: vaultId(),
    fn: opts.mode,
    args,
    relayerBase: opts.relayerBase,
    sponsor: opts.sponsor,
    credId: opts.credId,
  });
}
