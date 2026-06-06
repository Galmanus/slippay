import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// LiveProof — a subtle, honest engagement cue placed across the site. One quiet
// monospace line: a live pulse, the real time since the last on-chain payment
// (from Horizon), the per-transaction saving vs cards, and a funnel into the live
// cockpit. No badges, no confetti — the legitimate dopamine of "real money is
// moving and you're saving", in the editorial register. Numbers are real; nothing
// is fabricated.

const HORIZON = "https://horizon.stellar.org";
const RECIPIENT = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P";

function rel(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function LiveProof({ dark = false, prominent = false }: { dark?: boolean; prominent?: boolean }) {
  const [last, setLast] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const r = await fetch(`${HORIZON}/accounts/${RECIPIENT}/payments?order=desc&limit=1&include_failed=false`);
        const rec = (await r.json())?._embedded?.records?.[0];
        if (on && rec?.created_at) setLast(rec.created_at);
      } catch { /* offline — line still renders the rest */ }
    };
    tick();
    const id = setInterval(tick, 20000);
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => { on = false; clearInterval(id); clearInterval(t); };
  }, []);

  const muted = dark ? "rgba(241,238,231,.5)" : "rgba(10,10,10,.5)";
  const accent = dark ? "#FDDA24" : "#A16207";
  const Dot = () => <span className="opacity-30">·</span>;

  if (prominent) {
    return (
      <div className="mx-auto max-w-[760px] rounded-full border border-[#0a0a0a]/12 bg-white/40 px-6 md:px-8 py-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] md:text-[13px] tracking-[-0.01em] text-[#0a0a0a]/70">
        <span className="flex items-center gap-2.5 font-medium text-[#0a0a0a]">
          <span className="w-2 h-2 rounded-full bg-[#FDDA24] animate-pulse" /> Real money is moving on mainnet
        </span>
        {last && <span className="text-[#0a0a0a]/55">last payment <span className="tabular-nums text-[#0a0a0a]/80">{rel(last)}</span></span>}
        <span className="text-[#0a0a0a]/55">~3% cheaper than cards, every time</span>
        <Link to="/cockpit" className="font-medium hover:opacity-70 transition-opacity" style={{ color: "#A16207" }}>See it live ↗</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] md:text-[11px] uppercase tracking-[0.18em]" style={{ color: muted }}>
      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#FDDA24] animate-pulse" /> live on mainnet</span>
      {last && <><Dot /><span>last payment {rel(last)}</span></>}
      <Dot /><span>~3% cheaper than cards</span>
      <Dot /><Link to="/cockpit" className="hover:opacity-100 transition-opacity" style={{ color: accent }}>see it live ↗</Link>
    </div>
  );
}
