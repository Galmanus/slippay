// Landing — high-conversion (Stripe/Apple + crypto-native-invisible). Top sells
// magic (instant result), middle reduces anxiety (full control), end proves it's
// real (invisible infra). Warm bone, ink text, GRAY accent (#6f6862), yellow ONLY
// as small details (#FDDA24: live dots, checkmarks, logo dot), ink CTAs. PT/EN.

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
    hero: { axis: "global money", h1a: "Global money.", h1acc: "In one touch.", sub: "Pix → Dollars → Your wallet. In 10 seconds.", reassure: "No bank. No broker. No hassle.", bold: "Just you and your money.", cta: "Get started free", note: "2 minutes • biometrics • no card • no seed phrase", liveTag: "live · mainnet",
      micro: ["USDC in your wallet in seconds", "Zero custody", "You keep full control", "Works across multiple chains"] },
    second: { stamp: "how", h: "Pix in. Dollars out.", lines: ["You send reais.", "You get dollars.", "Straight to your wallet.", "No middlemen in between."] },
    magic: { stamp: "one touch", h: "One touch.", lines: ["Open the app.", "Biometrics.", "Done.", "Your global money appears."] },
    control: { stamp: "control", h: "You never lose control.", lines: ["Before anything exists in the system, you define:", "who can be paid · how much can be spent · which rules apply", "If it's outside the rule, it doesn't happen."] },
    transform: { stamp: "the shift", h: "Money stops being slow.", todayL: "Today", slipL: "With SlipPay", today: ["banks", "business days", "manual approvals", "closed systems"], slip: ["seconds", "global", "automatic", "programmable"] },
    truth: { stamp: "your money", h: "Your money passes through no one.", lines: ["Not a bank. Not a middleman. Not a custodian.", "It goes straight to you.", "Your wallet. Your key. Your possession."] },
    automation: { stamp: "then it works alone", h: "After that, it works on its own.", lines: ["Set it up once: recurring payments, monthly limits, authorized recipients.", "The system executes automatically. Within your rules."], gateLink: "How the gate works →" },
    guarantee: { stamp: "the guarantee", h: "If it's not right, it doesn't happen.", body: "Before every transaction:", checks: ["checks the rule", "checks the amount", "checks the recipient"], fail: "Any deviation: blocked automatically." },
    invisible: { stamp: "invisible", h: "The technology disappears.", lines: ["Behind it: smart contracts, multiple blockchains, global settlement, real financial infrastructure.", "You never need to see any of it.", "You only see the result: money that works."] },
    proof: { stamp: "live", h: "Real money. Live.", lines: ["Not a demo. Not a promise.", "Every payment is publicly verifiable. Check it yourself."], btnReal: "See a real payment ↗", btnContract: "The live contract ↗" },
    positioning: { stamp: "category", h: "This isn't a bank.", lines: ["Not a traditional fintech. Not a broker.", "It's a new layer:"], big: "programmable money + instant access to dollars" },
    cta: { stamp: "start", h: "Start now.", lines: ["Turn Pix into dollars in seconds.", "Hold it in your wallet.", "Automate when you want.", "Keep full control."], btn: "Get started free", note: "No card • 2 minutes • biometrics",
      final: ["Pix in. Dollars out.", "One touch.", "Your money."],
      supportLabel: "support the team", supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars, one touch, no app.", supportBtn: "Support with $10 ↗", footer: "slippay · global money, in one touch · live on mainnet" },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", manifesto: "Manifesto", login: "Entrar", tryFree: "Começar" },
    hero: { axis: "dinheiro global", h1a: "Dinheiro global.", h1acc: "Em um toque.", sub: "Pix → Dólares → Sua carteira. Em 10 segundos.", reassure: "Sem banco. Sem corretora. Sem complicação.", bold: "Só você e seu dinheiro.", cta: "Começar grátis", note: "2 minutos • biometria • sem cartão • sem seed phrase", liveTag: "ao vivo · mainnet",
      micro: ["USDC na sua carteira em segundos", "Custódia zero", "Você mantém controle total", "Funciona em múltiplas chains"] },
    second: { stamp: "como", h: "Pix in. Dollars out.", lines: ["Você envia reais.", "Você recebe dólares.", "Direto na sua carteira.", "Sem intermediários no meio."] },
    magic: { stamp: "um toque", h: "Um toque.", lines: ["Abra o app.", "Biometria.", "Pronto.", "Seu dinheiro global aparece."] },
    control: { stamp: "controle", h: "Você nunca perde o controle.", lines: ["Antes de qualquer coisa existir no sistema, você define:", "quem pode receber · quanto pode ser gasto · quais regras valem", "Se sair da regra, não acontece."] },
    transform: { stamp: "a virada", h: "O dinheiro deixa de ser lento.", todayL: "Hoje", slipL: "Com SlipPay", today: ["bancos", "dias úteis", "aprovações manuais", "sistemas fechados"], slip: ["segundos", "global", "automático", "programável"] },
    truth: { stamp: "seu dinheiro", h: "O dinheiro não passa por ninguém.", lines: ["Nem banco. Nem intermediário. Nem custodiante.", "Ele vai direto para você.", "Na sua carteira. Na sua chave. Na sua posse."] },
    automation: { stamp: "depois, trabalha sozinho", h: "Depois disso, ele trabalha sozinho.", lines: ["Você configura uma vez: pagamentos recorrentes, limites mensais, destinatários autorizados.", "E o sistema executa automaticamente. Dentro das suas regras."], gateLink: "Como o gate funciona →" },
    guarantee: { stamp: "a garantia", h: "Se não estiver certo, não acontece.", body: "Antes de cada transação:", checks: ["verifica a regra", "verifica o valor", "verifica o destinatário"], fail: "Qualquer desvio: bloqueia automaticamente." },
    invisible: { stamp: "invisível", h: "A tecnologia desaparece.", lines: ["Por trás disso: smart contracts, múltiplas blockchains, liquidação global, infraestrutura financeira real.", "Você nunca precisa ver isso.", "Você só vê o resultado: dinheiro funcionando."] },
    proof: { stamp: "ao vivo", h: "Dinheiro real. Ao vivo.", lines: ["Não é demo. Não é promessa.", "Cada pagamento é verificável publicamente. Confira você mesmo."], btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗" },
    positioning: { stamp: "categoria", h: "Isso não é um banco.", lines: ["Não é uma fintech tradicional. Não é uma corretora.", "É uma nova camada:"], big: "dinheiro programável + acesso instantâneo ao dólar" },
    cta: { stamp: "comece", h: "Comece agora.", lines: ["Transforme Pix em dólares em segundos.", "Guarde na sua carteira.", "Automatize quando quiser.", "Mantenha controle total."], btn: "Começar grátis", note: "Sem cartão • 2 minutos • biometria",
      final: ["Pix in. Dollars out.", "Um toque.", "Seu dinheiro."],
      supportLabel: "apoie o time", supportText: "Feito sozinho no Brasil. Se ganhou teu respeito, manda uns dólares, um toque, sem app.", supportBtn: "Apoiar com $10 ↗", footer: "slippay · dinheiro global, em um toque · ao vivo na mainnet" },
  },
} as const;

