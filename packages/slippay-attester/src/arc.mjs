// AIA over Arc — the integrity gate for Slippay's AgentVault on Circle's Arc L1.
//
// AgentVault (contracts-evm) requires, above a session's attestThreshold, a P-256 signature by
// the session's attester over attestationHash(spendDigest), verified on-chain by Arc's P-256
// precompile (0x100). P-256 (not ed25519) because the EVM has no ed25519 precompile; it is also
// the passkey curve. The verdict stays the same as every other rail: is the agent still inside
// the surface it committed?
//
// SECURITY: the attester never signs a caller-supplied hash. It recomputes the EIP-712 spend
// digest from the spend fields it checked (vault, chain, agent, recipient, amount, nonce,
// deadline, order) — so "recipient is in-surface" can't be laundered onto a different spend. The
// digest binds nonce and deadline, so one attestation clears exactly one spend and expires with
// it; deadlines too far ahead are refused so a verdict can't be banked for later.
import { p256 } from "@noble/curves/p256";
import { keccak_256 } from "@noble/hashes/sha3";
import { getSurface, hexToBytes, noteCharge, runIntegrityCheck, surfaceDeviation } from "./oracle.mjs";

const enc = new TextEncoder();
const toHex = (b) => "0x" + Buffer.from(b).toString("hex");
const keccak = (...parts) => {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return keccak_256(buf);
};
function word(v) { // uint256 big-endian, 32 bytes
  let x = BigInt(v);
  if (x < 0n || x >= 1n << 256n) throw new Error("uint out of range");
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}
function addr(a) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`bad address ${a}`);
  const out = new Uint8Array(32);
  out.set(hexToBytes(a), 12);
  return out;
}
function b32(h) {
  const b = hexToBytes(h);
  if (b.length !== 32) throw new Error("bytes32 expected");
  return b;
}
// Shared with counterparty.mjs (EIP-3009 over Circle Gateway).
export { keccak, word, addr, b32, toHex };

