// Arc agent sub-wallet (AgentVault) — browser side of the /agents/new flow.
//
// Pure builders (limits validation, installSession args, MCP config, persistence) plus viem
// actions that take an injected EIP-1193 provider (window.ethereum). The on-chain calls mirror
// packages/slippay-mcp/scripts/arc-e2e-testnet.mjs exactly: deploy AgentVault(owner, USDC,
// identity, maxAbs) → ERC-8004 register(uri) → native USDC send to the vault → installSession.
//
// Secrets rule: the agent's ECDSA key and SLH-DSA secret are created by generateAgentKeys() in
// the browser and only ever reach mcpConfig(). Nothing in this module logs, stores or sends them;
// saveFlow() whitelists public on-chain pointers only.
import {
  createPublicClient, createWalletClient, custom, decodeEventLog, defineChain, encodeDeployData, getAddress,
  getContractAddress, http, isAddress, keccak256, parseAbi, parseAbiItem, stringToHex, toHex, zeroAddress,
  type Address, type Chain, type Hash, type Hex, type Log, type PublicClient, type TransactionReceipt,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arc, arcTestnet } from "viem/chains";
import { ARC_NETWORKS, ARC_USDC, agentVaultAbi, slhKeygen, type ArcNetwork } from "@slippay/arc-agent";
import { AGENT_VAULT_BYTECODE, AGENT_VAULT_CONSTRUCTOR_ABI } from "./agentVaultBytecode.ts";

export type { ArcNetwork };

/** Arc drops txs with maxFeePerGas < 20 gwei silently (no error, no receipt); floor at 25 like the relayer. */
export const ARC_FEE_FLOOR = 25_000_000_000n;
const PRIORITY_FEE = 1_000_000_000n;
/** type(uint128).max — "never" for pqThreshold / attestThreshold. */
export const NEVER = (1n << 128n) - 1n;
const ZERO32 = `0x${"00".repeat(32)}` as Hex;
/** AgentVault.MIN_WINDOW_SECONDS / MAX_WINDOW_MULTIPLIER. */
const MIN_WINDOW_SECONDS = 60;
const MAX_WINDOW_MULTIPLIER = 100n;
/** Allowlist entries are one SSTORE each; keep install gas bounded. */
export const MAX_RECIPIENTS = 50;
/** Default immutable per-payment ceiling (same default as contracts-evm/script/Deploy.s.sol). */
export const DEFAULT_MAX_ABS_PER_TX = 1_000_000_000n;
export const RELAYER_URL = "https://api.slippay.cc/api/v1/arc";
/** Arc RPC refuses eth_getLogs ranges somewhere between 5k and 10k blocks (measured 2026-10-16). */
const LOG_CHUNK = 4_000n;

export class ArcFlowError extends Error {
  constructor(public readonly code: FlowErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ArcFlowError";
  }
}
export type FlowErrorCode =
  | "no_wallet" | "no_account" | "account_changed" | "wrong_chain" | "insufficient_funds" | "invalid_limits"
  | "invalid_amount" | "not_a_vault" | "not_owner" | "tx_failed" | "no_agent_id";

// ------------------------------------------------------------------ pure: parsing & validation

export function parseNetwork(search: string): ArcNetwork {
  return new URLSearchParams(search).get("network")?.toLowerCase() === "mainnet" ? "mainnet" : "testnet";
}

/** "12.50" or "12,50" → 6-decimal units. null for anything ambiguous (thousand separators, exponents, > 6 dp). */
export function parseUsdc(input: string): bigint | null {
  let s = input.trim();
  if (!s.includes(".") && (s.match(/,/g) ?? []).length === 1) s = s.replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(s);
  if (!m) return null;
  return BigInt(m[1]!) * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0"));
}

