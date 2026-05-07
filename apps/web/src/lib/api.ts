const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:54321/functions/v1/api";

export interface PublicOrder {
  id: string;
  brl_amount: string | number;
  usdc_amount: string;
  memo: string;
  status: string;
  expires_at: string;
  paid_at: string | null;
  tx_hash: string | null;
  created_at: string;
  external_ref: string | null;
  merchant_id: string;
  merchant_stellar_address: string | null;
}

export async function fetchOrder(id: string): Promise<PublicOrder> {
  const r = await fetch(`${API_BASE}/v1/orders/${id}`);
  if (!r.ok) throw new Error(`fetch_order_${r.status}`);
  const j = await r.json() as { order: PublicOrder };
  return j.order;
}
