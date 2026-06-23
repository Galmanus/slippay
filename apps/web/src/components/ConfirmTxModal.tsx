import type { TxSummary, OpSummary } from "../lib/txguard.ts";

interface Props {
  summary: TxSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmTxModal({ summary, onConfirm, onCancel }: Props) {
  const payments = summary.operations.filter((o) => o.type === "payment");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/60"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar transação"
    >
      <div className="bg-[#f1eee7] text-[#0a0a0a] w-full max-w-md mx-4 p-8 shadow-2xl">
        {/* Header */}
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-6">
          <span className="inline-block w-2 h-2 bg-[#0a0a0a]/70 mr-2 align-middle" />
          Confirmar transação
        </div>

        {/* Operations */}
        <div className="space-y-6">
          {payments.length === 0 && (
            <div className="text-sm text-[#0a0a0a]/70">
              Nenhum pagamento detectado nesta transação.
            </div>
          )}

          {payments.map((op, i) => (
            <PaymentRow key={i} op={op} />
          ))}
        </div>

        {/* Memo */}
        {summary.memo && (
          <div className="mt-6 border-l-2 border-[#0a0a0a]/20 pl-4">
            <Label>Memo</Label>
            <div className="font-mono text-sm break-all">{summary.memo}</div>
          </div>
        )}

        {/* Source */}
        <div className="mt-4 border-l-2 border-[#0a0a0a]/10 pl-4">
          <Label>Conta origem</Label>
          <div className="font-mono text-xs break-all text-[#0a0a0a]/70">{summary.source}</div>
        </div>

        {/* Warning */}
        <div className="mt-6 text-[10px] uppercase tracking-[0.14em] text-[#0a0a0a]/50 border border-[#0a0a0a]/15 px-3 py-2">
          Verifique os dados antes de confirmar. Esta ação não pode ser desfeita.
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-[#0a0a0a] py-4 text-sm uppercase tracking-[0.18em] hover:bg-[#0a0a0a]/5"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#0a0a0a] text-[#f1eee7] py-4 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a]"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentRow({ op }: { op: OpSummary }) {
  return (
    <div className="space-y-2">
      <div>
        <Label>Destino</Label>
        <div className="font-mono text-sm break-all">
          {op.destination ?? "—"}
        </div>
      </div>
      <div className="flex gap-8">
        <div>
          <Label>Valor</Label>
          <div className="text-2xl font-medium tabular-nums">
            {op.amount ?? "—"}
          </div>
        </div>
        <div>
          <Label>Ativo</Label>
          <div className="text-2xl font-medium">{op.assetCode ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-1">
      {children}
    </div>
  );
}
