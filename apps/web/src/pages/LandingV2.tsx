// /v2 — experimental "Yeezy editorial monumental" landing. Magazine craft:
// oversized display type (Space Grotesk), asymmetric grid, big negative space,
// numbered index stamps (001…), one live artifact as the punctum. English,
// plain language, and an honest "live on mainnet" block with verifiable proof.
// Lives at /v2 so the production landing (/) is untouched.

import { Link } from "react-router-dom";
import { useEffect } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";

const LIVE_CONTRACT = "CD2RFNOLMIKZN4EETDCGULGMD4ANS56IIUDIBLOE24P4JRZM2GCVFV2U";
const REAL_TX = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
const xurl = (p: string, id: string) => `https://stellar.expert/explorer/public/${p}/${id}`;

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;

function Index({ n, label, dark = false }: { n: string; label: string; dark?: boolean }) {
  return (
    <div className={`flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] ${dark ? "text-[#b5e853]" : "text-[#0a0a0a]/45"}`}>
      <span className={dark ? "text-[#f1eee7]/70" : "text-[#0a0a0a]/70"}>{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

export default function LandingV2() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); }
    }, { rootMargin: "-8% 0px -8% 0px", threshold: 0.06 });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("js-reveal"); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      {/* HEADER */}
      <header className="px-6 md:px-12 py-7 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-[-0.04em]" style={display}>slippay</span>
        <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <Link to="/manifesto" className="hidden sm:inline hover:text-[#0a0a0a]">Manifesto</Link>
          <a href="#proof" className="hidden sm:inline hover:text-[#0a0a0a]">Proof</a>
          <Link to="/pay" className="inline-flex items-center rounded-full px-5 py-2.5 bg-[#0a0a0a] text-[#f1eee7] hover:opacity-90">Try it free</Link>
        </nav>
      </header>

      {/* HERO — monumental, asymmetric */}
      <section className="px-6 md:px-12 pt-10 md:pt-16 pb-24 md:pb-40">
        <div className="max-w-[1400px] mx-auto">
          <Index n="001" label="payments, on autopilot" />
          <div className="mt-8 grid lg:grid-cols-[1.35fr_0.65fr] gap-12 lg:gap-8 items-end">
            <h1 className="font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,9.5vw,7.5rem)] break-words" style={display}>
              Your<br />money,<br /><span className="text-[#0a0a0a]/30">on</span> auto<span className="text-[#65a30d]">pilot.</span>
            </h1>
            <div className="lg:pb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">live · mainnet</div>
              <LivePaymentCard />
            </div>
          </div>

          <div className="mt-16 grid md:grid-cols-[0.5fr_1fr] gap-8 md:gap-16 items-start">
            <div className="h-px bg-[#0a0a0a]/20 mt-4 hidden md:block" />
            <div>
              <p className="text-xl md:text-2xl leading-relaxed max-w-[44ch] text-[#0a0a0a]/75">
                Keep your money in dollars and let it pay your bills by itself, the moment they're due.
                <span className="text-[#0a0a0a] font-medium"> It stays yours, and only does what you allow.</span>
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-7">
                <Link to="/pay" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#b5e853] text-[#0a0a0a]">Try it free</Link>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">free · no card · no seed phrase</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 002 — what it is, one monumental line */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="002" label="what it does" />
          <p className="mt-10 font-semibold tracking-[-0.04em] leading-[1.0] text-[clamp(2rem,7vw,5.5rem)] max-w-[18ch] break-words" style={display}>
            Pay with your face. <span className="text-[#0a0a0a]/35">No app, no password, no seed phrase.</span>
          </p>
        </div>
      </section>

      {/* 003 — PROOF, dark, the punctum of credibility */}
      <section id="proof" className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Index n="003" label="live on the main network" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,10rem)] break-words" style={display}>
            This isn't<br />a demo.<br /><span className="text-[#b5e853]">It's running.</span>
          </h2>
          <div className="mt-16 grid md:grid-cols-3 gap-10 max-w-[1000px]">
            {[
              ["Pays by itself", "Recurring payments charge themselves, on schedule. Live on the main network."],
              ["Pay with your face", "Create an account and pay with Face ID. No seed phrase, no wallet to install."],
              ["Public & checkable", "Every payment is recorded in the open. Anyone can verify it, anytime."],
            ].map(([h, b]) => (
              <div key={h}>
                <div className="text-xl font-semibold tracking-[-0.02em] text-[#b5e853]" style={display}>{h}</div>
                <p className="mt-3 text-[15px] text-[#f1eee7]/60 leading-relaxed max-w-[34ch]">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#b5e853] text-[#0a0a0a]">See a real payment ↗</a>
            <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/60 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">The live contract ↗</a>
          </div>
        </div>
      </section>

      {/* 004 — price, editorial stat */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36 grid md:grid-cols-[1fr_1fr] gap-12 items-end">
          <div>
            <Index n="004" label="the price" />
            <p className="mt-10 font-bold tracking-[-0.05em] leading-[0.85] text-[clamp(4rem,13vw,10.5rem)] break-words" style={display}>
              2.97<span className="text-[#65a30d]">%</span>
            </p>
          </div>
          <p className="text-xl md:text-2xl leading-relaxed max-w-[40ch] text-[#0a0a0a]/70 md:pb-8">
            Cards and Stripe take close to 3% and can freeze your account. SlipPay takes a flat fee,
            settles in seconds, <span className="text-[#0a0a0a] font-medium">never holds your money, and can't be charged back.</span>
          </p>
        </div>
      </section>

      {/* 005 — CTA monumental */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-28 md:py-48">
          <Index n="005" label="start" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,12vw,11rem)] break-words" style={display}>
            Set it<br />once.<br /><span className="text-[#b5e853]">Done.</span>
          </h2>
          <div className="mt-14 flex flex-wrap items-center gap-7">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#b5e853] text-[#0a0a0a]">Try it free</Link>
            <a href="#proof" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/55 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">See it running</a>
          </div>
          <div className="mt-20 font-mono text-[10px] uppercase tracking-[0.28em] text-[#f1eee7]/30">slippay · real dollars, on autopilot · live on mainnet</div>
        </div>
      </section>
    </div>
  );
}
