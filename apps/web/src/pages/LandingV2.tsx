// /v2 — full landing in the "Yeezy editorial monumental" register, CENTERED:
// every section and the production copy, with oversized Space Grotesk display,
// numbered index stamps, big negative space, alternating dark sections, and the
// live artifacts (payment card, rule sandbox, mandate demo) as punctums. All
// text centered. English, plain language, honest mainnet proof.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { CountUp } from "../components/CountUp.tsx";
import { LiveProof } from "../components/LiveProof.tsx";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const LIVE_CONTRACT = "CD2RFNOLMIKZN4EETDCGULGMD4ANS56IIUDIBLOE24P4JRZM2GCVFV2U";
const REAL_TX = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
const LIVE_CONTRACT_TEAM = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P"; // team USDC address
const xurl = (p: string, id: string) => `https://stellar.expert/explorer/public/${p}/${id}`;

const TIERS = [
  { name: "Starter", who: "to start and test", featured: false },
  { name: "Growth", who: "when payments grow", featured: true },
  { name: "Business", who: "for the whole finance team", featured: false },
];

const FAQ: [string, string][] = [
  ["Is it safe to let an agent pay my bills?", "Yes. The agent decides nothing. It only executes what you approved. Before every payment it checks the recipient, the amount, and the limit. If something falls outside the rule, it stops and flags you. And you can pause whenever you want."],
  ["Does SlipPay hold the money?", "Never. The money sits in a wallet that is only yours. Not even SlipPay can touch it. We handle the automation, not your money."],
  ["How does it pay without me approving every time?", "You set the rules once: how much it can spend, to whom, and how often. Within that, the agent executes on its own. Over the limit or outside the rule, it stops immediately."],
  ["Do I need to understand crypto or blockchain?", "No. You use it like any app. The blockchain is just where every payment is recorded, so you can check everything without taking our word for it."],
  ["What currency does the agent pay in?", "Today, in digital dollars (USDC): settles in seconds, no chargebacks. Direct local-currency payment is on the roadmap."],
  ["Does it really work, or is it a prototype?", "It works. Real payments have already happened and are recorded. You verify every transaction. Not a simulation, not a mockup."],
  ["Is there a free trial? How much does it cost?", "14 days free, no card. Then a plan tailored to the size of your operation, always less than the hours the agent gives you back."],
  ["Can I pause or cancel?", "Anytime, in one click. The control is always yours."],
];

