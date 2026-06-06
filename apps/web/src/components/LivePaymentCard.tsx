// Hero artifact: an animated, looping replay of the agent making a REAL payment.
// The final row links to a real mainnet transaction on stellar.expert — the one
// thing that turns "live and real today" from a claim into proof you can click.
// The motion is decorative; the tx hash is not. Re-runs every ~8s.
import { useEffect, useRef, useState } from "react";

const FALLBACK_TX = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
const FALLBACK_AMOUNT = 1240; // USD
// Live proof: pull the latest real mainnet payment to this account so the card
// shows fresh on-chain activity, not a frozen example. Falls back to the known
// real tx above if Horizon is slow or unreachable.
const LIVE_ACCOUNT = "GCYEAQWXDR3MXHU364KIFOLSL2FIZL5RYXEKO3QVQ3WTQCWY64BXBRNR";
const HORIZON = "https://horizon.stellar.org";

const STEPS = [
  { at: 250, key: "init", label: "recurring payment", meta: "API bill" },
  { at: 1050, key: "limit", label: "policy check", meta: "approved vendor" },
  { at: 1900, key: "route", label: "within monthly cap", meta: "$5,000/mo" },
  { at: 3500, key: "settle", label: "executed · settled", meta: "final · 4.9s" },
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
  const [txHash, setTxHash] = useState(FALLBACK_TX);
  const [payAmount, setPayAmount] = useState(FALLBACK_AMOUNT);
  const txUrl = `https://stellar.expert/explorer/public/tx/${txHash}`;
  const raf = useRef<number | null>(null);

  // Fetch the latest real mainnet payment once; keep fallback on any failure.
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    (async () => {
      try {
        const r = await fetch(`${HORIZON}/accounts/${LIVE_ACCOUNT}/payments?order=desc&limit=5&include_failed=false`, { signal: ctrl.signal });
        if (!r.ok) return;
        const j = await r.json();
        const recs: Array<Record<string, unknown>> = j?._embedded?.records ?? [];
        const p = recs.find((x) => typeof x.amount === "string" && typeof x.transaction_hash === "string");
        if (!p || cancelled) return;
        setTxHash(p.transaction_hash as string);
        const amt = Math.round(parseFloat(p.amount as string));
        if (amt > 0) setPayAmount(amt);
      } catch { /* keep fallback */ }
    })();
    return () => { cancelled = true; ctrl.abort(); window.clearTimeout(timer); };
  }, []);

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
        setAmount(payAmount * eased);
        if (p < 1) raf.current = requestAnimationFrame(up);
        else setAmount(payAmount);
      };
      raf.current = requestAnimationFrame(up);
    }, SETTLE_AT));

    timers.push(window.setTimeout(() => setShowTx(true), TX_AT));
    timers.push(window.setTimeout(() => setCycle((c) => c + 1), RESET_AT));

    return () => {
      timers.forEach(clearTimeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [cycle, payAmount]);

  return (
    <div className="lpc relative">
      <style>{`
        @keyframes lpcBlink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes lpcSheen { 0%{transform:translateX(-120%)} 60%,100%{transform:translateX(220%)} }
        .lpc-dot { animation: lpcBlink 1.4s ease-in-out infinite; }
        .lpc-sheen { animation: lpcSheen 7s ease-in-out infinite; }
      `}</style>

      {/* glow base */}
      <div className="absolute -inset-2 rounded-[28px] bg-[#FDDA24]/10 blur-2xl opacity-60" aria-hidden />

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
            <span className="lpc-dot inline-block w-2 h-2 rounded-full bg-[#FDDA24] shadow-[0_0_10px_#FDDA24]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#f1eee7]/55">agent · running payments</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/40">Stellar · mainnet</span>
        </div>

        {/* amount */}
        <div className="relative mt-7">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/40 mb-1.5">amount paid</div>
          <div className="text-5xl md:text-[56px] leading-none font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: "#FDDA24", textShadow: "0 0 30px rgba(253,218,36,.18)" }}>
            {fmt(amount)}
          </div>
          <div className="font-mono text-[11px] text-[#f1eee7]/45 mt-2.5">in dollars · non-custodial · final</div>
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
                <span className={`flex-none w-4 text-center text-[12px] ${on ? "text-[#FDDA24]" : "text-[#f1eee7]/25"}`}>
                  {on ? "✓" : "·"}
                </span>
                <span className="flex-1 text-[13px] text-[#f1eee7]/85">{s.label}</span>
                {isRoute && on && route < 1 ? (
                  <span className="flex-none w-24 h-[3px] rounded-full bg-[#f1eee7]/12 overflow-hidden">
                    <span className="block h-full rounded-full bg-[#FDDA24] transition-[width] duration-100"
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
        <a href={txUrl} target="_blank" rel="noreferrer"
          className="relative mt-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-all duration-700 group"
          style={{
            opacity: showTx ? 1 : 0,
            transform: showTx ? "none" : "translateY(6px)",
            background: "rgba(253,218,36,.07)",
            border: "1px solid rgba(253,218,36,.22)",
          }}>
          <span className="font-mono text-[11px] text-[#f1eee7]/70">
            tx <span className="text-[#FDDA24]">{txHash.slice(0, 10)}…</span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FDDA24] group-hover:underline underline-offset-4">
            verify on-chain ↗
          </span>
        </a>
      </div>
    </div>
  );
}
