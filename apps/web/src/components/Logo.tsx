import { Link } from "react-router-dom";

interface LogoProps {
  to?: string;
  variant?: "ink" | "bone";
  size?: "sm" | "md";
}

export function Logo({ to = "/", variant = "ink", size = "md" }: LogoProps) {
  // The arrow inside the KLEIN square is always INK — keeps contrast with
  // the lime green regardless of background. Only the wordmark recolors.
  const fgSquare = "#0a0a0a";
  const fgText   = variant === "ink" ? "#0a0a0a" : "#f1eee7";
  const dim = size === "sm" ? 22 : 30;
  const text = size === "sm" ? "text-base" : "text-xl";
  const gap = size === "sm" ? "gap-2.5" : "gap-3";

  // Suppress unused-var warning · fgSquare kept for backward-compat with
  // older skin variants that re-introduce inline SVG marks.
  void fgSquare;
  const inner = (
    <span className={`inline-flex items-center ${gap} group`}>
      <img
        src="/slippay-mark.png"
        alt=""
        width={dim}
        height={dim}
        className="block shrink-0"
        style={{ imageRendering: "auto" }}
      />
      <span
        className={`${text} tracking-tight font-medium leading-none`}
        style={{
          color: fgText,
          textShadow: variant === "bone" ? "0 1px 3px rgba(0,0,0,0.6)" : "none",
        }}
      >
        slippay
      </span>
    </span>
  );

  return to ? <Link to={to} className="inline-block">{inner}</Link> : inner;
}
