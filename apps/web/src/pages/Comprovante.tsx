// Comprovante / Verifier — a PUBLIC, no-login surface that JUDGES a payment
//   /comprovante/:txhash?net=public&amount=0.30&to=G...&asset=USDC&label=...
//
// The moat is NOT the signature (that's solved — P-256, mainnet). The moat is
// HERE: the page reads the transaction LIVE from Stellar's public chain and
// decides green/red ITSELF — it never trusts the URL params. The params are the
// CLAIM (the obligation: this amount, this recipient); the chain is the JUDGE.
//   • green  = the chain attests a payment in THIS tx of the claimed amount to
//              the claimed recipient. Bound to the obligation, not "a transfer
//              happened".
//   • red    = mismatch — and it shows EXACTLY what the chain says vs the claim
//              (this is the anti-fraud surface).
//   • amber  = can't bind here yet (contract/Soroban transfer not readable via
//              classic Horizon) — we refuse a fake green and send you to verify.
// Trust ritual: don't trust a forwarded screenshot — scan the QR / open the link
// and the page re-verifies live. A "verified at HH:MM:SS" stamp distinguishes the
// live page from a static image.
//
// Honest limits (named in-UI): (1) binding to "this recipient" only matters if
// you know GABC… really is that merchant — that's a merchant-identity layer the
// chain does not provide. (2) Soroban/contract transfers aren't read here yet;
// the endgame is reading the on-chain obligation (x402/subscription contract).

import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import QRCode from "qrcode";
import { Logo } from "../components/Logo.tsx";
import { useLang } from "../lib/lang.ts";

type Net = "public" | "testnet";
const HORIZON: Record<Net, string> = { public: "https://horizon.stellar.org", testnet: "https://horizon-testnet.stellar.org" };
const EXPLORER: Record<Net, string> = { public: "https://stellar.expert/explorer/public", testnet: "https://stellar.expert/explorer/testnet" };

type Level = "green" | "red" | "amber" | "loading" | "notfound";
interface ChainPay { amount: string; to: string; from: string; assetCode: string; }
interface Result {
  level: Level; successful: boolean; ledger?: number; createdAt?: string;
  pay?: ChainPay; checkedAt?: string;
}

const STR = {
  pt: {
    receipt: "Comprovante", verifying: "Conferindo na blockchain…",
    notFound: "Transação não encontrada nesta rede.", notFoundHint: "Confira o hash e a rede.",
    gPago: "Pago e confirmado", gSub: "A blockchain confirma: este pagamento existe e bate com a cobrança.",
    rFalhou: "Pagamento NÃO confirmado", rMismatch: "Atenção: não bate com a cobrança",
    rSubFailed: "Esta transação falhou na blockchain.",
    rSubMismatch: "A blockchain registra um pagamento diferente do que esta cobrança pede. Não pague / não aceite.",
    aContract: "Confirmado on-chain — valor não lido aqui",
    aContractSub: "É uma transação de contrato (Soroban). Existe e teve sucesso na blockchain, mas o valor não é legível por esta página ainda — confira no explorer antes de aceitar.",
    aUnbound: "Pagamento existe — compare com a cobrança",
    aUnboundSub: "A blockchain confirma o pagamento abaixo, mas esta página não recebeu a cobrança esperada para comparar. Confira valor e destino com a sua fatura.",
    chainSays: "A blockchain registra", expected: "Esta cobrança pede",
    amount: "Valor", to: "Para", asset: "Ativo", when: "Quando", ledger: "Bloco", txid: "Hash",
    ritualTitle: "Não confie no print — confira você mesmo",
    ritual: "Esta página confere ao vivo na blockchain pública. Um print encaminhado não prova nada: escaneie o QR ou abra o link você mesmo. A blockchain não pode ser forjada nem apagada — mas só vale se VOCÊ conferir.",
    verifyCta: "Abrir na blockchain (Stellar Expert)", checkedAt: "Verificado agora",
    share: "Compartilhar", copy: "Copiar link", copied: "Link copiado",
    footer: "Prova o movimento na blockchain. Conferir que o destino é mesmo o vendedor certo é outra camada (identidade) — e não é nota fiscal.",
    net: (n: Net) => (n === "public" ? "Stellar mainnet" : "Stellar testnet"),
  },
  en: {
    receipt: "Receipt", verifying: "Checking the blockchain…",
    notFound: "Transaction not found on this network.", notFoundHint: "Check the hash and the network.",
    gPago: "Paid and confirmed", gSub: "The blockchain confirms: this payment exists and matches the charge.",
    rFalhou: "Payment NOT confirmed", rMismatch: "Warning: does not match the charge",
    rSubFailed: "This transaction failed on the blockchain.",
    rSubMismatch: "The blockchain records a payment different from what this charge asks for. Do not pay / do not accept.",
    aContract: "Confirmed on-chain — amount not read here",
    aContractSub: "This is a contract (Soroban) transaction. It exists and succeeded on-chain, but its amount isn't readable by this page yet — check the explorer before accepting.",
    aUnbound: "Payment exists — compare with the charge",
    aUnboundSub: "The blockchain confirms the payment below, but this page didn't receive the expected charge to compare. Check amount and recipient against your invoice.",
    chainSays: "The blockchain records", expected: "This charge asks for",
    amount: "Amount", to: "To", asset: "Asset", when: "When", ledger: "Ledger", txid: "Hash",
    ritualTitle: "Don't trust the screenshot — verify it yourself",
    ritual: "This page checks the public blockchain live. A forwarded screenshot proves nothing: scan the QR or open the link yourself. The blockchain can't be forged or deleted — but only if YOU check it.",
    verifyCta: "Open on the blockchain (Stellar Expert)", checkedAt: "Verified just now",
    share: "Share", copy: "Copy link", copied: "Link copied",
    footer: "Proves the movement on the blockchain. Confirming the recipient is really the right seller is another layer (identity) — and this is not a tax invoice.",
    net: (n: Net) => (n === "public" ? "Stellar mainnet" : "Stellar testnet"),
  },
};

