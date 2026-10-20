// x402 buyer over Circle Gateway nanopayments on Arc (x402 v2, scheme "exact", GatewayWalletBatched).
//
// The seller answers 402 with a challenge; we sign an EIP-3009 TransferWithAuthorization whose
// EIP-712 domain is the Gateway Wallet (not USDC), send it base64 in Payment-Signature and replay
// the identical request once. Gateway debits the payer's pre-deposited balance and batches
// settlement. Nanopayments need an EOA signature (no ERC-1271), so the payer is an EOA: for an
// AgentVault agent, the float that src/float.ts tops up from the vault.
//
// SECURITY: the 402 is seller-controlled, so it never decides what we sign. Before a signature
// exists we pin the network, the Gateway Wallet (verifyingContract), the asset (USDC), a price cap
// and optionally the payees; any mismatch is refused. Each authorization carries a fresh random
// nonce, so it clears at most one call of at most the cap. Mirrors the attester's noble
// implementation (packages/slippay-attester/src/counterparty.mjs); both are pinned to one vector.
import { getAddress, isAddress, toHex, type Address, type Hex, type LocalAccount } from "viem";
import { ARC_GATEWAY, ARC_NETWORKS, ARC_USDC, type ArcNetwork } from "./constants.ts";

export type X402Network = "eip155:5042" | "eip155:5042002";
export type X402Policy = {
  network: X402Network;
  /** Highest price (6-decimal USDC units) we will sign for one call. */
  maxAmount: bigint;
  /** When given, only these payees. */
  payTo?: readonly Address[];
};

export type GatewayOption = {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  extra: { name: string; version: string; verifyingContract: string };
};

export type GatewayAuthorization = {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

export type X402Result = {
  status: number;
  ok: boolean;
  body: string;
  paid: null | { amount: bigint; payTo: Address; network: string };
  error?: string;
};

/** Gateway's minimum validity (7 days) plus the Circle SDK's buffer. */
const GATEWAY_VALIDITY_SECONDS = 7 * 24 * 60 * 60 + 100;
/** Longest validity a seller may ask for: its maxTimeoutSeconds sets how long our signature lives. */
const MAX_TIMEOUT_SECONDS = 30 * 24 * 60 * 60;

const NETWORK_OF: Record<X402Network, ArcNetwork> = {
  [`eip155:${ARC_NETWORKS.mainnet.chainId}`]: "mainnet",
  [`eip155:${ARC_NETWORKS.testnet.chainId}`]: "testnet",
} as Record<X402Network, ArcNetwork>;

const lower = (s: unknown) => String(s ?? "").toLowerCase();

// UTF-8 base64 without Buffer: this module also runs under Deno (the API relayer).
function b64encode(s: string): string {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}
const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

export function gatewayAuthorizationTypedData(p: { chainId: number; verifyingContract: Address; authorization: GatewayAuthorization }) {
  return {
    domain: { name: "GatewayWalletBatched", version: "1", chainId: p.chainId, verifyingContract: p.verifyingContract },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization" as const,
    message: p.authorization,
  };
}

/** 65-byte r‖s‖v signature over the authorization under the GatewayWalletBatched domain. */
export function signGatewayAuthorization(
  account: LocalAccount,
  p: { chainId: number; verifyingContract: Address; authorization: GatewayAuthorization },
): Promise<Hex> {
  return account.signTypedData(gatewayAuthorizationTypedData(p));
}

function rejectReason(o: GatewayOption, policy: X402Policy): string | null {
  const net = NETWORK_OF[policy.network];
  const gw = ARC_GATEWAY[net];
  if (o.scheme !== "exact") return `scheme ${o.scheme} is not "exact"`;
  if (o.extra?.name !== "GatewayWalletBatched" || o.extra?.version !== "1") return "not a Circle Gateway batching option";
  if (lower(o.extra.verifyingContract) !== lower(gw.wallet)) return `verifyingContract ${o.extra.verifyingContract} is not the Gateway Wallet on Arc ${net}`;
  if (lower(o.asset) !== lower(ARC_USDC)) return `asset ${o.asset} is not USDC on Arc ${net}`;
  if (!isAddress(String(o.payTo), { strict: false })) return `bad payTo ${o.payTo}`;
  if (policy.payTo && !policy.payTo.some((a) => lower(a) === lower(o.payTo))) return `payTo ${o.payTo} is not an allowed payee`;
  if (!/^\d{1,39}$/.test(String(o.amount))) return `bad amount ${o.amount}`;
  if (BigInt(o.amount) > policy.maxAmount) return `price ${o.amount} above cap ${policy.maxAmount}`;
  const t = o.maxTimeoutSeconds;
  if (t !== undefined && t !== null && !(Number.isInteger(t) && t >= 0 && t <= MAX_TIMEOUT_SECONDS)) {
    return `maxTimeoutSeconds ${t} out of range (0..${MAX_TIMEOUT_SECONDS})`;
  }
  return null;
}

/** The option we are willing to sign, or throw with the reason we refuse. */
export function selectGatewayOption(challenge: unknown, policy: X402Policy): GatewayOption {
  if (!NETWORK_OF[policy.network]) throw new Error(`network ${policy.network} is not an Arc Gateway network`);
  const accepts = (challenge as { accepts?: unknown })?.accepts;
  const candidates = (Array.isArray(accepts) ? accepts : []).filter((o) => o?.network === policy.network) as GatewayOption[];
  if (!candidates.length) throw new Error(`network ${policy.network} not offered by the seller`);
  const good = candidates.find((o) => !rejectReason(o, policy));
  if (!good) throw new Error(rejectReason(candidates[0]!, policy)!);
  return good;
}

/** Base64 Payment-Signature header for one option. */
export async function gatewayPaymentHeader(
  challenge: { x402Version?: number; resource?: unknown },
  option: GatewayOption,
  account: LocalAccount,
  nowSec: number,
  nonce: Hex,
): Promise<string> {
  const authorization: GatewayAuthorization = {
    from: account.address,
    to: getAddress(option.payTo),
    value: BigInt(option.amount),
    validAfter: BigInt(nowSec - 600),
    validBefore: BigInt(nowSec + Math.max(Number(option.maxTimeoutSeconds) || 0, GATEWAY_VALIDITY_SECONDS)),
    nonce,
  };
  const chainId = Number(option.network.split(":")[1]);
  const signature = await signGatewayAuthorization(account, {
    chainId, verifyingContract: getAddress(option.extra.verifyingContract), authorization,
  });
  const wire = Object.fromEntries(Object.entries(authorization).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));
  const payload = { x402Version: challenge.x402Version ?? 2, payload: { authorization: wire, signature }, resource: challenge.resource, accepted: option };
  return b64encode(JSON.stringify(payload));
}