const DOMAIN_TYPEHASH = keccak(enc.encode("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
const NAME_HASH = keccak(enc.encode("SlippayAgentVault"));
const VERSION_HASH = keccak(enc.encode("1"));
const SPEND_TYPEHASH = keccak(enc.encode("Spend(address agentSigner,address to,uint256 amount,uint64 nonce,uint64 deadline,bytes32 orderId)"));
const HOLD_TYPEHASH = keccak(enc.encode("Hold(address agentSigner,address payee,uint256 amount,uint64 nonce,uint64 deadline,uint64 releaseBy,bytes32 orderId)"));
const RELEASE_TYPEHASH = keccak(enc.encode("Release(bytes32 holdId)"));
const AIA_DOMAIN = keccak(enc.encode("SlippayAIA.arc.v1"));
/** AgentVaultV2.MAX_HOLD_SECONDS: the longest a hold may lock funds. */
const MAX_HOLD_SECONDS = 30 * 86_400;

const eip712 = (vault, chainId, struct) =>
  toHex(keccak(Uint8Array.of(0x19, 0x01), keccak(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, word(chainId), addr(vault)), struct));

/** AgentVault.spendDigest — EIP-712, recomputed independently of the caller. */
export function arcSpendDigest({ vault, chainId, agentSigner, to, amount, nonce, deadline, orderId }) {
  return eip712(vault, chainId, keccak(SPEND_TYPEHASH, addr(agentSigner), addr(to), word(amount), word(nonce), word(deadline), b32(orderId)));
}

/** AgentVaultV2.holdDigest — also the hold's id in the vault. */
export function arcHoldDigest({ vault, chainId, agentSigner, payee, amount, nonce, deadline, releaseBy, orderId }) {
  return eip712(vault, chainId, keccak(HOLD_TYPEHASH, addr(agentSigner), addr(payee), word(amount), word(nonce), word(deadline), word(releaseBy), b32(orderId)));
}

/** AgentVaultV2.releaseDigest — what the agent (and the attester) sign to pay a hold out. */
export function arcReleaseDigest({ vault, chainId, holdId }) {
  return eip712(vault, chainId, keccak(RELEASE_TYPEHASH, b32(holdId)));
}

/** AgentVault.attestationHash — what the P-256 attester signs. */
export function arcAttestationHash(digestHex) {
  return toHex(keccak(AIA_DOMAIN, b32(digestHex)));
}

/** P-256 public key as the (x, y) the vault stores in the session. */
export function p256PublicKey(priv) {
  const pub = p256.getPublicKey(priv, false); // 0x04 ‖ x ‖ y
  return { x: toHex(pub.slice(1, 33)), y: toHex(pub.slice(33, 65)) };
}

// Steps every attestation shares. Each returns a refusal ({ ok:false, reason }) or null/a value.
function deadlineRefusal(deadline, now, maxTtl) {
  if (!(Number(deadline) >= now)) return { ok: false, reason: "deadline already passed" };
  if (Number(deadline) > now + maxTtl) return { ok: false, reason: `deadline more than ${maxTtl}s ahead — attestations are short-lived` };
  return null;
}
/** Ask the counterparty guard about `to`; { refusal } when it blocks or throws, else { counterparty }. */
async function askCounterparty(guard, to, amount) {
  if (!guard) return {};
  let counterparty;
  try {
    counterparty = await guard({ counterparty: to, amountUsd: Number(amount) / 1e6 });
  } catch (e) {
    return { refusal: { ok: false, reason: `counterparty check failed: ${e?.message ?? e}` } };
  }
  if (counterparty.block) {
    const why = counterparty.reasons?.length ? counterparty.reasons.join("; ") : counterparty.error ?? "no reason given";
    return { refusal: { ok: false, reason: `counterparty ${counterparty.decision}: ${why}`, counterparty } };
  }
  return { counterparty };
}
function signed(digest, p256Priv, counterparty) {
  const h = arcAttestationHash(digest);
  const sig = p256.sign(h.slice(2), p256Priv, { prehash: false, lowS: true });
  return { ok: true, digest, attestation_hash: h, attestation: "0x" + sig.toCompactHex(), pubkey: p256PublicKey(p256Priv), ...(counterparty && { counterparty }) };
}

/**
 * Attest one AgentVault spend. Runs the integrity check (surface + velocity) against the spend's
 * own recipient/amount, refuses expired or far-future deadlines, then signs. Fail-closed.
 * opts.counterparty (counterpartyGuard from counterparty.mjs) asks A-Identity about the recipient
 * after the integrity check passes, so refused spends never pay for a check; `block` refuses, and
 * the verdict rides along in the result either way. A guard that throws refuses.
 * Returns { ok, digest, attestation_hash, attestation: 0x r‖s, pubkey, counterparty? } or { ok:false, reason }.
 */
export async function attestArc({ agent_id, spend, tools_used }, p256Priv, opts = {}) {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const late = deadlineRefusal(spend.deadline, now, opts.maxTtlSeconds ?? 900);
  if (late) return late;

  const chk = runIntegrityCheck(
    { agent_id, recipient: String(spend.to).toLowerCase(), amount: String(spend.amount), tools_used },
    now,
  );
  if (!chk.ok) return chk;

  const { refusal, counterparty } = await askCounterparty(opts.counterparty, spend.to, spend.amount);
  if (refusal) return refusal;

  const out = signed(arcSpendDigest(spend), p256Priv, counterparty);
  noteCharge(agent_id, now);
  return out;
}

/**
 * Attest one AgentVaultV2 hold: the same checks as a spend (the payee is the recipient, and a hold
 * counts as a charge for velocity), plus releaseBy inside the vault's bound (in the future, at
 * most 30 days ahead). Returns what attestArc returns, plus holdId (= the digest).
 */
export async function attestArcHold({ agent_id, hold, tools_used }, p256Priv, opts = {}) {
  const holdId = arcHoldDigest(hold); // malformed terms throw here, before any paid check
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const late = deadlineRefusal(hold.deadline, now, opts.maxTtlSeconds ?? 900);
  if (late) return late;
  const releaseBy = Number(hold.releaseBy);
  if (!(releaseBy > now) || releaseBy > now + MAX_HOLD_SECONDS) {
    return { ok: false, reason: "releaseBy must be in the future and at most 30 days ahead" };
  }

  const chk = runIntegrityCheck(
    { agent_id, recipient: String(hold.payee).toLowerCase(), amount: String(hold.amount), tools_used },
    now,
  );
  if (!chk.ok) return chk;

  const { refusal, counterparty } = await askCounterparty(opts.counterparty, hold.payee, hold.amount);
  if (refusal) return refusal;

  const out = signed(holdId, p256Priv, counterparty);
  noteCharge(agent_id, now);
  return { ...out, holdId };
}

/**
 * Attest the release of an AgentVaultV2 hold (delivery confirmed). The caller sends the hold's
 * terms, never a bare holdId: the attester recomputes holdId from them, so it knows the payee and
 * amount it is clearing, and terms that were never held give a holdId the vault does not have.
 * Refuses at or after releaseBy (the vault refuses too; the hold can only be refunded then), and
 * a payee that is no longer in the committed surface. Velocity is not checked and the release is
 * not counted: the hold already was. The counterparty is asked again, so a payee that turned
 * DENY since the hold is refused under enforce and the hold runs out to a refund.
 * The vault's Release digest carries no deadline: an attestation stays usable until releaseBy.
 * Returns { ok, holdId, digest (release digest), attestation_hash, attestation, pubkey, counterparty? }.
 */
export async function attestArcRelease({ agent_id, hold, tools_used }, p256Priv, opts = {}) {
  if (!hold) throw new Error("release needs the hold's terms (hold), not just its id");
  const holdId = arcHoldDigest(hold); // malformed terms throw here, before any paid check
  const digest = arcReleaseDigest({ vault: hold.vault, chainId: hold.chainId, holdId });
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const releaseBy = Number(hold.releaseBy);
  if (!(now < releaseBy)) return { ok: false, reason: "hold is at or past releaseBy — it can only be refunded" };
  if (releaseBy > now + MAX_HOLD_SECONDS) return { ok: false, reason: "releaseBy more than 30 days ahead — the vault never made this hold" };

  const surface = getSurface(agent_id);
  if (!surface) return { ok: false, reason: "agent has no committed surface — register it first" };
  const off = surfaceDeviation({ agent_id, recipient: String(hold.payee).toLowerCase(), amount: String(hold.amount), tools_used }, surface);
  if (off) return { ok: false, reason: off, compromised: true };

  const { refusal, counterparty } = await askCounterparty(opts.counterparty, hold.payee, hold.amount);
  if (refusal) return refusal;

  return { ...signed(digest, p256Priv, counterparty), holdId };
}

/** Off-chain mirror of the vault's on-chain check. */
export function verifyArc({ spend, attestation, pubkey }) {
  try {
    const h = arcAttestationHash(arcSpendDigest(spend));
    const pub = "04" + pubkey.x.slice(2) + pubkey.y.slice(2);
    const ok = p256.verify(attestation.slice(2), h.slice(2), pub, { prehash: false, lowS: false });
    return { valid: ok, reason: ok ? null : "bad signature" };
  } catch (e) {
    return { valid: false, reason: String(e?.message ?? e) };
  }
}
