// Landing — Yeezy editorial monumental, bilingual (PT/EN, toggle in header,
// persisted). Plain web2 voice, Pix-forward, honest mainnet proof.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { CountUp } from "../components/CountUp.tsx";
import { LiveProof } from "../components/LiveProof.tsx";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const LIVE_CONTRACT = "CD2RFNOLMIKZN4EETDCGULGMD4ANS56IIUDIBLOE24P4JRZM2GCVFV2U";
const REAL_TX = "5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";
const TEAM_USDC = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P";
const xurl = (p: string, id: string) => `https://stellar.expert/explorer/public/${p}/${id}`;

type Lang = "pt" | "en";

const COPY = {
  en: {
    nav: { gate: "The gate", security: "Security", live: "Live", pay: "Pay", receive: "Receive", pricing: "Pricing", manifesto: "Manifesto", login: "Login", tryFree: "Try it free" },
    hero: {
      stamp: "payments, on autopilot",
      h1a: "Your money,", h1dim: "on", h1accent: "autopilot.",
      subA: "Add money with ", subPix: "Pix", subB: " and keep it in dollars, then let it pay your bills by itself, the moment they're due. ",
      subBold: "It stays yours, and only does what you allow.",
      cta: "Add money with Pix", ctaNote: "free to start · no card · 2 minutes",
      note: "As simple as any app you already use. No crypto knowledge needed.",
      liveTag: "live · mainnet",
    },
    cheaper: {
      stamp: "cheaper & safer than cards",
      h2a: "Save ~3% on ", h2accent: "every transaction.",
      p1a: "Cards take close to 3% of every sale. On Stellar, moving money costs fractions of a cent. SlipPay passes that saving on to you: ",
      p1bold: "the same sale, a fraction of the fee, no chargebacks.",
      cardLabel: "card", cardSub: "per transaction, and still subject to chargebacks",
      slipLabel: "slippay", slipVal: "a fraction", slipSub: "near-zero network fee · final in seconds · no chargebacks",
      p2a: "And safer. Card processors hold your money and can freeze your account. ",
      p2bold: "SlipPay never holds it. The money never leaves your wallet, and no one can lock it.",
    },
    how: {
      stamp: "how it works", h2a: "How it ", h2accent: "works.",
      steps: [
        ["Create your account with a touch", "Your face or your finger. No password, no email, no 12 crypto words. One tap."],
        ["Add money with Pix", "Top up in seconds, like any app you already use. Your reais become dollars."],
        ["The money is yours", "It sits in your pocket, in dollars. No one holds it, no one can freeze it, not even us."],
        ["Pay or get paid with a touch", "Instant, almost free (about 3% cheaper than cards), and anyone can verify it really happened."],
        ["It pays your bills by itself", "Within the rules you set, like max $200 a month to one vendor. That's the kicker."],
      ] as [string, string][],
    },
    proof: {
      stamp: "live on the main network", h2a: "This isn't a demo. ", h2accent: "It's running.",
      sub: "Everything in one place: a dollar account, Pix, one touch, autopilot. And the part the frontier is only writing papers about — it only pays when it's proven safe; if something looks off, it refuses. Live, not a slide. Don't trust us: open any payment and check it yourself.",
      btnReal: "See a real payment ↗", btnContract: "The live contract ↗",
    },
    pricing: {
      stamp: "pricing", h2a: "Start free. ", h2dim: "Pay when it's worth it.",
      sub: "Free to start, no card. Then a plan tailored to the size of your operation.",
      tiers: [["Starter", "to start and test"], ["Growth", "when payments grow"], ["Business", "for the whole finance team"]] as [string, string][],
      badge: "most chosen", cta: "Try it free", talk: "Talk to us",
    },
    faq: {
      stamp: "frequently asked", h2: "Still have questions?",
      items: [
        ["Is it safe to let it pay my bills?", "Yes. It decides nothing. It only executes what you approved. Before every payment it checks the recipient, the amount, and the limit. If something falls outside the rule, it stops and flags you. You can pause whenever you want."],
        ["Does SlipPay hold the money?", "Never. The money sits in a wallet that is only yours. Not even SlipPay can touch it. We handle the automation, not your money."],
        ["How does it pay without me approving every time?", "You set the rules once: how much it can spend, to whom, and how often. Within that it runs on its own. Over the limit or outside the rule, it stops immediately."],
        ["Do I need to understand crypto?", "No. You use it like any app. The blockchain is just where every payment is recorded, so you can check everything without taking our word for it."],
        ["Does it really work, or is it a prototype?", "It works. Real payments have already happened and are recorded. You verify every transaction. Not a simulation."],
        ["Can I pause or cancel?", "Anytime, in one click. The control is always yours."],
      ] as [string, string][],
    },
    cta: {
      stamp: "start", h2a: "Set it once.", h2accent: "Done.",
      sub: "Stop approving the same payments forever. Free to try, no card. The simple way to let your money work on its own.",
      btn: "Add money with Pix", see: "See it running",
      supportLabel: "support the team",
      supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars, one touch, no app.",
      supportBtn: "Support with $10 ↗",
      footer: "slippay · real dollars, on autopilot · live on mainnet",
    },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", pricing: "Preços", manifesto: "Manifesto", login: "Entrar", tryFree: "Testar grátis" },
    hero: {
      stamp: "pagamentos, no automático",
      h1a: "Seu dinheiro,", h1dim: "no", h1accent: "automático.",
      subA: "Põe dinheiro com ", subPix: "Pix", subB: " e mantém em dólar, e deixa ele pagar suas contas sozinho, na hora que vencem. ",
      subBold: "É seu, e só faz o que você permitir.",
      cta: "Põe dinheiro com Pix", ctaNote: "grátis pra começar · sem cartão · 2 minutos",
      note: "Simples como qualquer app que você já usa. Não precisa entender de cripto.",
      liveTag: "ao vivo · mainnet",
    },
    cheaper: {
      stamp: "mais barato e seguro que cartão",
      h2a: "Economize ~3% em ", h2accent: "cada transação.",
      p1a: "Cartão leva quase 3% de cada venda. Na Stellar, mover dinheiro custa frações de centavo. O SlipPay repassa essa economia pra você: ",
      p1bold: "a mesma venda, uma fração da taxa, sem estorno.",
      cardLabel: "cartão", cardSub: "por transação, e ainda sujeito a estorno",
      slipLabel: "slippay", slipVal: "uma fração", slipSub: "taxa de rede quase zero · final em segundos · sem estorno",
      p2a: "E mais seguro. Adquirente segura seu dinheiro e pode congelar sua conta. ",
      p2bold: "O SlipPay nunca segura. O dinheiro nunca sai da sua carteira, e ninguém trava.",
    },
    how: {
      stamp: "como funciona", h2a: "Como ", h2accent: "funciona.",
      steps: [
        ["Crie sua conta com um toque", "Seu rosto ou seu dedo. Sem senha, sem email, sem aquelas 12 palavras de cripto. Um toque."],
        ["Põe dinheiro com Pix", "Em segundos, como qualquer app que você já usa. Seus reais viram dólar."],
        ["O dinheiro é seu", "Fica no seu bolso, em dólar. Ninguém segura, ninguém congela, nem a gente."],
        ["Pague ou receba com um toque", "Na hora, quase de graça (uns 3% mais barato que cartão), e qualquer um confere que aconteceu de verdade."],
        ["Ele paga suas contas sozinho", "Dentro das regras que você define, tipo no máximo R$200 por mês pra um fornecedor. Esse é o pulo do gato."],
      ] as [string, string][],
    },
    proof: {
      stamp: "no ar na rede principal", h2a: "Não é demo. ", h2accent: "Está rodando.",
      sub: "Tudo num lugar só: conta em dólar, Pix, um toque, piloto automático. E o detalhe que a galera de ponta ainda só escreve paper: ele só paga se for provado que está tudo certo; se cheirar a problema, recusa. No ar de verdade, não no slide. Não precisa confiar na gente: abre qualquer pagamento e confere você mesmo.",
      btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗",
    },
    pricing: {
      stamp: "preços", h2a: "Comece grátis. ", h2dim: "Pague quando valer a pena.",
      sub: "Grátis pra começar, sem cartão. Depois, um plano do tamanho da sua operação.",
      tiers: [["Starter", "pra começar e testar"], ["Growth", "quando os pagamentos crescem"], ["Business", "pro time financeiro inteiro"]] as [string, string][],
      badge: "mais escolhido", cta: "Testar grátis", talk: "Falar com a gente",
    },
    faq: {
      stamp: "perguntas frequentes", h2: "Ainda tem dúvida?",
      items: [
        ["É seguro deixar pagar minhas contas?", "Sim. Ele não decide nada. Só executa o que você aprovou. Antes de cada pagamento confere o destino, o valor e o limite. Se fugir da regra, ele para e te avisa. Você pausa quando quiser."],
        ["O SlipPay segura o dinheiro?", "Nunca. O dinheiro fica numa carteira que é só sua. Nem o SlipPay toca. A gente cuida da automação, não do seu dinheiro."],
        ["Como ele paga sem eu aprovar toda vez?", "Você define as regras uma vez: quanto pode gastar, pra quem e com que frequência. Dentro disso ele roda sozinho. Acima do limite ou fora da regra, ele para na hora."],
        ["Preciso entender de cripto?", "Não. Você usa como qualquer app. A blockchain é só onde cada pagamento fica registrado, pra você conferir tudo sem ter que confiar na nossa palavra."],
        ["Funciona mesmo ou é protótipo?", "Funciona. Pagamentos reais já aconteceram e estão registrados. Você verifica cada transação. Não é simulação."],
        ["Posso pausar ou cancelar?", "Quando quiser, num clique. O controle é sempre seu."],
      ] as [string, string][],
    },
    cta: {
      stamp: "comece", h2a: "Configure uma vez.", h2accent: "Pronto.",
      sub: "Pare de aprovar os mesmos pagamentos pra sempre. Grátis pra testar, sem cartão. O jeito simples de deixar seu dinheiro trabalhar sozinho.",
      btn: "Põe dinheiro com Pix", see: "Ver rodando",
      supportLabel: "apoie o time",
      supportText: "Feito sozinho no Brasil. Se ganhou teu respeito, manda uns dólares, um toque, sem app.",
      supportBtn: "Apoiar com $10 ↗",
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const s = localStorage.getItem("slippay.lang");
      if (s === "pt" || s === "en") return s;
    } catch { /* ignore */ }
    return (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) ? "pt" : "en";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* ignore */ } }, [lang]);
  const t = COPY[lang];
  const NAV: [string, string][] = [[t.nav.gate, "/gate"], [t.nav.security, "/security"], [t.nav.live, "/cockpit"], [t.nav.pay, "/pay"], [t.nav.receive, "/cobrar"], [t.nav.pricing, "#pricing"], [t.nav.manifesto, "/manifesto"], [t.nav.login, "/account"]];

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
      <button onClick={() => setLang("pt")} className={lang === "pt" ? "text-[#FDDA24]" : "hover:opacity-80"}>PT</button>
      <span className="opacity-30 mx-1">/</span>
      <button onClick={() => setLang("en")} className={lang === "en" ? "text-[#FDDA24]" : "hover:opacity-80"}>EN</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <style>{`
        html { scroll-behavior: smooth; }
        ::selection { background: #FDDA24; color: #0a0a0a; }
        section[id] { scroll-margin-top: 1.5rem; }
        section h2 { text-wrap: balance; }
      `}</style>
      <header className="relative px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay</Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          {NAV.map(([label, href]) => (
            href.startsWith("#")
              ? <a key={href} href={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</a>
              : <Link key={href} to={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</Link>
          ))}
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
            {NAV.map(([label, href]) => (
              href.startsWith("#")
                ? <a key={href} href={href} onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">{label}</a>
                : <Link key={href} to={href} onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">{label}</Link>
            ))}
            <div className="py-3 border-b border-[#0a0a0a]/8"><LangToggle /></div>
            <Link to="/account" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#0a0a0a] text-[#f1eee7]">{t.nav.tryFree}</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="px-6 md:px-12 pt-10 md:pt-16 pb-24 md:pb-36">
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center">
          <Index n="001" label={t.hero.stamp} />
          <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,8.5rem)] break-words mx-auto" style={display}>
            {t.hero.h1a}<br /><span className="text-[#0a0a0a]/30">{t.hero.h1dim}</span> <span className="text-[#0a0a0a]">{t.hero.h1accent}</span>
          </h1>
          <p className="mt-10 text-xl md:text-2xl leading-relaxed max-w-[46ch] mx-auto text-[#0a0a0a]/75">
            {t.hero.subA}<span className="text-[#0a0a0a] font-medium">{t.hero.subPix}</span>{t.hero.subB}
            <span className="text-[#0a0a0a] font-medium">{t.hero.subBold}</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">{t.hero.cta}</Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/40">{t.hero.ctaNote}</span>
          </div>
          <p className="mt-6 text-[15px] text-[#0a0a0a]/50 max-w-[44ch] mx-auto">{t.hero.note}</p>
          <div className="mt-14 w-full max-w-[420px] mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-4">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-8">
          <LiveProof prominent lang={lang} />
        </div>
      </section>

      {/* CHEAPER */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="002" label={t.cheaper.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.5rem,8vw,6.5rem)] max-w-[15ch] mx-auto break-words" style={display}>
            {t.cheaper.h2a}<span className="text-[#0a0a0a]">{t.cheaper.h2accent}</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/60">
            {t.cheaper.p1a}<span className="text-[#0a0a0a] font-medium">{t.cheaper.p1bold}</span>
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 max-w-[680px] mx-auto text-left">
            <div className="bg-white p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.cheaper.cardLabel}</div>
              <div className="mt-4 text-4xl font-semibold tabular-nums tracking-[-0.03em]" style={display}><CountUp to={2.9} format={(n) => `~${n.toFixed(1)}%+`} /></div>
              <div className="mt-2 text-[14px] text-[#0a0a0a]/55 leading-snug">{t.cheaper.cardSub}</div>
            </div>
            <div className="bg-[#0a0a0a] text-[#f1eee7] p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#FDDA24]">{t.cheaper.slipLabel}</div>
              <div className="mt-4 text-4xl font-semibold tracking-[-0.03em]" style={display}>{t.cheaper.slipVal}</div>
              <div className="mt-2 text-[14px] text-[#f1eee7]/60 leading-snug">{t.cheaper.slipSub}</div>
            </div>
          </div>
          <p className="mt-10 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#0a0a0a]/60">
            {t.cheaper.p2a}<span className="text-[#0a0a0a] font-medium">{t.cheaper.p2bold}</span>
          </p>
        </div>
      </section>

      {/* HOW IT WORKS (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1200px] mx-auto px-6 md:px-12 py-24 md:py-40 text-center">
          <Index n="003" label={t.how.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,9vw,7rem)]" style={display}>
            {t.how.h2a}<span className="text-[#FDDA24]">{t.how.h2accent}</span>
          </h2>
          <div className="mt-16 max-w-[760px] mx-auto text-left flex flex-col gap-10 md:gap-12">
            {t.how.steps.map(([h, b], i) => (
              <div key={i} className="flex gap-5 md:gap-7 items-baseline">
                <span className="font-mono text-[13px] text-[#FDDA24] shrink-0 w-8">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="text-2xl md:text-3xl font-semibold tracking-[-0.02em]" style={display}>{h}</div>
                  <p className="mt-2 text-[16px] md:text-[17px] text-[#f1eee7]/60 leading-relaxed max-w-[54ch]">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROOF (dark) */}
      <section id="proof" className="bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-40 flex flex-col items-center text-center">
          <Index n="004" label={t.proof.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,10vw,8.5rem)] max-w-[14ch] mx-auto break-words" style={display}>
            {t.proof.h2a}<span className="text-[#FDDA24]">{t.proof.h2accent}</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[52ch] mx-auto text-[#f1eee7]/65">{t.proof.sub}</p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a]">{t.proof.btnReal}</a>
            <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/60 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">{t.proof.btnContract}</a>
          </div>
          <div className="mt-12 w-full max-w-[440px] mx-auto text-left">
            <MandateDemo />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-[#0a0a0a]/12">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="005" label={t.pricing.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[18ch] mx-auto break-words" style={display}>
            {t.pricing.h2a}<span className="text-[#0a0a0a]/35">{t.pricing.h2dim}</span>
          </h2>
          <p className="mt-8 text-xl leading-relaxed max-w-[50ch] mx-auto text-[#0a0a0a]/60">{t.pricing.sub}</p>
          <div className="mt-14 grid md:grid-cols-3 gap-8 text-left">
            {t.pricing.tiers.map(([name, who], i) => (
              <div key={name} className={`py-8 ${i === 1 ? "border-t-2 border-[#A16207]" : "border-t border-[#0a0a0a]/15"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold tracking-[-0.01em]" style={display}>{name}</span>
                  {i === 1 && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#0a0a0a]">{t.pricing.badge}</span>}
                </div>
                <div className="mt-3 text-[15px] text-[#0a0a0a]/55">{who}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            <Link to="/account" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">{t.pricing.cta}</Link>
            <a href="/signup" className="text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-1">{t.pricing.talk}</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#0a0a0a]/12">
        <div data-reveal className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <Index n="006" label={t.faq.stamp} />
          <h2 className="mt-10 font-bold tracking-[-0.04em] leading-[0.9] text-[clamp(2.25rem,7vw,5.5rem)] max-w-[14ch] mx-auto break-words" style={display}>{t.faq.h2}</h2>
          <div className="mt-12 max-w-[900px] mx-auto text-left">
            {t.faq.items.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <div key={i} className="border-t border-[#0a0a0a]/12 last:border-b">
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

      {/* CTA (dark) */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-28 md:py-48 text-center">
          <Index n="007" label={t.cta.stamp} dark />
          <h2 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(3rem,12vw,11rem)] mx-auto break-words" style={display}>
            {t.cta.h2a}<br /><span className="text-[#FDDA24]">{t.cta.h2accent}</span>
          </h2>
          <p className="mt-10 text-xl md:text-2xl text-[#f1eee7]/60 max-w-[44ch] mx-auto">{t.cta.sub}</p>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-7">
            <Link to="/account" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#FDDA24] text-[#0a0a0a]">{t.cta.btn}</Link>
            <a href="#proof" className="text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/55 hover:text-[#f1eee7] border-b border-[#f1eee7]/25 pb-1">{t.cta.see}</a>
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