const short = (s?: string, h = 7, t = 7) => !s ? "" : s.length <= h + t + 1 ? s : `${s.slice(0, h)}…${s.slice(-t)}`;
const numEq = (a?: string, b?: string) => {
  if (a == null || b == null) return false;
  const x = Number(a), y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-7;
};

export default function Comprovante() {
  const { txhash = "" } = useParams();
  const [sp] = useSearchParams();
  const [lang, setLang] = useLang();
  const t = STR[lang];

  const net: Net = sp.get("net") === "testnet" ? "testnet" : "public";
  const expAmount = sp.get("amount") ?? undefined;     // the CLAIM (obligation)
  const expTo = sp.get("to") ?? undefined;
  const expAsset = (sp.get("asset") ?? "USDC").toUpperCase();
  const label = sp.get("label") ?? undefined;
  const hasClaim = !!(expAmount || expTo);

  const [r, setR] = useState<Result>({ level: "loading", successful: false });
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const explorerUrl = `${EXPLORER[net]}/tx/${txhash}`;

  useEffect(() => {
    let alive = true;
    setR({ level: "loading", successful: false });
    (async () => {
      try {
        const txr = await fetch(`${HORIZON[net]}/transactions/${txhash}`);
        if (!txr.ok) { if (alive) setR({ level: "notfound", successful: false }); return; }
        const tx = await txr.json();
        const successful = !!tx.successful;
        let pay: ChainPay | undefined;
        try {
          const or = await fetch(`${HORIZON[net]}/transactions/${txhash}/operations?limit=50`);
          if (or.ok) {
            const recs: any[] = (await or.json())?._embedded?.records ?? [];
            const p = recs.find(x => x.type === "payment" || (typeof x.type === "string" && x.type.startsWith("path_payment")));
            if (p) pay = { amount: p.amount, to: p.to, from: p.from ?? p.source_account, assetCode: p.asset_type === "native" ? "XLM" : (p.asset_code ?? "?") };
          }
        } catch { /* Soroban / non-classic */ }

        // JUDGE — the chain decides, never the params
        let level: Level;
        if (!successful) level = "red";
        else if (!pay) level = "amber";                       // contract transfer not readable here
        else if (!hasClaim) level = "amber";                  // payment exists but nothing to bind to
        else {
          const amtOk = !expAmount || numEq(pay.amount, expAmount);
          const toOk = !expTo || pay.to === expTo;
          const assetOk = pay.assetCode === expAsset;
          level = (amtOk && toOk && assetOk) ? "green" : "red";
        }
        const checkedAt = new Date().toLocaleTimeString(lang === "pt" ? "pt-BR" : "en-US");
        if (alive) setR({ level, successful, ledger: tx.ledger, createdAt: tx.created_at, pay, checkedAt });
      } catch { if (alive) setR({ level: "notfound", successful: false }); }
    })();
    return () => { alive = false; };
  }, [txhash, net, hasClaim, expAmount, expTo, expAsset, lang]);

  useEffect(() => {
    QRCode.toDataURL(typeof window !== "undefined" ? window.location.href : explorerUrl,
      { margin: 1, width: 240, color: { dark: "#0a0a0a", light: "#00000000" } }).then(setQr).catch(() => {});
  }, [explorerUrl]);

  const fmt = (a?: string, asset?: string) => {
    if (!a) return "—";
    const n = Number(a); if (!Number.isFinite(n)) return a;
    const usd = (asset ?? expAsset) === "USDC";
    return (usd ? "US$ " : "") + n.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 7 }) + (usd ? "" : ` ${asset ?? ""}`);
  };
  const when = r.createdAt ? new Date(r.createdAt).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", { dateStyle: "long", timeStyle: "short" }) : "—";

  // verdict presentation
  const isMismatch = r.level === "red" && r.successful;
  const headline =
    r.level === "green" ? t.gPago :
    r.level === "red" ? (isMismatch ? t.rMismatch : t.rFalhou) :
    r.level === "amber" ? (r.pay ? t.aUnbound : t.aContract) : "";
  const sub =
    r.level === "green" ? t.gSub :
    r.level === "red" ? (isMismatch ? t.rSubMismatch : t.rSubFailed) :
    r.level === "amber" ? (r.pay ? t.aUnboundSub : t.aContractSub) : "";
  const bg = r.level === "green" ? "#b5e853" : r.level === "red" ? "#b91c1c" : "#0a0a0a";
  const fg = r.level === "green" ? "#0a0a0a" : "#f1eee7";

  async function onShare() {
    const url = window.location.href;
    if ((navigator as any).share) { try { await (navigator as any).share({ title: t.receipt + " · Slippay", url }); return; } catch { /* */ } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* */ }
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain flex flex-col">
      <header className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[560px] mx-auto w-full px-5 py-4 flex items-center justify-between">
          <Link to="/" aria-label="Slippay"><Logo variant="ink" /></Link>
          <button onClick={() => setLang(lang === "pt" ? "en" : "pt")} className="text-[10px] uppercase tracking-[0.22em] opacity-60 hover:opacity-100">{lang === "pt" ? "EN" : "PT"}</button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[560px] mx-auto px-5 py-9 md:py-14">
        {r.level === "loading" && (
          <div className="text-center py-24 font-mono text-[11px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
            <span className="inline-block w-1.5 h-1.5 bg-[#b5e853] animate-pulse mr-2" />{t.verifying}
          </div>
        )}
        {r.level === "notfound" && (
          <div className="text-center py-24">
            <div className="text-2xl font-medium tracking-tight">{t.notFound}</div>
            <p className="mt-3 text-sm text-[#0a0a0a]/60">{t.notFoundHint}</p>
            <div className="mt-6 font-mono text-[11px] text-[#0a0a0a]/40 break-all">{short(txhash, 12, 12)}</div>
          </div>
        )}

        {(r.level === "green" || r.level === "red" || r.level === "amber") && (
          <div className="border border-[#0a0a0a]/15 bg-white/55">
            {/* VERDICT banner — the chain's decision, in plain language */}
            <div className="px-7 md:px-9 py-8 text-center" style={{ background: bg, color: fg }}>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-70">{t.receipt} · slippay · {t.net(net)}</div>
              <div className="mx-auto mt-5 w-[56px] h-[56px] flex items-center justify-center" style={{ background: fg === "#0a0a0a" ? "#0a0a0a" : "transparent", border: r.level === "green" ? "none" : `2px solid ${fg}`, borderRadius: r.level === "green" ? 0 : 999 }}>
                {r.level === "green"
                  ? <svg width="30" height="30" viewBox="0 0 44 44" fill="none"><path d="M11 23l8 8 14-16" stroke="#b5e853" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : r.level === "red"
                    ? <svg width="26" height="26" viewBox="0 0 44 44" fill="none"><path d="M14 14l16 16M30 14L14 30" stroke={fg} strokeWidth="4" strokeLinecap="round" /></svg>
                    : <svg width="26" height="26" viewBox="0 0 44 44" fill="none"><path d="M22 12v16M22 32v.5" stroke={fg} strokeWidth="4" strokeLinecap="round" /></svg>}
              </div>
              <div className="mt-5 text-2xl md:text-3xl font-medium tracking-[-0.02em]">{headline}</div>
              <p className="mt-3 text-sm leading-relaxed opacity-85 max-w-[42ch] mx-auto">{sub}</p>
              {label && <div className="mt-3 text-xs opacity-70">{label}</div>}
            </div>

            {/* CHAIN vs CLAIM — the binding, explicit (anti-fraud) */}
            <div className="px-7 md:px-9 py-7">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45 font-mono mb-3">{t.chainSays}</div>
              <dl className="space-y-3 text-sm">
                {r.pay ? (
                  <>
                    <Row label={t.amount} value={fmt(r.pay.amount, r.pay.assetCode)} mono mismatch={isMismatch && !numEq(r.pay.amount, expAmount)} />
                    <Row label={t.to} value={short(r.pay.to, 8, 8)} mono mismatch={isMismatch && !!expTo && r.pay.to !== expTo} />
                    <Row label={t.asset} value={r.pay.assetCode === "USDC" ? "USDC · dólar" : r.pay.assetCode} mismatch={isMismatch && r.pay.assetCode !== expAsset} />
                  </>
                ) : (
                  <div className="text-sm text-[#0a0a0a]/55">{lang === "pt" ? "transação de contrato — valor não legível aqui" : "contract transaction — amount not readable here"}</div>
                )}
                <Row label={t.when} value={when} />
                <Row label={t.ledger} value={r.ledger ? String(r.ledger) : "—"} mono />
                <Row label={t.txid} value={short(txhash, 10, 10)} mono />
              </dl>

              {hasClaim && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45 font-mono mt-6 mb-3">{t.expected}</div>
                  <dl className="space-y-3 text-sm">
                    {expAmount && <Row label={t.amount} value={fmt(expAmount)} mono />}
                    {expTo && <Row label={t.to} value={short(expTo, 8, 8)} mono />}
                    <Row label={t.asset} value={expAsset === "USDC" ? "USDC · dólar" : expAsset} />
                  </dl>
                </>
              )}
            </div>

            {/* RITUAL — verify yourself, don't trust a screenshot */}
            <div className="px-7 md:px-9 py-7 bg-[#0a0a0a] text-[#f1eee7]">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#b5e853] mb-3">
                <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" />{t.ritualTitle}
              </div>
              <div className="flex gap-5 items-center">
                {qr && <img src={qr} alt="" className="w-[88px] h-[88px] shrink-0 bg-[#f1eee7] p-1.5" />}
                <p className="text-[12.5px] leading-[1.55] text-[#f1eee7]/75">{t.ritual}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-[#f1eee7]/30 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] hover:bg-[#f1eee7] hover:text-[#0a0a0a] transition-colors">
                  {t.verifyCta} <span>↗</span>
                </a>
                {r.checkedAt && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/45">{t.checkedAt} · {r.checkedAt}</span>}
              </div>
            </div>

            {/* actions */}
            <div className="px-7 md:px-9 py-5 flex items-center justify-between gap-3 border-t border-dashed border-[#0a0a0a]/20">
              <button onClick={onShare} className="inline-flex items-center gap-2 bg-[#0a0a0a] text-[#f1eee7] px-5 py-3 text-[10px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
                {copied ? t.copied : ((navigator as any)?.share ? t.share : t.copy)} <span>→</span>
              </button>
              <Link to="/" className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/50 hover:text-[#0a0a0a]">slippay</Link>
            </div>
          </div>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-[#0a0a0a]/45 text-center max-w-[46ch] mx-auto">{t.footer}</p>
      </main>
    </div>
  );
}

function Row({ label, value, mono, mismatch }: { label: string; value: string; mono?: boolean; mismatch?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/45 font-mono shrink-0">{label}</dt>
      <dd className={"text-right " + (mono ? "font-mono text-xs break-all " : "") + (mismatch ? "text-[#b91c1c] font-semibold" : "")}>
        {mismatch && <span className="mr-1">≠</span>}{value}
      </dd>
    </div>
  );
}
