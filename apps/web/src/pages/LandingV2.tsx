// Landing — "global money in one touch." Brutal, minimal, manifesto-inevitable.
// Warm bone, ink text, GRAY accent (#6f6862), yellow ONLY as small details
// (#FDDA24: live dots, checkmarks, the logo dot), ink CTAs. Bilingual PT/EN.
// The thesis: money becomes software without looking like software.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { LiveProof } from "../components/LiveProof.tsx";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const GRAY = "#6f6862";
const LIVE_CONTRACT = "CCT3KJXRUO3HJJ2GLTW2MISSQVUEKOPUG3B4YQH75TCGKAOC4P6FIKUF";
const REAL_TX = "ede13fb6230334af91b2af1cfab92f86f8f44e8a7755acb57d92891d68a3e957";
const TEAM_USDC = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P";
const xurl = (p: string, id: string) => `https://stellar.expert/explorer/public/${p}/${id}`;
type Lang = "pt" | "en";

const COPY = {
  en: {
    nav: { gate: "The gate", security: "Security", live: "Live", pay: "Pay", receive: "Receive", manifesto: "Manifesto", login: "Login", tryFree: "Get started" },
    hero: {
      axis: "global money", h1a: "Global money.", h1acc: "In one touch.",
      sub: "Pix. Dollars in your wallet. 10 seconds.",
      reassure: "No bank. No broker. No complexity.",
      cta: "Get started free", note: "2 minutes • biometrics • no card • no seed phrase", liveTag: "live · mainnet",
    },
    pixin: { stamp: "how", h: "Pix in. Dollars out.", lines: ["You send reais.", "You get dollars.", "Straight to your wallet. Instantly."] },
    touch: { stamp: "one touch", h: "One touch. And it's yours.", lines: ["Biometrics. No password.", "Just you and your money."] },
    runs: { stamp: "then it runs", h: "After that, it runs on its own.", lines: ["Set the rules once: who can be paid, how much, when.", "If it's within the rules, it happens. If not, it doesn't."] },
    yours: { stamp: "your money", h: "Your money passes through no one.", lines: ["Not a bank. Not a middleman. Not us.", "It's yours from the first second. In your wallet. On your key."] },
    invisible: { stamp: "invisible", h: "The rest is invisible.", lines: ["Smart contracts. Multiple blockchains. Global settlement.", "You never see any of it. Only the result.", "The best financial technology doesn't look like technology."] },
    proof: { stamp: "live", h: "Real money. Live.", lines: ["Not a demo. Not a promise.", "Every payment is publicly verifiable. Check it yourself."], btnReal: "See a real payment ↗", btnContract: "The live contract ↗" },
    cta: { stamp: "start", h: "Start.", lines: ["Pix → dollars → your wallet.", "In seconds."], btn: "Get started free", note: "No card • no seed phrase • takes about 2 minutes",
      supportLabel: "support the team", supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars, one touch, no app.", supportBtn: "Support with $10 ↗", footer: "slippay · global money, in one touch · live on mainnet" },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", manifesto: "Manifesto", login: "Entrar", tryFree: "Começar" },
    hero: {
      axis: "dinheiro global", h1a: "Dinheiro global.", h1acc: "Em um toque.",
      sub: "Pix. Dólares na sua carteira. 10 segundos.",
      reassure: "Sem banco. Sem corretora. Sem complexidade.",
      cta: "Começar grátis", note: "2 minutos • biometria • sem cartão • sem seed phrase", liveTag: "ao vivo · mainnet",
    },
    pixin: { stamp: "como", h: "Pix in. Dollars out.", lines: ["Você envia reais.", "Você recebe dólares.", "Direto na sua carteira. Instantaneamente."] },
    touch: { stamp: "um toque", h: "Um toque. E ele já é seu.", lines: ["Biometria. Nada de senha.", "Só você e seu dinheiro."] },
    runs: { stamp: "depois, ele executa", h: "Depois disso, ele só executa.", lines: ["Defina as regras uma vez: quem pode receber, quanto pode gastar, quando pagar.", "Se estiver dentro, acontece. Se não estiver, não acontece."] },
    yours: { stamp: "seu dinheiro", h: "Seu dinheiro não passa por ninguém.", lines: ["Nem banco. Nem intermediário. Nem nós.", "Ele é seu desde o primeiro segundo. Na sua carteira. Na sua chave."] },
    invisible: { stamp: "invisível", h: "O resto é invisível.", lines: ["Smart contracts. Múltiplas blockchains. Liquidação global.", "Você nunca vê nada disso. Só o resultado.", "A melhor tecnologia financeira não parece tecnologia."] },
    proof: { stamp: "ao vivo", h: "Dinheiro real. Ao vivo.", lines: ["Não é demo. Não é promessa.", "Cada pagamento é verificável publicamente. Confira você mesmo."], btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗" },
    cta: { stamp: "comece", h: "Comece.", lines: ["Pix → dólar → sua carteira.", "Em segundos."], btn: "Começar grátis", note: "Sem cartão • sem seed phrase • leva ~2 minutos",
      supportLabel: "apoie o time", supportText: "Feito sozinho no Brasil. Se ganhou teu respeito, manda uns dólares, um toque, sem app.", supportBtn: "Apoiar com $10 ↗", footer: "slippay · dinheiro global, em um toque · ao vivo na mainnet" },
  },
} as const;

function Index({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-baseline justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GRAY }}>
      <span className="text-[#0a0a0a]/55">{n}</span><span className="h-px w-8 bg-current opacity-40" /><span>{label}</span>
    </div>
  );
}
const Lines = ({ lines }: { lines: readonly string[] }) => (
  <div className="mt-8 flex flex-col gap-3.5 max-w-[46ch] mx-auto">
    {lines.map((l, i) => <p key={i} className="text-xl md:text-2xl leading-relaxed text-[#0a0a0a]/65">{l}</p>)}
  </div>
);

