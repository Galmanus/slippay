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
import {
  createPublicClient, hexToBytes, http, keccak256, stringToHex, toHex,
  type Address, type Hex, type LocalAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc, arcTestnet } from "viem/chains";
import { ARC_NETWORKS, agentVaultAbi, signSpend, type ArcNetwork } from "@slippay/arc-agent";

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
