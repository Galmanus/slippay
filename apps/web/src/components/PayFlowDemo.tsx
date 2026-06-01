// PayFlowDemo — auto-looping, editorial animation of the Slippay payment flow:
//   scan QR  →  Face ID  →  paid (verified on-chain)
// Pure CSS/React, IntersectionObserver-gated, honors prefers-reduced-motion.
// This is the marketing showcase; the real flow lives at /pay + /cobrar.

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { encodeRequest } from "../lib/slippayqr";

type Phase = "scan" | "face" | "paid";
const ORDER: Phase[] = ["scan", "face", "paid"];
const DUR: Record<Phase, number> = { scan: 2600, face: 2200, paid: 3000 };

export function PayFlowDemo() {
  const [phase, setPhase] = useState<Phase>("scan");
  const [qr, setQr] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    QRCode.toDataURL(encodeRequest({ to: "GANJ32T5VD2LDSQDT4A72LXSYG5IRLVMGJ5BQGTW3RRNJCEH3Y4HZ65K", amount: "3000000", label: "Slippay" }),
      { margin: 0, width: 240, color: { dark: "#0a0a0a", light: "#00000000" } }).then(setQr).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver((es) => setInView(es[0]?.isIntersecting ?? false), { threshold: 0.3 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!inView || reduce) return;
    timer.current = window.setTimeout(() => {
      setPhase((p) => ORDER[(ORDER.indexOf(p) + 1) % ORDER.length]!);
    }, DUR[phase]);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [phase, inView]);

  const step = ORDER.indexOf(phase);

  return (
    <div ref={ref} className="flex flex-col items-center">
      {/* phone */}
      <div className="relative w-[260px] h-[540px] bg-[#0a0a0a] rounded-[2.4rem] p-3 shadow-[0_40px_100px_-30px_rgba(10,10,10,0.55)] ring-1 ring-[#0a0a0a]/10">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#0a0a0a] rounded-b-2xl z-20" />
        <div className="relative w-full h-full rounded-[1.9rem] overflow-hidden bg-[#f1eee7]">

          {/* SCAN */}
          <Screen active={phase === "scan"}>
            <div className="h-full bg-[#0a0a0a] flex flex-col items-center justify-center px-6 relative">
              <div className="absolute top-6 left-0 right-0 text-center text-[9px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">aponta no QR</div>
              <div className="relative w-[180px] h-[180px] flex items-center justify-center">
                {qr && <img src={qr} alt="" className="w-[150px] h-[150px] invert-0" style={{ filter: "invert(1)" }} />}
                <span className="absolute -inset-1 border-2 border-[#b5e853]" />
                {phase === "scan" && <span className="absolute left-0 right-0 h-[2px] bg-[#b5e853] shadow-[0_0_12px_#b5e853]" style={{ animation: "pf-sweep 1.4s ease-in-out infinite" }} />}
              </div>
              <div className="mt-7 text-[#f1eee7] text-3xl font-medium tabular-nums tracking-[-0.03em]"><span className="text-sm text-[#f1eee7]/50">US$ </span>0,30</div>
            </div>
          </Screen>

          {/* FACE */}
          <Screen active={phase === "face"}>
            <div className="h-full bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
              <div className="relative w-[120px] h-[120px] flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-[#f1eee7]/15" />
                {phase === "face" && <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#b5e853] border-r-[#b5e853]" style={{ animation: "pf-spin 0.9s linear infinite" }} />}
                {/* simple face glyph */}
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-[#f1eee7]">
                  <circle cx="20" cy="23" r="3" fill="currentColor" /><circle cx="36" cy="23" r="3" fill="currentColor" />
                  <path d="M19 36c3 3 15 3 18 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mt-8 text-[#f1eee7]/80 text-sm uppercase tracking-[0.2em] font-mono">autorizando</div>
              <div className="mt-1 text-[#f1eee7]/40 text-[10px]">sem senha · só o seu rosto</div>
            </div>
          </Screen>

          {/* PAID */}
          <Screen active={phase === "paid"}>
            <div className="h-full bg-[#f1eee7] flex flex-col items-center justify-center px-6">
              <div className="w-[88px] h-[88px] bg-[#b5e853] flex items-center justify-center" style={{ animation: phase === "paid" ? "pf-pop 0.5s var(--ease-out-expo) both" : "none" }}>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M11 23l8 8 14-16" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div className="mt-6 text-2xl font-medium tracking-[-0.02em]">Pago</div>
              <div className="mt-1 text-3xl font-medium tabular-nums tracking-[-0.03em]">US$ 0,30</div>
              <div className="mt-5 text-[9px] uppercase tracking-[0.2em] font-mono text-[#0a0a0a]/45 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" /> verificado on-chain
              </div>
            </div>
          </Screen>
        </div>
      </div>

      {/* step dots */}
      <div className="mt-8 flex items-center gap-2">
        {ORDER.map((p, i) => (
          <span key={p} className="h-1.5 transition-all duration-500"
            style={{ width: i === step ? 28 : 8, background: i === step ? "#b5e853" : "rgba(10,10,10,0.2)" }} />
        ))}
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-[0.22em] font-mono text-[#0a0a0a]/55">
        {["aponta no QR", "toca o rosto", "pago · on-chain"][step]}
      </div>
    </div>
  );
}

function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 transition-all duration-500"
      style={{
        opacity: active ? 1 : 0,
        transform: active ? "translateX(0)" : "translateX(8%)",
        pointerEvents: active ? "auto" : "none",
        transitionTimingFunction: "var(--ease-out-expo)",
      }}
    >
      {children}
    </div>
  );
}
