// RealLedger — the agent's payment ledger, not an illustration. Settled rows are real AgentVault
// spends on Arc mainnet, re-checked from the visitor's browser on load (receipt status + block).
// The x402 row is the nanopayment the float made (Circle Gateway batches it off-chain, so it has
// no tx of its own). Refused rows are the 2026-10-20 mainnet red-team (linked report).
import { useEffect, useState } from "react";
import { REDTEAM_REPORT, SETTLED_TX, TOPUP_TX, txUrl, verifyTx } from "../lib/arcLive.ts";

type Lang = "pt" | "en";
type Verdict = "ATTESTED" | "PAID" | "REFUSED";
type Row = { who: [string, string]; sub: string; verdict: Verdict; amount: string; tx?: `0x${string}`; settle?: string };

const T = {
  pt: {
    title: "Livro de pagamentos do agente", right: "conferido na Arc agora · USDC",
    cols: ["Contrapartes", "Veredito", "Valor", "Liquidação"],
    verdict: { ATTESTED: "ATESTADO", PAID: "PAGO", REFUSED: "RECUSADO" } as Record<Verdict, string>,
    settled: "Liquidado · bloco", checking: "conferindo na rede…", fail: "não deu pra conferir agora",
    rows: [
      { who: ["Agente #2579", "Comerciante"], sub: "dentro do teto por pagamento", verdict: "ATTESTED", amount: "0,10", tx: SETTLED_TX },
      { who: ["Agente #2579", "Carteira de troco do agente"], sub: "abastece compras pagas por chamada", verdict: "ATTESTED", amount: "0,12", tx: TOPUP_TX },
      { who: ["Carteira de troco", "Serviço de checagem de risco"], sub: "pago por chamada, x402", verdict: "PAID", amount: "0,005", settle: "Circle Gateway · em lote" },
      { who: ["Chave do agente roubada", "Ladrão"], sub: "fora da lista do agente", verdict: "REFUSED", amount: "0,000001", settle: "nunca saiu · RecipientNotAllowed" },
      { who: ["Chave do agente roubada", "Comerciante"], sub: "acima do teto por pagamento", verdict: "REFUSED", amount: "0,200001", settle: "nunca saiu · AmountExceedsCap" },
      { who: ["Pagamento de 19/10", "repetido"], sub: "a mesma ordem, byte a byte", verdict: "REFUSED", amount: "0,10", settle: "nunca saiu · Expired" },
    ] as Row[],
    foot: "As duas primeiras linhas foram conferidas agora, direto na rede. As recusas são do ataque ao cofre na mainnet em 20/10, com a chave do agente nas mãos do atacante.",
    report: "Ler o relatório ↗",
  },
  en: {
    title: "The agent's payment ledger", right: "checked on Arc just now · USDC",
    cols: ["Counterparties", "Verdict", "Amount", "Settlement"],
    verdict: { ATTESTED: "ATTESTED", PAID: "PAID", REFUSED: "REFUSED" } as Record<Verdict, string>,
    settled: "Settled · block", checking: "checking the network…", fail: "couldn't check right now",
    rows: [
      { who: ["Agent #2579", "Merchant"], sub: "inside the per-payment cap", verdict: "ATTESTED", amount: "0.10", tx: SETTLED_TX },
      { who: ["Agent #2579", "The agent's change wallet"], sub: "funds pay-per-call purchases", verdict: "ATTESTED", amount: "0.12", tx: TOPUP_TX },
      { who: ["Change wallet", "Risk-check service"], sub: "paid per call, x402", verdict: "PAID", amount: "0.005", settle: "Circle Gateway · batched" },
      { who: ["Stolen agent key", "Thief"], sub: "not on the agent's list", verdict: "REFUSED", amount: "0.000001", settle: "never left · RecipientNotAllowed" },
      { who: ["Stolen agent key", "Merchant"], sub: "above the per-payment cap", verdict: "REFUSED", amount: "0.200001", settle: "never left · AmountExceedsCap" },
      { who: ["The 19/10 payment", "replayed"], sub: "the same order, byte for byte", verdict: "REFUSED", amount: "0.10", settle: "never left · Expired" },
    ] as Row[],
    foot: "The first two rows were checked just now, straight from the network. The refusals come from the mainnet attack on the vault on 20/10, with the agent's key in the attacker's hands.",
    report: "Read the report ↗",
  },
} as const;

