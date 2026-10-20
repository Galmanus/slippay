// SlipPay MCP · Arc rail. The agent spends from an AgentVault (contracts-evm) on Arc, inside
// limits the vault enforces on-chain (per-tx cap, sliding window, allowlist, expiry, revocation).
// Non-custodial: the agent key signs locally (ECDSA, plus SLH-DSA post-quantum above the
// session's pqThreshold) and the signed intent goes to the Slippay relayer, which only pays gas.
// Every refusal the vault would make is checked here first, so a doomed intent is never signed.
//
// Env: SLIPPAY_ARC_VAULT (AgentVault address) · SLIPPAY_ARC_AGENT_KEY (0x… ECDSA key of the
// session's agentSigner) · SLIPPAY_ARC_SLH_SECRET (0x… 64-byte SLH-DSA secret, needed above
// pqThreshold) · SLIPPAY_ARC_NETWORK (testnet|mainnet, default testnet) · SLIPPAY_ARC_RELAYER_URL
// (default https://api.slippay.cc/api/v1/arc) · SLIPPAY_ARC_RPC_URL (optional).
// x402 (optional): SLIPPAY_ARC_FLOAT_KEY (0x… key of the float EOA on the session allowlist) ·
// SLIPPAY_ARC_X402_MAX_USDC (hard per-call price ceiling, default 0.05) · SLIPPAY_ARC_FLOAT_TOPUP_USDC
// (default 0.10) · SLIPPAY_ARC_FROM_BLOCK (vault deploy block, floor for receipts).
import {
  createPublicClient, hexToBytes, http, keccak256, stringToHex, toHex,
  type Address, type Hex, type LocalAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc, arcTestnet } from "viem/chains";
import {
  AGENT_SPEND_EVENTS, ARC_NETWORKS, agentVaultAbi, ensureGatewayFloat, liveFloatDeps, signSpend, x402Fetch,
  type ArcNetwork, type FloatFunding, type X402Network,
} from "@slippay/arc-agent";

export type ArcSessionView = {
  exists: boolean;
  revoked: boolean;
  agentId: bigint;
  perTxCap: bigint;
  windowCap: bigint;
  pqThreshold: bigint;
  windowSeconds: bigint;
  expiresAt: bigint;
  epochStart: bigint;
  curSpent: bigint;
  prevSpent: bigint;
  nonce: bigint;
};

export type RelayBody = Record<string, string>;
export type RelayResponse = { txHash: string; status: string; explorerUrl?: string };

export interface ArcDeps {
  readSession(vault: Address, agentSigner: Address): Promise<ArcSessionView>;
  isAllowed(vault: Address, agentSigner: Address, to: Address): Promise<boolean>;
  now(): number;
  relay(body: RelayBody): Promise<RelayResponse>;
}

/** Decimal USDC ("12.50") → 6-decimal units. Strict: positive, at most 6 decimals, no exponents. */
export function parseUsdc(amount: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!m) throw new Error(`invalid USDC amount "${amount}" (use e.g. "12.50", max 6 decimals)`);
  const v = BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
  if (v <= 0n) throw new Error("amount must be greater than zero");
  return v;
}

