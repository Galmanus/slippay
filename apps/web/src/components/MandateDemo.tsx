// Live, self-explanatory mandate demo for the hero. Animates one recurring
// mandate: approve once → it charges itself → settles → on-chain proof, looping
// each cycle, accumulating against a cap — and STOPPING when the cap is reached
// (the safety, shown not told). B&W + Stellar gold accent. Honors reduced-motion
// (renders the finished state, no animation). The real charge link at the bottom
// is the actual mainnet tx (0.05 USDC); the cycling above is an illustration of
// the mechanism — labelled "demo" so it's never mistaken for live settlement.

import { useEffect, useState } from "react";

const STEPS = [
  ["Aprove com Face ID", "um toque de passkey · sem seed phrase · você define o teto"],
  ["Ele cobra sozinho", "puxa 0,05 USDC · sem re-assinar"],
  ["Liquida na Stellar", "~5s · taxa < $0,01"],
  ["Prova on-chain", "transação pública e verificável"],
];
const CAP = 0.2;
const CHARGE = 0.05;
const TX = "https://stellar.expert/explorer/public/tx/5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
const GOLD = "#65a30d";

const reduceMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MandateDemo() {
  const reduce = reduceMotion();
  const [active, setActive] = useState(reduce ? 3 : 0);
  const [charges, setCharges] = useState(reduce ? CAP / CHARGE : 0);
  const [capped, setCapped] = useState(reduce);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduce) return;
    setActive(0);
    setCharges(0);
    setCapped(false);
    let step = 0;
    let done = 0;
    const id = setInterval(() => {
      step += 1;
      if (step <= 3) {
        setActive(step);
        return;
      }
      // reached "on-chain proof" → one cycle settled
      done += 1;
      setCharges(done);
      if (done * CHARGE >= CAP - 1e-9) {
        setCapped(true);
        clearInterval(id);
        return;
      }
      step = 1; // next cycle: approve already granted, straight to charge
      setActive(1);
    }, 1050);
    return () => clearInterval(id);
  }, [run, reduce]);

  const spent = +(charges * CHARGE).toFixed(2);
  const pct = Math.min(100, (spent / CAP) * 100);

  return (
    <button
      onClick={() => setRun((x) => x + 1)}
      className="block w-full text-left border border-[#0a0a0a]/20 rounded-2xl p-8 bg-white shadow-[0_18px_50px_-24px_rgba(10,10,10,0.30)] cursor-pointer"
      aria-label="Repetir a demo do mandato"
    >
      <div className="flex items-center justify-between mb-7">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/45">mandato recorrente · demo</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/45 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
          {capped ? "no teto" : "ativo"}
        </span>
      </div>

      {STEPS.map(([t, d], i) => {
        const isActive = !capped && i === active;
        const isDone = capped || i < active || (charges > 0 && i >= 1);
        return (
          <div key={t} className="relative flex gap-4 pb-7 last:pb-0">
            {i < STEPS.length - 1 && <span className="absolute left-[10px] top-6 bottom-0 w-px bg-[#0a0a0a]/15" />}
            <span
              className="relative shrink-0 w-[21px] h-[21px] rounded-full flex items-center justify-center font-mono text-[9px] transition-colors duration-300"
              style={{
                background: isActive ? GOLD : isDone ? "#0a0a0a" : "#fff",
                color: isActive ? "#0a0a0a" : isDone ? "#fff" : "#0a0a0a",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isActive || isDone ? "transparent" : "rgba(10,10,10,0.30)",
                boxShadow: isActive ? `0 0 0 5px ${GOLD}33` : "none",
              }}
            >
              {isDone && !isActive ? "✓" : i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight flex items-center gap-2">
                {t}
                {isActive && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#0a0a0a]/40">rodando…</span>}
              </div>
              <div className="font-mono text-[11px] text-[#0a0a0a]/50 mt-1">{d}</div>
            </div>
          </div>
        );
      })}

      {/* cap meter — the safety, shown */}
      <div className="mt-2 mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
        <span>gasto neste período</span>
        <span>{spent.toFixed(2)} / {CAP.toFixed(2)} USDC</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#0a0a0a]/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: GOLD }} />
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] h-4" style={{ color: capped ? "#0a0a0a" : "rgba(10,10,10,0.45)" }}>
        {capped ? "teto atingido — não puxa mais um centavo ✓" : `ciclo ${Math.max(1, charges)} · dentro do teto`}
      </div>

      <span
        onClick={(e) => { e.stopPropagation(); window.open(TX, "_blank", "noopener"); }}
        className="mt-5 flex items-center justify-between border-t border-[#0a0a0a]/10 pt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a]"
      >
        <span>cobrança real · liquidada · 0,05 USDC</span>
        <span>tx 5da9741f ↗</span>
      </span>

      <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-[#0a0a0a]/30">clique pra repetir</div>
    </button>
  );
}
