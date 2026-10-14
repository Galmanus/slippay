// Agents — the AI-agent wallet on Arc. Same identity system as the landing
// (Inter, monumental caps, mono index labels, Klein blue #002FA7; #5B82FF on dark).
// Every claim maps to a live AgentVault feature (contracts-evm/src/AgentVault.sol);
// the proof links are the real Arc testnet transactions recorded in
// contracts-evm/README.md. Plain words first, the technical name in mono after.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const display = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" } as const;
const GRAY = "#6f6862";
const tx = (h: string) => `https://explorer.testnet.arc.io/tx/${h}`;
type Lang = "pt" | "en";

// Arc testnet, 2026-10-13 (contracts-evm/README.md).
const PROOFS = {
  deploy: "0x01d19dde48353526b67677fbf41bc54c40d394c1db8ac5fb2f5f921de797211a",
  identity: "0xa30b233af756a1f27310ddad8fc66cb96a1454bf170836530ac01dac2e3e7ea9",
  session: "0x6f0fed429f3e8653cbe6614f4a14892eea938c4e0f929d562d82c7074a75d71e",
  spend: "0x8cb9df02fc39a4733f861ae30c22a2cc783806a6e2de44832d1fe50427aa5bbb",
  spendPq: "0x4c10777d86b8093d26e01905de7e4ce203912dd1e731989f27cd427f52ee9691",
} as const;

const COPY = {
  pt: {
    back: "Início", open: "Abrir conta",
    hero: {
      eyebrow: "carteira de agente · na Arc",
      h1: "Dólar pro seu agente. Com limite.",
      sub: "Cada agente de IA ganha uma sub-carteira em dólar (USDC na Arc), com identidade própria e um limite que ele não consegue passar, nem se for enganado.",
      cta: "Conectar um agente", proof: "Ver um pagamento real (rede de teste) ↗",
    },
    how: { n: "001", stamp: "como", h: "Três passos.", steps: [
      ["Crie a sub-carteira", "Defina quanto ele pode gastar por pagamento e por período, até quando, e quem pode receber."],
      ["Conecte o agente", "Cole o código de conexão no Claude, no ChatGPT, no n8n ou no bot da sua empresa."],
      ["Ele paga sozinho", "Dentro do limite, o pagamento cai na hora. Acima dele, a própria rede recusa."],
    ] as [string, string][] },
    locks: { n: "002", stamp: "o que trava", h: "O limite mora na rede, não na boa vontade do agente.", items: [
      ["Teto por pagamento", "Nenhum pagamento passa do valor que você definiu."],
      ["Teto por período", "O gasto acumulado tem um limite por janela de tempo, com um teto rígido que nem a virada de período fura."],
      ["Só quem você autorizou", "Uma lista de destinatários. Fora dela, nada sai."],
      ["Validade e revogação", "A carteira do agente expira na data que você escolher, e você corta o acesso na hora que quiser."],
      ["Sem repetição", "Cada ordem de pagamento vale uma vez só. Ninguém reaproveita uma assinatura antiga."],
      ["Dupla checagem nos valores altos", "Acima de um valor, o pagamento exige uma segunda assinatura pós-quântica e um atestado de que o agente não foi comprometido."],
    ] as [string, string][], tech: "AgentVault · EIP-712 · SLH-DSA (precompile da Arc) · P-256" },
    identity: { n: "003", stamp: "identidade", h: "Cada agente tem nome e sobrenome.", body: "Todo agente recebe uma identidade registrada na Arc. Cada gasto fica ligado a ela, então dá pra saber qual agente pagou o quê, de quem ele é e dentro de qual regra.", tech: "registro ERC-8004 na Arc" },
    proofs: { n: "004", stamp: "provas", h: "Não é promessa. Está na rede.", body: "O fluxo inteiro já rodou na rede de teste da Arc. Qualquer pessoa confere:", items: [
      ["Cofre criado", PROOFS.deploy], ["Identidade do agente registrada", PROOFS.identity], ["Limites instalados", PROOFS.session],
      ["Pagamento de $0,50 dentro do limite", PROOFS.spend], ["Pagamento de $2,00 com assinatura pós-quântica", PROOFS.spendPq],
    ] as [string, string][] },
    dev: { n: "005", stamp: "pra quem constrói", h: "Uma ferramenta, não uma integração.", body: "O agente usa duas ferramentas pelo nosso servidor MCP: uma pra ver o saldo e os limites, outra pra pagar. Toda recusa acontece antes de assinar, e a rede confere de novo.", tools: ["slippay_arc_session", "slippay_arc_pay"] },
    cta: { h: "Dê um orçamento ao seu agente.", btn: "Conectar um agente", footer: "slippay · o dólar da Arc, no Pix" },
  },
  en: {
    back: "Home", open: "Open your account",
    hero: {
      eyebrow: "agent wallet · on Arc",
      h1: "Dollars for your agent. With a limit.",
      sub: "Each AI agent gets a dollar sub-wallet (USDC on Arc), with its own identity and a limit it cannot pass, even if it gets tricked.",
      cta: "Connect an agent", proof: "See a real payment (test network) ↗",
    },
    how: { n: "001", stamp: "how", h: "Three steps.", steps: [
      ["Create the sub-wallet", "Set how much it can spend per payment and per period, until when, and who can receive."],
      ["Connect the agent", "Paste the connection code into Claude, ChatGPT, n8n or your company's bot."],
      ["It pays on its own", "Inside the limit, the payment lands instantly. Above it, the network itself refuses."],
    ] as [string, string][] },
    locks: { n: "002", stamp: "what locks", h: "The limit lives on the network, not in the agent's good will.", items: [
      ["Per-payment cap", "No payment goes above the amount you set."],
      ["Per-period cap", "Total spend is capped per time window, with a hard ceiling that not even the window rollover breaks."],
      ["Only who you approved", "A recipient list. Outside it, nothing goes out."],
      ["Expiry and revocation", "The agent's wallet expires on the date you choose, and you can cut access at any moment."],
      ["No replays", "Each payment order is good once. Nobody can reuse an old signature."],
      ["Double check on large amounts", "Above a set amount, a payment needs a second, post-quantum signature and an attestation that the agent wasn't compromised."],
    ] as [string, string][], tech: "AgentVault · EIP-712 · SLH-DSA (Arc precompile) · P-256" },
    identity: { n: "003", stamp: "identity", h: "Every agent has a name.", body: "Each agent gets an identity registered on Arc. Every payment is tied to it, so you can tell which agent paid what, who it belongs to and under which rule.", tech: "ERC-8004 registry on Arc" },
    proofs: { n: "004", stamp: "proof", h: "Not a promise. It's on the network.", body: "The whole flow already ran on the Arc test network. Anyone can check:", items: [
      ["Vault created", PROOFS.deploy], ["Agent identity registered", PROOFS.identity], ["Limits installed", PROOFS.session],
      ["$0.50 payment inside the limit", PROOFS.spend], ["$2.00 payment with a post-quantum signature", PROOFS.spendPq],
    ] as [string, string][] },
    dev: { n: "005", stamp: "for builders", h: "A tool, not an integration.", body: "The agent uses two tools from our MCP server: one to read its balance and limits, one to pay. Every refusal happens before signing, and the network checks again.", tools: ["slippay_arc_session", "slippay_arc_pay"] },
    cta: { h: "Give your agent a budget.", btn: "Connect an agent", footer: "slippay · the Arc dollar, in Pix" },
  },
} as const;

