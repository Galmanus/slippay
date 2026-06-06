// Landing — pain-led conversion copy. Warm bone, ink text, GRAY accent (#6f6862),
// yellow only as small details (#FDDA24: live dots, checkmarks, the logo dot),
// ink CTAs. Bilingual PT/EN (toggle in header, persisted). Live artifacts = proof.

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
      axis: "financial automation",
      h1a: "Stop approving the same bills.", h1acc: "Every month.",
      sub: "Add money with Pix. Hold dollars. Set the rules once. The rest happens on its own.",
      reassure: "No bank holding your money. No card. No bureaucracy.",
      cta: "Get started free", note: "2 minutes • no card • no seed phrase",
      trust: ["Your money stays yours", "You set the limits", "Payments final in seconds", "Up to ~3% cheaper than cards"],
      liveTag: "live · mainnet",
    },
    pain: { stamp: "the problem", h: "The last time you approve a recurring payment.",
      lines: ["Every month, the same thing.", "Renew the API. Pay the server. Renew a subscription. Pay a vendor.", "Open the bank. Approve. Wait. Approve again.", "Not because it's hard. Because no one built anything better.", "Until now."],
      turn: "SlipPay turns recurring payments into a one-time setup. You approve once. After that, it runs on its own." },
    control: { stamp: "control", h: "Automatic doesn't mean out of control.",
      lines: ["It means you set the rules once.", "Who can be paid. How much. How much per month. How often.", "Before every execution, everything is checked.", "If something's outside the rule, the payment doesn't happen.", "Simple as that."] },
    yours: { stamp: "your money stays yours", h: "Your money stays yours.",
      lines: ["This is the most important part.", "SlipPay doesn't hold your money. Doesn't lend it. Doesn't block it. Doesn't freeze it. Doesn't control it.", "Your balance stays in your own wallet. You stay the owner. Always.", "SlipPay only executes the payments you already authorized. Nothing more."] },
    global: { stamp: "dollars + pix", h: "Hold dollars. Move with Pix. Automate everything.",
      lines: ["Add reais with Pix in seconds.", "Keep your balance in dollars.", "Pay and get paid instantly.", "No international banks. No business days. No artificial borders."] },
    save: { stamp: "fewer fees", h: "Fewer fees. More of your money.",
      lines: ["Cards became so common people forgot what they cost.", "Nearly 3% disappears on every transaction. Every time. Forever.", "On Stellar, moving money costs fractions of a cent.", "More money stays with you. Not with middlemen."] },
    gate: { stamp: "it only pays when it's right", h: "It only pays when everything checks out.",
      body: "Before every payment, SlipPay verifies:", checks: ["authorized recipient", "authorized amount", "monthly limit", "your policy"],
      fail: "If any condition fails, the payment is refused automatically. No exceptions. No shortcuts. No surprises.", gateLink: "How the gate works →" },
    proof: { stamp: "live", h: "Real money. Live.",
      lines: ["Not a demo. Not a prototype. Not a promise.", "Real payments already happen every day. Real funds already move through the system.", "Every transaction can be verified publicly. You don't have to trust marketing, you can check it yourself."],
      btnReal: "See a real payment ↗", btnContract: "The live contract ↗" },
    diff: { stamp: "the difference", h: "Most systems ask for trust. SlipPay asks for rules.",
      rows: [["Most financial apps say:", "“Trust us.”"], ["We'd rather say:", "“Set the conditions.”"], ["Most automation tools only suggest actions.", "SlipPay executes, but only within the limits you approved."]] as [string, string][],
      tag: "That difference changes everything." },
    cta: { stamp: "start", h: "Configure it once.", hacc: "And stop thinking about it.",
      lines: ["Hold dollars.", "Fund with Pix.", "Automate recurring payments.", "Stay in control."],
      sig: ["Your money.", "Your rules.", "On autopilot."], btn: "Get started free", note: "No card • takes about 2 minutes",
      supportLabel: "support the team", supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars, one touch, no app.", supportBtn: "Support with $10 ↗",
      footer: "slippay · real dollars, on autopilot · live on mainnet" },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", manifesto: "Manifesto", login: "Entrar", tryFree: "Começar" },
    hero: {
      axis: "automação financeira",
      h1a: "Pare de aprovar as mesmas contas.", h1acc: "Todo mês.",
      sub: "Coloque dinheiro com Pix. Guarde em dólar. Defina as regras uma vez. O resto acontece sozinho.",
      reassure: "Sem banco segurando seu dinheiro. Sem cartão. Sem burocracia.",
      cta: "Começar grátis", note: "2 minutos • sem cartão • sem seed phrase",
      trust: ["Seu dinheiro continua seu", "Você define os limites", "Pagamentos finais em segundos", "Até ~3% mais barato que cartão"],
      liveTag: "ao vivo · mainnet",
    },
    pain: { stamp: "o problema", h: "A última vez que você aprova um pagamento recorrente.",
      lines: ["Todo mês é a mesma coisa.", "Renovar a API. Pagar o servidor. Renovar uma assinatura. Transferir para um fornecedor.", "Abrir o banco. Aprovar. Esperar. Aprovar de novo.", "Não porque seja difícil. Porque ninguém construiu algo melhor.", "Até agora."],
      turn: "O SlipPay transforma pagamentos recorrentes em uma configuração única. Você aprova uma vez. Depois disso, ele executa sozinho." },
    control: { stamp: "controle", h: "Automático não significa sem controle.",
      lines: ["Significa que você define as regras uma única vez.", "Quem pode receber. Quanto pode receber. Quanto pode ser gasto por mês. Com que frequência.", "Antes de cada execução, tudo é conferido.", "Se algo estiver fora da regra, o pagamento não acontece.", "Simples assim."] },
    yours: { stamp: "seu dinheiro continua seu", h: "Seu dinheiro continua sendo seu.",
      lines: ["Essa é a parte mais importante.", "O SlipPay não segura seu dinheiro. Não empresta. Não bloqueia. Não congela. Não controla.", "Seu saldo permanece na sua própria carteira. Você continua dono. Sempre.", "O SlipPay apenas executa os pagamentos que você já autorizou. Nada mais."] },
    global: { stamp: "dólar + pix", h: "Guarde em dólar. Movimente com Pix. Automatize tudo.",
      lines: ["Coloque reais via Pix em segundos.", "Mantenha seu saldo em dólar.", "Pague e receba instantaneamente.", "Sem bancos internacionais. Sem dias úteis. Sem fronteiras artificiais."] },
    save: { stamp: "menos taxas", h: "Menos taxas. Mais dinheiro seu.",
      lines: ["Os cartões ficaram tão comuns que muita gente esqueceu quanto custam.", "Quase 3% desaparecem em cada transação. Toda vez. Para sempre.", "Na Stellar, movimentar dinheiro custa frações de centavo.", "Mais dinheiro ficando com você. Não com intermediários."] },
    gate: { stamp: "só paga quando está certo", h: "Ele só paga quando está tudo certo.",
      body: "Antes de cada pagamento, o SlipPay verifica:", checks: ["destinatário autorizado", "valor autorizado", "limite mensal", "política definida por você"],
      fail: "Se qualquer condição falhar, o pagamento é recusado automaticamente. Sem exceções. Sem atalhos. Sem surpresas.", gateLink: "Como o gate funciona →" },
    proof: { stamp: "ao vivo", h: "Dinheiro real. Ao vivo.",
      lines: ["Não é uma demonstração. Não é um protótipo. Não é uma promessa.", "Pagamentos reais já acontecem todos os dias. Fundos reais já circulam pelo sistema.", "Cada transação pode ser verificada publicamente. Você não precisa confiar no marketing, pode conferir por conta própria."],
      btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗" },
    diff: { stamp: "a diferença", h: "A maioria pede confiança. O SlipPay pede regras.",
      rows: [["A maioria dos apps financeiros diz:", "“Confie na gente.”"], ["Nós preferimos:", "“Defina as condições.”"], ["A maioria das ferramentas de automação só sugere ações.", "O SlipPay executa, mas só dentro dos limites que você aprovou."]] as [string, string][],
      tag: "Essa diferença muda tudo." },
    cta: { stamp: "comece", h: "Configure uma vez.", hacc: "E pare de pensar nisso.",
      lines: ["Guarde em dólar.", "Carregue com Pix.", "Automatize pagamentos recorrentes.", "Continue no controle."],
      sig: ["Seu dinheiro.", "Suas regras.", "No automático."], btn: "Começar grátis", note: "Sem cartão • leva cerca de 2 minutos",
      supportLabel: "apoie o time", supportText: "Feito sozinho no Brasil. Se ganhou teu respeito, manda uns dólares, um toque, sem app.", supportBtn: "Apoiar com $10 ↗",
      footer: "slippay · dólar de verdade, no automático · ao vivo na mainnet" },
  },
} as const;