export const formatUsdc = (v: bigint) => {
  const s = v.toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)}`.replace(/\.?0+$/, "") || "0";
};

/** Headroom left in the session window — same math as AgentVault._consumeWindow. */
export function remainingWindowBudget(s: ArcSessionView, now: number): bigint {
  const t = BigInt(now);
  const w = s.windowSeconds;
  let prev = s.prevSpent;
  let cur = s.curSpent;
  let start = s.epochStart;
  const elapsed = t - start;
  if (elapsed >= w) {
    prev = elapsed < 2n * w ? cur : 0n;
    cur = 0n;
    start = t;
  }
  const weightedPrev = (prev * (w - (t - start))) / w;
  const weighted = s.windowCap - (weightedPrev + cur);
  const hard = 2n * s.windowCap - (prev + cur);
  const left = weighted < hard ? weighted : hard;
  return left > 0n ? left : 0n;
}

export async function arcPay(
  d: ArcDeps,
  cfg: { vault: Address; chainId: number; account: LocalAccount; slhSecretKey?: Uint8Array },
  input: { to: Address; amount: string; orderId?: string; deadlineSeconds?: number },
): Promise<RelayResponse & { pq: boolean; orderId: Hex; amount: string }> {
  const amount = parseUsdc(input.amount);
  const agent = cfg.account.address;
  const now = d.now();
  const s = await d.readSession(cfg.vault, agent);

  if (!s.exists) throw new Error(`no AgentVault session for agent ${agent} on vault ${cfg.vault}`);
  if (s.revoked) throw new Error("session revoked by the vault owner");
  if (s.expiresAt !== 0n && BigInt(now) >= s.expiresAt) throw new Error("session expired");
  if (amount > s.perTxCap) throw new Error(`amount exceeds the per-transaction cap of ${formatUsdc(s.perTxCap)} USDC`);
  if (!(await d.isAllowed(cfg.vault, agent, input.to))) throw new Error(`recipient ${input.to} is not on this session's allowlist`);
  const left = remainingWindowBudget(s, now);
  if (amount > left) throw new Error(`amount exceeds the remaining window budget of ${formatUsdc(left)} USDC`);
  const pq = amount > s.pqThreshold;
  if (pq && !cfg.slhSecretKey) {
    throw new Error(`amount above the post-quantum threshold (${formatUsdc(s.pqThreshold)} USDC) needs SLIPPAY_ARC_SLH_SECRET (SLH-DSA)`);
  }

  const orderId: Hex = input.orderId
    ? keccak256(stringToHex(input.orderId))
    : toHex(crypto.getRandomValues(new Uint8Array(32)));
  const intent = {
    agentSigner: agent,
    to: input.to,
    amount,
    nonce: s.nonce,
    deadline: BigInt(now + (input.deadlineSeconds ?? 300)),
    orderId,
  };
  const signed = await signSpend({
    account: cfg.account,
    vault: cfg.vault,
    chainId: cfg.chainId,
    intent,
    pqThreshold: s.pqThreshold,
    slhSecretKey: cfg.slhSecretKey,
  });
  const res = await d.relay({
    vault: cfg.vault,
    agentSigner: agent,
    to: input.to,
    amount: amount.toString(),
    deadline: intent.deadline.toString(),
    orderId,
    ecdsaSig: signed.ecdsaSig,
    slhSig: signed.slhSig,
  });
  return { ...res, pq: signed.pq, orderId, amount: formatUsdc(amount) };
}

export type X402ToolDeps = {
  isAllowed: ArcDeps["isAllowed"];
  readSession: ArcDeps["readSession"];
  now: ArcDeps["now"];
  x402: typeof x402Fetch;
  /** Make the float's Gateway balance cover `need` (6-decimal units), topping up from the vault. */
  ensureFloat(need: bigint): Promise<FloatFunding>;
};

const BODY_LIMIT = 20_000;

/**
 * Buy an x402 resource with vault money. The float EOA signs the Gateway nanopayment; it must be
 * on the session allowlist, because its only funding is an ordinary bounded vault spend.
 *
 * What is on-chain and what is not: the TOTAL the float can ever receive is bounded by the vault
 * (every top-up is an attested AgentSpend inside perTxCap and the window cap). The per-call price
 * cap, min(SLIPPAY_ARC_X402_MAX_USDC, maxUsdc), and the optional payee allowlist
 * (SLIPPAY_ARC_X402_PAYTO) are enforced by this process. So is "the session is still live":
 * Gateway balances already deposited can't be revoked on-chain, hence the session check here.
 * Exposure at any moment = float wallet + float Gateway balance (normally <= topUp + gas reserve).
 */
export async function arcX402Fetch(
  d: X402ToolDeps,
  cfg: {
    vault: Address; chainId: number; account: LocalAccount; floatAccount?: LocalAccount; maxPerCall: bigint;
    payTo?: readonly Address[];
  },
  input: { url: string; method?: string; body?: string; maxUsdc?: string },
) {
  const float = cfg.floatAccount;
  if (!float) throw new Error("SLIPPAY_ARC_FLOAT_KEY not set — the x402 float key (an EOA on this session's allowlist).");
  const s = await d.readSession(cfg.vault, cfg.account.address);
  if (!s.exists) throw new Error(`no AgentVault session for agent ${cfg.account.address} on vault ${cfg.vault}`);
  if (s.revoked) throw new Error("session revoked by the vault owner: the float may not spend for it any more");
  if (s.expiresAt !== 0n && BigInt(d.now()) >= s.expiresAt) throw new Error("session expired: the float may not spend for it any more");
  if (!(await d.isAllowed(cfg.vault, cfg.account.address, float.address))) {
    throw new Error(`float ${float.address} is not on this session's allowlist, so the vault can't fund it`);
  }
  const asked = input.maxUsdc ? parseUsdc(input.maxUsdc) : cfg.maxPerCall;
  const maxAmount = asked < cfg.maxPerCall ? asked : cfg.maxPerCall;
  let funding: FloatFunding | undefined;
  const r = await d.x402(input.url, { method: input.method, body: input.body }, {
    account: float,
    policy: { network: `eip155:${cfg.chainId}` as X402Network, maxAmount, ...(cfg.payTo?.length && { payTo: cfg.payTo }) },
    beforePay: async (amount) => {
      funding = await d.ensureFloat(amount);
    },
  });
  return {
    url: input.url,
    status: r.status,
    ok: r.ok,
    body: r.body.length > BODY_LIMIT ? `${r.body.slice(0, BODY_LIMIT)}… [truncated]` : r.body,
    paid: r.paid && { amountUsdc: formatUsdc(r.paid.amount), payTo: r.paid.payTo, network: r.paid.network, from: float.address },
    ...(funding && {
      funding: { topUpTx: funding.topUpTx, depositTx: funding.depositTx, gatewayUsdc: formatUsdc(funding.gatewayAfter) },
    }),
    ...(r.paid && !r.ok && { doNotRetry: true }),
    ...(r.error && { error: r.error }),
  };
}