async function readChallenge(res: Response): Promise<unknown> {
  const h = res.headers.get("PAYMENT-REQUIRED");
  try {
    return h ? JSON.parse(b64decode(h)) : await res.json();
  } catch {
    throw new Error("unreadable 402 challenge");
  }
}

/**
 * Fetch an x402 resource, paying one Gateway nanopayment if the seller answers 402. `beforePay`
 * runs after the challenge passed the policy and before anything is signed (fund the float
 * there); if it throws, nothing is paid. At most one paid replay: a second 402 is reported, not
 * retried. Never throws: refusals and network trouble come back in `error`.
 */
export async function x402Fetch(
  url: string,
  init: { method?: string; body?: string },
  o: {
    account: LocalAccount;
    policy: X402Policy;
    beforePay?: (amount: bigint, option: GatewayOption) => Promise<void>;
    fetch?: typeof fetch;
    timeoutMs?: number;
    now?: number;
    nonce?: Hex;
  },
): Promise<X402Result> {
  const fetchFn = o.fetch ?? globalThis.fetch;
  const timeoutMs = o.timeoutMs ?? 15_000;
  const send = (extra: Record<string, string> = {}) =>
    fetchFn(url, {
      method: init.method ?? "GET",
      headers: { ...(init.body !== undefined && { "content-type": "application/json" }), ...extra },
      body: init.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  let paid: X402Result["paid"] = null;
  let status = 0;
  try {
    let res = await send();
    status = res.status;
    if (res.status === 402) {
      const challenge = (await readChallenge(res)) as { x402Version?: number; resource?: unknown };
      const option = selectGatewayOption(challenge, o.policy);
      const amount = BigInt(option.amount);
      if (o.beforePay) await o.beforePay(amount, option);
      const header = await gatewayPaymentHeader(
        challenge, option, o.account, o.now ?? Math.floor(Date.now() / 1000), o.nonce ?? toHex(crypto.getRandomValues(new Uint8Array(32))),
      );
      paid = { amount, payTo: getAddress(option.payTo), network: option.network };
      res = await send({ "Payment-Signature": header });
      status = res.status;
    }
    return { status: res.status, ok: res.ok, body: await res.text(), paid };
  } catch (e) {
    const msg = e instanceof Error ? (e.name === "TimeoutError" ? `timeout after ${timeoutMs}ms` : e.message) : String(e);
    if (!paid) return { status, ok: false, body: "", paid, error: msg };
    // The authorization left this process; the seller may already have been paid. Never report
    // the challenge's 402 here, or a caller would read "not paid" and pay again.
    return { status: 0, ok: false, body: "", paid, error: `${msg}: a payment authorization for ${paid.amount} was sent; do not retry, check with the seller` };
  }
}
