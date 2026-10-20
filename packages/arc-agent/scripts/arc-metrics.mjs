// On-chain AgentVault metrics for Arc: payments, active wallets, active days, volume.
//
// Reads ONLY `AgentSpend` logs emitted by the vaults listed in docs/arc/vaults.json (read-only RPC:
// eth_chainId, eth_blockNumber, eth_getCode, eth_call owner(), eth_getLogs, eth_getBlockByNumber),
// aggregates them with src/metrics.ts and writes a Markdown table + the raw JSON. Anyone with the
// registry and a public RPC gets the same numbers.
//
// usage (Node >= 22.18, which runs the .ts sources directly; no build step):
//   node packages/arc-agent/scripts/arc-metrics.mjs --network mainnet   # -> docs/arc/metrics.{md,json}
//   node packages/arc-agent/scripts/arc-metrics.mjs --network testnet   # -> docs/arc/metrics-testnet.{md,json}
// options: --registry <file> (default docs/arc/vaults.json) · --out <path without extension>
//          --rpc <url> (default from ARC_NETWORKS) · env ARC_NETWORK / ARC_RPC_URL work as well.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createPublicClient, defineChain, formatUnits, getAddress, http, parseAbi, toEventSelector } from "viem";
import { ARC_NETWORKS } from "../src/constants.ts";
import { ACTIVE_WINDOW_DAYS, AGENT_SPEND_EVENTS, USDC_DECIMALS, aggregate, parseVaultRegistry, spendEventsFromLogs } from "../src/metrics.ts";

