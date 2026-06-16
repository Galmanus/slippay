// Landing — "global money in one tap." USDC-explicit, compliance-careful copy.
// Warm bone, ink text, GRAY accent (#6f6862), yellow as details + ALL CTAs yellow
// (#FDDA24), yellow keyword marker + logo dot. Bilingual PT/EN (persisted toggle).

import { Link } from "react-router-dom";
import { Fragment, useEffect, useState } from "react";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";

const display = { fontFamily: "'DM Sans', sans-serif" } as const;
const GRAY = "#6f6862";
const LIVE_CONTRACT = "CCT3KJXRUO3HJJ2GLTW2MISSQVUEKOPUG3B4YQH75TCGKAOC4P6FIKUF";
const REAL_TX = "ede13fb6230334af91b2af1cfab92f86f8f44e8a7755acb57d92891d68a3e957";
const TEAM_USDC = "GCEYFLGNHCW4EIEX5LAVYGIGPT2KLHHVB6EOUWKKALA2FT7RMCHI242P";
const xurl = (p: string, id: string) => `https://stellar.expert/explorer/public/${p}/${id}`;
type Lang = "pt" | "en";

const COPY = {
  en: {
    nav: { gate: "The gate", security: "Security", live: "Live", pay: "Pay", receive: "Receive", investors: "Investors", manifesto: "Manifesto", login: "Login", tryFree: "Get started" },
    hero: {
      eyebrow: "live on mainnet",
      h1l1: "Your dollars, in Pix.", h1l2: "",
      sub: "Your smart dollar vault that pays your bills on its own, by your rules. Nobody takes it, nobody freezes it. It's money that's truly yours.",
      reassure: "No wires. No delays. Just instant conversion from local money to global dollars.",
      cta: "Get started", note: "2 minutes • biometrics • no card • self-custody support",
      cred: "Powered by USDC · Real-time settlement rails · Non-custodial architecture",
      micro: "Built on stablecoin infrastructure and real payment rails in Brazil.",
      liveTag: "live · mainnet",
    },
    simple: { stamp: "in plain words", h: "Simple as that.",
      beats: [
        ["🐷", "You put money in with one touch of your finger, like unlocking your phone. Only your finger opens it. No one else."],
        ["💵", "You put in reais and, like magic, it becomes dollars. The dollars stay inside your piggy bank, not in a bank. It's yours, in your hand."],
        ["🤖", "The piggy bank is smart: you teach it the rules once. “You can pay Maria, max 10 a month.” Then it pays on its own. But if someone tries to take more, or pay someone you didn't allow, it locks instantly. It never breaks your rule."],
        ["✨", "And the best part: all of it in seconds. No asking the bank. No waiting. No paperwork."],
      ] as [string, string][],
      close: "That's SlipPay: a dollar piggy bank that opens with your finger and pays on its own, only the way you told it to." },
    why: { stamp: "why", items: [
      ["Pix → USDC in ~10s", "Send reais, get digital dollars in your wallet in seconds. No bank in between."],
      ["Only your finger moves it", "A passkey on your device signs every payment. No password, no seed phrase, no one else."],
      ["It pays on its own", "Set the rules once — who, how much, how often. It runs, and never outside your rules."],
      ["~2% vs ~5%", "A bank or dollar account costs ~5% to turn reais into dollars (IOF + spread). Here it's ~1.9% — the rest stays yours."],
    ] as [string, string][] },
    how: { stamp: "how it works", h: "From Pix to USDC.", steps: [
      ["Send Pix", "You pay in reais as usual."],
      ["Convert to USDC", "Liquidity rails exchange BRL → USDC."],
      ["Receive in wallet", "USDC arrives in your wallet, ready to use globally."],
    ] as [string, string][] },
    onetap: { stamp: "one tap", h: "One-tap experience.", lines: ["Authenticate → confirm → done.", "Your USDC balance updates instantly."] },
    prog: { stamp: "on autopilot", h: "It pays on its own.", intro: "Set it once. It handles the rest.", steps: [
      ["Teach the rule", "Who can be paid, the cap, how often — e.g. 'pay Maria, up to R$500/month'."],
      ["It pays on time", "Automatically, on the right date, without you opening the app."],
      ["Breaks the rule? It locks", "A bigger amount or an address you didn't allow is blocked instantly. It never breaks your rule."],
    ] as [string, string][], fail: "If it doesn't match your rules, it doesn't execute.", gateLink: "How the gate works →" },
    rails: { stamp: "the rails", h: "Built on modern rails.", lines: ["Powered by stablecoins, blockchain settlement, and FX liquidity providers.", "You see the result. Not the infrastructure."] },
    proof: { stamp: "real transactions", h: "Real transactions.", lines: ["Live, verifiable blockchain transfers."], shots: ["your account · mainnet", "confirm with a touch", "verified on-chain receipt"], btnReal: "See a real payment ↗", btnContract: "The live contract ↗" },
    compare: { stamp: "head to head", h: "Best at the 5 that matter.", sub: "From the world's biggest banks to fintechs — every way to hold dollars, side by side.", competitors: ["Slippay", "JPMorgan", "BofA", "Citi", "Stripe", "Nomad", "Avenue", "Wise", "Nubank", "Inter", "C6"], rows: [
      ["Your money, never frozen", [true, false, false, false, false, false, false, false, false, false, false]],
      ["No cap on what you keep", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Pays your bills on its own", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Real dollars in your hands", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Total cost (with IOF)", ["~1.9%", "~7%", "~7%", "~7%", "~4%", "~5.5%", "~6%", "~4.3%", "~3.5%", "~4.5%", "~4.4%"]],
    ] as [string, (boolean | string)[]][], score: "5 × 0", taunts: ["too easy.", "next.", "no contest.", "not even close.", "didn't even compete.", "bye.", "sit down.", "0 to 5, every time."] },
    pain: { stamp: "the real pain", h: "Holding dollars hurts today.", points: [["You lose ~5% just to get in", "3.5% IOF plus the bank's spread, on every single conversion."], ["And the money isn't yours", "A custodial account — from banks to Stripe to Nomad — can freeze, block, or hold it."]] as [string, string][], close: "Slippay kills both: ~1.9% with no IOF, and nobody freezes it. It's yours, in your hands." },
    b2b: { stamp: "for companies", h: "We build the agent that runs your company's money.", body: "We build the AI agents that pay your suppliers, bills and payroll for you — with the spend limit proven on-chain. The agent works on its own, within your rules, and even if it's compromised it can't overspend or divert a cent.", cta: "See the engineering →" },
    notbank: { stamp: "not a bank", h: "Not a bank.", lead: "A global money layer built on USDC:", items: ["fast BRL → stablecoin conversion", "global transfers", "user-controlled automation"] },
    faq: { stamp: "questions", h: "Before you ask.", items: [
      ["How much can I keep?", "As much as you want. The money lives in your wallet, in your hands — Slippay never holds it, so there's no cap on our side. Putting in larger amounts via Pix just takes a few extra verification steps, like any account."],
      ["I have a large amount. Can I use it?", "Yes. The money stays in self-custody — in your wallet, never ours — so there's no cap to hold and nothing freezes. For large deposits and withdrawals, the conversion routes through a Banco Central–licensed partner, with KYC, FX compliance, and the documentation the tax authority requires."],
      ["Can I withdraw in dollars?", "Yes. The balance is real dollars (USDC) and it's yours. Send it, spend it, or move it to any wallet that accepts USDC, anytime. Nothing is locked."],
      ["Can I transfer to another account?", "Yes, instantly, to any address, in seconds. Your biometrics sign it, no one else."],
      ["And the fees?", "No monthly fee, no hidden charges. The Pix → dollar conversion costs ~1.9% — versus ~5% at a bank or dollar account (3.5% IOF plus spread). Moving money on-chain costs cents."],
    ] as [string, string][] },
    cta: { stamp: "start", h: "Start now.", lines: ["Move from Pix to USDC in seconds.", "Hold, send, or automate — your choice."], btn: "Get started", note: "No card • 2 minutes • biometrics",
      supportLabel: "support the team", supportText: "Built solo in Brazil. If this earned your respect, send us a few dollars, one touch, no app.", supportBtn: "Support with $10 ↗", footer: "slippay · global money, in one tap · live on mainnet" },
  },
  pt: {
    nav: { gate: "O gate", security: "Segurança", live: "Ao vivo", pay: "Pagar", receive: "Receber", investors: "Investidores", manifesto: "Manifesto", login: "Entrar", tryFree: "Começar" },
    hero: {
      eyebrow: "live on mainnet",
      h1l1: "Seus dólares, no Pix.", h1l2: "",
      sub: "Seu cofre inteligente em dólar que paga suas contas sozinho, pelas suas regras. Ninguém toma, ninguém congela. É dinheiro que é seu de verdade.",
      reassure: "Sem transferências internacionais. Sem atrasos. Só conversão instantânea de moeda local pra dólares globais.",
      cta: "Começar", note: "2 minutos • biometria • sem cartão • suporte a autocustódia",
      cred: "Movido por USDC · Liquidação em tempo real · Arquitetura não-custodial",
      micro: "Construído sobre infraestrutura de stablecoin e rails de pagamento reais no Brasil.",
      liveTag: "ao vivo · mainnet",
    },
    simple: { stamp: "em palavras simples", h: "Simples assim.",
      beats: [
        ["🐷", "Você bota dinheiro com um toque do dedo, igual quando aperta o dedão pra abrir o celular. Só o seu dedo abre. Mais ninguém."],
        ["💵", "Você coloca real e, num passe de mágica, vira dólar. O dólar fica guardado dentro do seu cofrinho, não no banco. É seu, na sua mão."],
        ["🤖", "O cofrinho é espertinho: você ensina as regras uma vez. “Pode pagar a Maria, no máximo 10 por mês.” Aí ele paga sozinho. Mas se alguém tentar tirar mais, ou pagar pra quem você não disse, ele trava na hora. Nunca quebra a sua regra."],
        ["✨", "E o melhor: tudo isso em segundos. Sem pedir pro banco. Sem esperar. Sem papelada."],
      ] as [string, string][],
      close: "É isso o SlipPay: um cofrinho de dólar que abre com o seu dedo e paga sozinho, só do jeito que você mandou." },
    why: { stamp: "por quê", items: [
      ["Pix → USDC em ~10s", "Manda real, recebe dólar digital na carteira em segundos. Sem banco no meio."],
      ["Só o seu dedo move", "Uma passkey no seu aparelho assina cada pagamento. Sem senha, sem seed phrase, mais ninguém."],
      ["Ele paga sozinho", "Defina as regras uma vez — quem, quanto, com que frequência. Roda, e nunca fora das suas regras."],
      ["~2% contra ~5%", "Num banco ou conta em dólar, virar real em dólar custa ~5% (IOF + spread). Aqui é ~1,9% — o resto fica com você."],
    ] as [string, string][] },
    how: { stamp: "como funciona", h: "Do Pix ao USDC.", steps: [
      ["Faça um Pix", "Você paga em reais, como sempre."],
      ["Converte pra USDC", "Rails de liquidez trocam BRL → USDC."],
      ["Recebe na carteira", "O USDC chega na sua carteira, pronto pra usar no mundo todo."],
    ] as [string, string][] },
    onetap: { stamp: "um toque", h: "Experiência de um toque.", lines: ["Autentique → confirme → pronto.", "Seu saldo em USDC atualiza na hora."] },
    prog: { stamp: "no automático", h: "Ele paga sozinho.", intro: "Você manda uma vez. Ele cuida do resto.", steps: [
      ["Ensine a regra", "Quem pode receber, o teto e a frequência — ex.: 'pode pagar a Maria, até R$500 por mês'."],
      ["Ele paga no prazo", "No automático, na data certa, sem você abrir o app."],
      ["Fugiu da regra? Trava", "Valor maior ou um recebedor que você não autorizou é bloqueado na hora. Nunca quebra a sua regra."],
    ] as [string, string][], fail: "Se não bater com as suas regras, não executa.", gateLink: "Como o gate funciona →" },
    rails: { stamp: "os rails", h: "Construído em rails modernos.", lines: ["Movido por stablecoins, liquidação em blockchain e provedores de liquidez de câmbio.", "Você vê o resultado. Não a infraestrutura."] },
    proof: { stamp: "transações reais", h: "Transações reais.", lines: ["Transferências em blockchain, ao vivo e verificáveis."], shots: ["sua conta · mainnet", "confirmar com um toque", "comprovante verificado on-chain"], btnReal: "Ver um pagamento real ↗", btnContract: "O contrato no ar ↗" },
    compare: { stamp: "frente a frente", h: "Melhor nas 5 que importam.", sub: "Dos maiores bancos do mundo às fintechs — toda forma de guardar dólar, lado a lado.", competitors: ["Slippay", "JPMorgan", "BofA", "Citi", "Stripe", "Nomad", "Avenue", "Wise", "Nubank", "Inter", "C6"], rows: [
      ["O dinheiro é seu, nunca congela", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Sem teto pra guardar", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Paga suas contas sozinho", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Dólar de verdade na sua mão", [true, false, false, false, false, false, false, false, false, false, false]],
      ["Custo total (com IOF)", ["~1,9%", "~7%", "~7%", "~7%", "~4%", "~5,5%", "~6%", "~4,3%", "~3,5%", "~4,5%", "~4,4%"]],
    ] as [string, (boolean | string)[]][], score: "5 × 0", taunts: ["fácil.", "próximo.", "sem chance.", "nem perto.", "nem competiu.", "tchau.", "senta lá.", "0 a 5, toda vez."] },
    pain: { stamp: "a dor real", h: "Ter dólar dói hoje.", points: [["Você perde ~5% só pra entrar", "IOF de 3,5% mais o spread do banco, toda vez que vira dólar."], ["E o dinheiro não é seu", "Conta custodiada — do banco à Stripe à Nomad — pode congelar, bloquear, segurar."]] as [string, string][], close: "A Slippay mata as duas: ~1,9% sem IOF, e ninguém congela. É seu, na sua mão." },
    b2b: { stamp: "pra empresas", h: "Criamos o agente que cuida do dinheiro da sua empresa.", body: "Nós construímos os agentes de IA que pagam seus fornecedores, contas e folha por você — com o limite de gasto provado on-chain. O agente trabalha sozinho, dentro das suas regras, e mesmo comprometido não consegue gastar além nem desviar um centavo.", cta: "Ver a engenharia →" },
    notbank: { stamp: "não é um banco", h: "Não é um banco.", lead: "Uma camada global de dinheiro construída sobre USDC:", items: ["conversão rápida BRL → stablecoin", "transferências globais", "automação controlada por você"] },
    faq: { stamp: "perguntas", h: "Antes de perguntar.", items: [
      ["Quanto posso guardar?", "Quanto você quiser. O dinheiro fica na sua carteira, na sua mão — a Slippay nunca segura ele, então não tem teto da nossa parte. Pra colocar valores altos via Pix, são só alguns passos a mais de verificação, como em qualquer conta."],
      ["Tenho um valor alto. Posso usar?", "Pode. O dinheiro fica em autocustódia — na sua carteira, nunca na nossa — então não há teto pra guardar e nada congela. Para entradas e saídas grandes, a conversão passa por um parceiro licenciado pelo Banco Central, com KYC, câmbio em conformidade e a documentação que a Receita pede."],
      ["Posso sacar em dólar?", "Pode. O saldo é dólar de verdade (USDC) e é seu. Envie, gaste ou leve pra qualquer carteira que aceite USDC, a qualquer hora. Nada fica preso."],
      ["Posso transferir pra outra conta?", "Pode, na hora, pra qualquer endereço, em segundos. Quem assina é a sua biometria, mais ninguém."],
      ["E as taxas?", "Sem mensalidade, sem tarifa escondida. A conversão Pix → dólar custa ~1,9% — contra ~5% num banco ou conta em dólar (3,5% de IOF mais o spread). Mover o dinheiro on-chain custa centavos."],
    ] as [string, string][] },
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
  // Comparison carousel — the competitor column cycles through indices 1..N-1
  // (index 0 is Slippay, always pinned). Re-keying the column replays cmp-swap.
  const [cmpIdx, setCmpIdx] = useState(1);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const n = COPY[lang].compare.competitors.length;
    const id = setInterval(() => setCmpIdx((i) => (i % (n - 1)) + 1), 2300);
    return () => clearInterval(id);
  }, [lang]);
  const cmpN = t.compare.competitors.length;
  const ci = ((cmpIdx - 1) % (cmpN - 1)) + 1;
  // consumer-first nav (who the landing speaks to). Institutional/technical links
  // (gate, live, investors, manifesto) move to the footer so the IA picks a lane.
  const NAV: [string, string][] = [[t.nav.security, "/security"], [t.nav.pay, "/pay"], [t.nav.receive, "/cobrar"], [t.nav.login, "/account"]];
  const NAV_MORE: [string, string][] = [[t.nav.gate, "/gate"], [t.nav.investors, "/investors"], [t.nav.manifesto, "/manifesto"]];

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
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#f1eee7]/85 border-b border-[#0a0a0a]/8 px-6 md:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl md:text-3xl tracking-[-0.02em] lowercase" style={{ fontFamily: "'Rounded', 'DM Sans', sans-serif" }}>slippay<span className="text-[#FDDA24]">.</span></Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          {NAV.map(([label, href]) => <Link key={href} to={href} className="hidden md:inline hover:text-[#0a0a0a]">{label}</Link>)}
          <Link to="/builders" className="hidden md:inline hover:text-[#0a0a0a]">Builders</Link>
          <a href="https://slippay.gitbook.io/slippay-docs" target="_blank" rel="noreferrer" className="hidden md:inline hover:text-[#0a0a0a]">Docs</a>
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
            <Link to="/builders" onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">Builders</Link>
            <a href="https://slippay.gitbook.io/slippay-docs" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">Docs</a>
            <div className="py-3 border-b border-[#0a0a0a]/8"><LangToggle /></div>
            <Link to="/account" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#FDDA24] text-[#0a0a0a]">{t.nav.tryFree}</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="px-6 md:px-12 pt-12 md:pt-16 pb-16 md:pb-24">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          {/* left: text */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            {t.hero.eyebrow && (
              <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#0a0a0a]/30 mb-5">{t.hero.eyebrow}</div>
            )}
            <h1 className="font-bold uppercase tracking-[-0.04em] leading-[0.95] text-[clamp(2rem,6vw,4.5rem)] max-w-[15ch] [text-wrap:balance]" style={display}>
              {t.hero.h1l1}
            </h1>
            {(t.hero.sub as string).length > 0 && (
              <p className="mt-8 text-2xl md:text-3xl leading-snug max-w-[26ch]" style={display}>
                {(t.hero.sub as string).split("USDC").flatMap((part, i) => i === 0 ? [part] : [<span key={i} style={mark}>USDC</span>, part])}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-6">
              <Link
                to="/account"
                className={btn}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - r.left - r.width / 2;
                  const y = e.clientY - r.top - r.height / 2;
                  e.currentTarget.style.transform = `translate(${x * 0.22}px, ${y * 0.4}px)`;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
              >{t.hero.cta}</Link>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0a0a0a]/40">{t.hero.note}</span>
            </div>
            <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: GRAY }}>{t.hero.cred}</div>
            <p className="mt-2 text-[13px] text-[#0a0a0a]/45 max-w-[44ch]">{t.hero.micro}</p>
          </div>
          {/* right: live product card — proof, not a drawing */}
          <div className="w-full max-w-[440px] mx-auto md:mx-0 md:justify-self-end">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 mb-3 text-center">{t.hero.liveTag}</div>
            <LivePaymentCard />
          </div>
        </div>
      </section>

      {/* IN PLAIN WORDS — the soul */}
      <section className={sec}><div data-reveal className="max-w-[860px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <div className="text-center"><Index n="·" label={t.simple.stamp} /></div>
        <h2 className="mt-10 text-center font-bold tracking-[-0.04em] leading-[0.95] text-[clamp(2rem,6vw,3.75rem)] max-w-[20ch] mx-auto" style={display}>{t.simple.h}</h2>
        <div className="mt-12 flex flex-col gap-7 max-w-[640px] mx-auto">
          {t.simple.beats.map(([, text], i) => (
            <div key={i} className="flex gap-4 items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FDDA24] shrink-0 mt-2.5" />
              <p className="text-lg md:text-xl leading-relaxed text-[#0a0a0a]/75">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-xl md:text-2xl font-medium tracking-[-0.02em] max-w-[42ch] mx-auto" style={display}>{t.simple.close}</p>
      </div></section>

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
        <p className="mt-6 text-lg md:text-xl text-[#0a0a0a]/60 max-w-[34ch]">{t.prog.intro}</p>
        <div className="mt-12 grid sm:grid-cols-3 gap-8 md:gap-10 max-w-[920px] text-left">
          {t.prog.steps.map(([h, b], i) => (
            <div key={i}>
              <div className="font-mono text-[11px] tracking-[0.2em] text-[#FDDA24]">0{i + 1}</div>
              <div className="mt-2 font-bold text-lg" style={display}>{h}</div>
              <p className="mt-1.5 text-[#0a0a0a]/60 leading-relaxed">{b}</p>
            </div>
          ))}
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
        {/* real product screenshots — account, pay, on-chain receipt */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-6 items-start max-w-[820px] mx-auto">
          {["/proof/account.jpg", "/proof/pay.jpg", "/proof/receipt.jpg"].map((src, i) => (
            <figure key={src} className="group">
              <div className="rounded-2xl overflow-hidden border border-[#0a0a0a]/10 bg-[#f1eee7] shadow-[0_24px_60px_-24px_rgba(10,10,10,0.35)] transition-transform duration-300 group-hover:-translate-y-1">
                <img src={src} alt={t.proof.shots[i]} loading="lazy" className="w-full h-auto block" />
              </div>
              <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/45">{t.proof.shots[i]}</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
          <a href={xurl("tx", REAL_TX)} target="_blank" rel="noreferrer" className={btn}>{t.proof.btnReal}</a>
          <a href={xurl("contract", LIVE_CONTRACT)} target="_blank" rel="noreferrer" className="text-[12px] uppercase tracking-[0.18em] border-b border-[#0a0a0a]/20 hover:border-[#0a0a0a] pb-1" style={{ color: GRAY }}>{t.proof.btnContract}</a>
        </div>
      </div></section>

      {/* THE REAL PAIN — sets up the comparison */}
      <section className={sec}><div data-reveal className="max-w-[860px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <div className="text-center"><Index n="·" label={t.pain.stamp} /></div>
        <h2 className="mt-10 text-center font-bold tracking-[-0.04em] leading-[0.95] text-[clamp(2rem,6vw,3.75rem)] max-w-[18ch] mx-auto" style={display}>{t.pain.h}</h2>
        <div className="mt-12 grid sm:grid-cols-2 gap-8 md:gap-10 max-w-[700px] mx-auto text-left">
          {t.pain.points.map(([h, b], i) => (
            <div key={i}>
              <div className="font-bold text-lg md:text-xl" style={display}>{h}</div>
              <p className="mt-2 text-[#0a0a0a]/60 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-xl md:text-2xl font-medium tracking-[-0.02em] max-w-[34ch] mx-auto" style={display}>{t.pain.close}</p>
      </div></section>

      {/* COMPARISON — best at the 5 that matter */}
      <section className={sec}><div data-reveal className="max-w-[820px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <div className="text-center"><Index n="·" label={t.compare.stamp} /></div>
        <h2 className="mt-10 text-center font-bold tracking-[-0.04em] leading-[0.95] text-[clamp(2rem,6vw,3.75rem)] max-w-[18ch] mx-auto" style={display}>{t.compare.h}</h2>
        <p className="mt-4 text-center text-[#0a0a0a]/55 max-w-[46ch] mx-auto">{t.compare.sub}</p>
        {/* deboche scoreboard — Slippay curb-stomps each one, 5 × 0 */}
        <div className="mt-6 flex items-center justify-center gap-3 font-mono text-[12px] sm:text-[13px] uppercase tracking-[0.16em]">
          <span className="font-bold text-[#0a0a0a]">Slippay</span>
          <span className="px-2.5 py-1 bg-[#0a0a0a] text-[#FDDA24] font-bold rounded">{t.compare.score}</span>
          <span key={`vs${ci}`} className="cmp-swap text-[#0a0a0a]/45">{t.compare.competitors[ci]}</span>
        </div>
        <div key={`tt${ci}`} className="cmp-swap mt-2 text-center text-base sm:text-lg italic text-[#0a0a0a]/55" style={display}>{t.compare.taunts[(ci - 1) % t.compare.taunts.length]}</div>
        <div className="mt-6 max-w-[600px] mx-auto rounded-2xl border border-[#0a0a0a]/12 overflow-hidden">
          <div className="grid grid-cols-[1fr_4.5rem_5.5rem] sm:grid-cols-[1fr_7rem_8rem]">
            {/* header */}
            <div className="bg-[#0a0a0a]/[0.03]" />
            <div className="bg-[#FDDA24] px-2 py-4 text-center font-bold text-[12px] sm:text-[13px] uppercase tracking-[0.07em]">{t.compare.competitors[0]}</div>
            <div key={`h${ci}`} className="cmp-swap bg-[#0a0a0a]/[0.03] px-2 py-4 text-center font-bold text-[12px] sm:text-[13px] uppercase tracking-[0.07em] text-[#0a0a0a]/45">{t.compare.competitors[ci]}</div>
            {/* rows */}
            {t.compare.rows.map(([label, cells], ri) => {
              const draw = (val: boolean | string, slip: boolean) =>
                typeof val === "boolean"
                  ? (val ? <span className="text-[#0a0a0a] text-xl leading-none">✓</span> : <span className="text-[#0a0a0a]/25 text-lg">✗</span>)
                  : <span className={`text-[13px] sm:text-sm ${slip ? "font-bold text-[#0a0a0a]" : "text-[#0a0a0a]/55"}`}>{val}</span>;
              return (
                <Fragment key={ri}>
                  <div className={`px-4 py-4 text-[13px] sm:text-[15px] flex items-center ${ri % 2 ? "bg-[#0a0a0a]/[0.02]" : ""}`} style={display}>{label}</div>
                  <div className="px-2 py-4 flex items-center justify-center bg-[#FDDA24]/[0.16]">{draw(cells[0] ?? false, true)}</div>
                  <div key={`c${ci}-${ri}`} className={`cmp-swap px-2 py-4 flex items-center justify-center ${ri % 2 ? "bg-[#0a0a0a]/[0.02]" : ""}`}>{draw(cells[ci] ?? false, false)}</div>
                </Fragment>
              );
            })}
          </div>
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

      {/* FOR COMPANIES — B2B agent + security layer (no prices) */}
      <section className={sec}><div data-reveal className="max-w-[860px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <div className="text-center"><Index n="·" label={t.b2b.stamp} /></div>
        <h2 className="mt-10 text-center font-bold tracking-[-0.04em] leading-[0.95] text-[clamp(2rem,6vw,3.75rem)] max-w-[20ch] mx-auto" style={display}>{t.b2b.h}</h2>
        <p className="mt-6 text-center text-lg md:text-xl text-[#0a0a0a]/65 max-w-[52ch] mx-auto leading-relaxed">{t.b2b.body}</p>
        <div className="mt-10 text-center"><Link to="/builders" className={btn}>{t.b2b.cta}</Link></div>
      </div></section>

      {/* FAQ — remove objections */}
      <section className={sec}><div data-reveal className="max-w-[820px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <div className="text-center"><Index n="·" label={t.faq.stamp} /></div>
        <h2 className="mt-10 text-center font-bold tracking-[-0.04em] leading-[0.95] text-[clamp(2rem,6vw,3.75rem)]" style={display}>{t.faq.h}</h2>
        <div className="mt-12 max-w-[680px] mx-auto flex flex-col">
          {t.faq.items.map(([q, a], i) => (
            <div key={i} className="border-t border-[#0a0a0a]/12 py-7">
              <div className="text-xl md:text-2xl font-semibold tracking-[-0.02em]" style={display}>{q}</div>
              <p className="mt-2 text-[16px] md:text-[17px] leading-relaxed text-[#0a0a0a]/60 max-w-[60ch]">{a}</p>
            </div>
          ))}
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
        <div className="mt-16 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/45">
          {NAV_MORE.map(([label, href]) => <Link key={href} to={href} className="hover:text-[#0a0a0a]">{label}</Link>)}
        </div>
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-[#0a0a0a]/30">{t.cta.footer}</div>
      </div></section>
    </div>
  );
}
