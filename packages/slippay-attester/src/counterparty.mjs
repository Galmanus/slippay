// Counterparty check for Slippay agents on Arc — A-Identity risk_check, paid per call with Circle
// Gateway nanopayments (x402 v2, scheme "exact", GatewayWalletBatched).
//
// The attester already answers "is OUR agent compromised?". This asks the other question before
// money moves: "is the RECIPIENT someone we should pay?" — ALLOW / WARN / DENY with reasons. In
// "warn" mode the verdict is logged and never blocks; "enforce" blocks DENY and UNVERIFIABLE.
//
// Payment: the seller answers 402 with a challenge; we sign an EIP-3009 TransferWithAuthorization
// whose EIP-712 domain is the Gateway Wallet (not USDC), send it base64 in Payment-Signature and
// replay the identical request. Gateway debits our pre-deposited balance and batches settlement.
// Nanopayments need an EOA signature (no ERC-1271), so this signs with a dedicated payer key,
// never the AgentVault.
//
// SECURITY: the 402 is seller-controlled, so it never decides what we sign. Before a signature
// exists we pin the network, the Gateway Wallet (verifyingContract), the asset (USDC), the payee
// and a price cap; any mismatch is refused. Each authorization carries a fresh random nonce, so it
// clears at most one call of at most the cap.
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { randomBytes } from "node:crypto";
import { addr, b32, keccak, toHex, word } from "./arc.mjs";
import { hexToBytes } from "./oracle.mjs";

const enc = new TextEncoder();

