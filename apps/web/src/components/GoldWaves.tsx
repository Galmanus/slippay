// Flowing gold line-art — hand-written canvas, no lib. Thin gold STROKE waves
// (not filled areas, which turn to a low-contrast smudge on bone), drifting like
// silk threads / an audio waveform. Premium, defined. Killed under reduced-motion.

import { useEffect, useRef } from "react";

const N = 14;                 // number of thread lines
const GOLD = "253,218,36";    // brand gold rgb

export function GoldWaves({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size from the HOST, never from the canvas itself. A <canvas> is a
    // replaced element: `absolute inset-0` does not stretch it, its layout
    // size follows its width/height attributes. Observing the canvas and
    // setting width = cssWidth * dpr therefore fed back into layout and grew
    // the bitmap by dpr per tick until Chrome's cap (307200 x 153600 CSS px on
    // a dpr>1 screen, ~660 ms per frame, "site congelado"). Desktop dpr=1
    // never grew, which is why headless traces passed.
    let w = 0, h = 0;
    const host = canvas.parentElement ?? canvas;
    const MAX_CSS = 4096;
    // Bitmap budget: ~2 MP. Each frame re-uploads the whole bitmap to the
    // compositor, so a 1366x1059 hero at dpr 2 (5.8 MP) cost ~45% of a thread
    // in trace; at 2 MP it is a background again. Mobile stays near-native dpr.
    const MAX_PX = 2_000_000;
    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.min(r.width, MAX_CSS); h = Math.min(r.height, MAX_CSS);
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PX / Math.max(1, w * h)));
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const drawFrame = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < N; i++) {
        const p = i / (N - 1);                 // 0..1 across the band
        const baseY = h * (0.18 + p * 0.64);
        const amp = 26 + 40 * Math.sin(p * Math.PI);   // fatter in the middle
        const speed = 0.00018 + p * 0.00012;
        const phase = p * 6.0;
        // fade lines toward the edges of the band for a soft "beam"
        const alpha = 0.10 + 0.28 * Math.sin(p * Math.PI);
        ctx.strokeStyle = `rgba(${GOLD},${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 5) {
          const y = baseY
            + amp * Math.sin(x * 0.0016 + t * speed + phase)
            + amp * 0.45 * Math.sin(x * 0.0041 + t * speed * 1.8 + phase * 1.3);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { drawFrame(0); ro.disconnect(); return; }

    // Budget: ~30fps, and only while the canvas is on screen and the tab is
    // visible. Full-rate drawing of 14 strokes across the hero was ~13% of the
    // main thread for the whole visit.
    let raf = 0, last = 0, visible = true, running = false;
    const FRAME_MS = 1000 / 30;
    const loop = (t: number) => {
      if (!running) return;
      if (t - last >= FRAME_MS) { last = t; drawFrame(t); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (running) return; running = true; raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const sync = () => { (visible && document.visibilityState === "visible") ? start() : stop(); };
    const io = new IntersectionObserver((ents) => { visible = ents[0]?.isIntersecting ?? true; sync(); }, { threshold: 0 });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} style={{ width: "100%", height: "100%" }} />;
}
