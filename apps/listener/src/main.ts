import { config } from "./config.js";
import { db } from "./db.js";
import { startManager } from "./manager.js";
import { log } from "./log.js";

async function main() {
  log("info", "listener_starting", { network: config.network });
  const stop = startManager(db);
  process.on("SIGTERM", () => { log("info", "listener_stop"); stop(); process.exit(0); });
  await new Promise(() => {});
}

main().catch(e => { log("error", "fatal", { error: String(e) }); process.exit(1); });
