// DARK YEEZY design system — single source of dark tokens + shared chrome.
// Brand-separation guardrail: accent is Slippay yellow. NEVER Bluewave KLEIN.

export const TOKENS = {
  ink: "#0E0D0B",
  inkRaised: "#16140F",
  bone: "#F1EEE7",
  boneDim: "rgba(241,238,231,0.60)",
  boneFaint: "rgba(241,238,231,0.40)",
  accent: "#FDDA24",
  hairline: "rgba(241,238,231,0.12)",
} as const;

export const cx = {
  page: "min-h-screen bg-[#0E0D0B] text-[#F1EEE7] overflow-x-hidden",
  sec: "border-t border-[#F1EEE7]/12",
  inner: "max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center",
  btn: "lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a] font-medium",
  link: "text-[12px] uppercase tracking-[0.18em] border-b border-[#F1EEE7]/25 hover:border-[#F1EEE7] pb-1 text-[#F1EEE7]/70",
  label: "font-mono text-[10px] uppercase tracking-[0.3em] text-[#F1EEE7]/40",
} as const;

export const mark = {
  color: "#0a0a0a",
  background: "#FDDA24",
  padding: "0 0.06em",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
} as const;

export function Index({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-baseline justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#F1EEE7]/40">
      <span className="text-[#F1EEE7]/70">{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
      <span className="w-2 h-2 bg-[#FDDA24] self-center" />
    </div>
  );
}
