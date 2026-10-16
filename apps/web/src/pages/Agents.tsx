// Agents — the AI-agent wallet on Arc. Same identity system as the landing
// (Inter, monumental caps, mono index labels, Klein blue #002FA7; #5B82FF on dark).
// Every claim maps to a live AgentVault feature (contracts-evm/src/AgentVault.sol);
// the proof links are real Arc transactions: mainnet (docs/arc/metrics.md, the commit messages of
// 78bf61e and dae4278) and the testnet post-quantum spend (contracts-evm/README.md). The attack
// section links the read-only mainnet red-team report. Plain words first, the technical name after.
// The live modules (vault card, payment ledger, attack lab) read Arc mainnet from the visitor's
// browser: every number is the chain's, at the block they print. They live here, not on the home
// page, which speaks to companies.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { LiveVaultCard } from "../components/LiveVaultCard.tsx";
import { RealLedger } from "../components/RealLedger.tsx";
import { AttackLab } from "../components/AttackLab.tsx";

const display = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" } as const;
const GRAY = "#6f6862";
type Net = "main" | "test";
const tx = (h: string, net: Net = "main") => `https://explorer${net === "test" ? ".testnet" : ""}.arc.io/tx/${h}`;
type Lang = "pt" | "en";

// Arc mainnet, 2026-10-19/20 (pilot vault 0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8).
const PROOFS = {
  spend: "0xd4fb46dfe0d5322ef0274709208bee79ecbf3dfeee7928fbb86f225e1565ac7b",
  session2: "0x4d7bb8761eeaa18a6b3de52ec50878a69a6a5bd34fd786dac6d25ba11cffc8ec",
  floatTopUp: "0xf822f25c3cfd611ffac1f42f6f9f8853d85753ef869f926e848e5d12b41ff49f",
  floatDeposit: "0xfb68a2fc6a6a948c3252232fc38c6498041e9413c2130b34ed2a318d19d09f08",
} as const;
// Arc testnet, 2026-10-13 (contracts-evm/README.md): the post-quantum leg is proven there only.
const SPEND_PQ_TESTNET = "0x4c10777d86b8093d26e01905de7e4ce203912dd1e731989f27cd427f52ee9691";

