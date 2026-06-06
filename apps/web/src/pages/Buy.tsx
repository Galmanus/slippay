// /buy — one-touch "buy dollars": enter R$, see the live SlipPay quote (mid-market
// x spread), continue with Pix. The quote is where the margin lives; it's shown
// honestly as "includes a small conversion margin". Bone + gray + yellow-detail.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { quoteBRLtoUSDC, recordConversionIntent, SPREAD_PCT, type Quote } from "../lib/quote";
import { loadAccount } from "../lib/account";
import { buildOnrampUrl, transakConfigured } from "../lib/onramp";

const display = { fontFamily: "'DM Sans', sans-serif" } as const;
const GRAY = "#6f6862";
type Lang = "pt" | "en";

const C = {
  pt: {
    home: "Início", stamp: "comprar dólar",
    h1a: "Compre dólar.", h1acc: "Em um toque.",
    sub: "Coloque reais com Pix. Receba dólar na sua carteira. Em segundos.",
    youSend: "Você envia", youGet: "Você recebe",
    rate: (r: number) => `1 USD = R$ ${r.toFixed(4)} · taxa SlipPay`,
    margin: `Cotação inclui ~${SPREAD_PCT.toFixed(2)}% de margem de conversão. A taxa final é fixada na confirmação.`,
    stale: "Cotação de referência (taxa ao vivo indisponível agora).",
    cta: "Continuar com Pix", needAcct: "Crie sua conta (um toque)", soon: "On-ramp em configuração",
    custodial: "Não-custodial: o dólar cai direto na sua carteira. Ninguém segura no meio.",
  },
  en: {
    home: "Home", stamp: "buy dollars",
    h1a: "Buy dollars.", h1acc: "In one touch.",
    sub: "Add reais with Pix. Get dollars in your wallet. In seconds.",
    youSend: "You send", youGet: "You get",
    rate: (r: number) => `1 USD = R$ ${r.toFixed(4)} · SlipPay rate`,
    margin: `Quote includes a ~${SPREAD_PCT.toFixed(2)}% conversion margin. The final rate is locked at checkout.`,
    stale: "Reference quote (live rate unavailable right now).",
    cta: "Continue with Pix", needAcct: "Create your account (one touch)", soon: "On-ramp configuring",
    custodial: "Non-custodial: dollars land straight in your wallet. No one holds them in between.",
  },
} as const;

const PRESETS = [100, 500, 1000, 5000];

export default function Buy() {
  const [lang, setLang] = useState<Lang>(() => {
    try { const s = localStorage.getItem("slippay.lang"); if (s === "pt" || s === "en") return s; } catch { /* */ }
    return (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) ? "pt" : "en";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* */ } }, [lang]);
  const t = C[lang];

  const [brl, setBrl] = useState(1000);
  const [quote, setQuote] = useState<Quote | null>(null);
  const acct = useMemo(() => loadAccount(), []);

  useEffect(() => {
    let on = true;
    quoteBRLtoUSDC(brl).then((q) => { if (on) setQuote(q); }).catch(() => { /* keep last */ });
    return () => { on = false; };
  }, [brl]);

  function onContinue() {
    if (!acct || !transakConfigured()) return;
    if (quote) recordConversionIntent(quote, acct.walletId);
    window.open(buildOnrampUrl(acct.walletId, { fiat: "BRL", amount: brl }), "_blank", "noopener");
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <style>{`::selection{background:#FDDA24;color:#0a0a0a}`}</style>
      <header className="px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay<span className="text-[#FDDA24]">.</span></Link>
        <div className="flex items-center gap-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">
            <button onClick={() => setLang("pt")} className={lang === "pt" ? "text-[#0a0a0a] font-medium" : "hover:opacity-80"}>PT</button>
            <span className="opacity-30 mx-1">/</span>
            <button onClick={() => setLang("en")} className={lang === "en" ? "text-[#0a0a0a] font-medium" : "hover:opacity-80"}>EN</button>
          </div>
          <Link to="/" className="text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55 hover:text-[#0a0a0a]">{t.home}</Link>
        </div>
      </header>

      <main className="max-w-[680px] mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-28">
        <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GRAY }}>
          <span className="text-[#0a0a0a]/55">001</span><span className="h-px w-8 bg-current opacity-40" /><span>{t.stamp}</span>
        </div>
        <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,5.5rem)]" style={display}>
          {t.h1a}<br /><span style={{ color: GRAY }}>{t.h1acc}</span>
        </h1>
        <p className="mt-8 text-lg md:text-xl leading-relaxed max-w-[44ch] text-[#0a0a0a]/70">{t.sub}</p>

        {/* converter */}
        <div className="mt-12 rounded-3xl border border-[#0a0a0a]/12 bg-white/40 p-6 md:p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.youSend}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl text-[#0a0a0a]/55" style={display}>R$</span>
            <input
              type="number" min={0} value={brl}
              onChange={(e) => setBrl(Math.max(0, Number(e.target.value)))}
              className="w-full bg-transparent outline-none text-5xl md:text-6xl font-semibold tabular-nums tracking-[-0.03em]"
              style={display}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => setBrl(p)}
                className={`rounded-full px-4 py-1.5 text-[12px] tabular-nums border transition-colors ${brl === p ? "bg-[#0a0a0a] text-[#f1eee7] border-[#0a0a0a]" : "border-[#0a0a0a]/20 hover:border-[#0a0a0a]/50"}`}>
                R$ {p.toLocaleString("pt-BR")}
              </button>
            ))}
          </div>

          <div className="my-6 h-px bg-[#0a0a0a]/10" />

          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.youGet}</div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl text-[#0a0a0a]/45" style={display}>$</span>
            <span className="text-5xl md:text-6xl font-semibold tabular-nums tracking-[-0.03em]" style={display}>
              {quote ? quote.usdcOut.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
            </span>
            <span className="text-lg text-[#0a0a0a]/45 self-end mb-1.5">USDC</span>
          </div>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: GRAY }}>
            {quote ? t.rate(quote.quotedRate) : "…"}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[#0a0a0a]/50 max-w-[48ch]">
            {quote?.stale ? t.stale : t.margin}
          </p>
        </div>

        {acct && transakConfigured() ? (
          <button onClick={onContinue} disabled={brl <= 0}
            className="lift mt-8 w-full max-w-[420px] px-7 py-5 rounded-full bg-[#FDDA24] text-[#0a0a0a] text-[12px] uppercase tracking-[0.22em] disabled:opacity-40">
            {t.cta} →
          </button>
        ) : !acct ? (
          <Link to="/account" className="lift mt-8 inline-flex w-full max-w-[420px] items-center justify-center px-7 py-5 rounded-full bg-[#FDDA24] text-[#0a0a0a] text-[12px] uppercase tracking-[0.22em]">
            {t.needAcct} →
          </Link>
        ) : (
          <div className="mt-8 text-[12px] uppercase tracking-[0.2em] text-[#0a0a0a]/40">{t.soon}</div>
        )}

        <p className="mt-6 text-[13px] text-[#0a0a0a]/55 max-w-[46ch] flex items-start gap-2">
          <span className="text-[#FDDA24] mt-0.5">✓</span><span>{t.custodial}</span>
        </p>
      </main>
    </div>
  );
}
