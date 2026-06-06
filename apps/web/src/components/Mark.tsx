// SlipMark — hand-drawn, black & white. A sketched coin (a pen circle with a
// little overshoot, the way you draw one by hand) with a rising forward arrow:
// money moving on its own. Matches the crayon mascot register. Inline SVG, no
// asset, B&W (uses currentColor so it inverts on dark backgrounds).

export function Mark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {/* hand-drawn coin — slight overshoot so it reads sketched, not geometric */}
      <path d="M16.4 4.2C23.2 4 28.3 9.2 28 16c-.3 6.9-5.4 12.2-12.4 12C8.8 27.8 3.7 22.7 4 15.7 4.3 9 9.4 4.5 16.8 4.5" />
      {/* rising forward stroke + arrowhead — value moving on its own */}
      <path d="M10.8 21C13.6 17.6 17.4 13.9 21.2 10.9" />
      <path d="M16.3 10.5 21.6 10.6 21.3 16" />
    </svg>
  );
}
