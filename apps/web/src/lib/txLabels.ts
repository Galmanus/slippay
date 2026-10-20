// Payment names ("NF 1042 — Fornecedor X") for enterprise sends. USDC on Base
// is a bare ERC-20 transfer — no memo field exists on-chain — so the name is
// off-chain metadata keyed by tx hash. Phase 1: localStorage per wallet address
// (same pattern as enterpriseProfile.ts); phase 2 can move to account metadata
// so labels follow the company across devices.

const key = (address: string) => `slippay.enterprise.txlabels.${address.toLowerCase()}`;

export type TxLabels = Record<string, string>; // tx hash (lowercase) -> name

export function getTxLabels(address: string | null | undefined): TxLabels {
  if (!address) return {};
  try {
    return JSON.parse(localStorage.getItem(key(address)) ?? "{}") as TxLabels;
  } catch {
    return {};
  }
}

export function saveTxLabel(
  address: string | null | undefined,
  hash: string | null | undefined,
  label: string,
): void {
  if (!address || !hash) return;
  const name = label.trim();
  if (!name) return;
  try {
    const all = getTxLabels(address);
    all[hash.toLowerCase()] = name.slice(0, 120);
    localStorage.setItem(key(address), JSON.stringify(all));
  } catch {
    /* storage unavailable — the payment still went through; only the name is lost */
  }
}