const COPY = {
  pt: {
    back: "Início", open: "Abrir conta",
    hero: {
      eyebrow: "carteira de agente · na Arc",
      h1: "Dólar pro seu agente. Com limite.",
      sub: "Cada agente de IA ganha uma sub-carteira em dólar (USDC na Arc), com identidade própria e um limite que ele não consegue passar, nem se for enganado.",
      cta: "Conectar um agente", proof: "Ver um pagamento real na Arc ↗",
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
      ["Serviços pagos por chamada", "O agente compra APIs cobradas por uso (x402, nanopagamentos da Circle) com uma carteira de troco que só o cofre abastece. Tudo o que ela recebe passou pelos limites."],
    ] as [string, string][], tech: "AgentVault · EIP-712 · SLH-DSA (precompile da Arc) · P-256 · x402" },
    identity: { n: "003", stamp: "identidade", h: "Cada agente tem nome e sobrenome.", body: "Todo agente recebe uma identidade registrada na Arc. Cada gasto fica ligado a ela, então dá pra saber qual agente pagou o quê, de quem ele é e dentro de qual regra.", tech: "registro ERC-8004 na Arc" },
    proofs: { n: "004", stamp: "provas", h: "Não é promessa. Está na rede.", body: "O cofre roda na rede principal da Arc e já pagou com dinheiro de verdade. Qualquer pessoa confere:", items: [
      ["Pagamento de $0,10 a um comerciante, liberado pelo atestador", PROOFS.spend, "main"],
      ["Limites de um segundo agente instalados", PROOFS.session2, "main"],
      ["O cofre abastece a carteira de troco do agente ($0,12, atestado)", PROOFS.floatTopUp, "main"],
      ["A carteira de troco deposita no Gateway da Circle e paga por chamada", PROOFS.floatDeposit, "main"],
      ["Pagamento de $2,00 com assinatura pós-quântica (rede de teste)", SPEND_PQ_TESTNET, "test"],
    ] as [string, string, Net][] },
    more: "Mais provas na rede:",
    dev: { n: "006", stamp: "pra quem constrói", h: "Uma ferramenta, não uma integração.", body: "O agente usa quatro ferramentas pelo nosso servidor MCP: ver o saldo e os limites, pagar, comprar um serviço pago por chamada (x402) e ler os próprios recibos na rede. Toda recusa acontece antes de assinar, e a rede confere de novo.", tools: ["slippay_arc_session", "slippay_arc_pay", "slippay_arc_x402_fetch", "slippay_arc_receipts"] },
    cta: { h: "Dê um orçamento ao seu agente.", btn: "Conectar um agente", footer: "slippay · o dólar da Arc, no Pix" },
  },
  en: {
    back: "Home", open: "Open your account",
    hero: {
      eyebrow: "agent wallet · on Arc",
      h1: "Dollars for your agent. With a limit.",
      sub: "Each AI agent gets a dollar sub-wallet (USDC on Arc), with its own identity and a limit it cannot pass, even if it gets tricked.",
      cta: "Connect an agent", proof: "See a real payment on Arc ↗",
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
      ["Pay-per-call services", "The agent buys usage-priced APIs (x402, Circle nanopayments) from a change wallet only the vault can fill. Everything it ever receives went through the limits."],
    ] as [string, string][], tech: "AgentVault · EIP-712 · SLH-DSA (Arc precompile) · P-256 · x402" },
    identity: { n: "003", stamp: "identity", h: "Every agent has a name.", body: "Each agent gets an identity registered on Arc. Every payment is tied to it, so you can tell which agent paid what, who it belongs to and under which rule.", tech: "ERC-8004 registry on Arc" },
    proofs: { n: "004", stamp: "proof", h: "Not a promise. It's on the network.", body: "The vault runs on Arc mainnet and has already paid with real money. Anyone can check:", items: [
      ["$0.10 payment to a merchant, cleared by the attester", PROOFS.spend, "main"],
      ["A second agent's limits installed", PROOFS.session2, "main"],
      ["The vault fills the agent's change wallet ($0.12, attested)", PROOFS.floatTopUp, "main"],
      ["The change wallet deposits into Circle Gateway and pays per call", PROOFS.floatDeposit, "main"],
      ["$2.00 payment with a post-quantum signature (test network)", SPEND_PQ_TESTNET, "test"],
    ] as [string, string, Net][] },
    more: "More proof on the network:",
    dev: { n: "006", stamp: "for builders", h: "A tool, not an integration.", body: "The agent uses four tools from our MCP server: read its balance and limits, pay, buy a pay-per-call service (x402) and read its own receipts on-chain. Every refusal happens before signing, and the network checks again.", tools: ["slippay_arc_session", "slippay_arc_pay", "slippay_arc_x402_fetch", "slippay_arc_receipts"] },
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
      <section className="max-w-[1200px] mx-auto px-6 md:px-12 pt-20 md:pt-28 pb-28 md:pb-36 grid md:grid-cols-[1fr_420px] gap-16 md:gap-20 items-center">
        <div>
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#002FA7]" />{t.hero.eyebrow}
        </span>
        <h1 className="mt-7 font-black uppercase tracking-[-0.04em] leading-[0.9] text-[clamp(2.6rem,8vw,5.5rem)] max-w-[15ch]" style={display}>{t.hero.h1}</h1>
        <p className="mt-6 text-lg md:text-xl text-[#0a0a0a]/70 max-w-[52ch] leading-relaxed">{t.hero.sub}</p>
        <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link to="/agents/new" className={btn}>{t.hero.cta}</Link>
          <a href={tx(PROOFS.spend)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] border-b-2 border-[#002FA7] pb-1 hover:opacity-70">{t.hero.proof}</a>
        </div>
        </div>
        <div className="w-full pb-24 md:pb-16"><LiveVaultCard lang={lang} /></div>
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

      {/* 004 · PROOFS — the agent's real payment ledger (rows re-checked on Arc mainnet on load) */}
      <section className={sec}><div className="max-w-[1100px] mx-auto px-6 md:px-12 py-20 md:py-32">
        <Stamp n={t.proofs.n} label={t.proofs.stamp} />
        <h2 className={`mt-10 ${h2} text-[clamp(2.25rem,6vw,4.5rem)] max-w-[16ch]`} style={display}>{t.proofs.h}</h2>
        <p className="mt-8 text-lg md:text-xl text-[#0a0a0a]/70 leading-relaxed max-w-[52ch]">{t.proofs.body}</p>
        <div className="mt-12"><RealLedger lang={lang} /></div>
        <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[13px]">
          <span className="text-[#0a0a0a]/50">{t.more}</span>
          {t.proofs.items.filter(([, hash]) => hash !== PROOFS.spend && hash !== PROOFS.floatTopUp).map(([label, hash, net]) => (
            <a key={hash} href={tx(hash, net)} target="_blank" rel="noreferrer" className="text-[#0a0a0a]/75 hover:text-[#002FA7] border-b border-[#0a0a0a]/15 hover:border-[#002FA7]">{label} ↗</a>
          ))}
        </div>
      </div></section>

      {/* 005 · ATTACK — the visitor attacks the live vault (eth_call, nothing broadcast) */}
      <section id="ataque" className="px-4 md:px-6 py-2 scroll-mt-24"><div className="bg-[#0a0a0a] text-[#f1eee7] rounded-[1.75rem] md:rounded-[2.5rem] max-w-[1200px] mx-auto px-6 md:px-14 py-20 md:py-32 relative overflow-hidden">
        <div aria-hidden className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-[#002FA7]/30 blur-3xl" />
        <div className="relative"><AttackLab lang={lang} n="005" /></div>
      </div></section>

      {/* 006 · BUILDERS — the MCP tools */}
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
        <div className="mt-12"><Link to="/agents/new" className={btn}>{t.cta.btn}</Link></div>
        <div className="mt-16 font-mono text-[10px] uppercase tracking-[0.28em] text-[#0a0a0a]/30">{t.cta.footer}</div>
      </div></section>
    </div>
  );
}
