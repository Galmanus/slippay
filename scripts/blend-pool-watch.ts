// Blend/DeFindex exposure watcher — cofre hardening after the YieldBlox hack
// (22/02/2026, $10.2M: a COMMUNITY Blend pool listed an illiquid RWA collateral
// whose SDEX-VWAP oracle price was manipulated 100x; lenders ate the bad debt).
//
// Slippay's cofre routes: DeFindex vault CDB6GLRR… → strategy CDB2WMKQ… →
// Blend Fixed pool CAJJZSGM… (reserves today: XLM, USDC, EURC — deep-liquidity
// assets, verified 21/07/2026). The attack class only reaches the cofre if the
// POOL's risk surface changes. This watcher snapshots that surface hourly and
// pushes an alert on ANY drift:
//   - pool reserve list (a new collateral listed = the YieldBlox precondition)
//   - pool oracle address / status / bstop_rate / max_positions
//   - vault strategy set (strategy swapped/paused) + vault fees
//   - strategy config (pool/asset changed via keeper)
//
// Runs on the 165 via cron (user manuel, no sudo):
//   0 * * * * ~/.deno/bin/deno run --allow-net --allow-read --allow-write \
//     /opt/slippay-backend/scripts/blend-pool-watch.ts >> \
//     /opt/slippay-backend/blend-watch/run.log 2>&1
// Alerts: ntfy.sh push (topic in NTFY_TOPIC below — subscribe on the phone)
// + append-only /opt/slippay-backend/blend-watch/alerts.log (source of truth).
import * as S from "npm:@stellar/stellar-sdk@15";

const RPC = "https://soroban-rpc.mainnet.stellar.gateway.fm";
const PASSPHRASE = S.Networks.PUBLIC;
const VAULT = "CDB6GLRRBBN3B7MGARZQDFAXDUGFWY74E24MPNGEXMM3M5KZEKE4AMKS";
const STRATEGY = "CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP";
const POOL = "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD";
const NTFY_TOPIC = Deno.env.get("BLEND_WATCH_NTFY") ?? "slippay-blend-watch-kx7q2m";
const STATE_DIR = Deno.env.get("BLEND_WATCH_DIR") ?? "/opt/slippay-backend/blend-watch";

const server = new S.rpc.Server(RPC, { allowHttp: false });
const probe = S.Keypair.random();

async function view(contract: string, fn: string): Promise<unknown> {
  const tx = new S.TransactionBuilder(new S.Account(probe.publicKey(), "0"), {
    fee: "100", networkPassphrase: PASSPHRASE,
  }).addOperation(S.Operation.invokeContractFunction({ contract, function: fn, args: [] }))
    .setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (S.rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(`${contract}.${fn}: sim failed`);
  return S.scValToNative(sim.result.retval);
}

async function strategyConfig(): Promise<unknown> {
  const key = S.xdr.LedgerKey.contractData(new S.xdr.LedgerKeyContractData({
    contract: new S.Address(STRATEGY).toScAddress(),
    key: S.xdr.ScVal.scvLedgerKeyContractInstance(),
    durability: S.xdr.ContractDataDurability.persistent(),
  }));
  const res = await server.getLedgerEntries(key);
  for (const e of res.entries[0].val.contractData().val().instance().storage() ?? []) {
    try {
      if (JSON.stringify(S.scValToNative(e.key())).includes("Config")) {
        return S.scValToNative(e.val());
      }
    } catch { /* non-native key, skip */ }
  }
  throw new Error("strategy Config not found in instance storage");
}

const j = (x: unknown) => JSON.stringify(x, (_k, v) => typeof v === "bigint" ? String(v) : v, 1);

async function notify(title: string, body: string) {
  try {
    await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { Title: title, Priority: "high", Tags: "warning,bank" },
      body,
    });
  } catch (e) {
    console.error("ntfy failed:", (e as Error).message);
  }
}

async function main() {
  const snapshot = {
    pool_config: await view(POOL, "get_config"),
    pool_reserves: await view(POOL, "get_reserve_list"),
    vault_assets: await view(VAULT, "get_assets"),
    vault_fees: await view(VAULT, "get_fees"),
    strategy_config: await strategyConfig(),
  };
  const now = new Date().toISOString();
  await Deno.mkdir(STATE_DIR, { recursive: true });
  const statePath = `${STATE_DIR}/baseline.json`;
  const current = j(snapshot);

  let baseline: string | null = null;
  try { baseline = await Deno.readTextFile(statePath); } catch { /* first run */ }

  if (baseline === null) {
    await Deno.writeTextFile(statePath, current);
    console.log(`${now} baseline written`);
    await notify("Slippay cofre watcher ativo", "Baseline do pool Blend/vault gravada. Alertas ligados.");
    return;
  }
  if (baseline === current) {
    console.log(`${now} ok (no drift)`);
    return;
  }
  // Drift: alert with a compact diff hint, keep the old baseline aside, adopt new.
  const alert = `${now} DRIFT DETECTED\n--- baseline\n${baseline}\n--- current\n${current}\n`;
  await Deno.writeTextFile(`${STATE_DIR}/alerts.log`, alert, { append: true });
  await Deno.writeTextFile(`${STATE_DIR}/baseline.prev.${Date.now()}.json`, baseline);
  await Deno.writeTextFile(statePath, current);
  console.log(`${now} DRIFT — alerted`);
  await notify(
    "⚠ Cofre Slippay: superfície do Blend mudou",
    "Reserva/oráculo/strategy/fee do caminho do cofre mudou on-chain. Ver /opt/slippay-backend/blend-watch/alerts.log no 165 antes de qualquer depósito novo.",
  );
}

const failPath = `${STATE_DIR}/consecutive_failures`;
try {
  await main();
  // Success: reset the persistent-failure counter.
  try { await Deno.remove(failPath); } catch { /* none */ }
} catch (e) {
  console.error("watcher error:", (e as Error).message);
  // RPC hiccups happen; only page on persistent failure (3+ consecutive).
  let n = 0;
  try { n = Number(await Deno.readTextFile(failPath)) || 0; } catch { /* first failure */ }
  n += 1;
  await Deno.mkdir(STATE_DIR, { recursive: true });
  await Deno.writeTextFile(failPath, String(n));
  if (n >= 3) await notify("Cofre watcher FALHANDO", `${n} falhas seguidas: ${(e as Error).message}`);
}
