// Cofre earnings — the concrete "quanto você já rendeu", computed from the
// on-chain share value against a locally-tracked cost basis. This is the number
// the mãe actually sees; it never depends on the DeFindex indexer (the APY %),
// and it can never OVERSTATE earnings (clamped ≥ 0, conservative on withdrawal).
//
// Basis is the net USDC principal the user put in, in stroops (1 USDC = 1e7).
// It lives in localStorage per wallet. On a fresh device with no stored basis,
// earnings show as "—" (honest: we don't invent a past we can't prove) until
// the next deposit re-establishes a basis.

const ONE_USDC = 10_000_000;

export interface CofreBasis {
  basisStroops: number; // net USDC principal contributed, in stroops
  firstAt: number;      // unix ms of first deposit (for future rate calc)
}

// ── Pure math (unit-tested — a bug here misreports someone's money) ──────────

/** Realized+unrealized earnings = current value − basis, never negative.
 *  Clamped at 0 so rounding dust never renders as "rendeu -R$0,01". */
export function earnedStroops(currentValue: number, basis: number): number {
  return Math.max(0, Math.round(currentValue) - Math.round(basis));
}

/** New basis after withdrawing `withdrawn` USDC when the position is worth
 *  `valueBefore`. A withdrawal takes principal + yield proportionally, so the
 *  remaining basis scales by the remaining value fraction — this keeps "rendeu"
 *  honest across partial withdrawals (never overstates). */
export function basisAfterWithdraw(basis: number, valueBefore: number, withdrawn: number): number {
  if (valueBefore <= 0) return 0;
  const remainingFraction = Math.max(0, valueBefore - withdrawn) / valueBefore;
  return Math.max(0, Math.round(basis * remainingFraction));
}

// ── localStorage-backed basis store ──────────────────────────────────────────

const keyFor = (walletId: string) => `slippay.cofre.basis.${walletId}`;

export function getBasis(walletId: string): CofreBasis | null {
  try {
    const raw = localStorage.getItem(keyFor(walletId));
    if (!raw) return null;
    const b = JSON.parse(raw) as CofreBasis;
    if (typeof b.basisStroops !== "number") return null;
    return b;
  } catch { return null; }
}

function setBasis(walletId: string, b: CofreBasis): void {
  try { localStorage.setItem(keyFor(walletId), JSON.stringify(b)); } catch { /* private mode */ }
}

/** Record a deposit of `depositStroops` (adds to basis; stamps first deposit). */
export function recordDeposit(walletId: string, depositStroops: number, nowMs: number): void {
  const prev = getBasis(walletId);
  setBasis(walletId, {
    basisStroops: (prev?.basisStroops ?? 0) + Math.round(depositStroops),
    firstAt: prev?.firstAt ?? nowMs,
  });
}

/** Record a withdrawal: scale the basis down by the value fraction removed. */
export function recordWithdraw(walletId: string, valueBeforeStroops: number, withdrawnStroops: number): void {
  const prev = getBasis(walletId);
  if (!prev) return; // no basis to reduce
  setBasis(walletId, {
    basisStroops: basisAfterWithdraw(prev.basisStroops, valueBeforeStroops, withdrawnStroops),
    firstAt: prev.firstAt,
  });
}

/** Human USDC string for a stroop amount (2-decimal display rounding). */
export function stroopsToDisplay(stroops: number): string {
  return (Math.round(stroops) / ONE_USDC).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
