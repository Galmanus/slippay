// /v2 — the full landing in the "Yeezy editorial monumental" register: every
// section and the copy from the production landing, restyled with oversized
// Space Grotesk display, numbered index stamps, asymmetry, big negative space,
// alternating dark sections, and the live artifacts (payment card, rule sandbox,
// mandate demo) as punctums. English, plain language, honest mainnet proof.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { RuleSandbox } from "../components/RuleSandbox.tsx";
import { CountUp } from "../components/CountUp.tsx";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const LIVE_CONTRACT = "CD2RFNOLMIKZN4EETDCGULGMD4ANS56IIUDIBLOE24P4JRZM2GCVFV2U";
const REAL_TX = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
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
    <div className={`flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] ${dark ? "text-[#b5e853]" : "text-[#0a0a0a]/45"}`}>
      <span className={dark ? "text-[#f1eee7]/70" : "text-[#0a0a0a]/70"}>{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

export default function LandingV2() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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
      <header className="px-6 md:px-12 py-7 flex items-center justify-between">
        <span className="text-lg font-semibold tracking-[-0.04em]" style={display}>slippay</span>
        <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <Link to="/manifesto" className="hidden sm:inline hover:text-[#0a0a0a]">Manifesto</Link>
          <a href="#proof" className="hidden sm:inline hover:text-[#0a0a0a]">Proof</a>
          <a href="#pricing" className="hidden sm:inline hover:text-[#0a0a0a]">Pricing</a>
          <Link to="/pay" className="inline-flex items-center rounded-full px-5 py-2.5 bg-[#0a0a0a] text-[#f1eee7] hover:opacity-90">Try it free</Link>
        </nav>
      </header>

      {/* 001 — HERO */}
      <section className="px-6 md:px-12 pt-10 md:pt-16 pb-24 md:pb-36">
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
              <p className="mt-6 text-[15px] text-[#0a0a0a]/50 max-w-[44ch]">For anyone who pays or gets paid in dollars — from a freelancer to a company.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-7 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">
          <span>built on</span><span className="text-[#0a0a0a]/75">Stellar</span>
          <span className="opacity-30">·</span><span className="text-[#0a0a0a]/75">Circle · USDC</span>
          <span className="opacity-30">·</span><span>every payment public &amp; checkable</span>
        </div>
      </section>

      {/* 002 — WHAT THE AGENT HANDLES */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="002" label="what it handles" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[20ch] break-words" style={display}>
            The payments that follow <span className="text-[#0a0a0a]/35">predictable rules.</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[46ch] text-[#0a0a0a]/60">Subscriptions, APIs, suppliers, contractors, and other recurring charges.</p>
        </div>
      </section>

      {/* 003 — CHEAPER THAN STRIPE */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="003" label="cheaper & safer than stripe" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6.5rem)] max-w-[14ch] break-words" style={display}>
            Save ~3% on <span className="text-[#65a30d]">every transaction.</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[52ch] text-[#0a0a0a]/60">
            Cards and Stripe take close to 3% of every sale. On Stellar, moving money costs fractions
            of a cent. SlipPay passes that saving on to you:
            <span className="text-[#0a0a0a] font-medium"> the same sale, at a fraction of the fee, with no chargebacks.</span>
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 max-w-[720px]">
            <div className="bg-white p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">card / stripe</div>
              <div className="mt-4 text-4xl font-semibold tabular-nums tracking-[-0.03em]" style={display}><CountUp to={2.9} format={(n) => `~${n.toFixed(1)}%+`} /></div>
              <div className="mt-2 text-[14px] text-[#0a0a0a]/55 leading-snug">per transaction, and still subject to chargebacks</div>
            </div>
            <div className="bg-[#0a0a0a] text-[#f1eee7] p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#b5e853]">slippay · on stellar</div>
              <div className="mt-4 text-4xl font-semibold tracking-[-0.03em]" style={display}>a fraction</div>
              <div className="mt-2 text-[14px] text-[#f1eee7]/60 leading-snug">near-zero network fee · final in seconds · no chargebacks</div>
            </div>
          </div>
          <p className="mt-10 text-xl leading-relaxed max-w-[52ch] text-[#0a0a0a]/60">
            And safer. Stripe holds your money and can freeze your account.
            <span className="text-[#0a0a0a] font-medium"> SlipPay never holds it — the money never leaves your wallet, and no one can lock it.</span>
          </p>
        </div>
      </section>

      {/* 004 — HOW TO START (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Index n="004" label="how to start" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,8vw,7rem)] max-w-[16ch] break-words" style={display}>
            Start with what <span className="text-[#b5e853]">you already have.</span>
          </h2>
          <div className="mt-16 grid md:grid-cols-3 gap-12 md:gap-10">
            {[
              ["01", "Create your account", "With your face, in a minute. No password, no phrase to memorize, no card. Free."],
              ["02", "Your money becomes dollars", "From your bank account you buy digital dollars and send them to your wallet. We guide you step by step; it takes a few minutes."],
              ["03", "The agent takes over", "You set how much it can spend and to whom. Then it pays your bills in dollars, on its own, always within your rules."],
            ].map(([n, h, b]) => (
              <div key={n}>
                <div className="font-mono text-[12px] text-[#b5e853] mb-4">{n}</div>
                <div className="text-2xl font-semibold tracking-[-0.02em]" style={display}>{h}</div>
                <p className="mt-3 text-[15px] text-[#f1eee7]/60 leading-relaxed max-w-[34ch]">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 005 — BRING DOLLARS FROM ANYWHERE */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="005" label="bring your dollars from anywhere" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[18ch] break-words" style={display}>
            Already have digital dollars somewhere else?
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[50ch] text-[#0a0a0a]/60">
            If your dollars are on another network, bring them in. They arrive in your wallet as
            <span className="text-[#0a0a0a] font-medium"> real dollars, straight from Circle</span> — the company behind USDC.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 font-mono text-[12px] uppercase tracking-[0.16em] text-[#0a0a0a]/55">
            {["Ethereum", "Base", "Solana", "Arbitrum", "Optimism", "Polygon", "Avalanche", "+ more"].map((c) => (
              <span key={c} className="flex items-center gap-2"><span className="text-[#65a30d]">◆</span>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 006 — FULL CONTROL + sandbox (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Index n="006" label="full control" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,10vw,9rem)] max-w-[12ch] break-words" style={display}>
            The agent doesn't decide. <span className="text-[#b5e853]">It executes.</span>
          </h2>
          <div className="mt-12 grid lg:grid-cols-[1fr_0.9fr] gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-xl leading-relaxed max-w-[44ch] text-[#f1eee7]/70">
                <span className="text-[#f1eee7] font-medium">Your money never leaves your control.</span> You set the rules, and
                before every payment the agent checks who gets paid, how much, whether it's within policy, and whether the limit still holds.
              </p>
              <p className="mt-8 text-2xl md:text-3xl font-medium tracking-[-0.02em] max-w-[24ch] text-[#f1eee7]/90" style={display}>
                The agent can slip. The rule that protects your money can't.
              </p>
            </div>
            <RuleSandbox />
          </div>
        </div>
      </section>

      {/* 007 — EXAMPLE */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36 grid md:grid-cols-[1fr_0.8fr] gap-12 lg:gap-20 items-end">
          <div>
            <Index n="007" label="an example" />
            <h2 className="mt-10 font-bold tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,11vw,8.5rem)]" style={display}>
              R$<CountUp to={40} format={(n) => `${Math.round(n)}k`} /><span className="text-[#65a30d]">/mo</span>
            </h2>
            <p className="mt-8 text-xl leading-relaxed max-w-[40ch] text-[#0a0a0a]/65">
              The agent runs the recurring payments within the approved rules, and only asks for help when something falls outside the norm.
            </p>
          </div>
          <div className="w-full">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/40 pb-6">one company · every month</div>
            {[["APIs", "R$20,000"], ["Suppliers", "R$13,000"], ["Subscriptions", "R$7,000"]].map(([l, v]) => (
              <div key={l} className="flex items-baseline justify-between py-4 border-t border-[#0a0a0a]/10">
                <span className="text-lg text-[#0a0a0a]/70">{l}</span>
                <span className="text-xl font-semibold tabular-nums">{v}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-6 mt-2 border-t-2 border-[#0a0a0a]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#65a30d]">paid by the agent</span>
              <span className="text-3xl font-semibold tabular-nums" style={display}>R$40k</span>
            </div>
          </div>
        </div>
      </section>

      {/* 008 — LIVE ON MAINNET / PROOF (dark) */}
      <section id="proof" className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Index n="008" label="live on the main network" dark />
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
            <div>
              <h2 className="font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,9vw,8rem)] break-words" style={display}>
                This isn't a demo. <span className="text-[#b5e853]">It's running.</span>
              </h2>
              <p className="mt-8 text-xl leading-relaxed max-w-[46ch] text-[#f1eee7]/65">
                Real money already moves through SlipPay on the live network. You don't have to trust us — open any payment and check it yourself.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
                <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#b5e853] text-[#0a0a0a]">See a real payment ↗</a>
                <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/60 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">The live contract ↗</a>
              </div>
            </div>
            <MandateDemo />
          </div>
        </div>
      </section>

      {/* 009 — VISION */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Index n="009" label="our vision" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.88] text-[clamp(2.5rem,9vw,8rem)] max-w-[16ch] break-words" style={display}>
            Real dollars, <span className="text-[#65a30d]">as simple as an app.</span>
          </h2>
          <p className="mt-10 text-xl md:text-2xl leading-relaxed max-w-[54ch] text-[#0a0a0a]/70">
            Dollars that work on their own and stay yours. No becoming an engineer, no memorizing jargon. The AI does the heavy lifting, and the rule that protects your money never depends on it.
          </p>
          <Link to="/manifesto" className="mt-10 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a]/70 border-b border-[#0a0a0a]/25 hover:border-[#0a0a0a] pb-1">Read the manifesto ↗</Link>
        </div>
      </section>

      {/* 010 — PRICING */}
      <section id="pricing" className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="010" label="pricing" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[16ch] break-words" style={display}>
            Start free. <span className="text-[#0a0a0a]/35">Pay when it's worth it.</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[50ch] text-[#0a0a0a]/60">14 days free, no card. Then a plan tailored to the size of your operation.</p>
          <div className="mt-14 grid md:grid-cols-3 gap-8">
            {TIERS.map((t) => (
              <div key={t.name} className={`py-8 ${t.featured ? "border-t-2 border-[#65a30d]" : "border-t border-[#0a0a0a]/15"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold tracking-[-0.01em]" style={display}>{t.name}</span>
                  {t.featured && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#65a30d]">most chosen</span>}
                </div>
                <div className="mt-3 text-[15px] text-[#0a0a0a]/55">{t.who}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#b5e853] text-[#0a0a0a]">Try it free</Link>
            <a href="/signup" className="text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-1">Talk to us</a>
          </div>
        </div>
      </section>

      {/* 011 — FAQ */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="011" label="frequently asked" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[14ch] break-words" style={display}>Still have questions?</h2>
          <div className="mt-12 max-w-[900px]">
            {FAQ.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <div key={q} className="border-t border-[#0a0a0a]/12 last:border-b">
                  <button onClick={() => setOpenFaq(open ? null : i)} className="w-full flex items-center justify-between gap-6 py-6 text-left group" aria-expanded={open}>
                    <span className="text-lg md:text-2xl font-semibold tracking-[-0.02em] group-hover:text-[#65a30d] transition-colors" style={display}>{q}</span>
                    <span className={`shrink-0 text-2xl leading-none text-[#65a30d] transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
                  </button>
                  <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden"><p className="pb-7 text-lg text-[#0a0a0a]/65 leading-relaxed max-w-[60ch]">{a}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 012 — CTA (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-28 md:py-48">
          <Index n="012" label="start" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,12vw,11rem)] break-words" style={display}>
            Set it once.<br /><span className="text-[#b5e853]">Done.</span>
          </h2>
          <p className="mt-10 text-xl md:text-2xl text-[#f1eee7]/60 max-w-[42ch]">Stop approving the same payments forever. Free to try, no card. The simple way to let your money work on its own.</p>
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