export type SpendLog = {
  txHash: Hex;
  blockNumber: bigint;
  to: Address;
  amount: bigint;
  orderId: Hex;
  /** null for vaults deployed before the attester gate (their AgentSpend has no `attested`). */
  attested: boolean | null;
  pq: boolean;
};
export type ReceiptDeps = {
  latestBlock(): Promise<bigint>;
  spendLogs(agent: Address, fromBlock: bigint, toBlock: bigint): Promise<SpendLog[]>;
};

/**
 * Newest-first AgentSpend records for this agent, read back from `latest` one chunk at a time.
 * `searched` says which blocks were read; `complete` is true when the walk reached the floor, so
 * an empty or short list over an incomplete range is not mistaken for "no payments".
 */
export async function arcReceipts(d: ReceiptDeps, cfg: { agent: Address; floorBlock: bigint; chunk?: bigint }, limit = 10) {
  const chunk = cfg.chunk ?? 10_000n;
  const found: SpendLog[] = [];
  const latest = await d.latestBlock();
  let lowest = latest + 1n;
  for (let to = latest; to >= cfg.floorBlock && found.length < limit; to -= chunk) {
    const from = to - chunk + 1n > cfg.floorBlock ? to - chunk + 1n : cfg.floorBlock;
    const logs = await d.spendLogs(cfg.agent, from, to);
    found.push(...logs.sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : -1)));
    lowest = from;
  }
  return {
    searched: { fromBlock: lowest.toString(), toBlock: latest.toString(), complete: lowest <= cfg.floorBlock },
    receipts: found.slice(0, limit).map((l) => ({
      txHash: l.txHash, block: l.blockNumber.toString(), to: l.to, amountUsdc: formatUsdc(l.amount),
      orderId: l.orderId, attested: l.attested, pq: l.pq,
    })),
  };
}

