// Landing — Slippay identity system. Positioning (2026-10-16): the dollar account
// for Brazilian companies that import and export. Non-custodial USDC on Arc that
// moves in and out by Pix; idle balance earns; AI agents pay bills inside limits.
// Companies only: there is no retail (pessoa física) product.
// Helvetica-brutalist (Inter), monumental caps, mono index labels, International
// Klein Blue #002FA7 as the only accent (#5B82FF on dark surfaces). Bilingual.
// Register: a normal bank. Arc and Circle are named (declared ally); no other
// network is.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AccountDemo } from "../components/AccountDemo.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { GoldWaves } from "../components/GoldWaves.tsx";
import { LiveProof } from "../components/LiveProof.tsx";

const display = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" } as const;
const GRAY = "#6f6862";
// AgentVault spend on Arc testnet (0.5 USDC, inside the session limit). Swap for a
// mainnet payment once the Arc account flow is live.
const REAL_TX = "0x8cb9df02fc39a4733f861ae30c22a2cc783806a6e2de44832d1fe50427aa5bbb";
const xurl = (id: string) => `https://explorer.testnet.arc.io/tx/${id}`;
type Lang = "pt" | "en";

const COPY = {
  en: {
    nav: { pay: "Pay", receive: "Receive", agents: "Agents", enterprise: "Enterprise", login: "Sign in", tryFree: "Open a company account", gate: "The rules", live: "Live", investors: "Investors", manifesto: "Manifesto", builders: "Builders" },
    hero: { eyebrow: "dollar account for companies · on Arc", h1: "Dollars to import and export.", sub: "Circle's digital dollar (USDC) in your company's own account. In and out by Pix. Earns while idle. Your AI agents pay the bills.", cta: "Open a company account", note: "no bank branch · the money stays with the company", metrics: [["US$", "the company's own balance"], ["Pix", "in and out, in reais"], ["Earns", "while it waits"]] as [string, string][], circle: "Built on Arc, by Circle.", circleNote: "Arc Acceleration Season · 2026" },
    yours: { n: "001", stamp: "yours", h: "The company's. For real.", items: [
      ["Only the company moves it", "Every payment is approved by the people you authorize. Not by a bank, and not by us."],
      ["We never hold it", "The dollars stay in the company's own account, never parked inside Slippay. We can't block them, hold them, or take them."],
      ["Real dollars, ready to use", "Pay a supplier in Asia, receive from a client in Europe, or bring it back to reais. Nothing is locked."],
    ] as [string, string][] },
    how: { n: "002", stamp: "how", h: "From Pix to dollars, and back.", steps: [
      ["Send a Pix", "From the company's bank account, in reais, as always."],
      ["It becomes dollars", "USDC, straight into the company's account."],
      ["Use it abroad", "Pay suppliers, receive from clients, or bring it back by Pix."],
    ] as [string, string][], foot: "~1.9% to turn reais into dollars, vs ~5% at a bank. The rest stays with the company." },
    control: { n: "003", stamp: "agents", h: "Agents that pay the bills.", body: "Give an AI agent its own dollar sub-wallet with a limit and a list of who it may pay: freight, SaaS, a supplier's invoice. Past the limit, it locks on its own. Each agent has an identity, and every payment is on the record for your accountant.", gateLink: "How the limits work →", agentsLink: "Connect an agent →" },
    business: { n: "004", stamp: "yield", h: "Idle dollars earn.", body: "Money waiting for the next shipment doesn't have to sit still. From the account, the company moves idle dollars into a yield position on Arc and takes them back when it needs them. The position stays in the company's own account, with the rate and the earnings shown as they are on the network.", cta: "Talk to us →" },
    open: { n: "005", stamp: "on Arc", h: "Built on Arc, the network of Circle's dollar.", body: "The balance is USDC, the digital dollar issued by Circle, on Arc, the network Circle built for money. Every payment leaves a public receipt anyone can verify, without asking us.", btnReal: "See an agent payment (test network) ↗" },
    faq: { n: "006", stamp: "questions", h: "Before you ask.", items: [
      ["How much does it cost?", "~1.9% when reais become dollars, everything included. No monthly fee. No hidden fees. If a fee ever exists, it shows up before you confirm, never after."],
      ["Is Slippay a bank?", "No, and that's by design. A bank keeps your money; Slippay doesn't. The dollars stay with the company, and currency exchange runs through partners licensed by the Central Bank."],
      ["Who is it for?", "Companies that import, export, or pay and receive abroad. There is no personal account."],
      ["Can we pay a supplier abroad?", "Yes. The balance is real dollars and it's the company's. Send it to any supplier that accepts USDC, anywhere, anytime."],
      ["How does the yield work?", "The company moves idle dollars into a lending vault on Arc, through Circle's Earn, and takes them back when it wants. The position lives in the company's own account. The rate and the earnings shown are the network's numbers, not ours."],
      ["How does an agent's wallet work?", "You create a sub-wallet, set a limit and who it can pay, and paste a connection code into your agent. It pays on its own inside the limit; anything above it is blocked."],
      ["We move large amounts. Can we use it?", "Yes. The money stays in the company's hands, never ours. For large deposits and withdrawals, conversion routes through a Central Bank–licensed partner, with company identity checks and full FX compliance."],
      ["Can Slippay freeze our money?", "No. Slippay never holds it, so there's nothing for us, or a bank, to freeze. Like every digital dollar, USDC follows the compliance rules of Circle, its issuer."],
    ] as [string, string][] },
    cta: { n: "007", stamp: "start", h: "Start now.", lines: ["From a Pix to dollars, in an account that's the company's.", "For the business and for its agents."], btn: "Open a company account", note: "No bank branch · the money stays with the company",
      footer: "slippay · the dollar account for foreign trade" },
  },
  pt: {
    nav: { pay: "Pagar", receive: "Receber", agents: "Agentes", enterprise: "Enterprise", login: "Entrar", tryFree: "Abrir conta da empresa", gate: "As regras", live: "Ao vivo", investors: "Investidores", manifesto: "Manifesto", builders: "Builders" },
    hero: { eyebrow: "conta em dólar para empresas · na Arc", h1: "Dólar pra importar e exportar.", sub: "O dólar digital da Circle (USDC) na conta da própria empresa. Entra e sai por Pix. Rende parado. Seus agentes de IA pagam as contas.", cta: "Abrir conta da empresa", note: "sem agência · o dinheiro fica com a empresa", metrics: [["US$", "saldo da própria empresa"], ["Pix", "entra e sai em reais"], ["Rende", "enquanto espera"]] as [string, string][], circle: "Na Arc, a rede da Circle.", circleNote: "Arc Acceleration Season · 2026" },
    yours: { n: "001", stamp: "é da empresa", h: "É da empresa. De verdade.", items: [
      ["Só a empresa movimenta", "Cada pagamento é aprovado por quem você autorizar. Não por um banco, nem pela gente."],
      ["A gente não segura", "O dólar fica na conta da própria empresa, nunca parado dentro da Slippay. A gente não consegue bloquear, segurar nem tomar."],
      ["Dólar de verdade, pronto pra usar", "Pague um fornecedor na Ásia, receba de um cliente na Europa ou traga de volta pra real. Nada fica preso."],
    ] as [string, string][] },
    how: { n: "002", stamp: "como", h: "Do Pix ao dólar, e de volta.", steps: [
      ["Faça um Pix", "Da conta da empresa, em reais, como sempre."],
      ["Vira dólar", "USDC, direto na conta da empresa."],
      ["Use lá fora", "Pague fornecedores, receba de clientes ou traga de volta por Pix."],
    ] as [string, string][], foot: "~1,9% pra virar dólar, contra ~5% de banco. O resto fica com a empresa." },
    control: { n: "003", stamp: "agentes", h: "Agentes que pagam as contas.", body: "Dê a um agente de IA uma sub-carteira em dólar com limite e lista de quem ele pode pagar: frete, SaaS, a fatura de um fornecedor. Passou do limite, trava sozinho. Cada agente tem identidade própria, e todo pagamento fica registrado pro seu contador.", gateLink: "Como os limites funcionam →", agentsLink: "Conectar um agente →" },
    business: { n: "004", stamp: "rendimento", h: "Dólar parado rende.", body: "O dinheiro que espera o próximo embarque não precisa ficar parado. Da própria conta, a empresa coloca o dólar ocioso numa posição de rendimento na Arc e tira quando precisar. A posição fica na conta da empresa, com a taxa e o rendimento mostrados como estão na rede.", cta: "Falar com a gente →" },
    open: { n: "005", stamp: "na Arc", h: "Feito na Arc, a rede do dólar da Circle.", body: "O saldo é USDC, o dólar digital emitido pela Circle, na Arc, a rede que a Circle construiu para dinheiro. Cada pagamento deixa um comprovante público que qualquer pessoa confere, sem pedir nada pra gente.", btnReal: "Ver um pagamento de agente (rede de teste) ↗" },
    faq: { n: "006", stamp: "perguntas", h: "Antes de perguntar.", items: [
      ["Quanto custa?", "~1,9% quando o real vira dólar, com tudo dentro. Sem mensalidade. Sem taxa escondida. Se algum dia existir uma taxa, ela aparece antes de você confirmar, nunca depois."],
      ["A Slippay é um banco?", "Não, e é de propósito. Banco guarda o seu dinheiro; a Slippay não guarda. O dólar fica com a empresa, e o câmbio passa por parceiros licenciados pelo Banco Central."],
      ["Pra quem é?", "Empresas que importam, exportam ou pagam e recebem lá fora. Não existe conta pra pessoa física."],
      ["Dá pra pagar fornecedor lá fora?", "Dá. O saldo é dólar de verdade e é da empresa. Envie pra qualquer fornecedor que aceite USDC, em qualquer lugar, quando quiser."],
      ["Como funciona o rendimento?", "A empresa coloca o dólar parado num cofre de empréstimo na Arc, pelo Earn da Circle, e tira quando quiser. A posição fica na conta da própria empresa. A taxa e o rendimento mostrados são os números da rede, não os nossos."],
      ["Como funciona a carteira do agente?", "Você cria uma sub-carteira, define o limite e quem ele pode pagar, e cola um código de conexão no seu agente. Ele paga sozinho dentro do limite; passou disso, é bloqueado."],
      ["Movimentamos valores altos. Dá pra usar?", "Dá. O dinheiro fica na mão da empresa, nunca na nossa. Para entradas e saídas grandes, a conversão passa por um parceiro licenciado pelo Banco Central, com verificação da empresa e câmbio em conformidade."],
      ["A Slippay pode congelar o nosso dinheiro?", "Não. A Slippay nunca segura o dinheiro, então não há o que nós, ou um banco, congelar. Como todo dólar digital, o USDC segue as regras de conformidade da Circle, que o emite."],
    ] as [string, string][] },
    cta: { n: "007", stamp: "comece", h: "Comece agora.", lines: ["Do Pix ao dólar, numa conta que é da empresa.", "Pro negócio e pros agentes dele."], btn: "Abrir conta da empresa", note: "Sem agência · o dinheiro fica com a empresa",
      footer: "slippay · a conta em dólar do comércio exterior" },
  },
} as const;