export function formatUsdc(v: bigint): string {
  const s = v.toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)}`.replace(/\.?0+$/, "") || "0";
}

/** Arc native USDC has 18 decimals; the ERC-20 view at 0x3600… has 6. Same balance. */
export const usdcToNativeWei = (amount6: bigint) => amount6 * 1_000_000_000_000n;

export function parseRecipients(text: string): { addresses: Address[]; invalid: string[] } {
  const addresses: Address[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/).filter(Boolean)) {
    if (!isAddress(part, { strict: true })) { invalid.push(part); continue; }
    const a = getAddress(part);
    if (seen.has(a)) continue;
    seen.add(a);
    addresses.push(a);
  }
  return { addresses, invalid };
}

export type LimitsForm = {
  perTx: string;
  window: string;
  windowSeconds: number;
  recipients: string;
  /** "" = no end date, else YYYY-MM-DD (valid through the end of that local day). */
  expiresOn: string;
  /** "" = post-quantum check off, else USDC amount above which SLH-DSA is also required. */
  pqAbove: string;
};
export type LimitField = keyof LimitsForm;
export type LimitError =
  | "required" | "invalid_amount" | "zero" | "above_ceiling" | "window_below_per_tx" | "window_above_100x"
  | "window_too_short" | "no_recipients" | "bad_address" | "self_recipient" | "too_many_recipients"
  | "expiry_past" | "invalid_date" | "pq_never_applies";
export type ValidLimits = {
  perTxCap: bigint;
  windowCap: bigint;
  windowSeconds: bigint;
  expiresAt: bigint;
  recipients: Address[];
  pqThreshold: bigint | null;
};
export type LimitsContext = { owner: Address; vault: Address; maxAbsolutePerTx: bigint; nowSec: number };

/** Same rules AgentVault.installSession enforces, checked before the wallet is ever asked to sign. */
export function validateLimits(
  f: LimitsForm,
  ctx: LimitsContext,
): { ok: true; value: ValidLimits } | { ok: false; errors: Partial<Record<LimitField, LimitError>> } {
  const errors: Partial<Record<LimitField, LimitError>> = {};
  const amount = (field: "perTx" | "window"): bigint | null => {
    if (!f[field].trim()) { errors[field] = "required"; return null; }
    const v = parseUsdc(f[field]);
    if (v === null) { errors[field] = "invalid_amount"; return null; }
    if (v === 0n) { errors[field] = "zero"; return null; }
    return v;
  };
  const perTx = amount("perTx");
  if (perTx !== null && perTx > ctx.maxAbsolutePerTx) errors.perTx = "above_ceiling";
  const win = amount("window");
  if (perTx !== null && win !== null) {
    if (win < perTx) errors.window = "window_below_per_tx";
    else if (win > perTx * MAX_WINDOW_MULTIPLIER) errors.window = "window_above_100x";
  }
  if (!Number.isSafeInteger(f.windowSeconds) || f.windowSeconds < MIN_WINDOW_SECONDS) errors.windowSeconds = "window_too_short";

  const { addresses, invalid } = parseRecipients(f.recipients);
  const forbidden = new Set([zeroAddress, ctx.owner, ctx.vault].map((a) => a.toLowerCase()));
  if (invalid.length) errors.recipients = "bad_address";
  else if (addresses.length === 0) errors.recipients = "no_recipients";
  else if (addresses.length > MAX_RECIPIENTS) errors.recipients = "too_many_recipients";
  else if (addresses.some((a) => forbidden.has(a.toLowerCase()))) errors.recipients = "self_recipient";

  let expiresAt = 0n;
  if (f.expiresOn.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.expiresOn.trim());
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59) : null;
    if (!m || !d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) errors.expiresOn = "invalid_date";
    else {
      expiresAt = BigInt(Math.floor(d.getTime() / 1000));
      if (expiresAt <= BigInt(ctx.nowSec + 600)) errors.expiresOn = "expiry_past";
    }
  }

  let pqThreshold: bigint | null = null;
  if (f.pqAbove.trim()) {
    pqThreshold = parseUsdc(f.pqAbove);
    if (pqThreshold === null) errors.pqAbove = "invalid_amount";
    else if (perTx !== null && pqThreshold >= perTx) errors.pqAbove = "pq_never_applies";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      perTxCap: perTx!, windowCap: win!, windowSeconds: BigInt(f.windowSeconds), expiresAt,
      recipients: addresses, pqThreshold,
    },
  };
}

// ------------------------------------------------------------------ pure: session args

export type SessionLimits = ValidLimits & { agentSigner: Address; agentId: bigint; slhVk?: Hex };

/** AgentVault.SessionConfig, field-for-field. */
export type SessionConfig = {
  agentId: bigint;
  slhVk: Hex;
  perTxCap: bigint;
  windowCap: bigint;
  windowSeconds: bigint;
  expiresAt: bigint;
  pqThreshold: bigint;
  policyHash: Hex;
  allowRecipients: readonly Address[];
  attesterX: Hex;
  attesterY: Hex;
  attestThreshold: bigint;
};

/** keccak256 of the canonical limits JSON, stored on-chain as the session's policyHash. */
export function sessionPolicyHash(l: ValidLimits): Hex {
  const canon = JSON.stringify({
    v: "slippay.arc.session.v1",
    perTxCap: l.perTxCap.toString(),
    windowCap: l.windowCap.toString(),
    windowSeconds: l.windowSeconds.toString(),
    expiresAt: l.expiresAt.toString(),
    pqThreshold: l.pqThreshold === null ? null : l.pqThreshold.toString(),
    recipients: l.recipients.map((a) => a.toLowerCase()).sort(),
  });
  return keccak256(stringToHex(canon));
}

/**
 * installSession(agentSigner, SessionConfig) args. Throws on anything the contract would reject
 * with InvalidConfig / EmptyAllowlist / RecipientNotAllowed(0). Integrity-attester gate stays off
 * (attestThreshold = max) as in the testnet e2e; post-quantum is off unless pqThreshold is set.
 */
export function buildSessionArgs(l: SessionLimits): readonly [Address, SessionConfig] {
  const bad = (why: string): never => { throw new ArcFlowError("invalid_limits", why); };
  if (!isAddress(l.agentSigner) || l.agentSigner.toLowerCase() === zeroAddress) bad("agentSigner must be a non-zero address");
  if (l.perTxCap <= 0n) bad("perTxCap must be > 0");
  if (l.windowCap < l.perTxCap) bad("windowCap must be >= perTxCap");
  if (l.windowCap > l.perTxCap * MAX_WINDOW_MULTIPLIER) bad("windowCap must be <= 100 * perTxCap");
  if (l.windowSeconds < BigInt(MIN_WINDOW_SECONDS)) bad("windowSeconds must be >= 60");
  if (l.recipients.length === 0) bad("allowlist is empty");
  if (l.recipients.some((r) => !isAddress(r) || r.toLowerCase() === zeroAddress)) bad("allowlist has an invalid address");
  const pq = l.pqThreshold !== null;
  if (pq && (!l.slhVk || !/^0x[0-9a-fA-F]{64}$/.test(l.slhVk))) bad("a pqThreshold needs a 32-byte slhVk");
  return [
    getAddress(l.agentSigner),
    {
      agentId: l.agentId,
      slhVk: pq ? (l.slhVk as Hex) : ZERO32,
      perTxCap: l.perTxCap,
      windowCap: l.windowCap,
      windowSeconds: l.windowSeconds,
      expiresAt: l.expiresAt,
      pqThreshold: pq ? (l.pqThreshold as bigint) : NEVER,
      policyHash: sessionPolicyHash(l),
      allowRecipients: l.recipients.map((r) => getAddress(r)),
      attesterX: ZERO32,
      attesterY: ZERO32,
      attestThreshold: NEVER,
    },
  ] as const;
}

export type AgentKeys = { agentKey: Hex; agentAddress: Address; slhSecret?: Hex; slhVk?: Hex };

/** Fresh agent keys from the browser CSPRNG (crypto.getRandomValues). Hold in memory only. */
export function generateAgentKeys(opts: { pq: boolean }): AgentKeys {
  const agentKey = generatePrivateKey();
  const agentAddress = privateKeyToAccount(agentKey).address;
  if (!opts.pq) return { agentKey, agentAddress };
  const slh = slhKeygen();
  return { agentKey, agentAddress, slhSecret: toHex(slh.secretKey), slhVk: slh.publicKey };
}

/** MCP client config (mcpServers JSON) with exactly the env packages/slippay-mcp/src/arc.ts reads. */
export function mcpConfig(p: {
  vault: Address; agentKey: Hex; slhSecret?: Hex; network: ArcNetwork; relayerUrl?: string; rpcUrl?: string;
}): string {
  if (!isAddress(p.vault)) throw new ArcFlowError("not_a_vault", "vault is not an address");
  if (!/^0x[0-9a-fA-F]{64}$/.test(p.agentKey)) throw new Error("agent key must be 32 bytes hex");
  if (p.slhSecret !== undefined && !/^0x[0-9a-fA-F]{128}$/.test(p.slhSecret)) throw new Error("SLH secret must be 64 bytes hex");
  const env: Record<string, string> = {
    SLIPPAY_ARC_NETWORK: p.network,
    SLIPPAY_ARC_VAULT: getAddress(p.vault),
    SLIPPAY_ARC_AGENT_KEY: p.agentKey,
  };
  if (p.slhSecret) env.SLIPPAY_ARC_SLH_SECRET = p.slhSecret;
  env.SLIPPAY_ARC_RELAYER_URL = p.relayerUrl ?? RELAYER_URL;
  env.SLIPPAY_ARC_RPC_URL = p.rpcUrl ?? ARC_NETWORKS[p.network].rpcUrl;
  return JSON.stringify({ mcpServers: { slippay: { command: "npx", args: ["-y", "@slippay/mcp"], env } } }, null, 2);
}

// ------------------------------------------------------------------ pure: chain helpers

/** wallet_addEthereumChain params (EIP-3085). Native USDC is 18 decimals at the wallet level. */
export function addChainParams(network: ArcNetwork) {
  const n = ARC_NETWORKS[network];
  return {
    chainId: toHex(n.chainId),
    chainName: network === "mainnet" ? "Arc" : "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: [n.rpcUrl],
    blockExplorerUrls: [n.explorer],
  };
}

export function arcFees(baseFee: bigint | null | undefined) {
  const dynamic = baseFee ? baseFee * 2n + PRIORITY_FEE : 0n;
  return { maxFeePerGas: dynamic > ARC_FEE_FLOOR ? dynamic : ARC_FEE_FLOOR, maxPriorityFeePerGas: PRIORITY_FEE };
}

/** CREATE address of the owner's tx with this nonce — lets a reload find a vault whose receipt never arrived. */
export const vaultAddressAt = (owner: Address | string, nonce: number) =>
  getContractAddress({ from: owner as Address, nonce: BigInt(nonce) });

export const explorerTx = (network: ArcNetwork, hash: string) => `${ARC_NETWORKS[network].explorer}/tx/${hash}`;
export const explorerAddress = (network: ArcNetwork, a: string) => `${ARC_NETWORKS[network].explorer}/address/${a}`;

/** ERC-8004 registration file, inlined as a data: URI (no Slippay server hosts it). Public forever. */
export function agentRegistrationURI(p: { name: string; vault: Address; network: ArcNetwork }): string {
  const name = Array.from(p.name.trim().replace(/\s+/g, " ")).slice(0, 64).join("") || "Slippay agent";
  const file = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description:
      "AI agent paying in USDC on Arc from a Slippay AgentVault: per-payment cap, period cap, recipient allowlist and expiry are enforced on-chain.",
    services: [{ name: "agentWallet", endpoint: `eip155:${ARC_NETWORKS[p.network].chainId}:${getAddress(p.vault)}` }],
    active: true,
  };
  let bin = "";
  for (const b of new TextEncoder().encode(JSON.stringify(file))) bin += String.fromCharCode(b);
  return `data:application/json;base64,${btoa(bin)}`;
}

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");
const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256)",
  "function ownerOf(uint256 agentId) view returns (address)",
]);
const erc20BalanceAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

/** agentId minted to `owner` by the ERC-8004 registry in this receipt (ERC-721 Transfer from 0x0). */
export function agentIdFromLogs(logs: readonly Log[], registry: Address, owner: Address): bigint | null {
  for (const l of logs) {
    if (l.address?.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [transferEvent], data: l.data, topics: l.topics as [Hex, ...Hex[]] });
      if (ev.args.from.toLowerCase() === zeroAddress && ev.args.to.toLowerCase() === owner.toLowerCase()) return ev.args.tokenId;
    } catch { /* not an ERC-721 Transfer */ }
  }
  return null;
}

// ------------------------------------------------------------------ pure: flow state

export type Step = "connect" | "vault" | "identity" | "fund" | "limits" | "config" | "activate";

/** The next step, in on-chain dependency order: installSession needs the agentId and the vault. */
export function deriveStep(s: {
  connected: boolean; chainOk: boolean; vault: boolean; identity: boolean; funded: boolean; session: boolean; configSaved: boolean;
}): Step {
  if (!s.connected || !s.chainOk) return "connect";
  if (!s.vault) return "vault";
  if (!s.identity) return "identity";
  if (!s.funded) return "fund";
  if (!s.session) return "limits";
  if (!s.configSaved) return "config";
  return "activate";
}

/**
 * What survives a reload. Public on-chain pointers only — the vault (or its predicted CREATE
 * address + nonce while the deploy is in flight), the ERC-8004 id, the agent's public address,
 * a block hint for the identity log scan, and two UI flags. Never a key or secret.
 */
export type SavedFlow = {
  network: ArcNetwork;
  owner: Address;
  vault?: Address;
  vaultNonce?: number;
  agentId?: string;
  identityFromBlock?: string;
  agentSigner?: Address;
  fundSkipped?: boolean;
  configSaved?: boolean;
};
export type FlowStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export const storageKey = (network: ArcNetwork, owner: Address) => `slippay.arcAgent.v1.${network}.${owner.toLowerCase()}`;

function sanitizeFlow(o: Record<string, unknown>, network: ArcNetwork, owner: Address): SavedFlow {
  const f: SavedFlow = { network, owner: getAddress(owner) };
  if (typeof o.vault === "string" && isAddress(o.vault)) f.vault = getAddress(o.vault);
  if (typeof o.vaultNonce === "number" && Number.isSafeInteger(o.vaultNonce) && o.vaultNonce >= 0) f.vaultNonce = o.vaultNonce;
  if (typeof o.agentId === "string" && /^\d{1,78}$/.test(o.agentId)) f.agentId = o.agentId;
  if (typeof o.identityFromBlock === "string" && /^\d{1,20}$/.test(o.identityFromBlock)) f.identityFromBlock = o.identityFromBlock;
  if (typeof o.agentSigner === "string" && isAddress(o.agentSigner)) f.agentSigner = getAddress(o.agentSigner);
  if (typeof o.fundSkipped === "boolean") f.fundSkipped = o.fundSkipped;
  if (typeof o.configSaved === "boolean") f.configSaved = o.configSaved;
  return f;
}

export function saveFlow(storage: FlowStorage | null | undefined, f: SavedFlow): void {
  try {
    const clean = sanitizeFlow(f as unknown as Record<string, unknown>, f.network, f.owner);
    storage?.setItem(storageKey(f.network, f.owner), JSON.stringify({ v: 1, ...clean }));
  } catch { /* storage blocked: the flow still resumes from chain reads + the vault field */ }
}

export function loadFlow(storage: FlowStorage | null | undefined, network: ArcNetwork, owner: Address): SavedFlow | null {
  try {
    const raw = storage?.getItem(storageKey(network, owner));
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || o.v !== 1 || o.network !== network || typeof o.owner !== "string" || o.owner.toLowerCase() !== owner.toLowerCase()) return null;
    return sanitizeFlow(o, network, owner);
  } catch {
    return null;
  }
}

/** Map any wallet / viem / contract error to a code the page can explain in plain words. */
export function explainError(e: unknown): { code: string; reason?: string } {
  const chain: Record<string, unknown>[] = [];
  let cur: unknown = e;
  for (let i = 0; cur && typeof cur === "object" && i < 12; i++) {
    chain.push(cur as Record<string, unknown>);
    cur = (cur as { cause?: unknown }).cause;
  }
  for (const x of chain) if (x instanceof ArcFlowError) return { code: x.code };
  for (const x of chain) if (x.code === 4001 || x.name === "UserRejectedRequestError") return { code: "rejected" };
  for (const x of chain) {
    const data = x.data as { errorName?: unknown } | undefined;
    if (x.name === "ContractFunctionRevertedError" && typeof data?.errorName === "string") return { code: "reverted", reason: data.errorName };
  }
  for (const x of chain) if (x.name === "ChainMismatchError" || x.name === "ChainNotFoundError") return { code: "wrong_chain" };
  for (const x of chain) if (x.name === "WaitForTransactionReceiptTimeoutError") return { code: "timeout" };
  const text = chain.map((x) => `${String(x.shortMessage ?? "")} ${String(x.message ?? "")} ${String(x.details ?? "")}`).join(" ").toLowerCase();
  if (/insufficient funds|exceeds (the )?balance/.test(text)) return { code: "insufficient_funds" };
  if (/user rejected|user denied|rejected the request|request rejected/.test(text)) return { code: "rejected" };
  return { code: "unknown" };
}

/**
 * A read that failed because the contract said no (revert, missing function, empty return) —
 * as opposed to the RPC being unreachable. Only the former may be taken as "not a vault":
 * treating a network blip as "no vault" would make a resumed flow offer a second deploy.
 */
export function isContractNo(e: unknown): boolean {
  let cur = e as { name?: unknown; message?: unknown; details?: unknown; cause?: unknown } | undefined;
  for (let i = 0; cur && i < 12; i++) {
    if (typeof cur.name === "string" && /ContractFunctionRevertedError|ContractFunctionZeroDataError|AbiDecodingZeroDataError|AbiDecodingDataSizeTooSmallError|ExecutionRevertedError/.test(cur.name)) return true;
    if (/execution reverted/i.test(`${String(cur.message ?? "")} ${String(cur.details ?? "")}`)) return true;
    cur = cur.cause as typeof cur;
  }
  return false;
}

// ------------------------------------------------------------------ chain: clients

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, fn: (...args: unknown[]) => void): void;
  removeListener?(event: string, fn: (...args: unknown[]) => void): void;
};
// viem's PublicClient generics are invariant in places; the reader only needs these calls.
export type ArcReader = PublicClient;

export function arcChain(network: ArcNetwork): Chain {
  const n = ARC_NETWORKS[network];
  return defineChain({
    ...(network === "mainnet" ? arc : arcTestnet),
    rpcUrls: { default: { http: [n.rpcUrl] } },
    blockExplorers: { default: { name: "Arc Explorer", url: n.explorer } },
  });
}

/** Reads go to the public Arc RPC, never through the wallet, so a misconfigured wallet RPC can't lie to the flow. */
export function arcReader(network: ArcNetwork): ArcReader {
  return createPublicClient({ chain: arcChain(network), transport: http(ARC_NETWORKS[network].rpcUrl) }) as ArcReader;
}

export async function connectWallet(provider: Eip1193Provider | undefined): Promise<Address> {
  if (!provider) throw new ArcFlowError("no_wallet");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new ArcFlowError("no_account");
  return getAddress(accounts[0]);
}

export async function walletChainOk(provider: Eip1193Provider, network: ArcNetwork): Promise<boolean> {
  const id = (await provider.request({ method: "eth_chainId" })) as string;
  return Number(id) === ARC_NETWORKS[network].chainId;
}

function isUnknownChain(e: unknown): boolean {
  let cur = e as { code?: unknown; data?: { originalError?: { code?: unknown } }; message?: unknown; cause?: unknown } | undefined;
  for (let i = 0; cur && i < 8; i++) {
    if (cur.code === 4902 || cur.data?.originalError?.code === 4902) return true;
    if (typeof cur.message === "string" && /unrecognized chain|unknown chain|not been added/i.test(cur.message)) return true;
    cur = cur.cause as typeof cur;
  }
  return false;
}

/** Switch the wallet to Arc, adding the network first if the wallet doesn't know it. */
export async function ensureArcChain(provider: Eip1193Provider, network: ArcNetwork): Promise<void> {
  if (await walletChainOk(provider, network)) return;
  const chainId = toHex(ARC_NETWORKS[network].chainId);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (e) {
    if (!isUnknownChain(e)) throw e;
    await provider.request({ method: "wallet_addEthereumChain", params: [addChainParams(network)] });
    if (!(await walletChainOk(provider, network))) {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    }
  }
  if (!(await walletChainOk(provider, network))) throw new ArcFlowError("wrong_chain");
}

export type WriteCtx = { provider: Eip1193Provider; network: ArcNetwork; owner: Address; reader?: ArcReader };

async function prepWrite(ctx: WriteCtx) {
  await ensureArcChain(ctx.provider, ctx.network);
  const accounts = (await ctx.provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.[0] || getAddress(accounts[0]) !== getAddress(ctx.owner)) throw new ArcFlowError("account_changed");
  const reader = ctx.reader ?? arcReader(ctx.network);
  const chain = arcChain(ctx.network);
  const wallet = createWalletClient({ account: getAddress(ctx.owner), chain, transport: custom(ctx.provider) });
  const block = await reader.getBlock();
  return { reader, wallet, chain, fees: arcFees(block.baseFeePerGas) };
}

async function mined(reader: ArcReader, hash: Hash): Promise<TransactionReceipt> {
  const r = await reader.waitForTransactionReceipt({ hash, timeout: 90_000, pollingInterval: 1_000 });
  if (r.status !== "success") throw new ArcFlowError("tx_failed");
  return r;
}

// ------------------------------------------------------------------ chain: writes

/**
 * Deploy AgentVault(owner, USDC, ERC-8004 registry, maxAbs) from the owner's wallet.
 * onSubmitting fires BEFORE the wallet prompt with the predicted CREATE address, so a reload
 * mid-flight can find the vault instead of deploying a second one.
 */
export async function deployVault(
  ctx: WriteCtx & {
    maxAbsolutePerTx: bigint;
    onSubmitting?: (p: { predictedVault: Address; nonce: number }) => void;
    onHash?: (hash: Hash) => void;
  },
): Promise<{ vault: Address; txHash: Hash }> {
  if (ctx.maxAbsolutePerTx <= 0n || ctx.maxAbsolutePerTx > NEVER) throw new ArcFlowError("invalid_amount");
  const { reader, wallet, chain, fees } = await prepWrite(ctx);
  const owner = getAddress(ctx.owner);
  const nonce = await reader.getTransactionCount({ address: owner, blockTag: "pending" });
  ctx.onSubmitting?.({ predictedVault: vaultAddressAt(owner, nonce), nonce });
  const txHash = await wallet.deployContract({
    abi: AGENT_VAULT_CONSTRUCTOR_ABI,
    bytecode: AGENT_VAULT_BYTECODE,
    args: [owner, ARC_USDC, ARC_NETWORKS[ctx.network].identityRegistry, ctx.maxAbsolutePerTx],
    account: owner,
    chain,
    ...fees,
  });
  ctx.onHash?.(txHash);
  const r = await mined(reader, txHash);
  if (!r.contractAddress) throw new ArcFlowError("tx_failed");
  return { vault: getAddress(r.contractAddress), txHash };
}

/** ERC-8004 register(agentURI) from the owner's wallet; the identity NFT is minted to the owner. */
export async function registerIdentity(
  ctx: WriteCtx & { agentURI: string; onSubmitting?: (fromBlock: bigint) => void; onHash?: (hash: Hash) => void },
): Promise<{ agentId: bigint; txHash: Hash }> {
  const { reader, wallet, chain, fees } = await prepWrite(ctx);
  const owner = getAddress(ctx.owner);
  const registry = ARC_NETWORKS[ctx.network].identityRegistry;
  await reader.simulateContract({ address: registry, abi: identityAbi, functionName: "register", args: [ctx.agentURI], account: owner });
  ctx.onSubmitting?.(await reader.getBlockNumber());
  const txHash = await wallet.writeContract({
    address: registry, abi: identityAbi, functionName: "register", args: [ctx.agentURI], account: owner, chain, ...fees,
  });
  ctx.onHash?.(txHash);
  const r = await mined(reader, txHash);
  const agentId = agentIdFromLogs(r.logs, registry, owner);
  if (agentId === null) throw new ArcFlowError("no_agent_id");
  return { agentId, txHash };
}

/** Plain native USDC send to the vault (Arc: native and ERC-20 USDC are one balance; vault has receive()). */
export async function fundVault(
  ctx: WriteCtx & { vault: Address; amount: bigint; onHash?: (hash: Hash) => void },
): Promise<{ txHash: Hash }> {
  if (ctx.amount <= 0n) throw new ArcFlowError("invalid_amount");
  const { reader, wallet, chain, fees } = await prepWrite(ctx);
  const value = usdcToNativeWei(ctx.amount);
  const balance = await reader.getBalance({ address: getAddress(ctx.owner) });
  if (balance < value) throw new ArcFlowError("insufficient_funds");
  const txHash = await wallet.sendTransaction({ account: getAddress(ctx.owner), chain, to: getAddress(ctx.vault), value, ...fees });
  ctx.onHash?.(txHash);
  await mined(reader, txHash);
  return { txHash };
}

/** AgentVault.installSession, simulated first so a revert is named before the wallet prompt. */
export async function installSession(
  ctx: WriteCtx & { vault: Address; args: readonly [Address, SessionConfig]; onHash?: (hash: Hash) => void },
): Promise<{ txHash: Hash }> {
  const { reader, wallet, chain, fees } = await prepWrite(ctx);
  const owner = getAddress(ctx.owner);
  const vault = getAddress(ctx.vault);
  await reader.simulateContract({ address: vault, abi: agentVaultAbi, functionName: "installSession", args: ctx.args, account: owner });
  const txHash = await wallet.writeContract({
    address: vault, abi: agentVaultAbi, functionName: "installSession", args: ctx.args, account: owner, chain, ...fees,
  });
  ctx.onHash?.(txHash);
  await mined(reader, txHash);
  return { txHash };
}

/** AgentVault.revokeSession — retire an agent key (e.g. one whose secret was lost before it was saved). */
export async function revokeSession(
  ctx: WriteCtx & { vault: Address; agentSigner: Address; onHash?: (hash: Hash) => void },
): Promise<{ txHash: Hash }> {
  const { reader, wallet, chain, fees } = await prepWrite(ctx);
  const owner = getAddress(ctx.owner);
  const args = [getAddress(ctx.agentSigner)] as const;
  await reader.simulateContract({ address: getAddress(ctx.vault), abi: agentVaultAbi, functionName: "revokeSession", args, account: owner });
  const txHash = await wallet.writeContract({
    address: getAddress(ctx.vault), abi: agentVaultAbi, functionName: "revokeSession", args, account: owner, chain, ...fees,
  });
  ctx.onHash?.(txHash);
  await mined(reader, txHash);
  return { txHash };
}

// ------------------------------------------------------------------ chain: reads (resume)

export type SessionView = {
  exists: boolean; revoked: boolean; agentId: bigint; perTxCap: bigint; windowCap: bigint; windowSeconds: bigint;
  expiresAt: bigint; pqThreshold: bigint; nonce: bigint;
};
export type VaultState =
  | { exists: false }
  | {
      exists: true;
      owner: Address;
      ownerMatches: boolean;
      /** usdc() and identity() are this network's, and the runtime code is exactly AgentVault's. */
      isAgentVault: boolean;
      maxAbsolutePerTx: bigint;
      balance: bigint;
      session: SessionView | null;
    };

/** Everything the flow needs to know about a vault, from chain. Never trusts localStorage alone. */
export async function readVaultState(p: {
  network: ArcNetwork; vault: Address; owner?: Address; agentSigner?: Address; reader?: ArcReader;
}): Promise<VaultState> {
  const reader = p.reader ?? arcReader(p.network);
  const vault = getAddress(p.vault);
  const code = await reader.getCode({ address: vault });
  if (!code || code === "0x") return { exists: false };
  let owner: Address, usdc: Address, identity: Address, maxAbs: bigint;
  try {
    [owner, usdc, identity, maxAbs] = await Promise.all([
      reader.readContract({ address: vault, abi: agentVaultAbi, functionName: "owner" }),
      reader.readContract({ address: vault, abi: agentVaultAbi, functionName: "usdc" }),
      reader.readContract({ address: vault, abi: agentVaultAbi, functionName: "identity" }),
      reader.readContract({ address: vault, abi: agentVaultAbi, functionName: "maxAbsolutePerTx" }),
    ]);
  } catch (e) {
    if (isContractNo(e)) return { exists: false };
    throw e;
  }
  const net = ARC_NETWORKS[p.network];
  let isAgentVault = getAddress(usdc) === getAddress(ARC_USDC) && getAddress(identity) === getAddress(net.identityRegistry);
  if (isAgentVault) {
    // Re-run the creation code with this vault's own constructor args in an eth_call: the
    // returned runtime code (immutables filled in) must equal what is deployed, byte for byte.
    try {
      const expected = await reader.call({
        data: encodeDeployData({ abi: AGENT_VAULT_CONSTRUCTOR_ABI, bytecode: AGENT_VAULT_BYTECODE, args: [owner, usdc, identity, maxAbs] }),
      });
      isAgentVault = expected.data?.toLowerCase() === code.toLowerCase();
    } catch (e) {
      if (!isContractNo(e)) throw e;
      isAgentVault = false;
    }
  }
  const [balance, s] = await Promise.all([
    reader.readContract({ address: ARC_USDC, abi: erc20BalanceAbi, functionName: "balanceOf", args: [vault] }),
    p.agentSigner
      ? reader.readContract({ address: vault, abi: agentVaultAbi, functionName: "getSession", args: [getAddress(p.agentSigner)] })
      : Promise.resolve(null),
  ]);
  return {
    exists: true,
    owner: getAddress(owner),
    ownerMatches: p.owner ? getAddress(owner) === getAddress(p.owner) : false,
    isAgentVault,
    maxAbsolutePerTx: maxAbs,
    balance,
    session: s
      ? {
          exists: s.exists, revoked: s.revoked, agentId: s.agentId, perTxCap: s.perTxCap, windowCap: s.windowCap,
          windowSeconds: s.windowSeconds, expiresAt: s.expiresAt, pqThreshold: s.pqThreshold, nonce: s.nonce,
        }
      : null,
  };
}

/** True when the owner has a transaction in the mempool that hasn't been mined yet. */
export async function hasPendingTx(p: { network: ArcNetwork; owner: Address; reader?: ArcReader }): Promise<boolean> {
  const reader = p.reader ?? arcReader(p.network);
  const [latest, pending] = await Promise.all([
    reader.getTransactionCount({ address: p.owner, blockTag: "latest" }),
    reader.getTransactionCount({ address: p.owner, blockTag: "pending" }),
  ]);
  return pending > latest;
}

/**
 * Where did the deploy end up? Checks the saved/predicted address, then the CREATE addresses of
 * the next few owner nonces (a wallet may pick its own nonce). "none" only when no tx from that
 * nonce on produced an AgentVault owned by `owner` and nothing is pending — i.e. the signature was
 * rejected or the tx dropped (or isn't visible to this RPC yet: callers keep the nonce hint until
 * `stale`, so a late-landing deploy is still found). The page asks before deploying again; it never
 * auto-deploys.
 */
export async function resolveDeploy(p: {
  network: ArcNetwork; owner: Address; vault?: Address; vaultNonce?: number; reader?: ArcReader;
}): Promise<{ status: "deployed"; vault: Address } | { status: "pending" } | { status: "none"; stale: boolean }> {
  const reader = p.reader ?? arcReader(p.network);
  const ok = async (a: Address) => {
    const st = await readVaultState({ network: p.network, vault: a, owner: p.owner, reader });
    return st.exists && st.ownerMatches && st.isAgentVault;
  };
  if (p.vault && (await ok(p.vault))) return { status: "deployed", vault: getAddress(p.vault) };
  if (p.vaultNonce === undefined) return { status: "none", stale: true };
  const [latest, pending] = await Promise.all([
    reader.getTransactionCount({ address: p.owner, blockTag: "latest" }),
    reader.getTransactionCount({ address: p.owner, blockTag: "pending" }),
  ]);
  for (let n = p.vaultNonce; n < latest && n < p.vaultNonce + 8; n++) {
    const a = vaultAddressAt(p.owner, n);
    if (await ok(a)) return { status: "deployed", vault: a };
  }
  if (pending > latest && latest <= p.vaultNonce + 8) return { status: "pending" };
  // stale: the owner has moved past the scan window, so the hint can never resolve to a vault
  return { status: "none", stale: latest >= p.vaultNonce + 8 };
}

/** ERC-8004 ownership check for a saved agentId. */
export async function identityOwnedBy(p: { network: ArcNetwork; agentId: bigint; owner: Address; reader?: ArcReader }): Promise<boolean> {
  const reader = p.reader ?? arcReader(p.network);
  try {
    const o = await reader.readContract({
      address: ARC_NETWORKS[p.network].identityRegistry, abi: identityAbi, functionName: "ownerOf", args: [p.agentId],
    });
    return getAddress(o) === getAddress(p.owner);
  } catch (e) {
    if (isContractNo(e)) return false; // ERC-721 ownerOf reverts for an unknown id
    throw e;
  }
}

/**
 * Find an identity minted to `owner` at or after `fromBlock` (the block saved just before the
 * register tx was sent). Scans in chunks the Arc RPC accepts; bounded so a stale hint can't spin.
 */
export async function findAgentId(p: {
  network: ArcNetwork; owner: Address; fromBlock: bigint; reader?: ArcReader; maxChunks?: number;
}): Promise<bigint | null> {
  const reader = p.reader ?? arcReader(p.network);
  const latest = await reader.getBlockNumber();
  const max = p.maxChunks ?? 30;
  for (let from = p.fromBlock, i = 0; from <= latest && i < max; from += LOG_CHUNK, i++) {
    const to = from + LOG_CHUNK - 1n < latest ? from + LOG_CHUNK - 1n : latest;
    const logs = await reader.getLogs({
      address: ARC_NETWORKS[p.network].identityRegistry,
      event: transferEvent,
      args: { from: zeroAddress, to: getAddress(p.owner) },
      fromBlock: from,
      toBlock: to,
    });
    const id = logs[0]?.args.tokenId;
    if (id !== undefined) return id;
  }
  return null;
}