function Stamp({ n, label, dark = false }: { n: string; label: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: dark ? "rgba(241,238,231,.45)" : GRAY }}>
      <span className={dark ? "text-[#5B82FF]" : "text-[#0a0a0a]/70"}>{n}</span><span className="h-px w-10 bg-current opacity-40" /><span>{label}</span>
    </div>
  );
}

export default function Agents() {
  const [lang, setLang] = useState<Lang>(() => {
    try { const s = localStorage.getItem("slippay.lang"); if (s === "pt" || s === "en") return s; } catch { /* */ }
    return "pt";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* */ } }, [lang]);
  const t = COPY[lang];

  const btn = "lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#002FA7] text-white font-semibold";
  const sec = "border-t border-[#0a0a0a]/12";
  const h2 = "font-black uppercase tracking-[-0.04em] leading-[0.88]";

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] overflow-x-hidden" style={display}>
      <style>{`::selection{background:#002FA7;color:#ffffff}`}</style>

      <header className="sticky top-0 z-40 px-6 md:px-12 py-4 flex items-center justify-between backdrop-blur-md bg-white/85 border-b border-[#0a0a0a]/8">
        <Link to="/" className="text-2xl md:text-3xl lowercase" style={{ ...display, fontWeight: 800, letterSpacing: "-0.04em" }}>slippay<span className="text-[#002FA7]">.</span></Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          <Link to="/" className="hidden md:inline hover:opacity-70">{t.back}</Link>
          <button onClick={() => setLang(lang === "pt" ? "en" : "pt")} className="font-mono hover:opacity-70" aria-label="toggle language">{lang === "pt" ? "EN" : "PT"}</button>
          <Link to="/account" className="inline-flex items-center rounded-full px-5 py-2.5 bg-[#002FA7] text-white font-semibold hover:opacity-90">{t.open}</Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="max-w-[1100px] mx-auto px-6 md:px-12 pt-20 md:pt-28 pb-20 md:pb-28">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#002FA7]" />{t.hero.eyebrow}
        </span>
        <h1 className="mt-7 font-black uppercase tracking-[-0.04em] leading-[0.9] text-[clamp(2.6rem,8vw,5.5rem)] max-w-[15ch]" style={display}>{t.hero.h1}</h1>
        <p className="mt-6 text-lg md:text-xl text-[#0a0a0a]/70 max-w-[52ch] leading-relaxed">{t.hero.sub}</p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link to="/account" className={btn}>{t.hero.cta}</Link>
          <a href={tx(PROOFS.spend)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b-2 border-[#002FA7] pb-1 hover:opacity-70">{t.hero.proof}</a>
        </div>
      </section>

      {/* 001 · HOW */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-20 md:py-32">
        <Stamp n={t.how.n} label={t.how.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,7vw,5rem)]`} style={display}>{t.how.h}</h2>
        <div className="mt-14 grid md:grid-cols-3 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 rounded-2xl overflow-hidden">
          {t.how.steps.map(([h, b], i) => (
            <div key={h} className="bg-white p-7 md:p-9">
              <span className="font-mono text-[12px] text-[#002FA7]">{String(i + 1).padStart(2, "0")}</span>
              <div className="mt-4 text-2xl md:text-3xl font-bold tracking-[-0.02em]" style={display}>{h}</div>
              <p className="mt-2 text-[15px] text-[#0a0a0a]/60 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </div></section>

      {/* 002 · LOCKS — each line is an AgentVault check */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-20 md:py-32">
        <Stamp n={t.locks.n} label={t.locks.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2rem,5.5vw,4rem)] max-w-[20ch]`} style={display}>{t.locks.h}</h2>
        <div className="mt-14 grid md:grid-cols-2 gap-x-12 gap-y-10">
          {t.locks.items.map(([h, b]) => (
            <div key={h} className="border-t-2 border-[#0a0a0a] pt-5">
              <div className="text-xl md:text-2xl font-bold tracking-[-0.02em]" style={display}>{h}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-[#0a0a0a]/60 max-w-[46ch]">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/40">{t.locks.tech}</div>
      </div></section>

      {/* 003 · IDENTITY */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-20 md:py-32">
        <Stamp n={t.identity.n} label={t.identity.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,6vw,4.5rem)] max-w-[16ch]`} style={display}>{t.identity.h}</h2>
        <p className="mt-8 text-lg md:text-2xl text-[#0a0a0a]/70 leading-relaxed max-w-[54ch]">{t.identity.body}</p>
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/40">{t.identity.tech}</div>
      </div></section>

      {/* 004 · PROOFS — real Arc testnet transactions */}
      <section className="px-4 md:px-6 py-2"><div className="bg-[#0a0a0a] text-[#f1eee7] rounded-[1.75rem] md:rounded-[2.5rem] max-w-[1200px] mx-auto px-6 md:px-14 py-20 md:py-32">
        <Stamp n={t.proofs.n} label={t.proofs.stamp} dark />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,6vw,4.5rem)] max-w-[16ch]`} style={display}>{t.proofs.h}</h2>
        <p className="mt-8 text-lg md:text-xl text-[#f1eee7]/70 leading-relaxed max-w-[52ch]">{t.proofs.body}</p>
        <div className="mt-10 flex flex-col">
          {t.proofs.items.map(([label, hash]) => (
            <a key={hash} href={tx(hash)} target="_blank" rel="noreferrer"
              className="group flex flex-col md:flex-row md:items-center justify-between gap-2 border-t border-[#f1eee7]/12 py-5 hover:bg-[#f1eee7]/[0.03] transition-colors">
              <span className="text-lg md:text-xl font-semibold tracking-[-0.01em]">{label}</span>
              <span className="font-mono text-[11px] text-[#f1eee7]/50 group-hover:text-[#5B82FF] transition-colors">{hash.slice(0, 10)}…{hash.slice(-4)} ↗</span>
            </a>
          ))}
        </div>
      </div></section>

      {/* 005 · BUILDERS — the two MCP tools */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-20 md:py-32">
        <Stamp n={t.dev.n} label={t.dev.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,6vw,4.5rem)] max-w-[16ch]`} style={display}>{t.dev.h}</h2>
        <p className="mt-8 text-lg md:text-xl text-[#0a0a0a]/70 leading-relaxed max-w-[54ch]">{t.dev.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {t.dev.tools.map((name) => (
            <code key={name} className="font-mono text-[13px] px-4 py-2.5 rounded-full border border-[#002FA7]/30 text-[#002FA7] bg-[#002FA7]/[0.04]">{name}</code>
          ))}
        </div>
      </div></section>

      {/* CTA */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-24 md:py-36">
        <h2 className={`${h2} text-[clamp(2.75rem,9vw,7rem)] max-w-[14ch]`} style={display}>{t.cta.h}</h2>
        <div className="mt-12"><Link to="/account" className={btn}>{t.cta.btn}</Link></div>
        <div className="mt-16 font-mono text-[10px] uppercase tracking-[0.28em] text-[#0a0a0a]/30">{t.cta.footer}</div>
      </div></section>
    </div>
  );
}