function Stamp({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] justify-center md:justify-start" style={{ color: GRAY }}>
      <span className="text-[#0a0a0a]/70">{n}</span><span className="h-px w-10 bg-current opacity-40" /><span>{label}</span>
    </div>
  );
}

export default function LandingV2() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Transparent header over the full-bleed hero image; turns solid bone on scroll
  // so the dark nav text stays legible over the cream sections below.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [lang, setLang] = useState<Lang>(() => {
    try { const s = localStorage.getItem("slippay.lang"); if (s === "pt" || s === "en") return s; } catch { /* */ }
    return "pt";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* */ } }, [lang]);
  const t = COPY[lang];

  const NAV: [string, string][] = [[t.nav.agents, "/agents"], [t.nav.enterprise, "/enterprise"], [t.nav.login, "/account"]];
  const NAV_MORE: [string, string][] = [[t.nav.gate, "/gate"], [t.nav.live, "/cockpit"], [t.nav.investors, "/investors"], [t.nav.manifesto, "/manifesto"], [t.nav.builders, "/builders"]];

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); } }, { rootMargin: "-8% 0px -8% 0px", threshold: 0.06 });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("js-reveal"); };
  }, []);

  const LangToggle = () => {
    const active = "text-[#0a0a0a] font-medium";
    return (
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">
        <button onClick={() => setLang("pt")} className={lang === "pt" ? active : "hover:opacity-80"}>PT</button>
        <span className="opacity-30 mx-1">/</span>
        <button onClick={() => setLang("en")} className={lang === "en" ? active : "hover:opacity-80"}>EN</button>
      </div>
    );
  };
  const btn = "lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#002FA7] text-white font-semibold";
  const sec = "border-t border-[#0a0a0a]/12";
  const h2 = "font-black uppercase tracking-[-0.04em] leading-[0.88] text-center md:text-left mx-auto md:mx-0";

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] overflow-x-hidden" style={display}>
      <style>{`html{scroll-behavior:smooth}::selection{background:#002FA7;color:#ffffff}`}</style>

      {/* HEADER — transparent over the hero image, solid bone on scroll */}
      <header className={"fixed top-0 left-0 right-0 z-40 px-6 md:px-12 py-4 flex items-center justify-between transition-colors duration-300 " + (scrolled ? "backdrop-blur-md bg-white/85 border-b border-[#0a0a0a]/8" : "bg-transparent")}>
        <Link to="/" className="text-2xl md:text-3xl lowercase text-[#0a0a0a]" style={{ ...display, fontWeight: 800, letterSpacing: "-0.04em" }}>slippay<span className="text-[#002FA7]">.</span></Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          {NAV.map(([label, href]) => <Link key={href} to={href} className={(href === "/enterprise" ? "inline" : "hidden md:inline") + " transition-opacity hover:opacity-70"}>{label}</Link>)}
          <span className="hidden md:inline"><LangToggle /></span>
          <Link to="/account" className="hidden md:inline-flex items-center rounded-full px-5 py-2.5 bg-[#002FA7] text-white font-semibold hover:opacity-90">{t.nav.tryFree}</Link>
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" className="md:hidden flex flex-col gap-[5px] p-1">
            <span className={`block w-6 h-[2px] transition-all bg-[#0a0a0a] ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block w-6 h-[2px] transition-all bg-[#0a0a0a] ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-[2px] transition-all bg-[#0a0a0a] ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 z-50 bg-white border-y border-[#0a0a0a]/10 px-6 py-4 flex flex-col gap-1 text-[12px] uppercase tracking-[0.18em]">
            {NAV.map(([label, href]) => <Link key={href} to={href} onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">{label}</Link>)}
            <div className="py-3 border-b border-[#0a0a0a]/8"><LangToggle /></div>
            <Link to="/account" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#002FA7] text-white font-semibold">{t.nav.tryFree}</Link>
          </div>
        )}
      </header>

      {/* HERO — 2-col: text left, phone right. Plain bank register, zero tech words.
          GoldWaves drift behind the content (pointer-events off, z-0); content z-10. */}
      <section className="relative overflow-hidden bg-white text-[#0a0a0a]">
        <GoldWaves className="pointer-events-none absolute inset-0 z-0 opacity-40" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-32 md:pt-40 pb-16 md:pb-24 grid md:grid-cols-[1fr_auto] gap-10 md:gap-20 items-center">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#002FA7" }} />{t.hero.eyebrow}
            </span>
            <h1 className="mt-7 font-black uppercase tracking-[-0.04em] leading-[0.9] text-[clamp(2.4rem,7.5vw,4.75rem)] max-w-[14ch]" style={display}>{t.hero.h1}</h1>
            <p className="mt-6 text-base md:text-lg text-[#0a0a0a]/70 max-w-[40ch] leading-relaxed">{t.hero.sub}</p>
            <div className="mt-9 grid grid-cols-3 border-y-[1.5px] border-[#0a0a0a] w-full max-w-[440px]">
              {t.hero.metrics.map(([k, v], i) => (
                <div key={k} className={"px-3 md:px-4 py-4 text-center md:text-left " + (i > 0 ? "border-l border-[#0a0a0a]/12" : "")}>
                  <div className="font-black text-[22px] md:text-[27px] tracking-[-0.03em] leading-none text-[#0a0a0a]" style={display}>{k}</div>
                  <div className="mt-2 text-[10px] leading-tight text-[#0a0a0a]/50">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-4">
              <Link
                to="/account"
                className={btn}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
              >{t.hero.cta}</Link>
            </div>
            <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">{t.hero.note}</span>
          </div>
          <div className="mx-auto md:mx-0 max-w-[290px]">
            <AccountDemo lang={lang} />
          </div>
        </div>
        {/* CIRCLE — declared ally, monumental. Says "on Arc, by Circle": true today (program + network); not "backed by". */}
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 pb-14 md:pb-20 text-center md:text-left">
          <div className="font-black uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8.5rem)]" style={display}>
            {t.hero.circle.split("Circle").map((part, i, arr) => <span key={i}>{part}{i < arr.length - 1 && <span className="text-[#002FA7]">Circle</span>}</span>)}
          </div>
          <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.3em] text-[#0a0a0a]/45">{t.hero.circleNote}</div>
        </div>
        {/* Live pulse — real payment data behind the scenes, plain words in front */}
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 pb-16 md:pb-24">
          <LiveProof prominent lang={lang} />
        </div>
      </section>

      {/* 001 · YOURS — sovereignty, the spine */}
      <section className={sec}><div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <Stamp n={t.yours.n} label={t.yours.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.5rem,8vw,5.5rem)] max-w-[16ch]`} style={display}>{t.yours.h}</h2>
        <div className="mt-16 grid md:grid-cols-3 gap-x-12 gap-y-12">
          {t.yours.items.map(([h, b], i) => (
            <div key={h} className="border-t-2 border-[#0a0a0a] pt-6">
              <div className="font-mono text-[11px] tracking-[0.2em] text-[#002FA7]">0{i + 1}</div>
              <div className="mt-3 text-2xl md:text-[28px] font-bold tracking-[-0.02em] leading-[1.05]" style={display}>{h}</div>
              <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/60 max-w-[40ch]">{b}</p>
            </div>
          ))}
        </div>
      </div></section>

      {/* 002 · HOW — Pix to dollars, the entry ticket, minimal */}
      <section className={sec}><div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <Stamp n={t.how.n} label={t.how.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.5rem,9vw,6rem)]`} style={display}>{t.how.h}</h2>
        <div className="mt-14 grid md:grid-cols-3 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 rounded-2xl overflow-hidden">
          {t.how.steps.map(([h, b], i) => (
            <div key={i} className="bg-white p-7 md:p-9">
              <span className="font-mono text-[12px]" style={{ color: GRAY }}>{String(i + 1).padStart(2, "0")}</span>
              <div className="mt-4 text-2xl md:text-3xl font-bold tracking-[-0.02em]" style={display}>{h}</div>
              <p className="mt-2 text-[15px] text-[#0a0a0a]/60">{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-lg md:text-xl font-medium tracking-[-0.01em]">{t.how.foot}</p>
      </div></section>

      {/* 003 · AGENTS — a dollar sub-wallet per AI agent, with a limit it cannot pass */}
      <section className={sec}><div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        <div>
          <Stamp n={t.control.n} label={t.control.stamp} />
          <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,6.5vw,4.5rem)] max-w-[15ch]`} style={display}>{t.control.h}</h2>
          <p className="mt-6 text-lg md:text-xl text-[#0a0a0a]/70 leading-relaxed max-w-[46ch]">{t.control.body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link to="/agents" className="lift inline-flex items-center rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.22em] bg-[#002FA7] text-white font-semibold">{t.control.agentsLink}</Link>
            <Link to="/gate" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.control.gateLink}</Link>
          </div>
        </div>
        <div className="w-full max-w-[440px] mx-auto md:justify-self-end"><MandateDemo lang={lang} /></div>
      </div></section>

      {/* 004 · BUSINESS — for companies: an assistant that pays your bills */}
      <section className="px-4 md:px-6 py-2"><div data-reveal className="bg-[#0a0a0a] text-[#f1eee7] rounded-[1.75rem] md:rounded-[2.5rem] max-w-[1200px] mx-auto px-6 md:px-14 py-24 md:py-36">
        <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#f1eee7]/40">
          <span className="text-[#5B82FF]">{t.business.n}</span><span className="h-px w-8 bg-[#f1eee7]/30" /><span>{t.business.stamp}</span>
        </div>
        <h2 className="mt-10 font-black uppercase tracking-[-0.04em] leading-[0.88] text-[clamp(2.5rem,8vw,5.5rem)] max-w-[15ch]" style={display}>{t.business.h}</h2>
        <p className="mt-8 text-lg md:text-2xl text-[#f1eee7]/70 leading-relaxed max-w-[52ch]">{t.business.body}</p>
        <Link to="/builders" className="mt-10 lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#002FA7] text-white font-semibold">{t.business.cta}</Link>
      </div></section>

      {/* 005 · ON ARC — declared ally: USDC by Circle, on Arc; every payment has a public receipt */}
      <section className={sec}><div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <Stamp n={t.open.n} label={t.open.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,7vw,5rem)] max-w-[18ch]`} style={display}>{t.open.h}</h2>
        <p className="mt-8 text-lg md:text-2xl text-[#0a0a0a]/70 leading-relaxed max-w-[54ch] mx-auto md:mx-0">{t.open.body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <a href={xurl(REAL_TX)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a] border-b-2 border-[#002FA7] hover:opacity-70 pb-1">{t.open.btnReal}</a>
        </div>
      </div></section>

      {/* 006 · FAQ — the objections that block the first deposit */}
      <section className={sec}><div data-reveal className="max-w-[900px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <Stamp n={t.faq.n} label={t.faq.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,7vw,4.5rem)]`} style={display}>{t.faq.h}</h2>
        <div className="mt-12 flex flex-col">
          {t.faq.items.map(([q, a], i) => (
            <div key={i} className="border-t border-[#0a0a0a]/12 py-7">
              <div className="text-xl md:text-2xl font-bold tracking-[-0.02em]" style={display}>{q}</div>
              <p className="mt-2 text-[16px] leading-relaxed text-[#0a0a0a]/60 max-w-[60ch]">{a}</p>
            </div>
          ))}
        </div>
      </div></section>

      {/* 007 · CTA */}
      <section className={sec}><div className="max-w-[1200px] mx-auto px-6 md:px-12 py-28 md:py-44">
        <Stamp n={t.cta.n} label={t.cta.stamp} />
        <h2 className="mt-10 font-black uppercase tracking-[-0.055em] leading-[0.8] text-[clamp(3.5rem,16vw,12rem)] text-center md:text-left" style={display}>{t.cta.h}</h2>
        <div className="mt-8 flex flex-col gap-1 text-xl md:text-2xl text-[#0a0a0a]/65 text-center md:text-left">{t.cta.lines.map((l) => <span key={l}>{l}</span>)}</div>
        <div className="mt-12 flex flex-wrap items-center gap-6 justify-center md:justify-start"><Link to="/account" className={btn}>{t.cta.btn}</Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.cta.note}</span>
        </div>

        <div className="mt-16 flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/45">
          {NAV_MORE.map(([label, href]) => <Link key={href} to={href} className="hover:text-[#0a0a0a]">{label}</Link>)}
          <a href="https://slippay.gitbook.io/slippay-docs" target="_blank" rel="noreferrer" className="hover:text-[#0a0a0a]">Docs</a>
        </div>
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-[#0a0a0a]/30">{t.cta.footer}</div>
      </div></section>
    </div>
  );
}
