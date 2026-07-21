// Guardian recovery watcher — pages the owner when someone starts a recovery
// on her wallet (guardian spec, threats #2/#3: the contest window only
// protects an owner who NOTICES; this is the noticing).
//
// Follows the wallets in /opt/slippay-backend/wallets.list (appended by the
// relayer /deploy route) and scans Soroban events for the guardian topics.
// Cron (user manuel, no sudo):
//   */10 * * * * cd /opt/slippay-backend/supabase/functions/api && \
//     $HOME/.deno/bin/deno run --node-modules-dir=none --allow-net --allow-read \
//     --allow-write --allow-env /opt/slippay-backend/scripts/guardian-watch.ts \
//     >> /opt/slippay-backend/guardian-watch/run.log 2>&1
// Alert: ntfy.sh topic below + append-only alerts.log (source of truth).
import * as S from "npm:@stellar/stellar-sdk@15";

const RPC = "https://mainnet.sorobanrpc.com";
const NTFY_TOPIC = Deno.env.get("GUARDIAN_WATCH_NTFY") ?? "slippay-guardian-watch-kx7q2m";
const STATE_DIR = Deno.env.get("GUARDIAN_WATCH_DIR") ?? "/opt/slippay-backend/guardian-watch";
const WALLETS_LIST = Deno.env.get("GUARDIAN_WALLETS_LIST") ?? "/opt/slippay-backend/wallets.list";

// Topic0 symbols worth paging about, with the mother-readable message.
const TOPICS: Record<string, string> = {
  recovery_started: "⚠ Alguém pediu para RECUPERAR a conta {w}. Se a dona está viva, ela deve abrir o app AGORA e tocar em 'Fui eu não / cancelar'.",
  recovery_cancelled: "Recuperação na conta {w} foi cancelada.",
  recovery_finished: "⚠ HERANÇA CONCLUÍDA na conta {w}: a passkey foi rotacionada.",
  guardian_set: "Conta {w} definiu um guardião.",
};

const server = new S.rpc.Server(RPC, { allowHttp: false });

async function notify(title: string, body: string) {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST", headers: { Title: title, Priority: "high", Tags: "shield" }, body,
    });
  } catch (e) { console.error("ntfy failed:", (e as Error).message); }
}

async function main() {
  let listRaw = "";
  try { listRaw = await Deno.readTextFile(WALLETS_LIST); } catch { return; } // no wallets yet
  const wallets = [...new Set(
    listRaw.split("\n").map((l) => l.trim().split(" ")[0]).filter((w) => w.startsWith("C")),
  )];
  if (!wallets.length) return;

  await Deno.mkdir(STATE_DIR, { recursive: true });
  const cursorPath = `${STATE_DIR}/last_ledger`;
  const latest = await server.getLatestLedger();
  let start = latest.sequence - 100; // first run: shallow backfill
  try { start = Number(await Deno.readTextFile(cursorPath)) + 1; } catch { /* first run */ }
  // RPC retention is bounded; never ask for more than it holds.
  if (latest.sequence - start > 100_000) start = latest.sequence - 100_000;
  if (start > latest.sequence) return;

  const now = new Date().toISOString();
  for (let i = 0; i < wallets.length; i += 5) { // RPC caps contractIds per filter
    const batch = wallets.slice(i, i + 5);
    const res = await server.getEvents({
      startLedger: start,
      filters: [{ type: "contract", contractIds: batch }],
      limit: 200,
    });
    for (const ev of res.events ?? []) {
      let sym = "";
      try { sym = S.scValToNative(ev.topic[0]) as string; } catch { continue; }
      const msg = TOPICS[sym];
      if (!msg) continue;
      const w = `${ev.contractId?.toString().slice(0, 6)}…`;
      const line = `${now} ${sym} ${ev.contractId} ledger=${ev.ledger}\n`;
      await Deno.writeTextFile(`${STATE_DIR}/alerts.log`, line, { append: true });
      await notify(`Slippay guardião: ${sym}`, msg.replace("{w}", w));
      console.log(line.trim());
    }
  }
  await Deno.writeTextFile(cursorPath, String(latest.sequence));
  console.log(`${now} scanned ${wallets.length} wallets to ledger ${latest.sequence}`);
}

const failPath = `${STATE_DIR}/consecutive_failures`;
try {
  await main();
  try { await Deno.remove(failPath); } catch { /* none */ }
} catch (e) {
  console.error("guardian-watch error:", (e as Error).message);
  let n = 0;
  try { n = Number(await Deno.readTextFile(failPath)) || 0; } catch { /* first */ }
  n += 1;
  await Deno.mkdir(STATE_DIR, { recursive: true });
  await Deno.writeTextFile(failPath, String(n));
  if (n >= 3) await notify("Guardian watcher FALHANDO", `${n} falhas seguidas: ${(e as Error).message}`);
}
