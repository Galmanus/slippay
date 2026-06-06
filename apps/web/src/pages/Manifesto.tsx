// /manifesto — editorial "Yeezy monumental" register matching /v2. English,
// calm, apolitical, honest. Oversized Space Grotesk display, numbered index
// stamps, asymmetric, big negative space, alternating dark sections. The theme:
// the most advanced way to move money, made simple enough that you don't have
// to understand any of it.

import { Link } from "react-router-dom";
import { useEffect } from "react";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const REAL_TX = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";

function Index({ n, label, dark = false }: { n: string; label: string; dark?: boolean }) {
  return (
    <div className={`flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] ${dark ? "text-[#FDDA24]" : "text-[#0a0a0a]/45"}`}>
      <span className={dark ? "text-[#f1eee7]/70" : "text-[#0a0a0a]/70"}>{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

export default function Manifesto() {
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
        <Link to="/" className="text-lg font-semibold tracking-[-0.04em]" style={display}>slippay</Link>
        <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <Link to="/" className="hidden sm:inline hover:text-[#0a0a0a]">Home</Link>
          <Link to="/pay" className="inline-flex items-center rounded-full px-5 py-2.5 bg-[#0a0a0a] text-[#f1eee7] hover:opacity-90">Try it free</Link>
        </nav>
      </header>

      {/* 001 — who we are */}
      <section className="px-6 md:px-12 pt-12 md:pt-20 pb-24 md:pb-36">
        <div className="max-w-[1400px] mx-auto">
          <Index n="001" label="who we are" />
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,10vw,8.5rem)] break-words max-w-[16ch]" style={display}>
            We wanted<br />simpler money.<br /><span className="text-[#A16207]">So we built it.</span>
          </h1>
          <p className="mt-12 text-xl md:text-2xl leading-relaxed max-w-[54ch] text-[#0a0a0a]/70">
            We're not a bank. Not another fintech. A small team in Brazil, building the money we
            always wanted to use: in dollars, instant, simple.
            <span className="text-[#0a0a0a] font-medium"> The best financial technology has existed for years. We made it simple to use.</span>
          </p>
        </div>
      </section>

      {/* 002 — the AI that errs */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="002" label="the honest part" />
          <p className="mt-10 font-semibold tracking-[-0.04em] leading-[1.0] text-[clamp(2rem,7vw,5.5rem)] max-w-[20ch] break-words" style={display}>
            You talk to an AI every day. You already trust it. <span className="text-[#0a0a0a]/35">And you know it errs.</span>
          </p>
          <p className="mt-10 text-xl leading-relaxed max-w-[52ch] text-[#0a0a0a]/70">
            It has already changed how you work, and you feel it could change your life. But a mistake
            with your money has no excuse.
          </p>
        </div>
      </section>

      {/* 003 — dark, the turn */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Index n="003" label="the idea" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,8.5rem)] break-words max-w-[15ch]" style={display}>
            What if the mistake was <span className="text-[#FDDA24]">stopped before it happened?</span>
          </h2>
          <p className="mt-12 text-xl md:text-2xl leading-relaxed max-w-[54ch] text-[#f1eee7]/70">
            Not another promise that this time it'll be fine. A rule written in code and recorded in
            the open. The AI does the heavy lifting; the rule makes sure its mistake never becomes your
            loss. <span className="text-[#f1eee7] font-medium">The agent can slip. The rule that protects your money can't.</span>
          </p>
        </div>
      </section>

      {/* 004 — dollars, simple */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="004" label="the dollars" />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,7rem)] break-words max-w-[16ch]" style={display}>
            Real dollars, <span className="text-[#0a0a0a]/35">as simple as an app.</span>
          </h2>
          <p className="mt-10 text-xl leading-relaxed max-w-[52ch] text-[#0a0a0a]/70">
            Money in dollars that works on its own and stays yours. No becoming an engineer, no
            memorizing jargon. You use it the way you use any app.
          </p>
        </div>
      </section>

      {/* 005 — no jargon */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-36">
          <Index n="005" label="why it's different" />
          <p className="mt-10 font-semibold tracking-[-0.04em] leading-[1.0] text-[clamp(2rem,7vw,5.5rem)] max-w-[18ch] break-words" style={display}>
            You don't need to understand any of it.
          </p>
          <p className="mt-10 text-xl leading-relaxed max-w-[54ch] text-[#0a0a0a]/70">
            No blockchain to see. No twelve-word phrase. No bank manager. You tap, and it happens. The
            heaviest engineering in the world, hidden behind the simplest thing to use.
            <span className="text-[#0a0a0a] font-medium"> That's how the computer became the phone in your hand. It's how money becomes software in your pocket.</span>
          </p>
        </div>
      </section>

      {/* 006 — close, dark + CTA */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-28 md:py-48">
          <Index n="006" label="now" dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,10vw,9.5rem)] break-words max-w-[14ch]" style={display}>
            The most advanced technology, <span className="text-[#FDDA24]">made simple.</span>
          </h2>
          <p className="mt-10 text-xl md:text-2xl text-[#f1eee7]/65 max-w-[40ch]">
            Real dollars, on autopilot. Already live on the main network — see a
            <a href={`https://stellar.expert/explorer/public/tx/${REAL_TX}`} target="_blank" rel="noreferrer" className="text-[#FDDA24] border-b border-[#FDDA24]/40 hover:border-[#FDDA24]"> real payment</a>.
          </p>
          <div className="mt-14 flex flex-wrap items-center gap-7">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">Try it free</Link>
            <Link to="/" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/55 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">Back home</Link>
          </div>
          <div className="mt-20 font-mono text-[10px] uppercase tracking-[0.28em] text-[#f1eee7]/30">slippay · real dollars, on autopilot · live on mainnet</div>
        </div>
      </section>
    </div>
  );
}
