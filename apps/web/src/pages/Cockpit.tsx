// /cockpit — "the machine, live". Mission-control for agent payments: real
// mainnet activity streamed from Horizon (payments + balances), a spend
// guardrail (cap meter), and an agent-native conversational console where you
// command the agent in plain language and it executes within policy. Editorial
// dark register, Stellar yellow. The payment stream + balances are REAL; the
// console is a deterministic policy simulator (labelled demo).

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const display = { fontFamily: "'Plus Jakarta Sans', sans-serif" } as const;
const HORIZON = "https://horizon.stellar.org";
const SPONSOR = "GBI4NVNPTTXAQ7BTR6PSZYFRYFDFBGYR7DNGIQJF3SSSVEF7PRXMIEBU";
const RECIPIENT = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P";
const xtx = (h: string) => `https://stellar.expert/explorer/public/tx/${h}`;
const short = (s: string, h = 4, t = 4) => (s && s.length > h + t + 1 ? `${s.slice(0, h)}…${s.slice(-t)}` : s);

type Pay = { id: string; amount: string; asset: string; from: string; to: string; at: string; tx: string };
type Bal = { xlm: string; usdc: string };

async function balances(acct: string): Promise<Bal> {
  const r = await fetch(`${HORIZON}/accounts/${acct}`);
  const b = (await r.json()).balances ?? [];
  return {
    xlm: b.find((x: any) => x.asset_type === "native")?.balance ?? "0",
    usdc: b.find((x: any) => x.asset_code === "USDC")?.balance ?? "0",
  };
}
async function payments(acct: string): Promise<Pay[]> {
  const r = await fetch(`${HORIZON}/accounts/${acct}/payments?order=desc&limit=10&include_failed=false`);
  const recs = (await r.json())?._embedded?.records ?? [];
  return recs
    .filter((x: any) => x.amount && (x.to || x.from))
    .map((x: any) => ({
      id: x.id, amount: x.amount,
      asset: x.asset_code ?? "XLM",
      from: x.from ?? x.funder ?? "", to: x.to ?? x.account ?? "",
      at: x.created_at, tx: x.transaction_hash,
    }));
}

type Msg = { who: "you" | "agent"; text: string };
const CAP_DEFAULT = 1.0;

