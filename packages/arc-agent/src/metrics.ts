// On-chain usage metrics for AgentVault, computed only from `AgentSpend` events so anyone can
// re-derive every number from Arc logs. Pure: no RPC, no clock (callers pass `now`).
//
// What counts as one payment: one AgentSpend log, identified by (txHash, logIndex). Reverted txs emit
// no logs, so they never count. USDC Transfer logs (Arc emits two per transfer: the 18-dec native
// system log and the 6-dec ERC-20 log) are never read.
import { formatUnits, getAddress, isAddress, parseAbiItem, parseEventLogs, type AbiEvent, type Address, type Hex, type Log } from "viem";
import { agentVaultAbi } from "./abi.ts";

/**
 * Every AgentSpend layout a deployed vault can emit. v1 (07bacd0, topic0 0xb23766a7…) is what the
 * 2026-10-13 testnet e2e vault runs; v2 (27510e6+, adds `attested`, topic0 0x9ea5d647…) is the current
 * source. Filtering on only one silently drops the other's payments.
 */
export const AGENT_SPEND_EVENTS = [
  agentVaultAbi.find((x): x is Extract<typeof x, { type: "event"; name: "AgentSpend" }> => x.type === "event" && x.name === "AgentSpend")!,
  parseAbiItem(
    "event AgentSpend(address indexed agentSigner, uint256 indexed agentId, address indexed to, uint256 amount, bytes32 orderId, uint64 nonce, bool pq)",
  ),
] as const satisfies readonly AbiEvent[];

/** USDC as an ERC-20 on Arc (what AgentVault moves and what AgentSpend.amount is denominated in). */
export const USDC_DECIMALS = 6;
/** Rolling window for `activeWallets28d`. */
export const ACTIVE_WINDOW_DAYS = 28;

export interface SpendEvent {
  vault: Address;
  agentSigner: Address;
  agentId: bigint;
  to: Address;
  /** USDC base units (6 decimals). */
  amount: bigint;
  orderId: Hex;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  /** Unix seconds of the block that included the spend. */
  blockTimestamp: number;
}

export interface VaultMeta {
  network: "mainnet" | "testnet";
  address: Address;
  fromBlock: number;
  owner: Address;
  label: string;
  /** true only for pilot users who are not Slippay (not Manuel, Mário, Bluewave AI). */
  external: boolean;
}

export interface Totals {
  payments: number;
  activeWallets: number;
  activeWallets28d: number;
  activeDays: number;
  volumeUsdc: string;
  volumeBaseUnits: string;
}

export interface VaultMetrics {
  address: Address;
  label: string;
  owner: Address;
  external: boolean;
  payments: number;
  volumeUsdc: string;
  activeDays: number;
  /** Distinct UTC dates (YYYY-MM-DD) with at least one spend, ascending. */
  days: string[];
  activeIn28d: boolean;
  firstSpendAt: string | null;
  lastSpendAt: string | null;
}

export interface Metrics extends Totals {
  externalPayments: number;
  /** The same totals restricted to vaults with `external: true`. */
  external: Totals;
  /** Distinct UTC dates with at least one spend across all registered vaults. */
  days: string[];
  /** Inclusive bounds of the `activeWallets28d` window. */
  window28d: { from: string; to: string };
  /** AgentSpend events whose vault is not in the registry: excluded from every count. */
  unregisteredEvents: number;
  perVault: VaultMetrics[];
}

/**
 * Validate `docs/arc/vaults.json`. Strict on purpose: e.g. `"external": "false"` (a truthy string)
 * would silently count a Slippay vault as a pilot, so anything but a real boolean is rejected.
 */
export function parseVaultRegistry(raw: unknown): VaultMeta[] {
  if (!Array.isArray(raw)) throw new Error("vault registry must be a JSON array");
  return raw.map((e: Record<string, unknown>, i): VaultMeta => {
    const bad = (field: string, why: string) => new Error(`vaults[${i}].${field}: ${why}`);
    if (e?.network !== "mainnet" && e?.network !== "testnet") throw bad("network", 'must be "mainnet" or "testnet"');
    if (typeof e.address !== "string" || !isAddress(e.address)) throw bad("address", "must be a 20-byte hex address (valid checksum if mixed case)");
    if (typeof e.owner !== "string" || !isAddress(e.owner)) throw bad("owner", "must be a 20-byte hex address (valid checksum if mixed case)");
    if (typeof e.fromBlock !== "number" || !Number.isSafeInteger(e.fromBlock) || e.fromBlock < 0) throw bad("fromBlock", "must be a non-negative integer");
    if (typeof e.label !== "string" || e.label.trim() === "") throw bad("label", "must be a non-empty string");
    if (typeof e.external !== "boolean") throw bad("external", "must be true or false (JSON boolean)");
    return { network: e.network, address: e.address, fromBlock: e.fromBlock, owner: e.owner, label: e.label, external: e.external };
  });
}

