// SlipMark — three minimalist sea waves: flow, money moving. Black & white
// (currentColor, inverts on dark). Inline SVG, no asset.

export function Mark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 q3 -3 6 0 t6 0 t6 0 t6 0" />
      <path d="M4 16 q3 -3 6 0 t6 0 t6 0 t6 0" />
      <path d="M4 21 q3 -3 6 0 t6 0 t6 0 t6 0" />
    </svg>
  );
}
