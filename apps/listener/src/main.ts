import { config } from "./config.js";
import { log } from "./log.js";

async function main() {
  log("info", "listener_starting", { network: config.network });
  // Tasks 8-11 will fill in subscription logic
  process.on("SIGTERM", () => { log("info", "listener_stop"); process.exit(0); });
  // keep alive
  await new Promise(() => {});
}

main().catch(e => { log("error", "fatal", { error: String(e) }); process.exit(1); });