/** Circle Gateway on Arc, as served in A-Identity's 402 challenges and docs/arc/ARC_KNOWLEDGE.md. */
export const GATEWAY_NETWORKS = {
  "eip155:5042": { name: "Arc mainnet", gatewayWallet: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE", usdc: "0x3600000000000000000000000000000000000000" },
  "eip155:5042002": { name: "Arc testnet", gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", usdc: "0x3600000000000000000000000000000000000000" },
};
export const AID_PAYTO = "0xd305607510e0db2c95807173c7a05bea53c1ed36";
export const RISK_CHECK_URL = "https://a-identity-backend.onrender.com/api/x402/gateway/tools/risk_check";
const RISK_CHECK_PRICE = 5000n; // 0.005 USDC, 6 decimals — the price A-Identity serves on Arc mainnet
const GATEWAY_VALIDITY_SECONDS = 7 * 24 * 60 * 60 + 100; // Gateway minimum + the SDK's buffer
const MAX_TIMEOUT_SECONDS = 30 * 24 * 60 * 60; // the seller's maxTimeoutSeconds sets how long our signature lives
const DECISIONS = new Set(["ALLOW", "WARN", "DENY"]);

const DOMAIN_TYPEHASH = keccak(enc.encode("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
const NAME_HASH = keccak(enc.encode("GatewayWalletBatched"));
const VERSION_HASH = keccak(enc.encode("1"));
const TWA_TYPEHASH = keccak(enc.encode("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"));

/** EIP-55 checksum. */
export function toChecksumAddress(a) {
  const lower = String(a).toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(lower)) throw new Error(`bad address ${a}`);
  const h = Buffer.from(keccak_256(enc.encode(lower))).toString("hex");
  return "0x" + [...lower].map((c, i) => (parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c)).join("");
}

/** The EOA that pays (and signs) for the checks. */
export function gatewayAddress(privKey) {
  const pub = secp256k1.getPublicKey(hexToBytes(privKey), false); // 0x04 ‖ x ‖ y
  return toChecksumAddress(toHex(keccak_256(pub.slice(1)).slice(12)));
}

/** EIP-712 digest of an EIP-3009 authorization under the GatewayWalletBatched domain. */
export function gatewayAuthorizationDigest({ chainId, verifyingContract, authorization: a }) {
  const domain = keccak(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, word(chainId), addr(verifyingContract));
  const struct = keccak(TWA_TYPEHASH, addr(a.from), addr(a.to), word(a.value), word(a.validAfter), word(a.validBefore), b32(a.nonce));
  return toHex(keccak(Uint8Array.of(0x19, 0x01), domain, struct));
}

/** 65-byte r‖s‖v signature (v = 27/28), the form viem's signTypedData returns. */
export function signGatewayAuthorization(typed, privKey) {
  const digest = gatewayAuthorizationDigest(typed);
  const sig = secp256k1.sign(hexToBytes(digest), hexToBytes(privKey), { prehash: false, lowS: true });
  return "0x" + sig.toCompactHex() + (27 + sig.recovery).toString(16);
}

const lower = (s) => String(s ?? "").toLowerCase();

function rejectReason(o, policy) {
  const net = GATEWAY_NETWORKS[o.network];
  if (o.scheme !== "exact") return `scheme ${o.scheme} is not "exact"`;
  if (o.extra?.name !== "GatewayWalletBatched" || o.extra?.version !== "1") return "not a Circle Gateway batching option";
  if (lower(o.extra.verifyingContract) !== lower(net.gatewayWallet)) return `verifyingContract ${o.extra.verifyingContract} is not the Gateway Wallet on ${net.name}`;
  if (lower(o.asset) !== lower(net.usdc)) return `asset ${o.asset} is not USDC on ${net.name}`;
  if (lower(o.payTo) !== lower(policy.payTo)) return `payTo ${o.payTo} is not the pinned payee ${policy.payTo}`;
  if (!/^\d+$/.test(String(o.amount))) return `bad amount ${o.amount}`;
  if (BigInt(o.amount) > policy.maxAmount) return `price ${o.amount} above cap ${policy.maxAmount}`;
  const t = o.maxTimeoutSeconds;
  if (t !== undefined && t !== null && !(Number.isInteger(t) && t >= 0 && t <= MAX_TIMEOUT_SECONDS)) {
    return `maxTimeoutSeconds ${t} out of range (0..${MAX_TIMEOUT_SECONDS})`;
  }
  return null;
}

/** Pick the option we are willing to sign, or throw with the reason we refuse. */
function selectOption(challenge, policy) {
  if (!GATEWAY_NETWORKS[policy.network]) throw new Error(`network ${policy.network} is not a known Gateway network`);
  const candidates = (Array.isArray(challenge?.accepts) ? challenge.accepts : []).filter((o) => o?.network === policy.network);
  if (!candidates.length) throw new Error(`network ${policy.network} not offered by the seller`);
  const good = candidates.find((o) => !rejectReason(o, policy));
  if (!good) throw new Error(rejectReason(candidates[0], policy));
  return good;
}

async function readChallenge(res) {
  const h = res.headers.get("PAYMENT-REQUIRED");
  try {
    return h ? JSON.parse(Buffer.from(h, "base64").toString("utf8")) : await res.json();
  } catch {
    throw new Error("unreadable 402 challenge");
  }
}

function paymentHeader(challenge, option, privKey, now, nonce) {
  const authorization = {
    from: gatewayAddress(privKey),
    to: toChecksumAddress(option.payTo),
    value: String(option.amount),
    validAfter: String(now - 600),
    validBefore: String(now + Math.max(Number(option.maxTimeoutSeconds) || 0, GATEWAY_VALIDITY_SECONDS)),
    nonce,
  };
  const chainId = Number(option.network.split(":")[1]);
  const signature = signGatewayAuthorization({ chainId, verifyingContract: option.extra.verifyingContract, authorization }, privKey);
  const payload = { x402Version: challenge.x402Version ?? 2, payload: { authorization, signature }, resource: challenge.resource, accepted: option };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Fetch an x402 resource, paying a Gateway nanopayment if the seller answers 402. One replay at
 * most. Returns { status, ok, json, paymentSent, error? } and never throws on network trouble.
 * opts: { privKey, policy: { network, maxAmount, payTo }, fetch?, timeoutMs?, now?, nonce? }
 */
export async function payAndFetch(url, { method = "GET", body } = {}, opts = {}) {
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const policy = { ...opts.policy, maxAmount: BigInt(opts.policy?.maxAmount ?? 0) };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const send = (extra = {}) => fetchFn(url, { method, headers: { "content-type": "application/json", ...extra }, body, signal: ctl.signal });
  let paymentSent = false;
  try {
    let res = await send();
    if (res.status === 402) {
      const challenge = await readChallenge(res);
      const option = selectOption(challenge, policy);
      const now = opts.now ?? Math.floor(Date.now() / 1000);
      const header = paymentHeader(challenge, option, opts.privKey, now, opts.nonce ?? toHex(randomBytes(32)));
      paymentSent = true;
      res = await send({ "Payment-Signature": header });
    }
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, json, paymentSent };
  } catch (e) {
    const error = ctl.signal.aborted ? `timeout after ${timeoutMs}ms` : String(e?.message ?? e);
    return { status: 0, ok: false, json: null, paymentSent, error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A-Identity risk_check on a counterparty (0x address, ERC-8004 id or CAIP id) for a payment of
 * amountUsd. Returns { decision: ALLOW|WARN|DENY|UNVERIFIABLE, risk, reasons, paymentSent, error? }.
 * UNVERIFIABLE covers refusals to pay, timeouts, HTTP errors and verdicts we don't recognize.
 */
export async function checkCounterparty({ counterparty, amountUsd }, opts = {}) {
  if (!counterparty) throw new Error("counterparty required");
  const policy = { network: "eip155:5042", maxAmount: RISK_CHECK_PRICE, payTo: AID_PAYTO, ...opts.policy };
  const body = JSON.stringify({ agentId: String(counterparty), txContext: { amountUsd: Number(amountUsd) } });
  const r = await payAndFetch(opts.url ?? RISK_CHECK_URL, { method: "POST", body }, { ...opts, policy });
  const d = r.json?.decision;
  if (!r.ok || !DECISIONS.has(d)) {
    return { decision: "UNVERIFIABLE", risk: null, reasons: [], paymentSent: r.paymentSent, status: r.status,
      error: r.error ?? (r.ok ? `unrecognized decision ${JSON.stringify(d)}` : `HTTP ${r.status}`) };
  }
  return { decision: d, risk: r.json.risk ?? null, reasons: Array.isArray(r.json.reasons) ? r.json.reasons.map(String) : [],
    paymentSent: r.paymentSent, status: r.status };
}

/** "warn" logs and never blocks (pilot). "enforce" blocks DENY and UNVERIFIABLE (fail-closed). */
export function counterpartyGate({ decision }, mode) {
  if (mode === "warn") return { block: false, decision };
  if (mode === "enforce") return { block: decision !== "ALLOW" && decision !== "WARN", decision };
  throw new Error(`counterparty gate mode must be "warn" or "enforce", got ${JSON.stringify(mode)}`);
}

/**
 * What attestArc calls (opts.counterparty): check + gate in one function returning the verdict
 * with `block`. A check that throws becomes UNVERIFIABLE, so warn mode never blocks on it. The
 * mode is validated here, at startup, not on the first payment.
 */
export function counterpartyGuard({ mode, check }) {
  counterpartyGate({ decision: "ALLOW" }, mode);
  return async (q) => {
    let v;
    try {
      v = await check(q);
    } catch (e) {
      v = { decision: "UNVERIFIABLE", risk: null, reasons: [], paymentSent: false, error: String(e?.message ?? e) };
    }
    return { ...v, block: counterpartyGate(v, mode).block };
  };
}