/** Live wiring from env (used by the MCP tools). Throws a clear message for missing config. */
export function arcFromEnv() {
  const network = (process.env.SLIPPAY_ARC_NETWORK ?? "testnet").toLowerCase() as ArcNetwork;
  const net = ARC_NETWORKS[network];
  if (!net) throw new Error(`SLIPPAY_ARC_NETWORK must be testnet or mainnet`);
  const vault = process.env.SLIPPAY_ARC_VAULT as Address | undefined;
  if (!vault) throw new Error("SLIPPAY_ARC_VAULT not set — the AgentVault address on Arc.");
  const key = process.env.SLIPPAY_ARC_AGENT_KEY as Hex | undefined;
  if (!key) throw new Error("SLIPPAY_ARC_AGENT_KEY not set — the session's agent key (never leaves this process).");
  const slh = process.env.SLIPPAY_ARC_SLH_SECRET as Hex | undefined;
  const relayerUrl = (process.env.SLIPPAY_ARC_RELAYER_URL ?? "https://api.slippay.cc/api/v1/arc").replace(/\/$/, "");
  const client = createPublicClient({
    chain: network === "mainnet" ? arc : arcTestnet,
    transport: http(process.env.SLIPPAY_ARC_RPC_URL ?? net.rpcUrl),
  });

  const deps: ArcDeps = {
    readSession: async (v, agent) => {
      const s = await client.readContract({ address: v, abi: agentVaultAbi, functionName: "getSession", args: [agent] });
      return {
        exists: s.exists, revoked: s.revoked, agentId: s.agentId, perTxCap: s.perTxCap, windowCap: s.windowCap,
        pqThreshold: s.pqThreshold, windowSeconds: s.windowSeconds, expiresAt: s.expiresAt,
        epochStart: s.epochStart, curSpent: s.curSpent, prevSpent: s.prevSpent, nonce: s.nonce,
      };
    },
    isAllowed: (v, agent, to) =>
      client.readContract({ address: v, abi: agentVaultAbi, functionName: "isAllowedRecipient", args: [agent, to] }),
    now: () => Math.floor(Date.now() / 1000),
    relay: async (body) => {
      const r = await fetch(`${relayerUrl}/${network}/spend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, string>;
      if (!r.ok) throw new Error(`relayer ${r.status}: ${j.error ?? ""} ${j.message ?? ""}`.trim());
      return j as unknown as RelayResponse;
    },
  };
  return {
    deps,
    network,
    cfg: {
      vault,
      chainId: net.chainId,
      account: privateKeyToAccount(key),
      slhSecretKey: slh ? hexToBytes(slh) : undefined,
    },
  };
}

/** Serializes float funding inside this process (see x402FromEnv). */
let floatQueue: Promise<unknown> = Promise.resolve();

/** x402 wiring from env: the float signs, the vault funds it through the relayer (arcPay). */
export function x402FromEnv() {
  const base = arcFromEnv();
  const floatKey = process.env.SLIPPAY_ARC_FLOAT_KEY as Hex | undefined;
  const floatAccount = floatKey ? privateKeyToAccount(floatKey) : undefined;
  const maxPerCall = parseUsdc(process.env.SLIPPAY_ARC_X402_MAX_USDC ?? "0.05");
  const topUp = parseUsdc(process.env.SLIPPAY_ARC_FLOAT_TOPUP_USDC ?? "0.10");
  const payTo = (process.env.SLIPPAY_ARC_X402_PAYTO ?? "").split(",").map((a) => a.trim()).filter(Boolean) as Address[];
  const d: X402ToolDeps = {
    isAllowed: base.deps.isAllowed,
    readSession: base.deps.readSession,
    now: base.deps.now,
    x402: x402Fetch,
    // One funding at a time per process: two calls in flight must not both top up and deposit.
    ensureFloat: (need) => {
      const run = floatQueue.then(() => fund(need));
      floatQueue = run.catch(() => {});
      return run;
    },
  };
  const fund = (need: bigint) => {
    if (!floatAccount) throw new Error("SLIPPAY_ARC_FLOAT_KEY not set");
    const fd = liveFloatDeps({
      network: base.network,
      floatAccount,
      rpcUrl: process.env.SLIPPAY_ARC_RPC_URL,
      topUpFromVault: async (amount) => {
        const r = await arcPay(base.deps, base.cfg, { to: floatAccount.address, amount: formatUsdc(amount), orderId: `x402-float-topup-${Date.now()}` });
        if (r.status !== "success") throw new Error(`vault top-up of the float did not settle: ${r.status} ${r.txHash}`);
        return r.txHash;
      },
    });
    return ensureGatewayFloat(need, fd, { topUp, gasReserve: parseUsdc("0.02") });
  };
  return { d, cfg: { ...base.cfg, floatAccount, maxPerCall, payTo } };
}

/** Receipts wiring from env: AgentSpend logs of this agent on the vault, paced for public RPCs. */
export function receiptsFromEnv() {
  const network = (process.env.SLIPPAY_ARC_NETWORK ?? "testnet").toLowerCase() as ArcNetwork;
  const { cfg } = arcFromEnv();
  const client = createPublicClient({
    chain: network === "mainnet" ? arc : arcTestnet,
    transport: http(process.env.SLIPPAY_ARC_RPC_URL ?? ARC_NETWORKS[network].rpcUrl),
  });
  const d: ReceiptDeps = {
    latestBlock: () => client.getBlockNumber(),
    spendLogs: async (agent, fromBlock, toBlock) => {
      await new Promise((r) => setTimeout(r, 150)); // public Arc RPCs rate-limit back-to-back getLogs
      // Both AgentSpend layouts (see AGENT_SPEND_EVENTS); viem can't filter args across two events,
      // so the agent filter runs here.
      const logs = await client.getLogs({ address: cfg.vault, events: AGENT_SPEND_EVENTS, fromBlock, toBlock, strict: false });
      return logs.flatMap((l) => {
        const a = l.args as { agentSigner?: Address; to: Address; amount: bigint; orderId: Hex; pq: boolean; attested?: boolean };
        if (a.agentSigner?.toLowerCase() !== agent.toLowerCase()) return [];
        return [{ txHash: l.transactionHash!, blockNumber: l.blockNumber!, to: a.to, amount: a.amount, orderId: a.orderId, pq: a.pq, attested: a.attested ?? null }];
      });
    },
  };
  const floor = process.env.SLIPPAY_ARC_FROM_BLOCK ? BigInt(process.env.SLIPPAY_ARC_FROM_BLOCK) : undefined;
  return { d, agent: cfg.account.address, floor };
}
