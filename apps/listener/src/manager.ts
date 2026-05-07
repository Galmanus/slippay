import type { SupabaseClient } from "@supabase/supabase-js";
import { watchAccount } from "./horizon.js";
import { log } from "./log.js";
import { config } from "./config.js";

interface Active { stop: () => void; }

export function startManager(db: SupabaseClient) {
  const active = new Map<string, Active>();

  async function tick() {
    const { data, error } = await db.from("merchants").select("stellar_address").eq("active", true).not("stellar_address", "is", null);
    if (error) { log("error", "manager_query_failed", { error: error.message }); return; }
    const desired = new Set((data ?? []).map(r => r.stellar_address as string));

    for (const addr of desired) {
      if (!active.has(addr)) {
        try {
          const stop = await watchAccount({ db, network: config.network, accountId: addr });
          active.set(addr, { stop });
          log("info", "manager_started", { addr });
        } catch (e) {
          log("error", "manager_start_failed", { addr, error: String(e) });
        }
      }
    }
    for (const addr of [...active.keys()]) {
      if (!desired.has(addr)) {
        active.get(addr)?.stop();
        active.delete(addr);
        log("info", "manager_stopped", { addr });
      }
    }
  }

  tick();
  const id = setInterval(tick, config.merchantPollMs);

  return () => {
    clearInterval(id);
    for (const a of active.values()) a.stop();
    active.clear();
  };
}