const utcDay = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();
const usdc = (baseUnits: bigint) => formatUnits(baseUnits, USDC_DECIMALS);

function totals(events: SpendEvent[], inWindow: (e: SpendEvent) => boolean): Totals {
  const wallets = new Set<string>();
  const wallets28d = new Set<string>();
  const days = new Set<string>();
  let volume = 0n;
  for (const e of events) {
    const v = e.vault.toLowerCase();
    wallets.add(v);
    if (inWindow(e)) wallets28d.add(v);
    days.add(utcDay(e.blockTimestamp));
    volume += e.amount;
  }
  return {
    payments: events.length,
    activeWallets: wallets.size,
    activeWallets28d: wallets28d.size,
    activeDays: days.size,
    volumeUsdc: usdc(volume),
    volumeBaseUnits: volume.toString(),
  };
}

/**
 * Aggregate AgentSpend events into milestone metrics. `vaults` must belong to ONE network: the same
 * address can exist on testnet and mainnet (same deployer, same nonce), so a mixed registry throws.
 */
export function aggregate(events: SpendEvent[], vaults: VaultMeta[], now: Date): Metrics {
  const registry = new Map<string, VaultMeta>();
  for (const v of vaults) {
    const key = v.address.toLowerCase();
    if (registry.has(key)) throw new Error(`duplicate vault ${v.address} in registry (pass one network at a time)`);
    registry.set(key, v);
  }

  const seen = new Set<string>();
  const counted: SpendEvent[] = [];
  let unregisteredEvents = 0;
  for (const e of events) {
    const id = `${e.txHash.toLowerCase()}:${e.logIndex}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!registry.has(e.vault.toLowerCase())) {
      unregisteredEvents += 1;
      continue;
    }
    counted.push(e);
  }
  counted.sort((a, b) => a.blockTimestamp - b.blockTimestamp || Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex);

  const nowSec = now.getTime() / 1000;
  const fromSec = nowSec - ACTIVE_WINDOW_DAYS * 86_400;
  const inWindow = (e: SpendEvent) => e.blockTimestamp >= fromSec && e.blockTimestamp <= nowSec;
  const isExternal = (e: SpendEvent) => registry.get(e.vault.toLowerCase())!.external;

  const all = totals(counted, inWindow);
  const external = totals(counted.filter(isExternal), inWindow);

  const perVault = vaults.map((v): VaultMetrics => {
    const mine = counted.filter((e) => e.vault.toLowerCase() === v.address.toLowerCase());
    const days = [...new Set(mine.map((e) => utcDay(e.blockTimestamp)))].sort();
    return {
      address: v.address,
      label: v.label,
      owner: v.owner,
      external: v.external,
      payments: mine.length,
      volumeUsdc: usdc(mine.reduce((s, e) => s + e.amount, 0n)),
      activeDays: days.length,
      days,
      activeIn28d: mine.some(inWindow),
      firstSpendAt: mine.length ? iso(mine[0]!.blockTimestamp) : null,
      lastSpendAt: mine.length ? iso(mine[mine.length - 1]!.blockTimestamp) : null,
    };
  });

  return {
    ...all,
    externalPayments: external.payments,
    external,
    days: [...new Set(counted.map((e) => utcDay(e.blockTimestamp)))].sort(),
    window28d: { from: iso(fromSec), to: iso(nowSec) },
    unregisteredEvents,
    perVault,
  };
}

/**
 * Decode raw logs into SpendEvents. Only logs whose topic0 is an AgentSpend layout are kept (Transfer
 * and any other event are dropped); logs flagged `removed` are skipped. `blockTimestamps` maps block number
 * to unix seconds and must cover every AgentSpend log.
 */
export function spendEventsFromLogs(logs: Log[], blockTimestamps: Map<bigint, number>): SpendEvent[] {
  const live = logs.filter((l) => !l.removed);
  return parseEventLogs({ abi: AGENT_SPEND_EVENTS, logs: live }).map((l) => {
    if (l.blockNumber == null || l.transactionHash == null || l.logIndex == null) {
      throw new Error("AgentSpend log without blockNumber/transactionHash/logIndex (pending log?)");
    }
    const ts = blockTimestamps.get(l.blockNumber);
    if (ts === undefined) throw new Error(`missing block timestamp for block ${l.blockNumber}`);
    return {
      vault: getAddress(l.address),
      agentSigner: l.args.agentSigner,
      agentId: l.args.agentId,
      to: l.args.to,
      amount: l.args.amount,
      orderId: l.args.orderId,
      txHash: l.transactionHash,
      logIndex: l.logIndex,
      blockNumber: l.blockNumber,
      blockTimestamp: ts,
    };
  });
}