export default function Cockpit() {
  const [pays, setPays] = useState<Pay[]>([]);
  const [sBal, setSBal] = useState<Bal | null>(null);
  const [rBal, setRBal] = useState<Bal | null>(null);
  const [now, setNow] = useState("");
  const [cap, setCap] = useState(CAP_DEFAULT);
  const [spent, setSpent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "agent", text: "I'm your payment agent. Tell me what to do — “pay 0.05 to a vendor”, “set cap to 1”, “pause”." }]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let on = true;
    const tick = async () => {
      try { const p = await payments(RECIPIENT); if (on) setPays(p); } catch {}
      try { const b = await balances(SPONSOR); if (on) setSBal(b); } catch {}
      try { const b = await balances(RECIPIENT); if (on) setRBal(b); } catch {}
    };
    tick();
    const id = setInterval(tick, 12000);
    const clk = setInterval(() => setNow(new Date().toLocaleTimeString()), 1000);
    return () => { on = false; clearInterval(id); clearInterval(clk); };
  }, []);

  useEffect(() => { logRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [msgs]);

  function agentReply(t: string): string {
    const s = t.toLowerCase().trim();
    const num = (s.match(/[\d.]+/) || [])[0];
    if (/pause|stop|halt/.test(s)) { setPaused(true); return "Agent paused. No charges will fire until you resume."; }
    if (/resume|start|unpause/.test(s)) { setPaused(false); return "Agent resumed. I'll keep paying within your rules."; }
    if (/cap|limit|teto/.test(s) && num) { const v = parseFloat(num); setCap(v); return `Cap set to ${v.toFixed(2)} USDC per period.`; }
    if (/pay|charge|send|paga/.test(s)) {
      if (paused) return "I'm paused right now — say “resume” and I'll execute.";
      const amt = num ? parseFloat(num) : 0.05;
      if (spent + amt > cap + 1e-9) return `That would push spend to ${(spent + amt).toFixed(2)} USDC, over your ${cap.toFixed(2)} cap. I stopped and flagged you.`;
      setSpent((x) => +(x + amt).toFixed(2));
      return `Recipient approved, amount within the ${cap.toFixed(2)} cap → executing… ✓ paid ${amt.toFixed(2)} USDC. Settled in ~5s, verifiable on-chain.`;
    }
    return "I can pay a vendor, set a spend cap, or pause/resume. Try “pay 0.05 to API vendor”.";
  }
  function submit() {
    const t = input.trim(); if (!t) return;
    const reply = agentReply(t);
    setMsgs((m) => [...m, { who: "you", text: t }, { who: "agent", text: reply }]);
    setInput("");
  }

  const pct = Math.min(100, (spent / cap) * 100);
  const fmtAcct = (a: string) => (a === RECIPIENT ? "merchant" : a === SPONSOR ? "relayer" : short(a, 4, 4));

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] overflow-x-hidden">
      <header className="px-6 md:px-12 py-7 flex items-center justify-between border-b border-[#0a0a0a]/10">
        <Link to="/" className="text-lg font-semibold tracking-[-0.04em]" style={display}>slippay</Link>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FDDA24] animate-pulse" /> live · mainnet · {now}
        </div>
      </header>

      <main className="max-w-[1300px] mx-auto px-6 md:px-12 py-10 md:py-14">
        <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#6f6862]">
          <span className="text-[#0a0a0a]/70">001</span><span className="h-px w-8 bg-current opacity-40" /><span>money in motion</span>
        </div>
        <h1 className="mt-8 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,7rem)]" style={display}>
          The machine, <span className="text-[#6f6862]">live.</span>
        </h1>

        {/* balances */}
        <div className="mt-12 grid sm:grid-cols-3 gap-px bg-[#0a0a0a]/10 border border-[#0a0a0a]/10 rounded-2xl overflow-hidden">
          {[
            ["agent float (USDC)", rBalUsdcOr(sBal), "USDC"],
            ["gas reserve (XLM)", sBal?.xlm, "XLM"],
            ["merchant received", rBal?.usdc, "USDC"],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-[#f1eee7] p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{label}</div>
              <div className="mt-3 text-4xl font-semibold tabular-nums tracking-[-0.02em] text-[#0a0a0a]" style={display}>
                {val == null ? "…" : Number(val).toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
          {/* live payment stream */}
          <div className="rounded-2xl border border-[#0a0a0a]/12 p-6">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              <span>live payments · on-chain</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#FDDA24] animate-pulse" /> streaming</span>
            </div>
            <div className="mt-5 divide-y divide-[#0a0a0a]/10">
              {pays.length === 0 && <div className="py-6 text-[13px] text-[#0a0a0a]/45 font-mono">listening to the network…</div>}
              {pays.slice(0, 8).map((p, i) => (
                <a key={p.id} href={xtx(p.tx)} target="_blank" rel="noreferrer"
                  className={`flex items-center gap-3 py-3 hover:bg-[#0a0a0a]/[0.03] -mx-2 px-2 rounded-lg transition-colors ${i === 0 ? "animate-[ledger-in_500ms_ease]" : ""}`}>
                  <span className="text-[#FDDA24] text-xs">✓</span>
                  <span className="font-mono text-[13px] tabular-nums text-[#0a0a0a]/90 w-[120px]">{Number(p.amount).toLocaleString("en-US", { maximumFractionDigits: 4 })} {p.asset}</span>
                  <span className="flex-1 font-mono text-[11px] text-[#0a0a0a]/55 truncate">{fmtAcct(p.from)} → {fmtAcct(p.to)}</span>
                  <span className="font-mono text-[10px] text-[#0a0a0a]/45">{p.at.slice(11, 19)}</span>
                  <span className="text-[10px] text-[#0a0a0a]/45">↗</span>
                </a>
              ))}
            </div>
          </div>

          {/* agent console + guardrail */}
          <div className="rounded-2xl border border-[#0a0a0a]/12 p-6 flex flex-col">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              <span>agent console</span>
              <span style={{ color: paused ? "#f87171" : "#6f6862" }}>{paused ? "paused" : "active"}</span>
            </div>

            {/* guardrail */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
                <span>spent this period</span><span>{spent.toFixed(2)} / {cap.toFixed(2)} USDC</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[#0a0a0a]/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "#6f6862" }} />
              </div>
            </div>

            {/* chat */}
            <div ref={logRef} className="mt-5 flex-1 min-h-[200px] max-h-[260px] overflow-y-auto space-y-2.5 pr-1">
              {msgs.map((m, i) => (
                <div key={i} className={m.who === "you" ? "text-right" : ""}>
                  <span className={`inline-block max-w-[85%] text-left rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${m.who === "you" ? "bg-[#0a0a0a] text-[#f1eee7]" : "bg-[#0a0a0a]/[0.05] text-[#0a0a0a]/90"}`}>
                    {m.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="pay 0.05 to API vendor"
                className="flex-1 bg-white border border-[#0a0a0a]/15 rounded-full px-4 py-2.5 text-[13px] text-[#0a0a0a] placeholder-[#0a0a0a]/35 outline-none focus:border-[#6f6862]/60" />
              <button onClick={submit} className="rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a] font-medium">Send</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["pay 0.05 to vendor", "set cap to 1", "pay 2 to stranger", paused ? "resume" : "pause"].map((q) => (
                <button key={q} onClick={() => { setInput(q); }} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0a0a0a]/55 hover:text-[#6f6862] border-b border-[#0a0a0a]/15 pb-0.5">{q}</button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">
          payments + balances are live from the Stellar network · the console is a policy preview
        </p>
      </main>

      <style>{`@keyframes ledger-in { from { opacity:0; transform: translateY(-6px) } to { opacity:1; transform:none } }`}</style>
    </div>
  );
}

function rBalUsdcOr(sBal: Bal | null): string | undefined { return sBal?.usdc; }