const CHUNK = 10_000n; // max blocks per eth_getLogs call
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const { values: opt } = parseArgs({
  options: {
    network: { type: "string" },
    registry: { type: "string" },
    out: { type: "string" },
    rpc: { type: "string" },
  },
});
const network = opt.network ?? process.env.ARC_NETWORK;
if (network !== "mainnet" && network !== "testnet") {
  console.error("usage: arc-metrics.mjs --network testnet|mainnet [--registry file] [--out path] [--rpc url]");
  process.exit(2);
}
const NET = ARC_NETWORKS[network];
const rpc = opt.rpc ?? process.env.ARC_RPC_URL ?? NET.rpcUrl;
const registryPath = resolve(opt.registry ?? `${ROOT}/docs/arc/vaults.json`);
const outBase = resolve(opt.out ?? `${ROOT}/docs/arc/${network === "mainnet" ? "metrics" : "metrics-testnet"}`);
const log = (...a) => console.error(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PACE_MS = 150; // public Arc RPCs answer -32005 "rate limit exceeded" to back-to-back getLogs

/** Retry rate-limited RPC calls (-32005 / HTTP 429) with backoff; anything else fails the run. */
async function withBackoff(label, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const limited = e?.code === -32005 || e?.cause?.code === -32005 || e?.status === 429 || e?.cause?.status === 429;
      if (!limited || attempt >= 6) throw e;
      const wait = Math.min(2_000 * 2 ** attempt, 30_000);
      log(`  rate limited on ${label}, retry ${attempt + 1}/6 in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

const chain = defineChain({
  id: NET.chainId,
  name: network === "mainnet" ? "Arc" : "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const client = createPublicClient({ chain, transport: http(rpc, { retryCount: 4, retryDelay: 500, timeout: 30_000 }) });

const remoteChainId = await client.getChainId();
if (remoteChainId !== NET.chainId) throw new Error(`RPC ${rpc} is chain ${remoteChainId}, expected ${NET.chainId} (${network})`);

const vaults = parseVaultRegistry(JSON.parse(readFileSync(registryPath, "utf8"))).filter((v) => v.network === network);
const latest = await client.getBlockNumber();
const now = new Date();
log(`${network} (chain ${NET.chainId}) · ${rpc} · latest block ${latest} · ${vaults.length} registered vault(s)`);

// 1. sanity-check each registry entry against the chain, then pull its AgentSpend logs.
const ownerAbi = parseAbi(["function owner() view returns (address)"]);
const rawLogs = [];
for (const v of vaults) {
  const code = await client.getCode({ address: v.address });
  if (!code || code === "0x") throw new Error(`${v.label} ${v.address}: no contract code on ${network}`);
  const owner = await client.readContract({ address: v.address, abi: ownerAbi, functionName: "owner" });
  if (getAddress(owner) !== getAddress(v.owner)) {
    throw new Error(`${v.label} ${v.address}: registry owner ${v.owner} but on-chain owner() is ${owner}`);
  }
  let found = 0;
  let calls = 0;
  for (let from = BigInt(v.fromBlock); from <= latest; from += CHUNK) {
    const to = from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest;
    const logs = await withBackoff(`getLogs ${from}..${to}`, () =>
      client.getLogs({ address: v.address, events: AGENT_SPEND_EVENTS, fromBlock: from, toBlock: to, strict: false }));
    await sleep(PACE_MS);
    calls += 1;
    found += logs.length;
    rawLogs.push(...logs);
  }
  log(`  ${v.label} ${v.address}: ${found} AgentSpend log(s) in blocks ${v.fromBlock}..${latest} (${calls} getLogs calls)`);
}

// 2. block timestamps, one getBlock per distinct block.
const timestamps = new Map();
for (const n of new Set(rawLogs.map((l) => l.blockNumber))) {
  const block = await withBackoff(`getBlock ${n}`, () => client.getBlock({ blockNumber: n }));
  timestamps.set(n, Number(block.timestamp));
}

// 3. aggregate (pure) and write the report.
const events = spendEventsFromLogs(rawLogs, timestamps);
const live = rawLogs.filter((l) => !l.removed).length;
if (events.length !== live) throw new Error(`decoded ${events.length} AgentSpend events from ${live} matching logs: refusing to report a partial count`);
const m = aggregate(events, vaults, now);
const byVault = new Map(vaults.map((v) => [v.address.toLowerCase(), v]));
const iso = (s) => new Date(s * 1000).toISOString();
const txUrl = (h) => `${NET.explorer}/tx/${h}`;
const addrUrl = (a) => `${NET.explorer}/address/${a}`;
const topic0 = AGENT_SPEND_EVENTS.map((e) => toEventSelector(e));

const payments = [...events]
  .sort((a, b) => a.blockTimestamp - b.blockTimestamp || Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex)
  .map((e) => {
    const v = byVault.get(e.vault.toLowerCase());
    return {
      vault: e.vault, label: v.label, external: v.external,
      txHash: e.txHash, logIndex: e.logIndex, blockNumber: e.blockNumber.toString(),
      time: iso(e.blockTimestamp), agentSigner: e.agentSigner, agentId: e.agentId.toString(), to: e.to,
      amountUsdc: formatUnits(e.amount, USDC_DECIMALS), orderId: e.orderId, explorer: txUrl(e.txHash),
      internal: (v.internalRecipients ?? []).some((r) => r.toLowerCase() === e.to.toLowerCase()),
    };
  });
const internal = payments.filter((p) => p.internal);
const internalUsdc = formatUnits(events.filter((e) => (byVault.get(e.vault.toLowerCase()).internalRecipients ?? [])
  .some((r) => r.toLowerCase() === e.to.toLowerCase())).reduce((n, e) => n + e.amount, 0n), USDC_DECIMALS);

const report = {
  schema: "slippay.arc-metrics/1",
  network, chainId: NET.chainId, rpc, explorer: NET.explorer,
  generatedAt: now.toISOString(), latestBlock: latest.toString(),
  source: { event: "AgentSpend", topic0, getLogsChunkBlocks: Number(CHUNK), registry: relative(ROOT, registryPath) },
  vaults, metrics: m, payments,
};

const yes = (b) => (b ? "yes" : "no");
const md = [
  `# Arc agent payments: on-chain metrics (${network})`,
  "",
  `Generated ${now.toISOString()} from Arc ${network} (chain ${NET.chainId}) at block ${latest}.`,
  `Every number is derived from \`AgentSpend\` events of the vaults in \`${relative(ROOT, registryPath)}\`.`,
  `Reproduce: \`node packages/arc-agent/scripts/arc-metrics.mjs --network ${network}\`.`,
  "",
  "## Summary",
  "",
  "| metric | all registered vaults | external (pilot) vaults |",
  "|---|---:|---:|",
  `| agent payments (AgentSpend events) | ${m.payments} | ${m.external.payments} |`,
  `| active wallets (vaults with >= 1 payment, all time) | ${m.activeWallets} | ${m.external.activeWallets} |`,
  `| active wallets, last ${ACTIVE_WINDOW_DAYS} days | ${m.activeWallets28d} | ${m.external.activeWallets28d} |`,
  `| active days (distinct UTC dates with >= 1 payment) | ${m.activeDays} | ${m.external.activeDays} |`,
  `| volume (USDC) | ${m.volumeUsdc} | ${m.external.volumeUsdc} |`,
  ...(internal.length ? ["", `Of these, ${internal.length} payment(s), ${internalUsdc} USDC, went to a vault's own wallet (the agent's x402 float, \`internalRecipients\` in the registry): internal transfers, not payments to a counterparty.`] : []),
  "",
  `${ACTIVE_WINDOW_DAYS}-day window: ${m.window28d.from} to ${m.window28d.to}. Active UTC dates: ${m.days.join(", ") || "none"}.`,
  "",
  "## Per vault",
  "",
  "| vault | label | external | owner | payments | volume (USDC) | active days | first payment | last payment |",
  "|---|---|---|---|---:|---:|---:|---|---|",
  ...m.perVault.map((v) =>
    `| [\`${v.address}\`](${addrUrl(v.address)}) | ${v.label} | ${yes(v.external)} | \`${v.owner}\` | ${v.payments} | ${v.volumeUsdc} | ${v.activeDays} | ${v.firstSpendAt ?? "-"} | ${v.lastSpendAt ?? "-"} |`),
  "",
  "## Payments",
  "",
  payments.length ? "| time (UTC) | vault | tx | log | block | agentId | to | USDC |" : "No AgentSpend events yet.",
  ...(payments.length ? ["|---|---|---|---:|---:|---:|---|---:|"] : []),
  ...payments.map((p) =>
    `| ${p.time} | ${p.label} | [\`${p.txHash.slice(0, 10)}…${p.txHash.slice(-4)}\`](${p.explorer}) | ${p.logIndex} | ${p.blockNumber} | ${p.agentId} | \`${p.to}\`${p.internal ? " (agent's float, internal)" : ""} | ${p.amountUsdc} |`),
  "",
  "## Method",
  "",
  "- One payment = one `AgentSpend` log, keyed by (txHash, logIndex); duplicates are dropped. Reverted transactions emit no logs, so they never count.",
  "- USDC `Transfer` logs are never read (on Arc one transfer emits two: the 18-decimal native log and the 6-decimal ERC-20 log). Amounts are `AgentSpend.amount`, 6 decimals.",
  `- \`eth_getLogs\` per vault from its registry \`fromBlock\` to the latest block, ${CHUNK} blocks per call, filtered on topic0 ${topic0.map((t) => `\`${t}\``).join(" (current AgentVault) and ")} (first deployed version, no \`attested\` field).`,
  "- Active wallet = vault with at least one payment. Active day = distinct UTC date (block timestamp) with at least one payment.",
  "- `external: false` marks Slippay-owned vaults (demo, e2e, adversarial cases). They are listed for transparency and excluded from the external column.",
  "- Before reading logs, each vault's code and immutable `owner()` are checked against the registry; a mismatch aborts the run.",
  "",
].join("\n");

const json = JSON.stringify(report, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
mkdirSync(dirname(outBase), { recursive: true });
writeFileSync(`${outBase}.md`, md);
writeFileSync(`${outBase}.json`, `${json}\n`);
log(`wrote ${relative(ROOT, outBase)}.md and .json`);
console.log(JSON.stringify({
  network, payments: m.payments, externalPayments: m.externalPayments, activeWallets: m.activeWallets,
  activeWallets28d: m.activeWallets28d, activeDays: m.activeDays, volumeUsdc: m.volumeUsdc, unregisteredEvents: m.unregisteredEvents,
}));
