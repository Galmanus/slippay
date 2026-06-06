// Landing — conversion-first ("inevitable result", not "impressive tech").
// Bilingual PT/EN (toggle in header, persisted). The live artifacts appear only
// as proof. Brand axis: "the last time you approve a recurring payment."

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { LiveProof } from "../components/LiveProof.tsx";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const LIVE_CONTRACT = "CCT3KJXRUO3HJJ2GLTW2MISSQVUEKOPUG3B4YQH75TCGKAOC4P6FIKUF";
const REAL_TX = "ede13fb6230334af91b2af1cfab92f86f8f44e8a7755acb57d92891d68a3e957";
const TEAM_USDC = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P";
const xurl = (p: string, id: string) => `https://stellar.expert/explorer/public/${p}/${id}`;
type Lang = "pt" | "en";

const COPY = {
  en: {
    nav: { gate: "The gate", security: "Security", live: "Live", pay: "Pay", receive: "Receive", manifesto: "Manifesto", login: "Login", tryFree: "Get started" },
    hero: {
      axis: "the last time you approve a recurring payment",
      h1a: "Your money.", h1acc: "On autopilot.",
      sub: "Hold dollars. Fund with Pix. Let approved payments run themselves.",
      b1: "Stop approving the same bills every month. Add money with Pix, keep it in dollars, and let SlipPay handle recurring payments automatically — but only within the rules you set.",
      b2: "No bank holding your money. No cards. No crypto expertise required.",
      cta: "Get started free with Pix", note: "2 minutes • no card required • no seed phrases", liveTag: "live · mainnet",
    },
    why: { stamp: "why people switch", items: ["Your money stays in your wallet", "You set the limits", "Payments settle in seconds", "Pause or cancel anytime", "No chargebacks", "Lower fees than cards"] },
    pain: {
      stamp: "the problem", h: "The last time you approve a recurring payment.",
      q: "How many times have you approved the exact same payment?",
      every: "Every month:", list: ["APIs", "Cloud servers", "SaaS subscriptions", "Contractors", "Suppliers"],
      same: "It's always the same process. Open the banking app. Approve. Wait. Approve again.",
      turn: "SlipPay turns recurring payments into a one-time setup. Approve once. After that, it runs automatically within the limits you define.",
    },
    save: {
      stamp: "save on every payment", h: "Save money on every payment.",
      body: "Cards take nearly 3% from every transaction. Every. Single. Time. On Stellar, moving money costs fractions of a cent. That means more of your money stays with you.",
      exLabel: "example", amount: "in payments", cardL: "card payments", cardV: "≈ $290 in fees", slipL: "slippay", slipV: "network fees in cents", note: "Same payment. Much lower cost.",
    },
    yours: {
      stamp: "your money stays yours", h: "Your money remains yours.",
      body: "This is the most important part. SlipPay never holds your funds. We can't freeze them. We can't lend them. We can't block them. We can't move them. You remain in control — your wallet holds the money. SlipPay only executes the payment rules you've already approved. Nothing more.",
    },
    how: {
      stamp: "how it works", h: "It takes less time than ordering an Uber.",
      steps: [
        ["Create your account", "One tap. Face ID or fingerprint. No password, no email, no seed phrase."],
        ["Add money with Pix", "Just like any modern payment app. Fast and simple."],
        ["Hold dollars", "Convert your balance into digital dollars and keep it there."],
        ["Set the rules", "Who can be paid, how much, and how often."],
        ["Walk away", "SlipPay handles the rest — only within your approved limits. No surprises."],
      ] as [string, string][],
    },
    guard: {
      stamp: "automation with guardrails", h: "Automation with guardrails.",
      body: "Before every payment, SlipPay checks:",
      checks: ["Approved recipient", "Approved amount", "Monthly spending cap", "Payment policy"],
      fail: "If anything falls outside your rules, the payment doesn't happen. Automatically.",
      gateLink: "How the gate works →",
    },
    proof: {
      stamp: "live on mainnet", h: "Real money. Real payments. Live on mainnet.",
      body: "Not a demo. Not a concept. Not a slide deck. Real funds are already moving through the system. Every payment is publicly verifiable. You don't have to trust marketing — you can verify it yourself.",
      btnReal: "See a real payment ↗", btnContract: "The live contract ↗",
    },
    diff: {
      stamp: "the difference", h: "What makes SlipPay different?",
      rows: [
        ["Most financial apps ask you to trust them with your money.", "SlipPay doesn't."],
        ["Most payment systems require manual approval every time.", "SlipPay doesn't."],
        ["Most automation tools can only suggest actions.", "SlipPay executes them — but only under rules you approved beforehand."],
      ] as [string, string][],
      tag: "That's the difference.",
    },
    cta: {
      stamp: "start", h: "Configure it once.", hacc: "Stop thinking about it forever.",
      lines: ["Hold dollars.", "Fund instantly with Pix.", "Automate recurring payments.", "Stay in control."],
      sig: ["Your money.", "Your rules.", "On autopilot."],
      btn: "Get started free", note: "No card required • Setup takes about 2 minutes",
      supportLabel: "support the team", supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars — one touch, no app.", supportBtn: "Support with $10 ↗",
      footer: "slippay · real dollars, on autopilot · live on mainnet",
    },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", manifesto: "Manifesto", login: "Entrar", tryFree: "Começar" },
    hero: {
      axis: "a última vez que você aprova um pagamento recorrente",
      h1a: "Seu dinheiro.", h1acc: "No automático.",
      sub: "Tenha dólar. Carregue com Pix. Deixe os pagamentos aprovados rodarem sozinhos.",
      b1: "Pare de aprovar as mesmas contas todo mês. Coloque dinheiro com Pix, mantenha em dólar, e deixe o SlipPay cuidar dos pagamentos recorrentes automaticamente — mas só dentro das regras que você definir.",
      b2: "Sem banco segurando seu dinheiro. Sem cartão. Sem precisar entender de cripto.",
      cta: "Começar grátis com Pix", note: "2 minutos • sem cartão • sem seed phrase", liveTag: "ao vivo · mainnet",
    },
    why: { stamp: "por que trocam", items: ["Seu dinheiro fica na sua carteira", "Você define os limites", "Pagamentos em segundos", "Pause ou cancele quando quiser", "Sem estorno", "Taxas menores que cartão"] },
    pain: {
      stamp: "o problema", h: "A última vez que você aprova um pagamento recorrente.",
      q: "Quantas vezes você já aprovou exatamente o mesmo pagamento?",
      every: "Todo mês:", list: ["APIs", "Servidores na nuvem", "Assinaturas SaaS", "Prestadores", "Fornecedores"],
      same: "É sempre o mesmo processo. Abre o app do banco. Aprova. Espera. Aprova de novo.",
      turn: "O SlipPay transforma pagamentos recorrentes numa configuração única. Aprove uma vez. Depois ele roda automaticamente dentro dos limites que você definir.",
    },
    save: {
      stamp: "economize em cada pagamento", h: "Economize em cada pagamento.",
      body: "O cartão leva quase 3% de cada transação. Toda. Santa. Vez. Na Stellar, mover dinheiro custa frações de centavo. Ou seja: mais do seu dinheiro fica com você.",
      exLabel: "exemplo", amount: "em pagamentos", cardL: "cartão", cardV: "≈ $290 em taxas", slipL: "slippay", slipV: "taxas de rede em centavos", note: "Mesmo pagamento. Custo muito menor.",
    },
    yours: {
      stamp: "seu dinheiro continua seu", h: "Seu dinheiro continua seu.",
      body: "Essa é a parte mais importante. O SlipPay nunca segura seus fundos. A gente não congela. Não empresta. Não bloqueia. Não move. Você continua no controle — o dinheiro fica na sua carteira. O SlipPay só executa as regras de pagamento que você já aprovou. Nada mais.",
    },
    how: {
      stamp: "como funciona", h: "Leva menos tempo que pedir um Uber.",
      steps: [
        ["Crie sua conta", "Um toque. Face ID ou digital. Sem senha, sem email, sem seed phrase."],
        ["Coloque dinheiro com Pix", "Como qualquer app de pagamento moderno. Rápido e simples."],
        ["Tenha dólar", "Converta seu saldo em dólar digital e mantenha lá."],
        ["Defina as regras", "Quem pode receber, quanto, e com que frequência."],
        ["Esqueça", "O SlipPay cuida do resto — só dentro dos seus limites aprovados. Sem surpresas."],
      ] as [string, string][],
    },
    guard: {
      stamp: "automação com trava", h: "Automação com trava.",
      body: "Antes de cada pagamento, o SlipPay checa:",
      checks: ["Destinatário aprovado", "Valor aprovado", "Teto mensal de gasto", "Política de pagamento"],
      fail: "Se algo sai das suas regras, o pagamento não acontece. Automaticamente.",
      gateLink: "Como o gate funciona →",
    },
    proof: {
      stamp: "ao vivo na mainnet", h: "Dinheiro real. Pagamentos reais. Ao vivo na mainnet.",
      body: "Não é demo. Não é conceito. Não é slide. Fundos reais já se movem pelo sistema. Cada pagamento é verificável publicamente. Você não precisa confiar no marketing — pode conferir você mesmo.",
      btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗",
    },
    diff: {
      stamp: "a diferença", h: "O que torna o SlipPay diferente?",
      rows: [
        ["A maioria dos apps financeiros pede pra você confiar seu dinheiro a eles.", "O SlipPay não."],
        ["A maioria dos sistemas exige aprovação manual toda vez.", "O SlipPay não."],
        ["A maioria das ferramentas de automação só sugere ações.", "O SlipPay executa — mas só sob regras que você aprovou antes."],
      ] as [string, string][],
      tag: "Essa é a diferença.",
    },
    cta: {
      stamp: "comece", h: "Configure uma vez.", hacc: "Pare de pensar nisso pra sempre.",
      lines: ["Tenha dólar.", "Carregue na hora com Pix.", "Automatize os pagamentos recorrentes.", "Continue no controle."],
      sig: ["Seu dinheiro.", "Suas regras.", "No automático."],
      btn: "Começar grátis", note: "Sem cartão • leva uns 2 minutos",
      supportLabel: "apoie o time", supportText: "Feito sozinho no Brasil. Se ganhou teu respeito, manda uns dólares — um toque, sem app.", supportBtn: "Apoiar com $10 ↗",
      footer: "slippay · dólar de verdade, no automático · ao vivo na mainnet",
    },
  },
} as const;

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

  const LangToggle = ({ dark = false }: { dark?: boolean }) => (
    <div className={`font-mono text-[10px] uppercase tracking-[0.18em] ${dark ? "text-[#f1eee7]/50" : "text-[#0a0a0a]/45"}`}>
      <button onClick={() => setLang("pt")} className={lang === "pt" ? "text-[#A16207]" : "hover:opacity-80"}>PT</button>
      <span className="opacity-30 mx-1">/</span>
      <button onClick={() => setLang("en")} className={lang === "en" ? "text-[#A16207]" : "hover:opacity-80"}>EN</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <style>{`
        html { scroll-behavior: smooth; }
        ::selection { background: #FDDA24; color: #0a0a0a; }
        section h2 { text-wrap: balance; }
      `}</style>
      <header className="relative px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay</Link>
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
      <section className="px-6 md:px-12 pt-10 md:pt-16 pb-20 md:pb-28">
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
          <Index n="—" label={t.hero.axis} />
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8rem)] break-words mx-auto" style={display}>
            {t.hero.h1a}<br /><span className="text-[#A16207]">{t.hero.h1acc}</span>
          </h1>
          <p className="mt-8 text-2xl md:text-3xl font-medium tracking-[-0.02em] max-w-[26ch] mx-auto" style={display}>{t.hero.sub}</p>
          <p className="mt-8 text-lg md:text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/70">{t.hero.b1}</p>
          <p className="mt-4 text-[15px] text-[#0a0a0a]/55 max-w-[44ch] mx-auto">{t.hero.b2}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">{t.hero.cta}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.hero.note}</span>
          </div>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      {/* LIVE PROOF BAND */}
      <section className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8"><LiveProof prominent lang={lang} /></div>
      </section>

      {/* WHY PEOPLE SWITCH */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-16 md:py-20">
          <Index n="001" label={t.why.stamp} />
          <div className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-4 max-w-[760px] mx-auto">
            {t.why.items.map((it) => (
              <div key={it} className="flex items-baseline gap-3 text-lg md:text-xl text-[#0a0a0a]/80">
                <span className="text-[#A16207] shrink-0">✓</span><span>{it}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN — the axis */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="002" label={t.pain.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.pain.h}</h2>
          <p className="mt-10 text-xl md:text-2xl leading-relaxed max-w-[40ch] mx-auto text-[#0a0a0a]/70">{t.pain.q}</p>
          <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.pain.every}</div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-lg text-[#0a0a0a]/75">
            {t.pain.list.map((x) => <span key={x}>{x}</span>)}
          </div>
          <p className="mt-10 text-lg leading-relaxed max-w-[48ch] mx-auto text-[#0a0a0a]/55">{t.pain.same}</p>
          <p className="mt-6 text-xl leading-relaxed max-w-[48ch] mx-auto text-[#0a0a0a]"><span className="font-medium">{t.pain.turn}</span></p>
        </div>
      </section>

      {/* SAVE */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="003" label={t.save.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.save.h}</h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/60">{t.save.body}</p>
          <div className="mt-12 max-w-[640px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/45 mb-4">$10,000 {t.save.amount}</div>
            <div className="grid sm:grid-cols-2 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 text-left">
              <div className="bg-white p-7"><div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.save.cardL}</div><div className="mt-3 text-4xl font-semibold tabular-nums tracking-[-0.03em]" style={display}>{t.save.cardV}</div></div>
              <div className="bg-[#0a0a0a] text-[#f1eee7] p-7"><div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#FDDA24]">{t.save.slipL}</div><div className="mt-3 text-2xl font-semibold tracking-[-0.02em]" style={display}>{t.save.slipV}</div></div>
            </div>
          </div>
          <p className="mt-8 text-xl font-medium tracking-[-0.01em]" style={display}>{t.save.note}</p>
        </div>
      </section>

      {/* YOURS */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="004" label={t.yours.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.yours.h}</h2>
          <p className="mt-10 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/65">{t.yours.body}</p>
        </div>
      </section>

      {/* HOW (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-40 text-center">
          <Index n="005" label={t.how.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.25rem,7vw,5.5rem)]" style={display}>{t.how.h}</h2>
          <div className="mt-16 max-w-[760px] mx-auto text-left flex flex-col gap-9">
            {t.how.steps.map(([h, b], i) => (
              <div key={i} className="flex gap-5 md:gap-7 items-baseline">
                <span className="font-mono text-[13px] text-[#FDDA24] shrink-0 w-8">{String(i + 1).padStart(2, "0")}</span>
                <div><div className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]" style={display}>{h}</div><p className="mt-2 text-[16px] md:text-[17px] text-[#f1eee7]/60 leading-relaxed max-w-[54ch]">{b}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GUARDRAILS (dark) + MandateDemo */}
      <section className="bg-[#0a0a0a] text-[#f1eee7] border-t border-[#f1eee7]/10">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-40 flex flex-col items-center text-center">
          <Index n="006" label={t.guard.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.25rem,7vw,5.5rem)]" style={display}>{t.guard.h}</h2>
          <p className="mt-8 text-xl text-[#f1eee7]/70">{t.guard.body}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-lg">
            {t.guard.checks.map((c) => <span key={c} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{c}</span>)}
          </div>
          <p className="mt-8 text-2xl md:text-3xl font-medium tracking-[-0.02em] max-w-[26ch]" style={display}>{t.guard.fail}</p>
          <div className="mt-12 w-full max-w-[440px] mx-auto text-left"><MandateDemo /></div>
          <Link to="/gate" className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#FDDA24] border-b border-[#FDDA24]/40 hover:border-[#FDDA24] pb-1">{t.guard.gateLink}</Link>
        </div>
      </section>

      {/* PROOF (dark) */}
      <section id="proof" className="bg-[#0a0a0a] text-[#f1eee7] border-t border-[#f1eee7]/10">
        <div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-40 flex flex-col items-center text-center">
          <Index n="007" label={t.proof.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[18ch]" style={display}>{t.proof.h}</h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[50ch] mx-auto text-[#f1eee7]/65">{t.proof.body}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a]">{t.proof.btnReal}</a>
            <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/60 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">{t.proof.btnContract}</a>
          </div>
        </div>
      </section>

      {/* DIFF */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="008" label={t.diff.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.diff.h}</h2>
          <div className="mt-12 max-w-[760px] mx-auto text-left flex flex-col">
            {t.diff.rows.map(([a, b], i) => (
              <div key={i} className="border-t border-[#0a0a0a]/12 py-7">
                <p className="text-lg md:text-xl text-[#0a0a0a]/55">{a}</p>
                <p className="mt-1 text-xl md:text-2xl font-semibold tracking-[-0.02em]" style={display}>{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-2xl md:text-3xl font-medium tracking-[-0.02em] text-[#A16207]" style={display}>{t.diff.tag}</p>
        </div>
      </section>

      {/* CTA (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-48 text-center">
          <Index n="009" label={t.cta.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,7.5rem)] mx-auto break-words" style={display}>
            {t.cta.h}<br /><span className="text-[#FDDA24]">{t.cta.hacc}</span>
          </h2>
          <div className="mt-10 flex flex-col gap-1 text-xl md:text-2xl text-[#f1eee7]/70">
            {t.cta.lines.map((l) => <span key={l}>{l}</span>)}
          </div>
          <div className="mt-8 flex flex-col gap-0.5 text-2xl md:text-3xl font-semibold tracking-[-0.02em]" style={display}>
            {t.cta.sig.map((l) => <span key={l}>{l}</span>)}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">{t.cta.btn}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f1eee7]/40">{t.cta.note}</span>
          </div>
          <div className="mt-16 pt-10 border-t border-[#f1eee7]/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#FDDA24]">{t.cta.supportLabel}</div>
            <p className="mt-3 text-[15px] text-[#f1eee7]/60 max-w-[42ch]">{t.cta.supportText}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link to={`/pay?to=${TEAM_USDC}&amount=100000000&asset=USDC`} className="lift inline-flex items-center rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a] font-medium">{t.cta.supportBtn}</Link>
              <span className="font-mono text-[10px] text-[#f1eee7]/40 break-all max-w-[280px]">USDC · {TEAM_USDC}</span>
            </div>
          </div>
          <div className="mt-16 font-mono text-[10px] uppercase tracking-[0.28em] text-[#f1eee7]/30">{t.cta.footer}</div>
        </div>
      </section>
    </div>
  );
}