function Index({ n, label, dark = false }: { n: string; label: string; dark?: boolean }) {
  return (
    <div className={`flex items-baseline justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] ${dark ? "text-[#FDDA24]" : "text-[#0a0a0a]/45"}`}>
      <span className={dark ? "text-[#f1eee7]/70" : "text-[#0a0a0a]/70"}>{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

export default function LandingV2() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const NAV: [string, string][] = [["Live", "/cockpit"], ["Pay", "/pay"], ["Receive", "/cobrar"], ["Pricing", "#pricing"], ["Manifesto", "/manifesto"], ["Login", "/account"]];

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
      <header className="relative px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay</Link>
        <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          {NAV.map(([label, href]) => (
            href.startsWith("#")
              ? <a key={label} href={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</a>
              : <Link key={label} to={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</Link>
          ))}
          <Link to="/pay" className="hidden md:inline-flex items-center rounded-full px-5 py-2.5 bg-[#0a0a0a] text-[#f1eee7] hover:opacity-90">Try it free</Link>
          {/* hamburger — mobile only */}
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" className="md:hidden flex flex-col gap-[5px] p-1">
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-transform ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-transform ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#f1eee7] border-y border-[#0a0a0a]/10 px-6 py-4 flex flex-col gap-1 text-[12px] uppercase tracking-[0.18em]">
            {NAV.map(([label, href]) => (
              href.startsWith("#")
                ? <a key={label} href={href} onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">{label}</a>
                : <Link key={label} to={href} onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">{label}</Link>
            ))}
            <Link to="/pay" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#0a0a0a] text-[#f1eee7]">Try it free</Link>
          </div>
        )}
      </header>

      {/* 001 — HERO */}
      <section className="px-6 md:px-12 pt-10 md:pt-16 pb-24 md:pb-36">
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
          <Index n="001" label="payments, on autopilot" />
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8.5rem)] break-words mx-auto" style={display}>
            Your money,<br /><span className="text-[#0a0a0a]/30">on</span> auto<span className="text-[#0a0a0a]">pilot.</span>
          </h1>
          <p className="mt-10 text-xl md:text-2xl leading-relaxed max-w-[46ch] mx-auto text-[#0a0a0a]/75">
            Keep your money in dollars and let it pay your bills by itself, the moment they're due.
            <span className="text-[#0a0a0a] font-medium"> It stays yours, and only does what you allow.</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">Try it free</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">free · no card · no seed phrase</span>
          </div>
          <p className="mt-6 text-[15px] text-[#0a0a0a]/50 max-w-[44ch] mx-auto">For anyone who pays or gets paid in dollars — from a freelancer to a company.</p>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">live · mainnet</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8">
          <LiveProof prominent />
        </div>
      </section>

      {/* 003 — CHEAPER THAN STRIPE */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="002" label="cheaper & safer than stripe" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6.5rem)] max-w-[15ch] mx-auto break-words" style={display}>
            Save ~3% on <span className="text-[#0a0a0a]">every transaction.</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/60">
            Cards and Stripe take close to 3% of every sale. On Stellar, moving money costs fractions
            of a cent. SlipPay passes that saving on to you:
            <span className="text-[#0a0a0a] font-medium"> the same sale, at a fraction of the fee, with no chargebacks.</span>
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 max-w-[680px] mx-auto text-left">
            <div className="bg-white p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">card / stripe</div>
              <div className="mt-4 text-4xl font-semibold tabular-nums tracking-[-0.03em]" style={display}><CountUp to={2.9} format={(n) => `~${n.toFixed(1)}%+`} /></div>
              <div className="mt-2 text-[14px] text-[#0a0a0a]/55 leading-snug">per transaction, and still subject to chargebacks</div>
            </div>
            <div className="bg-[#0a0a0a] text-[#f1eee7] p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#FDDA24]">slippay · on stellar</div>
              <div className="mt-4 text-4xl font-semibold tracking-[-0.03em]" style={display}>a fraction</div>
              <div className="mt-2 text-[14px] text-[#f1eee7]/60 leading-snug">near-zero network fee · final in seconds · no chargebacks</div>
            </div>
          </div>
          <p className="mt-10 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/60">
            And safer. Stripe holds your money and can freeze your account.
            <span className="text-[#0a0a0a] font-medium"> SlipPay never holds it — the money never leaves your wallet, and no one can lock it.</span>
          </p>
        </div>
      </section>

      {/* 004 — HOW TO START (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1200px] mx-auto px-6 md:px-12 py-24 md:py-40 text-center">
          <Index n="003" label="how to start" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,8vw,7rem)] max-w-[16ch] mx-auto break-words" style={display}>
            Start with what <span className="text-[#FDDA24]">you already have.</span>
          </h2>
          <div className="mt-16 grid md:grid-cols-3 gap-12 md:gap-10">
            {[
              ["01", "Create your account", "With your face, in a minute. No password, no phrase to memorize, no card. Free."],
              ["02", "Your money becomes dollars", "From your bank account you buy digital dollars and send them to your wallet. We guide you step by step; it takes a few minutes."],
              ["03", "The agent takes over", "You set how much it can spend and to whom. Then it pays your bills in dollars, on its own, always within your rules."],
            ].map(([n, h, b]) => (
              <div key={n}>
                <div className="font-mono text-[12px] text-[#FDDA24] mb-4">{n}</div>
                <div className="text-2xl font-semibold tracking-[-0.02em]" style={display}>{h}</div>
                <p className="mt-3 text-[15px] text-[#f1eee7]/60 leading-relaxed max-w-[34ch] mx-auto">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 008 — LIVE ON MAINNET / PROOF (dark) */}
      <section id="proof" className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-40 flex flex-col items-center text-center">
          <Index n="004" label="live on the main network" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,10vw,8.5rem)] max-w-[14ch] mx-auto break-words" style={display}>
            This isn't a demo. <span className="text-[#FDDA24]">It's running.</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[46ch] mx-auto text-[#f1eee7]/65">
            Real money already moves through SlipPay on the live network. You don't have to trust us — open any payment and check it yourself.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a]">See a real payment ↗</a>
            <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/60 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">The live contract ↗</a>
          </div>
          <div className="mt-12 w-full max-w-[440px] mx-auto text-left">
            <MandateDemo />
          </div>
        </div>
      </section>

      {/* 010 — PRICING */}
      <section id="pricing" className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="005" label="pricing" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[18ch] mx-auto break-words" style={display}>
            Start free. <span className="text-[#0a0a0a]/35">Pay when it's worth it.</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[50ch] mx-auto text-[#0a0a0a]/60">14 days free, no card. Then a plan tailored to the size of your operation.</p>
          <div className="mt-14 grid md:grid-cols-3 gap-8 text-left">
            {TIERS.map((t) => (
              <div key={t.name} className={`py-8 ${t.featured ? "border-t-2 border-[#A16207]" : "border-t border-[#0a0a0a]/15"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold tracking-[-0.01em]" style={display}>{t.name}</span>
                  {t.featured && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#0a0a0a]">most chosen</span>}
                </div>
                <div className="mt-3 text-[15px] text-[#0a0a0a]/55">{t.who}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">Try it free</Link>
            <a href="/signup" className="text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-1">Talk to us</a>
          </div>
        </div>
      </section>

      {/* 011 — FAQ */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="006" label="frequently asked" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[14ch] mx-auto break-words" style={display}>Still have questions?</h2>
          <div className="mt-12 max-w-[900px] mx-auto text-left">
            {FAQ.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <div key={q} className="border-t border-[#0a0a0a]/12 last:border-b">
                  <button onClick={() => setOpenFaq(open ? null : i)} className="w-full flex items-center justify-between gap-6 py-6 text-left group" aria-expanded={open}>
                    <span className="text-lg md:text-2xl font-semibold tracking-[-0.02em] group-hover:text-[#0a0a0a] transition-colors" style={display}>{q}</span>
                    <span className={`shrink-0 text-2xl leading-none text-[#0a0a0a] transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
                  </button>
                  <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden"><p className="pb-7 text-lg text-[#0a0a0a]/65 leading-relaxed">{a}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 012 — CTA (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-48 text-center">
          <Index n="007" label="start" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,12vw,11rem)] mx-auto break-words" style={display}>
            Set it once.<br /><span className="text-[#FDDA24]">Done.</span>
          </h2>
          <p className="mt-10 text-xl md:text-2xl text-[#f1eee7]/60 max-w-[42ch] mx-auto">Stop approving the same payments forever. Free to try, no card. The simple way to let your money work on its own.</p>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-7">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">Try it free</Link>
            <a href="#proof" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/55 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">See it running</a>
          </div>
          <div className="mt-16 pt-10 border-t border-[#f1eee7]/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#FDDA24]">support the team</div>
            <p className="mt-3 text-[15px] text-[#f1eee7]/60 max-w-[42ch]">Built solo in Brazil. If this earned your respect, send us a few dollars — one touch, no app.</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to={`/pay?to=${LIVE_CONTRACT_TEAM}&amount=100000000&asset=USDC`} className="lift inline-flex items-center rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a] font-medium">Support with $10 ↗</Link>
              <span className="font-mono text-[10px] text-[#f1eee7]/40 break-all max-w-[280px]">USDC · {LIVE_CONTRACT_TEAM}</span>
            </div>
          </div>
          <div className="mt-16 font-mono text-[10px] uppercase tracking-[0.28em] text-[#f1eee7]/30">slippay · real dollars, on autopilot · live on mainnet</div>
        </div>
      </section>
    </div>
  );
}
