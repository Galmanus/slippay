import { config } from "./config.js";
import { db } from "./db.js";
import { watchAccount } from "./horizon.js";
import { log } from "./log.js";

async function main() {
  log("info", "listener_starting", { network: config.network });

  const { data: merchants } = await db.from("merchants").select("id, stellar_address").eq("active", true).not("stellar_address", "is", null);
  const stops: Array<() => void> = [];
  for (const m of merchants ?? []) {
    if (!m.stellar_address) continue;
    stops.push(await watchAccount({ db, network: config.network, accountId: m.stellar_address }));
  }

  process.on("SIGTERM", () => { log("info", "listener_stop"); for (const s of stops) s(); process.exit(0); });
  await new Promise(() => {});
}

main().catch(e => { log("error", "fatal", { error: String(e) }); process.exit(1); });
