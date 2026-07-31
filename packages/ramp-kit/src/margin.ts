/**
 * Platform conversion margin.
 *
 * Marks a provider quote up with the host app's spread. Direction-agnostic:
 * `toAmount` is crypto on an on-ramp and fiat on an off-ramp — the spread
 * applies either way, so a full Pix→token→Pix cycle is captured on both legs.
 * Capped at 1000 bps (10%) as a guardrail against fat-fingered config.
 */

const MAX_BPS = 1000;

/** Clamp a margin to [0, 1000] bps; non-finite input falls back to `fallback`. */
export function clampMarginBps(bps: number, fallback = 0): number {
    return Number.isFinite(bps) && bps >= 0 && bps <= MAX_BPS ? bps : fallback;
}

function trimAmount(n: number): string {
    return n.toFixed(7).replace(/\.?0+$/, '');
}

/** Reduce the quote's output by `bps`; the difference is platform revenue.
 * Returns the gross (provider) amount and fee alongside for the ledger. */
export function applyMargin<T extends { toAmount: string }>(
    quote: T,
    bps: number,
): T & { grossToAmount: string; platformFeeBps: number; platformFee: string } {
    const clamped = clampMarginBps(bps);
    const gross = parseFloat(quote.toAmount);
    const fee = (gross * clamped) / 10_000;
    return {
        ...quote,
        toAmount: trimAmount(gross - fee),
        grossToAmount: quote.toAmount,
        platformFeeBps: clamped,
        platformFee: trimAmount(fee),
    };
}
