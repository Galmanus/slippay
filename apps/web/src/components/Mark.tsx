// SlipMark — the SlipPay logo mark. A small ink token with a Stellar-yellow
// double-chevron: "fast-forward" = payments on autopilot, money in motion.
// Inline SVG, no asset, scales with `size`. Pairs with the lowercase wordmark.

export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#0a0a0a" />
      <path d="M6.5 8L10.5 12L6.5 16M12.5 8L16.5 12L12.5 16"
        stroke="#FDDA24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
