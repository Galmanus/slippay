import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchOutcome, OrderForMatch } from "./matcher.js";
import { log } from "./log.js";

export async function reconcileMatch(
  db: SupabaseClient,
  order: OrderForMatch & { merchant_id: string },
  outcome: MatchOutcome,
  txHash: string,
) {
  if (outcome.outcome === "ignore") return;

  const newStatus = outcome.outcome === "paid" ? "paid" : "underpaid";

  const { data, error } = await db.from("orders")
    .update({ status: newStatus, tx_hash: txHash, paid_at: newStatus === "paid" ? new Date().toISOString() : null })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("*").single();

  if (error || !data) {
    log("warn", "reconcile_skipped", { order_id: order.id, error: error?.message ?? "no_pending_row" });
    return;
  }

  const payload = {
    type: outcome.outcome === "paid" ? "order.paid" : "order.underpaid",
    data: {
      id: order.id,
      external_ref: data.external_ref,
      brl_amount: data.brl_amount,
      usdc_amount: data.usdc_amount,
      tx_hash: txHash,
      memo: order.memo,
      paid_at: data.paid_at,
      ...(outcome.outcome === "underpaid" ? { expected: outcome.expected, received: outcome.received } : {}),
    },
  };

  const { error: webhookError } = await db.from("webhook_deliveries").insert({
    order_id: order.id,
    type: payload.type,
    payload,
  });

  if (webhookError) {
    log("error", "webhook_insert_failed", { order_id: order.id, error: webhookError.message });
  }

  log("info", "order_reconciled", { order_id: order.id, status: newStatus, tx_hash: txHash });
}
