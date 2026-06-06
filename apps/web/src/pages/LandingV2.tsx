// Landing — "global money in one tap." USDC-explicit, compliance-careful copy.
// Warm bone, ink text, GRAY accent (#6f6862), yellow as details + ALL CTAs yellow
// (#FDDA24), yellow keyword marker + logo dot. Bilingual PT/EN (persisted toggle).

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";

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
      h1pre: "Global ", h1mark: "money", h1post: "", h1acc: "in one tap.",
      sub: "Pix in. USDC out. Directly to your wallet in seconds.",
      reassure: "No waiting. No wire transfers. Just stable digital dollars moving globally.",
      cta: "Get started", note: "2 minutes • biometrics • no card • self-custody support", liveTag: "live · mainnet",
    },
    why: { stamp: "why", items: [
      ["Pix → USDC instantly", "Convert Brazilian reais into USDC, a digital dollar stablecoin."],
      ["You stay in control", "Funds go to a wallet you control, with optional automation rules."],
      ["Built for automation", "Set limits, recurring payments, and approved recipients. Execution only happens within your rules."],
      ["Fast settlement", "Transfers settle on modern blockchain rails in seconds, with low fees."],
    ] as [string, string][] },
    how: { stamp: "how it works", h: "From Pix to USDC.", steps: [
      ["Send Pix", "You pay in reais as usual."],
      ["Convert to USDC", "Liquidity rails exchange BRL → USDC."],
      ["Receive in wallet", "USDC arrives in your wallet, ready to use globally."],
    ] as [string, string][] },
    onetap: { stamp: "one tap", h: "One-tap experience.", lines: ["Authenticate → confirm → done.", "Your USDC balance updates instantly."] },
    prog: { stamp: "programmable", h: "Programmable money.", body: "Set rules like:", checks: ["monthly caps", "recurring payments", "allowed addresses"], fail: "If it doesn't match your rules, it doesn't execute.", gateLink: "How the gate works →" },
    rails: { stamp: "the rails", h: "Built on modern rails.", lines: ["Powered by stablecoins, blockchain settlement, and FX liquidity providers.", "You see the result. Not the infrastructure."] },
    proof: { stamp: "real transactions", h: "Real transactions.", lines: ["Live, verifiable blockchain transfers."], btnReal: "See a real payment ↗", btnContract: "The live contract ↗" },
    notbank: { stamp: "not a bank", h: "Not a bank.", lead: "A global money layer built on USDC:", items: ["fast BRL → stablecoin conversion", "global transfers", "user-controlled automation"] },
    cta: { stamp: "start", h: "Start now.", lines: ["Move from Pix to USDC in seconds.", "Hold, send, or automate — your choice."], btn: "Get started", note: "No card • 2 minutes • biometrics",
      supportLabel: "support the team", supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars, one touch, no app.", supportBtn: "Support with $10 ↗", footer: "slippay · global money, in one tap · live on mainnet" },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", manifesto: "Manifesto", login: "Entrar", tryFree: "Começar" },
    hero: {
      h1pre: "", h1mark: "Dinheiro", h1post: " global", h1acc: "em um toque.",
      sub: "Pix entra. USDC sai. Direto na sua carteira em segundos.",
      reassure: "Sem espera. Sem transferência internacional. Só dólar digital estável circulando pelo mundo.",
      cta: "Começar", note: "2 minutos • biometria • sem cartão • suporte a autocustódia", liveTag: "ao vivo · mainnet",
    },
    why: { stamp: "por quê", items: [
      ["Pix → USDC na hora", "Converta reais em USDC, um dólar digital (stablecoin)."],
      ["Você no controle", "Os fundos vão pra uma carteira que você controla, com regras de automação opcionais."],
      ["Feito pra automação", "Defina limites, pagamentos recorrentes e destinatários aprovados. A execução só acontece dentro das suas regras."],
      ["Liquidação rápida", "As transferências liquidam em rails modernos de blockchain em segundos, com taxas baixas."],
    ] as [string, string][] },
    how: { stamp: "como funciona", h: "Do Pix ao USDC.", steps: [
      ["Faça um Pix", "Você paga em reais, como sempre."],
      ["Converte pra USDC", "Rails de liquidez trocam BRL → USDC."],
      ["Recebe na carteira", "O USDC chega na sua carteira, pronto pra usar no mundo todo."],
    ] as [string, string][] },
    onetap: { stamp: "um toque", h: "Experiência de um toque.", lines: ["Autentique → confirme → pronto.", "Seu saldo em USDC atualiza na hora."] },
    prog: { stamp: "programável", h: "Dinheiro programável.", body: "Defina regras como:", checks: ["tetos mensais", "pagamentos recorrentes", "endereços permitidos"], fail: "Se não bater com as suas regras, não executa.", gateLink: "Como o gate funciona →" },
    rails: { stamp: "os rails", h: "Construído em rails modernos.", lines: ["Movido por stablecoins, liquidação em blockchain e provedores de liquidez de câmbio.", "Você vê o resultado. Não a infraestrutura."] },
    proof: { stamp: "transações reais", h: "Transações reais.", lines: ["Transferências em blockchain, ao vivo e verificáveis."], btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗" },
    notbank: { stamp: "não é um banco", h: "Não é um banco.", lead: "Uma camada global de dinheiro construída sobre USDC:", items: ["conversão rápida BRL → stablecoin", "transferências globais", "automação controlada por você"] },
    cta: { stamp: "comece", h: "Comece agora.", lines: ["Vá de Pix a USDC em segundos.", "Guarde, envie ou automatize — você escolhe."], btn: "Começar", note: "Sem cartão • 2 minutos • biometria",
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
  const btn = "lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]";
  const sec = "border-t border-[#0a0a0a]/12";
  const inner = "max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center";
  const mark = { color: "#0a0a0a", background: "#FDDA24", padding: "0 0.06em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } as const;

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <style>{`html{scroll-behavior:smooth}::selection{background:#FDDA24;color:#0a0a0a}section h2{text-wrap:balance}`}</style>
      <header className="relative px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay<span className="text-[#FDDA24]">.</span></Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          {NAV.map(([label, href]) => <Link key={href} to={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</Link>)}
          <span className="hidden md:inline"><LangToggle /></span>
          <Link to="/account" className="hidden md:inline-flex items-center rounded-full px-5 py-2.5 bg-[#FDDA24] text-[#0a0a0a] hover:opacity-90">{t.nav.tryFree}</Link>
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
            <Link to="/account" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#FDDA24] text-[#0a0a0a]">{t.nav.tryFree}</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="px-6 md:px-12 pt-12 md:pt-20 pb-16 md:pb-24">
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
          <h1 className="font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8rem)] mx-auto" style={display}>
            {t.hero.h1pre}<span style={mark}>{t.hero.h1mark}</span>{t.hero.h1post}
          </h1>
          <p className="mt-9 text-2xl md:text-3xl leading-snug max-w-[28ch] mx-auto" style={display}>{t.hero.sub}</p>
          <p className="mt-5 text-base md:text-lg text-[#0a0a0a]/55 max-w-[48ch] mx-auto">{t.hero.reassure}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className={btn}>{t.hero.cta}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0a0a0a]/40">{t.hero.note}</span>
          </div>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      {/* WHY (4 with descriptions) */}
      <section className={sec}><div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-20 md:py-28">
        <div className="text-center"><Index n="001" label={t.why.stamp} /></div>
        <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-10 max-w-[820px] mx-auto">
          {t.why.items.map(([h, b]) => (
            <div key={h}>
              <div className="flex items-baseline gap-2.5 text-xl md:text-2xl font-semibold tracking-[-0.02em]" style={display}><span className="text-[#FDDA24]">✓</span>{h}</div>
              <p className="mt-2 text-[16px] leading-relaxed text-[#0a0a0a]/60 max-w-[42ch]">{b}</p>
            </div>
          ))}
        </div>
      </div></section>

      {/* HOW (3 steps) */}
      <section className={sec}><div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="002" label={t.how.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.how.h}</h2>
        <div className="mt-14 max-w-[760px] mx-auto text-left flex flex-col gap-8">
          {t.how.steps.map(([h, b], i) => (
            <div key={i} className="flex gap-5 md:gap-7 items-baseline border-t border-[#0a0a0a]/12 pt-7">
              <span className="font-mono text-[13px] shrink-0 w-8" style={{ color: GRAY }}>{String(i + 1).padStart(2, "0")}</span>
              <div><div className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]" style={display}>{h}</div><p className="mt-1.5 text-[16px] md:text-[17px] text-[#0a0a0a]/60">{b}</p></div>
            </div>
          ))}
        </div>
      </div></section>

      {/* ONE TAP */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="003" label={t.onetap.stamp} />
        <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,6.5rem)]" style={display}>{t.onetap.h}</h2>
        <Lines lines={t.onetap.lines} />
      </div></section>

      {/* PROGRAMMABLE (gate) */}
      <section className={sec}><div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 flex flex-col items-center text-center">
        <Index n="004" label={t.prog.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.prog.h}</h2>
        <p className="mt-8 text-lg text-[#0a0a0a]/60">{t.prog.body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-lg">
          {t.prog.checks.map((c) => <span key={c} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{c}</span>)}
        </div>
        <p className="mt-8 text-xl md:text-2xl font-medium tracking-[-0.02em] max-w-[30ch]" style={display}>{t.prog.fail}</p>
        <div className="mt-12 w-full max-w-[440px] mx-auto text-left"><MandateDemo /></div>
        <Link to="/gate" className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.prog.gateLink}</Link>
      </div></section>

      {/* RAILS (invisible infra) */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="005" label={t.rails.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.rails.h}</h2>
        <Lines lines={t.rails.lines} />
      </div></section>

      {/* PROOF */}
      <section id="proof" className={sec}><div data-reveal className={inner}>
        <Index n="006" label={t.proof.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.proof.h}</h2>
        <Lines lines={t.proof.lines} />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className={btn}>{t.proof.btnReal}</a>
          <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.proof.btnContract}</a>
        </div>
      </div></section>

      {/* NOT A BANK */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="007" label={t.notbank.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.notbank.h}</h2>
        <p className="mt-8 text-xl text-[#0a0a0a]/65">{t.notbank.lead}</p>
        <div className="mt-5 flex flex-col items-center gap-2 text-lg md:text-xl">
          {t.notbank.items.map((x) => <span key={x} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{x}</span>)}
        </div>
      </div></section>

      {/* CTA */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-44 text-center">
        <Index n="008" label={t.cta.stamp} />
        <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,13vw,10rem)] mx-auto" style={display}>{t.cta.h}</h2>
        <div className="mt-10 flex flex-col gap-1 text-xl md:text-2xl text-[#0a0a0a]/65">{t.cta.lines.map((l) => <span key={l}>{l}</span>)}</div>
        <div className="mt-12"><Link to="/account" className={btn}>{t.cta.btn}</Link></div>
        <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.cta.note}</div>

        <div className="mt-16 pt-10 border-t border-[#0a0a0a]/10">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: GRAY }}>{t.cta.supportLabel}</div>
          <p className="mt-3 text-[15px] text-[#0a0a0a]/60 max-w-[42ch] mx-auto text-center">{t.cta.supportText}</p>
          <div className="mt-5 flex flex-col items-center gap-3">
            <Link to={`/pay?to=${TEAM_USDC}&amount=100000000&asset=USDC`} className="lift inline-flex items-center rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a] font-medium">{t.cta.supportBtn}</Link>
            <span className="font-mono text-[10px] text-[#0a0a0a]/40 break-all max-w-[320px] text-center">USDC · {TEAM_USDC}</span>
          </div>
        </div>
        <div className="mt-16 font-mono text-[10px] uppercase tracking-[0.28em] text-[#0a0a0a]/30">{t.cta.footer}</div>
      </div></section>
    </div>
  );
}
