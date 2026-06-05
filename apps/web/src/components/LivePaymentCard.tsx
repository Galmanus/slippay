// Hero artifact: an animated, looping replay of the agent making a REAL payment.
// The final row links to a real mainnet transaction on stellar.expert — the one
// thing that turns "live and real today" from a claim into proof you can click.
// The motion is decorative; the tx hash is not. Re-runs every ~8s.
import { useEffect, useRef, useState } from "react";

const TX_HASH = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
const TX_URL = `https://stellar.expert/explorer/public/tx/${TX_HASH}`;
const AMOUNT = 1240; // USD

const STEPS = [
  { at: 250, key: "init", label: "pagamento recorrente", meta: "conta de API" },
  { at: 1050, key: "limit", label: "checagem de política", meta: "fornecedor aprovado" },
  { at: 1900, key: "route", label: "dentro do teto mensal", meta: "$5.000/mês" },
  { at: 3500, key: "settle", label: "executado · liquidado", meta: "final · 4,9s" },
];
const ROUTE_START = 1900; // STEPS route .at
const SETTLE_AT = 3500;   // STEPS settle .at
const TX_AT = 4300;
const RESET_AT = 8000;
const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export function LivePaymentCard() {
  const [shown, setShown] = useState(0); // how many steps are visible
  const [route, setRoute] = useState(0); // routing progress 0..1
  const [amount, setAmount] = useState(0);
  const [showTx, setShowTx] = useState(false);
  const [cycle, setCycle] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    setShown(0); setRoute(0); setAmount(0); setShowTx(false);
    const timers: number[] = [];

    STEPS.forEach((s, i) => {
      timers.push(window.setTimeout(() => setShown(i + 1), s.at));
    });

    // routing bar fills between route-step and settle
    const routeStart = ROUTE_START, routeEnd = SETTLE_AT;
    const tickRoute = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - routeStart) / (routeEnd - routeStart)));
      setRoute(p);
      if (p < 1) raf.current = requestAnimationFrame(() => tickRoute(performance.now() - cycleStart));
    };
    const cycleStart = performance.now();
    timers.push(window.setTimeout(() => {
      raf.current = requestAnimationFrame(() => tickRoute(performance.now() - cycleStart));
    }, routeStart));

    // amount counts up at settle
    timers.push(window.setTimeout(() => {
      const dur = 850; const start = performance.now();
      const up = () => {
        const p = Math.min(1, (performance.now() - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setAmount(AMOUNT * eased);
        if (p < 1) raf.current = requestAnimationFrame(up);
        else setAmount(AMOUNT);
      };
      raf.current = requestAnimationFrame(up);
    }, SETTLE_AT));

    timers.push(window.setTimeout(() => setShowTx(true), TX_AT));
    timers.push(window.setTimeout(() => setCycle((c) => c + 1), RESET_AT));

    return () => {
      timers.forEach(clearTimeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [cycle]);

  return (
    <div className="lpc relative">
      <style>{`
        @keyframes lpcBlink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes lpcSheen { 0%{transform:translateX(-120%)} 60%,100%{transform:translateX(220%)} }
        .lpc-dot { animation: lpcBlink 1.4s ease-in-out infinite; }
        .lpc-sheen { animation: lpcSheen 7s ease-in-out infinite; }
      `}</style>

      {/* glow base */}
      <div className="absolute -inset-2 rounded-[28px] bg-[#b5e853]/10 blur-2xl opacity-60" aria-hidden />

      <div className="relative rounded-[22px] p-7 md:p-8 overflow-hidden text-[#f1eee7]"
        style={{
          background: "linear-gradient(160deg,#15151a 0%,#0a0a0c 55%,#101013 100%)",
          boxShadow: "0 30px 80px -30px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.08)",
        }}>
        {/* moving sheen */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="lpc-sheen absolute top-0 -left-1/3 h-full w-1/3"
            style={{ background: "linear-gradient(100deg,transparent,rgba(255,255,255,.05),transparent)" }} />
        </div>

        {/* header */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="lpc-dot inline-block w-2 h-2 rounded-full bg-[#b5e853] shadow-[0_0_10px_#b5e853]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#f1eee7]/55">agente · rodando pagamentos</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/40">Stellar · mainnet</span>
        </div>

        {/* amount */}
        <div className="relative mt-7">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/40 mb-1.5">valor pago</div>
          <div className="text-5xl md:text-[56px] leading-none font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: "#b5e853", textShadow: "0 0 30px rgba(74,222,128,.18)" }}>
            {fmt(amount)}
          </div>
          <div className="font-mono text-[11px] text-[#f1eee7]/45 mt-2.5">em dólar · não-custodial · final</div>
        </div>

        {/* steps */}
        <div className="relative mt-7 pt-6 border-t border-[#f1eee7]/10 space-y-3">
          {STEPS.map((s, i) => {
            const on = i < shown;
            const isRoute = s.key === "route";
            return (
              <div key={s.key}
                className="flex items-center gap-3 transition-all duration-500"
                style={{ opacity: on ? 1 : 0.18, transform: on ? "none" : "translateY(3px)" }}>
                <span className={`flex-none w-4 text-center text-[12px] ${on ? "text-[#b5e853]" : "text-[#f1eee7]/25"}`}>
                  {on ? "✓" : "·"}
                </span>
                <span className="flex-1 text-[13px] text-[#f1eee7]/85">{s.label}</span>
                {isRoute && on && route < 1 ? (
                  <span className="flex-none w-24 h-[3px] rounded-full bg-[#f1eee7]/12 overflow-hidden">
                    <span className="block h-full rounded-full bg-[#b5e853] transition-[width] duration-100"
                      style={{ width: `${Math.round(route * 100)}%` }} />
                  </span>
                ) : (
                  <span className="flex-none font-mono text-[10px] uppercase tracking-[0.12em] text-[#f1eee7]/40">{s.meta}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* tx proof */}
        <a href={TX_URL} target="_blank" rel="noreferrer"
          className="relative mt-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-all duration-700 group"
          style={{
            opacity: showTx ? 1 : 0,
            transform: showTx ? "none" : "translateY(6px)",
            background: "rgba(74,222,128,.07)",
            border: "1px solid rgba(74,222,128,.22)",
          }}>
          <span className="font-mono text-[11px] text-[#f1eee7]/70">
            tx <span className="text-[#b5e853]">{TX_HASH.slice(0, 10)}…</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#b5e853] group-hover:underline underline-offset-4">
            verificar on-chain ↗
          </span>
        </a>
      </div>
    </div>
  );
}