export default function LandingV2() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    try { const s = localStorage.getItem("slippay.lang"); if (s === "pt" || s === "en") return s; } catch { /* */ }
    return (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) ? "pt" : "en";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* */ } }, [lang]);
  const t = COPY[lang];
  const NAV: [string, string][] = [[t.nav.gate, "/gate"], [t.nav.security, "/security"], [t.nav.live, "/cockpit"], [t.nav.pay, "/pay"], [t.nav.receive, "/cobrar"], [t.nav.manifesto, "/manifesto"], [t.nav.login, "/account"]];

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); } }, { rootMargin: "-8% 0px -8% 0px", threshold: 0.06 });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("js-reveal"); };
  }, []);

  const LangToggle = () => (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">
      <button onClick={() => setLang("pt")} className={lang === "pt" ? "text-[#0a0a0a] font-medium" : "hover:opacity-80"}>PT</button>
      <span className="opacity-30 mx-1">/</span>
      <button onClick={() => setLang("en")} className={lang === "en" ? "text-[#0a0a0a] font-medium" : "hover:opacity-80"}>EN</button>
    </div>
  );
  const btn = "lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#0a0a0a] text-[#f1eee7]";
  const section = "border-t border-[#0a0a0a]/12";
  const inner = "max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center";

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <style>{`html{scroll-behavior:smooth}::selection{background:#FDDA24;color:#0a0a0a}section h2{text-wrap:balance}`}</style>
      <header className="relative px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay<span className="text-[#FDDA24]">.</span></Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          {NAV.map(([label, href]) => <Link key={href} to={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</Link>)}
          <span className="hidden md:inline"><LangToggle /></span>
          <Link to="/account" className="hidden md:inline-flex items-center rounded-full px-5 py-2.5 bg-[#0a0a0a] text-[#f1eee7] hover:opacity-90">{t.nav.tryFree}</Link>
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" className="md:hidden flex flex-col gap-[5px] p-1">
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-transform ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-transform ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-[#f1eee7] border-y border-[#0a0a0a]/10 px-6 py-4 flex flex-col gap-1 text-[12px] uppercase tracking-[0.18em]">
            {NAV.map(([label, href]) => <Link key={href} to={href} onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">{label}</Link>)}
            <div className="py-3 border-b border-[#0a0a0a]/8"><LangToggle /></div>
            <Link to="/account" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#0a0a0a] text-[#f1eee7]">{t.nav.tryFree}</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="px-6 md:px-12 pt-12 md:pt-20 pb-16 md:pb-24">
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
          <Index n="—" label={t.hero.axis} />
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8rem)] mx-auto" style={display}>
            {t.hero.h1a}<br /><span style={{ color: GRAY }}>{t.hero.h1acc}</span>
          </h1>
          <p className="mt-9 text-2xl md:text-3xl leading-snug max-w-[24ch] mx-auto" style={display}>{t.hero.sub}</p>
          <p className="mt-5 text-base md:text-lg text-[#0a0a0a]/55">{t.hero.reassure}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className={btn}>{t.hero.cta}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.hero.note}</span>
          </div>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      <section className={section}><div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8"><LiveProof prominent lang={lang} /></div></section>

      {/* PIX IN */}
      <section className={section}><div data-reveal className={inner}>
        <Index n="001" label={t.pixin.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.05em] leading-[0.9] text-[clamp(2.75rem,9vw,6.5rem)]" style={display}>{t.pixin.h}</h2>
        <Lines lines={t.pixin.lines} />
      </div></section>

      {/* ONE TOUCH */}
      <section className={section}><div data-reveal className={inner}>
        <Index n="002" label={t.touch.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.touch.h}</h2>
        <Lines lines={t.touch.lines} />
      </div></section>

      {/* RUNS (gate) */}
      <section className={section}><div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 flex flex-col items-center text-center">
        <Index n="003" label={t.runs.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)] max-w-[20ch]" style={display}>{t.runs.h}</h2>
        <Lines lines={t.runs.lines} />
        <div className="mt-12 w-full max-w-[440px] mx-auto text-left"><MandateDemo /></div>
        <Link to="/gate" className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.runs.stamp === "depois, ele executa" ? "Como o gate funciona →" : "How the gate works →"}</Link>
      </div></section>

      {/* YOURS */}
      <section className={section}><div data-reveal className={inner}>
        <Index n="004" label={t.yours.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[20ch] mx-auto" style={display}>{t.yours.h}</h2>
        <Lines lines={t.yours.lines} />
      </div></section>

      {/* INVISIBLE */}
      <section className={section}><div data-reveal className={inner}>
        <Index n="005" label={t.invisible.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.invisible.h}</h2>
        <Lines lines={t.invisible.lines} />
      </div></section>

      {/* PROOF */}
      <section id="proof" className={section}><div data-reveal className={inner}>
        <Index n="006" label={t.proof.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.proof.h}</h2>
        <Lines lines={t.proof.lines} />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className={btn}>{t.proof.btnReal}</a>
          <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.proof.btnContract}</a>
        </div>
      </div></section>

      {/* CTA */}
      <section className={section}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-44 text-center">
        <Index n="007" label={t.cta.stamp} />
        <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3.5rem,16vw,12rem)] mx-auto" style={display}>{t.cta.h}</h2>
        <div className="mt-10 flex flex-col gap-1 text-2xl md:text-3xl font-medium tracking-[-0.02em]" style={display}>{t.cta.lines.map((l) => <span key={l}>{l}</span>)}</div>
        <div className="mt-12"><Link to="/account" className={btn}>{t.cta.btn}</Link></div>
        <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.cta.note}</div>

        <div className="mt-16 pt-10 border-t border-[#0a0a0a]/10">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: GRAY }}>{t.cta.supportLabel}</div>
          <p className="mt-3 text-[15px] text-[#0a0a0a]/60 max-w-[42ch] mx-auto text-center">{t.cta.supportText}</p>
          <div className="mt-5 flex flex-col items-center gap-3">
            <Link to={`/pay?to=${TEAM_USDC}&amount=100000000&asset=USDC`} className="lift inline-flex items-center rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.2em] bg-[#0a0a0a] text-[#f1eee7] font-medium">{t.cta.supportBtn}</Link>
            <span className="font-mono text-[10px] text-[#0a0a0a]/40 break-all max-w-[320px] text-center">USDC · {TEAM_USDC}</span>
          </div>
        </div>
        <div className="mt-16 font-mono text-[10px] uppercase tracking-[0.28em] text-[#0a0a0a]/30">{t.cta.footer}</div>
      </div></section>
    </div>
  );
}
