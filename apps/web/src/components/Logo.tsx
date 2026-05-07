import { Link } from "react-router-dom";

interface LogoProps {
  to?: string;
  variant?: "ink" | "bone";
  size?: "sm" | "md";
}

export function Logo({ to = "/", variant = "ink", size = "md" }: LogoProps) {
  const fg = variant === "ink" ? "#0a0a0a" : "#f1eee7";
  const dim = size === "sm" ? 16 : 20;
  const text = size === "sm" ? "text-sm" : "text-base";

  const inner = (
    <span className="inline-flex items-center gap-2.5 group">
      <svg width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="0" y="0" width="24" height="24" fill="#b5e853" />
        <path
          d="M7 8 Q12 8 12 12 Q12 16 17 16"
          stroke={fg}
          strokeWidth="2.5"
          strokeLinecap="square"
          fill="none"
        />
      </svg>
      <span className={`${text} tracking-tight font-medium`} style={{ color: fg }}>
        slippay
      </span>
    </span>
  );

  return to ? <Link to={to} className="inline-block">{inner}</Link> : inner;
}