function Index({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-baseline justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GRAY }}>
      <span className="text-[#0a0a0a]/55">{n}</span>
      <span className="h-px w-8 bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

const Lines = ({ lines }: { lines: readonly string[] }) => (
  <div className="mt-8 flex flex-col gap-4 max-w-[52ch] mx-auto">
    {lines.map((l, i) => <p key={i} className="text-lg md:text-xl leading-relaxed text-[#0a0a0a]/65">{l}</p>)}
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
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); }
    }, { rootMargin: "-8% 0px -8% 0px", threshold: 0.06 });
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
      <section className="px-6 md:px-12 pt-10 md:pt-16 pb-16 md:pb-24">
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
          <Index n="—" label={t.hero.axis} />
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.88] text-[clamp(2.5rem,8.5vw,6.5rem)] max-w-[18ch] mx-auto" style={display}>
            {t.hero.h1a} <span style={{ color: GRAY }}>{t.hero.h1acc}</span>
          </h1>
          <p className="mt-9 text-xl md:text-2xl leading-relaxed max-w-[40ch] mx-auto" style={display}>{t.hero.sub}</p>
          <p className="mt-5 text-base md:text-lg text-[#0a0a0a]/55 max-w-[46ch] mx-auto">{t.hero.reassure}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className={btn}>{t.hero.cta}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.hero.note}</span>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[#0a0a0a]/65">
            {t.hero.trust.map((x) => <span key={x} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{x}</span>)}
          </div>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      <section className="border-t border-[#0a0a0a]/12"><div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8"><LiveProof prominent lang={lang} /></div></section>

      {/* PAIN */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="001" label={t.pain.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.pain.h}</h2>
        <Lines lines={t.pain.lines} />
        <p className="mt-8 text-xl md:text-2xl leading-relaxed max-w-[46ch] mx-auto font-medium" style={display}>{t.pain.turn}</p>
      </div></section>

      {/* CONTROL */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="002" label={t.control.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.control.h}</h2>
        <Lines lines={t.control.lines} />
      </div></section>

      {/* YOURS */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="003" label={t.yours.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,5.5rem)]" style={display}>{t.yours.h}</h2>
        <Lines lines={t.yours.lines} />
      </div></section>

      {/* GLOBAL */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="004" label={t.global.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.global.h}</h2>
        <Lines lines={t.global.lines} />
      </div></section>

      {/* SAVE */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="005" label={t.save.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.save.h}</h2>
        <Lines lines={t.save.lines} />
      </div></section>

      {/* GATE */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 flex flex-col items-center text-center">
        <Index n="006" label={t.gate.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)] max-w-[20ch]" style={display}>{t.gate.h}</h2>
        <p className="mt-8 text-lg text-[#0a0a0a]/60">{t.gate.body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-lg">
          {t.gate.checks.map((c) => <span key={c} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{c}</span>)}
        </div>
        <p className="mt-8 text-lg leading-relaxed max-w-[48ch] mx-auto text-[#0a0a0a]/55">{t.gate.fail}</p>
        <div className="mt-12 w-full max-w-[440px] mx-auto text-left"><MandateDemo /></div>
        <Link to="/gate" className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.gate.gateLink}</Link>
      </div></section>

      {/* PROOF */}
      <section id="proof" className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="007" label={t.proof.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,5.5rem)]" style={display}>{t.proof.h}</h2>
        <Lines lines={t.proof.lines} />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className={btn}>{t.proof.btnReal}</a>
          <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.proof.btnContract}</a>
        </div>
      </div></section>

      {/* DIFF */}
      <section className="border-t border-[#0a0a0a]/12"><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="008" label={t.diff.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,4.5rem)] max-w-[22ch] mx-auto" style={display}>{t.diff.h}</h2>
        <div className="mt-12 max-w-[680px] mx-auto text-left flex flex-col">
          {t.diff.rows.map(([a, b], i) => (
            <div key={i} className="border-t border-[#0a0a0a]/12 py-7">
              <p className="text-lg text-[#0a0a0a]/55">{a}</p>
              <p className="mt-1 text-xl md:text-2xl font-semibold tracking-[-0.02em]" style={display}>{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-2xl md:text-3xl font-medium tracking-[-0.02em]" style={{ ...display, color: GRAY }}>{t.diff.tag}</p>
      </div></section>

      {/* CTA */}
      <section className="border-t border-[#0a0a0a]/12"><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-44 text-center">
        <Index n="009" label={t.cta.stamp} />
        <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,7rem)] mx-auto break-words" style={display}>
          {t.cta.h}<br /><span style={{ color: GRAY }}>{t.cta.hacc}</span>
        </h2>
        <div className="mt-10 flex flex-col gap-1 text-xl md:text-2xl text-[#0a0a0a]/65">{t.cta.lines.map((l) => <span key={l}>{l}</span>)}</div>
        <div className="mt-8 flex flex-col gap-0.5 text-2xl md:text-3xl font-semibold tracking-[-0.02em]" style={display}>{t.cta.sig.map((l) => <span key={l}>{l}</span>)}</div>
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