function Typewriter({ text, delay = 0, speed = 60 }: { text: string; delay?: number; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(text.length); return; }
    setN(0);
    let i = 0; let id = 0;
    const start = window.setTimeout(() => {
      id = window.setInterval(() => { i += 1; setN(i); if (i >= text.length) window.clearInterval(id); }, speed);
    }, delay);
    return () => { window.clearTimeout(start); if (id) window.clearInterval(id); };
  }, [text, delay, speed]);
  return <span>{text.slice(0, n)}<span className="tw-caret" style={{ color: "#FDDA24" }}>▋</span></span>;
}

function Index({ n, label, typed = false }: { n: string; label: string; typed?: boolean }) {
  return (
    <div className="flex items-baseline justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GRAY }}>
      <span className="text-[#0a0a0a]/55">{n}</span><span className="h-px w-8 bg-current opacity-40" /><span>{typed ? <Typewriter text={label} /> : label}</span>
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

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <style>{`html{scroll-behavior:smooth}::selection{background:#FDDA24;color:#0a0a0a}section h2{text-wrap:balance}@keyframes twBlink{0%,49%{opacity:1}50%,100%{opacity:0}}.tw-caret{animation:twBlink 1.05s steps(1,end) infinite;margin-left:1px}`}</style>
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
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8rem)] mx-auto" style={display}>
            {t.hero.h1a}<br /><span style={{ color: GRAY }}><Typewriter text={t.hero.h1acc} delay={700} speed={90} /></span>
          </h1>
          <p className="mt-9 text-2xl md:text-3xl leading-snug max-w-[24ch] mx-auto" style={display}>{t.hero.sub}</p>
          <p className="mt-5 text-base md:text-lg text-[#0a0a0a]/55">{t.hero.reassure}</p>
          <p className="mt-3 text-lg md:text-xl font-medium" style={display}>{t.hero.bold}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className={btn}>{t.hero.cta}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.hero.note}</span>
          </div>
          <div className="mt-8 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[#0a0a0a]/65 max-w-[640px]">
            {t.hero.micro.map((x) => <span key={x} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{x}</span>)}
          </div>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      {/* SECOND HERO */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="001" label={t.second.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.05em] leading-[0.9] text-[clamp(2.75rem,9vw,6.5rem)]" style={display}>{t.second.h}</h2>
        <Lines lines={t.second.lines} />
      </div></section>

      {/* MAGIC */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="002" label={t.magic.stamp} />
        <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,12vw,8rem)]" style={display}>{t.magic.h}</h2>
        <Lines lines={t.magic.lines} />
      </div></section>

      {/* CONTROL */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="003" label={t.control.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)] max-w-[20ch] mx-auto" style={display}>{t.control.h}</h2>
        <Lines lines={t.control.lines} />
      </div></section>

      {/* TRANSFORM (today vs slippay) */}
      <section className={sec}><div data-reveal className="max-w-[860px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
        <Index n="004" label={t.transform.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)]" style={display}>{t.transform.h}</h2>
        <div className="mt-12 grid sm:grid-cols-2 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 text-left">
          <div className="bg-[#f1eee7] p-7 md:p-9">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.transform.todayL}</div>
            <div className="mt-4 flex flex-col gap-2 text-lg text-[#0a0a0a]/55">{t.transform.today.map((x) => <span key={x}>{x}</span>)}</div>
          </div>
          <div className="bg-white p-7 md:p-9">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: GRAY }}>{t.transform.slipL}</div>
            <div className="mt-4 flex flex-col gap-2 text-lg font-medium" style={display}>{t.transform.slip.map((x) => <span key={x} className="flex items-center gap-2"><span className="text-[#FDDA24] text-sm">✓</span>{x}</span>)}</div>
          </div>
        </div>
      </div></section>

      {/* TRUTH */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="005" label={t.truth.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[20ch] mx-auto" style={display}>{t.truth.h}</h2>
        <Lines lines={t.truth.lines} />
      </div></section>

      {/* AUTOMATION (gate) */}
      <section className={sec}><div data-reveal className="max-w-[1000px] mx-auto px-6 md:px-12 py-24 md:py-36 flex flex-col items-center text-center">
        <Index n="006" label={t.automation.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)] max-w-[20ch]" style={display}>{t.automation.h}</h2>
        <Lines lines={t.automation.lines} />
        <div className="mt-12 w-full max-w-[440px] mx-auto text-left"><MandateDemo /></div>
        <Link to="/gate" className="mt-8 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.automation.gateLink}</Link>
      </div></section>

      {/* GUARANTEE */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="007" label={t.guarantee.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.92] text-[clamp(2.25rem,7vw,5rem)] max-w-[18ch] mx-auto" style={display}>{t.guarantee.h}</h2>
        <p className="mt-8 text-lg text-[#0a0a0a]/60">{t.guarantee.body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-lg">{t.guarantee.checks.map((c) => <span key={c} className="flex items-center gap-2"><span className="text-[#FDDA24]">✓</span>{c}</span>)}</div>
        <p className="mt-8 text-xl md:text-2xl font-medium tracking-[-0.02em]" style={display}>{t.guarantee.fail}</p>
      </div></section>

      {/* INVISIBLE */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="008" label={t.invisible.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.invisible.h}</h2>
        <Lines lines={t.invisible.lines} />
      </div></section>

      {/* PROOF */}
      <section id="proof" className={sec}><div data-reveal className={inner}>
        <Index n="009" label={t.proof.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.proof.h}</h2>
        <Lines lines={t.proof.lines} />
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className={btn}>{t.proof.btnReal}</a>
          <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.proof.btnContract}</a>
        </div>
      </div></section>

      {/* POSITIONING */}
      <section className={sec}><div data-reveal className={inner}>
        <Index n="010" label={t.positioning.stamp} />
        <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6rem)]" style={display}>{t.positioning.h}</h2>
        <Lines lines={t.positioning.lines} />
        <p className="mt-6 text-2xl md:text-4xl font-semibold tracking-[-0.02em] max-w-[20ch] mx-auto" style={{ ...display, color: GRAY }}>{t.positioning.big}</p>
      </div></section>

      {/* CTA */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-44 text-center">
        <Index n="011" label={t.cta.stamp} />
        <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,13vw,10rem)] mx-auto" style={display}>{t.cta.h}</h2>
        <div className="mt-10 flex flex-col gap-1 text-xl md:text-2xl text-[#0a0a0a]/65">{t.cta.lines.map((l) => <span key={l}>{l}</span>)}</div>
        <div className="mt-12"><Link to="/account" className={btn}>{t.cta.btn}</Link></div>
        <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.cta.note}</div>
        <div className="mt-16 flex flex-col gap-0.5 text-2xl md:text-3xl font-bold tracking-[-0.03em]" style={display}>{t.cta.final.map((l) => <span key={l}>{l}</span>)}</div>

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
