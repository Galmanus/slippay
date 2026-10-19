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
import { hexToBytes, noteCharge, runIntegrityCheck } from "./oracle.mjs";

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
const AIA_DOMAIN = keccak(enc.encode("SlippayAIA.arc.v1"));

/** AgentVault.spendDigest — EIP-712, recomputed independently of the caller. */
export function arcSpendDigest({ vault, chainId, agentSigner, to, amount, nonce, deadline, orderId }) {
  const domain = keccak(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, word(chainId), addr(vault));
  const struct = keccak(SPEND_TYPEHASH, addr(agentSigner), addr(to), word(amount), word(nonce), word(deadline), b32(orderId));
  return toHex(keccak(Uint8Array.of(0x19, 0x01), domain, struct));
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

/**
 * Attest one AgentVault spend. Runs the integrity check (surface + velocity) against the spend's
 * own recipient/amount, refuses expired or far-future deadlines, then signs. Fail-closed.
 * Returns { ok, digest, attestation_hash, attestation: 0x r‖s, pubkey } or { ok:false, reason }.
 */
export async function attestArc({ agent_id, spend, tools_used }, p256Priv, opts = {}) {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const maxTtl = opts.maxTtlSeconds ?? 900;
  const deadline = Number(spend.deadline);
  if (!(deadline >= now)) return { ok: false, reason: "deadline already passed" };
  if (deadline > now + maxTtl) return { ok: false, reason: `deadline more than ${maxTtl}s ahead — attestations are short-lived` };

  const chk = runIntegrityCheck(
    { agent_id, recipient: String(spend.to).toLowerCase(), amount: String(spend.amount), tools_used },
    now,
  );
  if (!chk.ok) return chk;

  const digest = arcSpendDigest(spend);
  const h = arcAttestationHash(digest);
  const sig = p256.sign(h.slice(2), p256Priv, { prehash: false, lowS: true });
  noteCharge(agent_id, now);
  return { ok: true, digest, attestation_hash: h, attestation: "0x" + sig.toCompactHex(), pubkey: p256PublicKey(p256Priv) };
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