const chip: Record<Verdict, string> = {
  ATTESTED: "bg-[#e6f7ee] text-[#137a46] border-[#137a46]/20",
  PAID: "bg-[#eaf0ff] text-[#002FA7] border-[#002FA7]/20",
  REFUSED: "bg-[#ffe9e7] text-[#c0281c] border-[#c0281c]/20",
};

export function RealLedger({ lang = "pt" }: { lang?: Lang }) {
  const t = T[lang];
  const [checked, setChecked] = useState<Record<string, { ok: boolean; block: bigint } | "fail">>({});

  useEffect(() => {
    let on = true;
    for (const h of [SETTLED_TX, TOPUP_TX]) {
      verifyTx(h).then((r) => on && setChecked((c) => ({ ...c, [h]: r }))).catch(() => on && setChecked((c) => ({ ...c, [h]: "fail" })));
    }
    return () => { on = false; };
  }, []);

  const settleCell = (r: Row) => {
    if (r.tx) {
      const c = checked[r.tx];
      const label = c === undefined ? t.checking : c === "fail" || !c.ok ? t.fail : `${t.settled} ${Number(c.block).toLocaleString("pt-BR")}`;
      return <a href={txUrl(r.tx)} target="_blank" rel="noreferrer" className="text-[#137a46] hover:underline">{label} ↗</a>;
    }
    return <span className={r.verdict === "REFUSED" ? "text-[#c0281c]" : "text-[#002FA7]"}>{r.settle}</span>;
  };

  return (
    <div className="rounded-[22px] border border-[#0a0a0a]/10 bg-white shadow-[0_30px_80px_-40px_rgba(10,10,10,.35)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 md:px-7 py-4 border-b border-[#0a0a0a]/10">
        <span className="font-semibold tracking-[-0.01em]">{t.title}</span>
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/50">
          <span className="w-1.5 h-1.5 rounded-full bg-[#137a46] animate-pulse" />{t.right}
        </span>
      </div>
      <div className="hidden md:grid grid-cols-[1.6fr_.7fr_.6fr_1.3fr] px-7 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/40 border-b border-[#0a0a0a]/8">
        {t.cols.map((c, i) => <span key={c} className={i === 2 ? "text-right pr-6" : i === 3 ? "text-right" : ""}>{c}</span>)}
      </div>
      {t.rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-[1.6fr_.7fr_.6fr_1.3fr] gap-y-2 items-center px-6 md:px-7 py-4 border-b last:border-b-0 border-[#0a0a0a]/8 hover:bg-[#002FA7]/[0.025] transition-colors">
          <div className="col-span-2 md:col-span-1">
            <div className="text-[15px]"><span className="font-semibold">{r.who[0]}</span><span className="text-[#0a0a0a]/35 mx-1.5">→</span><span className="text-[#0a0a0a]/70">{r.who[1]}</span></div>
            <div className="text-[12px] text-[#0a0a0a]/45 mt-0.5">{r.sub}</div>
          </div>
          <div><span className={`inline-block rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.12em] ${chip[r.verdict]}`}>{t.verdict[r.verdict]}</span></div>
          <div className={`text-right md:pr-6 font-mono text-[14px] font-semibold ${r.verdict === "REFUSED" ? "line-through text-[#0a0a0a]/35" : ""}`}>US$ {r.amount}</div>
          <div className="col-span-2 md:col-span-1 md:text-right font-mono text-[11px]">{settleCell(r)}</div>
        </div>
      ))}
      <div className="px-6 md:px-7 py-4 bg-[#0a0a0a]/[0.02] border-t border-[#0a0a0a]/8 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#0a0a0a]/55">
        <span className="max-w-[70ch]">{t.foot}</span>
        <a href={REDTEAM_REPORT} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-[#002FA7] hover:underline whitespace-nowrap">{t.report}</a>
      </div>
    </div>
  );
}
