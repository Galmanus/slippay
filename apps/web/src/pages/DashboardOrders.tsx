import { useEffect, useState } from "react";
import { authFetch } from "../lib/apiAuth.ts";

const EXPLORER_BASE =
  (import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET").toUpperCase() === "PUBLIC"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

interface OrderRow {
  id: string;
  external_ref: string | null;
  brl_amount: string | number;
  usdc_amount: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  tx_hash: string | null;
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  paid: "bg-[#FDDA24]",
  underpaid: "bg-orange-500",
  expired: "bg-[#0a0a0a]/30",
  cancelled: "bg-[#0a0a0a]/30",
  dead: "bg-red-500",
};

export default function DashboardOrders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await authFetch("/v1/orders");
      if (!alive) return;
      const j = await r.json();
      setOrders(j.orders ?? []);
    }
    load();
    const id = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (orders === null) {
    return <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">Loading...</div>;
  }

  return (
    <div className="max-w-6xl">
      <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-3">001. Orders</div>
      <h1 className="text-5xl md:text-7xl font-medium tracking-[-0.04em] leading-[0.95] mb-16">
        {orders.length} {orders.length === 1 ? "order" : "orders"}
      </h1>

      {orders.length === 0
        ? (
          <div className="border border-[#0a0a0a]/10 p-8">
            <div className="text-base">No orders yet.</div>
            <p className="text-sm text-[#0a0a0a]/55 mt-2 max-w-[60ch]">
              Create one with a POST to /v1/orders using your API key from settings.
              Orders show up here in real time.
            </p>
          </div>
        )
        : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 text-left border-b border-[#0a0a0a]/20">
                <th className="py-4 font-normal">ID</th>
                <th className="font-normal">Ref</th>
                <th className="font-normal">BRL</th>
                <th className="font-normal">USDC</th>
                <th className="font-normal">Status</th>
                <th className="font-normal">Created</th>
                <th className="font-normal">Tx</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-[#0a0a0a]/10 hover:bg-[#0a0a0a]/[0.02]">
                  <td className="py-4 font-mono text-xs text-[#0a0a0a]/70">{o.id.slice(0,8)}</td>
                  <td className="text-sm text-[#0a0a0a]/70">{o.external_ref ?? "—"}</td>
                  <td className="text-sm tabular-nums">R$ {Number(o.brl_amount).toFixed(2)}</td>
                  <td className="text-sm tabular-nums">{o.usdc_amount}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                      <span className={`inline-block w-1.5 h-1.5 ${STATUS_DOT[o.status] ?? "bg-[#0a0a0a]/30"}`} />
                      {o.status}
                    </span>
                  </td>
                  <td className="text-xs text-[#0a0a0a]/55 tabular-nums">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="font-mono text-xs">
                    {o.tx_hash
                      ? <a href={`${EXPLORER_BASE}/${o.tx_hash}`}
                           target="_blank" rel="noreferrer"
                           className="border-b border-[#0a0a0a] hover:border-[#FDDA24]">
                          {o.tx_hash.slice(0,8)}
                        </a>
                      : <span className="text-[#0a0a0a]/30">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
