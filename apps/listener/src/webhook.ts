import { signWebhook } from "./crypto.js";
import { log } from "./log.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSafeWebhookUrl } from "./ssrf.js";

const SCHEDULE = [60, 300, 1800, 7200, 43200, 86400];

export function nextBackoff(attempt: number): number | null {
  return SCHEDULE[attempt] ?? null;
}

export interface DeliverArgs {
  url: string;
  secret: string;
  deliveryId: string;
  payload: unknown;
}

export interface DeliverResult {
  status: "sent" | "failed";
  code?: number;
  body?: string;
}

export async function deliverOnce(args: DeliverArgs): Promise<DeliverResult> {
  const body = JSON.stringify(args.payload);
  const t = Math.floor(Date.now() / 1000);
  const sig = await signWebhook(args.secret, body, t);
  try {
    const r = await fetch(args.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slippay-signature": sig,
        "x-slippay-delivery-id": args.deliveryId,
      },
      body,
    });
    const text = await r.text().catch(() => "");
    return { status: r.ok ? "sent" : "failed", code: r.status, body: text.slice(0, 500) };
  } catch (e) {
    return { status: "failed", body: String(e) };
  }
}

export function startWebhookWorker(db: SupabaseClient, network: "testnet"|"mainnet") {
  let stopped = false;

  async function tick() {
    while (!stopped) {
      const { data: rows } = await db.from("webhook_deliveries")
        .select("id, order_id, payload, attempt_n, status, orders ( merchants ( webhook_url, webhook_secret, network ) )")
        .in("status", ["queued", "failed"])
        .lte("next_attempt_at", new Date().toISOString())
        .order("next_attempt_at", { ascending: true })
        .limit(50);

      if (!rows || rows.length === 0) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      for (const row of rows) {
        const merchant = (row as any).orders?.merchants as { webhook_url?: string; webhook_secret?: string; network?: string };
        if (!merchant?.webhook_url) {
          await db.from("webhook_deliveries").update({ status: "dead", response_body: "no_webhook_url" }).eq("id", row.id);
          continue;
        }
        if (!isSafeWebhookUrl(merchant.webhook_url, network)) {
          await db.from("webhook_deliveries").update({ status: "dead", response_body: "unsafe_url" }).eq("id", row.id);
          continue;
        }

        const result = await deliverOnce({
          url: merchant.webhook_url,
          secret: merchant.webhook_secret!,
          deliveryId: row.id as string,
          payload: row.payload,
        });

        const newAttempt = (row.attempt_n as number) + 1;
        if (result.status === "sent") {
          await db.from("webhook_deliveries").update({
            status: "sent",
            response_code: result.code,
            response_body: result.body,
            attempt_n: newAttempt,
            last_attempt_at: new Date().toISOString(),
          }).eq("id", row.id);
          log("info", "webhook_sent", { id: row.id, code: result.code });
        } else {
          const backoff = nextBackoff(newAttempt - 1);
          await db.from("webhook_deliveries").update({
            status: backoff === null ? "dead" : "failed",
            response_code: result.code,
            response_body: result.body,
            attempt_n: newAttempt,
            last_attempt_at: new Date().toISOString(),
            next_attempt_at: backoff === null
              ? new Date().toISOString()
              : new Date(Date.now() + backoff * 1000).toISOString(),
          }).eq("id", row.id);
          log("warn", "webhook_failed", { id: row.id, attempt: newAttempt, backoff });
        }
      }
    }
  }

  tick();
  return () => { stopped = true; };
}
