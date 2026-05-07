import { useEffect, useState } from "react";
import { authFetch } from "../lib/apiAuth.ts";

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

const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-400 bg-amber-900/30",
  paid: "text-emerald-400 bg-emerald-900/30",
  underpaid: "text-orange-400 bg-orange-900/30",
  expired: "text-zinc-500 bg-zinc-800",
  cancelled: "text-zinc-500 bg-zinc-800",
  dead: "text-red-400 bg-red-900/30",
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

  if (orders === null) return <div className="text-zinc-400">loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">orders</h1>
      {orders.length === 0
        ? <div className="text-zinc-500 text-sm">no orders yet. POST to /v1/orders with your API key to create one.</div>
        : (
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-left">
              <tr>
                <th className="py-2">id</th>
                <th>ref</th>
                <th>BRL</th>
                <th>USDC</th>
                <th>status</th>
                <th>created</th>
                <th>tx</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t border-zinc-800">
                  <td className="py-2 font-mono text-xs text-zinc-400">{o.id.slice(0,8)}</td>
                  <td className="text-zinc-400">{o.external_ref ?? "—"}</td>
                  <td>R$ {Number(o.brl_amount).toFixed(2)}</td>
                  <td className="tabular-nums">{o.usdc_amount}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[o.status] ?? ""}`}>{o.status}</span>
                  </td>
                  <td className="text-zinc-500 text-xs">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="font-mono text-xs">
                    {o.tx_hash
                      ? <a href={`https://stellar.expert/explorer/testnet/tx/${o.tx_hash}`} target="_blank" rel="noreferrer"
                           className="text-emerald-400 hover:underline">{o.tx_hash.slice(0,8)}</a>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}
