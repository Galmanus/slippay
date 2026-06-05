// Interactive proof of "o agente não decide, ele executa". The visitor sets the
// spending limit, then lets the agent try to pay. Within the rule -> PAGO (green).
// Over the limit or to an unapproved recipient -> BLOQUEADO (red), with the reason.
// Pure client-side simulation; it mirrors the on-chain rule, it does not call it.
import { useState } from "react";

const fmt = (n: number) => "R$" + n.toLocaleString("pt-BR");

type Attempt = { who: string; amount: number; approved: boolean };
const ATTEMPTS: Attempt[] = [
  { who: "Conta de API", amount: 8000, approved: true },
  { who: "Fornecedor", amount: 22000, approved: true },
  { who: "Destino desconhecido", amount: 3000, approved: false },
];

type Verdict = { ok: boolean; who: string; amount: number; reason: string; n: number };

export function RuleSandbox() {
  const [cap, setCap] = useState(10000);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [n, setN] = useState(0);

  function tryPay(a: Attempt) {
    let ok = true;
    let reason = "dentro da regra";
    if (!a.approved) { ok = false; reason = "destino fora da lista aprovada"; }
    else if (a.amount > cap) { ok = false; reason = `acima do limite de ${fmt(cap)}`; }
    setN((x) => x + 1);
    setVerdict({ ok, who: a.who, amount: a.amount, reason, n: n + 1 });
  }

  return (
    <div className="rounded-2xl p-6 md:p-8 border border-[#f1eee7]/12 bg-[#f1eee7]/[0.03]">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#f1eee7]/45">teste você mesmo</div>

      {/* limit slider */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-[#f1eee7]/65">Limite por pagamento</span>
          <span className="text-2xl font-semibold tabular-nums text-[#b5e853]">{fmt(cap)}</span>
        </div>
        <input
          type="range" min={1000} max={50000} step={1000} value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          className="mt-3 w-full accent-[#b5e853] cursor-pointer"
          aria-label="limite por pagamento"
        />
        <div className="flex justify-between font-mono text-[10px] text-[#f1eee7]/35 mt-1">
          <span>R$1 mil</span><span>R$50 mil</span>
        </div>
      </div>

      {/* the agent tries */}
      <div className="mt-7">
        <div className="text-[13px] text-[#f1eee7]/65 mb-3">O agente tenta pagar:</div>
        <div className="flex flex-wrap gap-2.5">
          {ATTEMPTS.map((a) => (
            <button
              key={a.who}
              onClick={() => tryPay(a)}
              className="rounded-full px-4 py-2.5 text-[12px] border border-[#f1eee7]/20 hover:border-[#b5e853] hover:text-[#b5e853] transition-colors text-left"
            >
              {a.who} · <span className="tabular-nums">{fmt(a.amount)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* verdict */}
      <div className="mt-7 min-h-[92px]">
        {verdict ? (
          <div
            key={verdict.n}
            className="verdict rounded-xl px-5 py-4 border"
            style={{
              borderColor: verdict.ok ? "rgba(74,222,128,.35)" : "rgba(248,113,113,.4)",
              background: verdict.ok ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid place-items-center w-7 h-7 rounded-full text-[15px] font-bold"
                style={{
                  background: verdict.ok ? "#b5e853" : "#f87171",
                  color: "#0a0a0a",
                }}
              >
                {verdict.ok ? "✓" : "✕"}
              </span>
              <span
                className="font-semibold tracking-[-0.01em] text-lg"
                style={{ color: verdict.ok ? "#b5e853" : "#f87171" }}
              >
                {verdict.ok ? "PAGO" : "BLOQUEADO"}
              </span>
              <span className="ml-auto font-mono text-[12px] tabular-nums text-[#f1eee7]/55">
                {fmt(verdict.amount)} → {verdict.who}
              </span>
            </div>
            <div className="mt-2 text-[13px] text-[#f1eee7]/60">
              {verdict.ok
                ? "Dentro do limite e destino aprovado. Liquida em segundos, verificável on-chain."
                : verdict.reason + ". O agente parou e te chamaria."}
            </div>
          </div>
        ) : (
          <div className="rounded-xl px-5 py-4 border border-dashed border-[#f1eee7]/15 text-[13px] text-[#f1eee7]/40">
            Ajuste o limite e deixe o agente tentar. Ele só executa o que cabe na sua regra.
          </div>
        )}
      </div>

      <style>{`
        @keyframes verdictIn { from { opacity: 0; transform: translateY(6px) scale(.99) } to { opacity: 1; transform: none } }
        .verdict { animation: verdictIn .35s cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
}
