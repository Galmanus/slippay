import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchOrder, type PublicOrder } from "../lib/api.ts";
import { Countdown } from "../components/Countdown.tsx";

export default function Checkout() {
  const { order_id } = useParams<{ order_id: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order_id) return;
    fetchOrder(order_id).then(setOrder).catch(e => setError(e.message));
  }, [order_id]);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!order) return <div className="p-8 text-zinc-400">loading...</div>;

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-semibold">pay with crypto</h1>
      <div className="mt-8 rounded-lg bg-zinc-900 p-6">
        <div className="text-sm text-zinc-500">amount due</div>
        <div className="text-3xl font-semibold mt-1">R$ {Number(order.brl_amount).toFixed(2)}</div>
        <div className="text-zinc-500 mt-2 tabular-nums">{order.usdc_amount} USDC</div>
        <div className="mt-6 text-sm text-zinc-500">
          expires in <Countdown expiresAt={order.expires_at} />
        </div>
      </div>
      <button disabled className="mt-6 w-full rounded-lg bg-zinc-800 text-zinc-500 py-3">
        connect wallet (Task 4)
      </button>
    </main>
  );
}
