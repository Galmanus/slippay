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

  const subscriptionId: string | null = data.subscription_id ?? null;

  // If this order was generated from a subscription and was successfully paid,
  // bump charges_done. If it hits max_periods, expire the subscription.
  if (subscriptionId && newStatus === "paid") {
    const { data: sub, error: subFetchErr } = await db.from("subscriptions")
      .select("charges_done, max_periods, status").eq("id", subscriptionId).maybeSingle();
    if (sub && !subFetchErr) {
      const nextCount = (sub.charges_done ?? 0) + 1;
      const reachedMax = sub.max_periods != null && nextCount >= sub.max_periods;
      const patch: Record<string, unknown> = {
        charges_done: nextCount,
        last_charge_at: new Date().toISOString(),
      };
      if (reachedMax) patch.status = "expired";
      const { error: subUpdErr } = await db.from("subscriptions")
        .update(patch).eq("id", subscriptionId);
      if (subUpdErr) {
        log("error", "subscription_update_failed", { subscription_id: subscriptionId, error: subUpdErr.message });
      }
    }
  }

  const payload = {
    type: outcome.outcome === "paid"
      ? (subscriptionId ? "subscription.charged" : "order.paid")
      : "order.underpaid",
    data: {
      id: order.id,
      subscription_id: subscriptionId,
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

  log("info", "order_reconciled", {
    order_id: order.id,
    subscription_id: subscriptionId,
    status: newStatus,
    tx_hash: txHash,
  });
}
