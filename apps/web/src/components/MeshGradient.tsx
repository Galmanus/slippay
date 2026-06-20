// Animated mesh gradient — the live "silk" backdrop, Stripe-grade, in Slippay's
// gold palette. Uses whatamesh (the open-source port of Stripe's WebGL gradient).
// Killed under prefers-reduced-motion (renders a static gold wash instead).

import { useEffect, useRef } from "react";

// whatamesh reads the 4 stops from CSS custom properties on the canvas.
const COLORS = {
  "--gradient-color-1": "#FDDA24", // brand gold
  "--gradient-color-2": "#f6c343", // amber
  "--gradient-color-3": "#f9ead0", // cream
  "--gradient-color-4": "#eab308", // deep honey
} as const;

export function MeshGradient({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    for (const [k, v] of Object.entries(COLORS)) canvas.style.setProperty(k, v);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // static CSS wash (set on the element) is enough

    let grad: { disconnect?: () => void } | null = null;
    let cancelled = false;
    import("whatamesh")
      .then((m) => {
        if (cancelled) return;
        const Gradient = (m as { Gradient: new () => { initGradient: (s: string | HTMLCanvasElement) => void; disconnect?: () => void } }).Gradient;
        grad = new Gradient();
        (grad as { initGradient: (c: HTMLCanvasElement) => void }).initGradient(canvas);
      })
      .catch(() => { /* gradient is decorative; ignore load failures */ });

    return () => { cancelled = true; grad?.disconnect?.(); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{
        // fallback wash so it's never a blank/black box before WebGL paints
        background: "radial-gradient(60% 80% at 70% 30%, rgba(253,218,36,0.55), rgba(246,195,67,0.25) 45%, transparent 75%)",
      }}
    />
  );
}
