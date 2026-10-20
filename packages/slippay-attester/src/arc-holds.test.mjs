// AIA over Arc for AgentVaultV2 holds. Proves: the attester recomputes the EXACT hold and release
// digests the Solidity vault computes (shared vector), signs a hold only like a spend (in-surface
// payee, cap, velocity, bounded deadline, releaseBy inside the vault's 30-day bound), and signs a
// release only for a hold it can recompute, before releaseBy, to a payee still in-surface, without
// counting it as a second charge. The counterparty is asked again at release.
//
// Run isolated:  SLIPPAY_ATTESTER_DATA=/tmp/arc-holds-surfaces.json node src/arc-holds.test.mjs
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import { keccak_256 } from "@noble/hashes/sha3";
import { commitSurface } from "./oracle.mjs";
import { arcAttestationHash, arcHoldDigest, arcReleaseDigest, attestArcHold, attestArcRelease } from "./arc.mjs";
import { counterpartyGuard } from "./counterparty.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };

// Shared with contracts-evm/test/DigestVector.t.sol (test_vector_v2Holds_arcTestnet).
const HOLD = {
  vault: "0x0000000000000000000000000000000000a6E57a",
  chainId: 5042002,
  agentSigner: "0xe05fcC23807536bEe418f142D19fa0d21BB0cfF7",
  payee: "0x000000000000000000000000000000000000bEEF",
  amount: "12345678",
  nonce: "7",
  deadline: "1900000000",
  releaseBy: "1900086400",
  orderId: "0x" + Buffer.from(keccak_256(new TextEncoder().encode("order-vector-1"))).toString("hex"),
};
const CONTRACT_HOLD_ID = "0xb04ffadd0f2b3c55ecbc57bfabbacc5a8dae773a01417acab27da981fedc1a5b";
const CONTRACT_HOLD_AIA = "0x027548357c046d257924df42860857823f531c32016c13c223202f1c197227db";
const CONTRACT_RELEASE = "0x8d6096d59dc1785da38620be71b09df28f78d33e6ce39da41fc217c3567d6568";
const CONTRACT_RELEASE_AIA = "0x6b533e750f9d35ff1c963a497a064717a9bdf53db0dd3a45058420d1aeb47f16";

const priv = sha256(new TextEncoder().encode("slippay-arc-holds-test-seed"));
const PUB = p256.getPublicKey(priv, false);
const NOW = 1_900_000_000 - 60; // the vector deadline is 60 s ahead of "now"
const verifies = (attestation, aia) =>
  p256.verify(p256.Signature.fromCompact(attestation.slice(2)), aia.slice(2), PUB, { prehash: false });
const surface = (agent_id, extra = {}) =>
  commitSurface({ agent_id, allowed_recipients: [HOLD.payee.toLowerCase()], max_amount: "20000000", ...extra });

const main = async () => {
  // digests
  ok(arcHoldDigest(HOLD) === CONTRACT_HOLD_ID, "hold digest == AgentVaultV2.holdDigest (shared vector)");
  ok(arcAttestationHash(CONTRACT_HOLD_ID) === CONTRACT_HOLD_AIA, "hold attestation hash == AgentVaultV2.attestationHash");
  ok(arcReleaseDigest({ vault: HOLD.vault, chainId: HOLD.chainId, holdId: CONTRACT_HOLD_ID }) === CONTRACT_RELEASE, "release digest == AgentVaultV2.releaseDigest");
  ok(arcAttestationHash(CONTRACT_RELEASE) === CONTRACT_RELEASE_AIA, "release attestation hash == AgentVaultV2.attestationHash");

  // hold: attested exactly like a spend
  surface("hold-agent");
  const h = await attestArcHold({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW });
  ok(h.ok === true && h.digest === CONTRACT_HOLD_ID, "in-surface hold is attested over the digest the attester recomputed");
  ok(h.ok && verifies(h.attestation, CONTRACT_HOLD_AIA), "hold attestation verifies over attestationHash(holdId)");
  ok(h.ok && !verifies(h.attestation, CONTRACT_RELEASE_AIA), "a hold attestation does not clear its release");
  const offPayee = await attestArcHold({ agent_id: "hold-agent", hold: { ...HOLD, payee: "0x000000000000000000000000000000000000dEaD" } }, priv, { now: NOW });
  ok(offPayee.ok === false && /outside the committed surface/.test(offPayee.reason), "hold to an off-surface payee refused");
  const big = await attestArcHold({ agent_id: "hold-agent", hold: { ...HOLD, amount: "20000001" } }, priv, { now: NOW });
  ok(big.ok === false && /exceeds the committed cap/.test(big.reason), "hold over the cap refused");
  const far = await attestArcHold({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW - 3600 });
  ok(far.ok === false && /deadline/.test(far.reason), "hold deadline too far ahead refused");
  const late = await attestArcHold({ agent_id: "hold-agent", hold: HOLD }, priv, { now: 1_900_000_001 });
  ok(late.ok === false && /deadline/.test(late.reason), "hold past its deadline refused");
  const pastRelease = await attestArcHold({ agent_id: "hold-agent", hold: { ...HOLD, releaseBy: String(NOW) } }, priv, { now: NOW });
  ok(pastRelease.ok === false && /releaseBy/.test(pastRelease.reason), "hold whose releaseBy is not in the future refused");
  const longHold = await attestArcHold({ agent_id: "hold-agent", hold: { ...HOLD, releaseBy: String(NOW + 30 * 86_400 + 1) } }, priv, { now: NOW });
  ok(longHold.ok === false && /releaseBy/.test(longHold.reason), "hold longer than 30 days refused");
  const maxHold = await attestArcHold({ agent_id: "hold-agent", hold: { ...HOLD, releaseBy: String(NOW + 30 * 86_400) } }, priv, { now: NOW });
  ok(maxHold.ok === true, "hold of exactly 30 days attested (the vault's bound)");
  const nobody = await attestArcHold({ agent_id: "nobody", hold: HOLD }, priv, { now: NOW });
  ok(nobody.ok === false, "hold by an agent without a committed surface refused");

  // velocity: a hold is a charge, a release is not
  surface("slow-agent", { max_per_window: 1, window_seconds: 3600 });
  const first = await attestArcHold({ agent_id: "slow-agent", hold: HOLD }, priv, { now: NOW });
  ok(first.ok === true, "first hold inside the velocity limit attested");
  const second = await attestArcHold({ agent_id: "slow-agent", hold: { ...HOLD, nonce: "8" } }, priv, { now: NOW });
  ok(second.ok === false && /velocity/.test(second.reason), "second hold over the velocity limit refused");
  const relSlow = await attestArcRelease({ agent_id: "slow-agent", hold: HOLD }, priv, { now: NOW });
  ok(relSlow.ok === true, "release of a counted hold is not blocked by velocity");
  const third = await attestArcHold({ agent_id: "slow-agent", hold: { ...HOLD, nonce: "8" } }, priv, { now: NOW });
  ok(third.ok === false && /velocity/.test(third.reason), "a release does not reset the velocity window");

  // release
  const r = await attestArcRelease({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW });
  ok(r.ok === true && r.holdId === CONTRACT_HOLD_ID && r.digest === CONTRACT_RELEASE, "release attested over the recomputed holdId and release digest");
  ok(r.ok && verifies(r.attestation, CONTRACT_RELEASE_AIA), "release attestation verifies over attestationHash(releaseDigest)");
  ok(r.ok && !verifies(r.attestation, CONTRACT_HOLD_AIA), "a release attestation cannot create a hold");
  const otherHold = await attestArcRelease({ agent_id: "hold-agent", hold: { ...HOLD, amount: "12345679" } }, priv, { now: NOW });
  ok(otherHold.ok && otherHold.holdId !== CONTRACT_HOLD_ID && !verifies(otherHold.attestation, CONTRACT_RELEASE_AIA), "changed hold terms give another holdId, never this hold's release");
  const atReleaseBy = await attestArcRelease({ agent_id: "hold-agent", hold: HOLD }, priv, { now: Number(HOLD.releaseBy) });
  ok(atReleaseBy.ok === false && /releaseBy/.test(atReleaseBy.reason), "release at releaseBy refused (the vault refuses it too)");
  const longRel = await attestArcRelease({ agent_id: "hold-agent", hold: { ...HOLD, releaseBy: String(NOW + 30 * 86_400 + 1) } }, priv, { now: NOW });
  ok(longRel.ok === false && /releaseBy/.test(longRel.reason), "release of a hold the vault could never have made refused");
  const afterDeadline = await attestArcRelease({ agent_id: "hold-agent", hold: HOLD }, priv, { now: 1_900_000_001 });
  ok(afterDeadline.ok === true, "release after the hold's own deadline is fine (the deadline bounds the hold, not delivery)");
  surface("moved-agent", { allowed_recipients: ["0x000000000000000000000000000000000000dead"] });
  const moved = await attestArcRelease({ agent_id: "moved-agent", hold: HOLD }, priv, { now: NOW });
  ok(moved.ok === false && /outside the committed surface/.test(moved.reason), "release to a payee no longer in the surface refused");
  const relNobody = await attestArcRelease({ agent_id: "nobody", hold: HOLD }, priv, { now: NOW });
  ok(relNobody.ok === false, "release by an agent without a committed surface refused");
  let threw = false;
  try { await attestArcRelease({ agent_id: "hold-agent", holdId: CONTRACT_HOLD_ID }, priv, { now: NOW }); } catch { threw = true; }
  ok(threw, "a bare holdId is not enough: the attester needs the hold's terms to check the payee");

  // counterparty: asked at hold and asked again at release
  const asked = [];
  const guard = (decision, mode) => counterpartyGuard({ mode, check: async (q) => { asked.push(q); return { decision, risk: "high", reasons: ["r1"], paymentSent: true }; } });
  const hAllow = await attestArcHold({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW, counterparty: guard("ALLOW", "enforce") });
  ok(hAllow.ok === true && asked[0]?.counterparty === HOLD.payee && asked[0]?.amountUsd === 12.345678, "hold asks the counterparty check about the payee and the amount");
  const hDeny = await attestArcHold({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW, counterparty: guard("DENY", "enforce") });
  ok(hDeny.ok === false && /counterparty DENY/.test(hDeny.reason ?? "") && !hDeny.attestation, "enforce: DENY refuses the hold");
  asked.length = 0;
  const rDeny = await attestArcRelease({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW, counterparty: guard("DENY", "enforce") });
  ok(rDeny.ok === false && /counterparty DENY/.test(rDeny.reason ?? "") && asked[0]?.counterparty === HOLD.payee, "enforce: a payee that turned DENY by release time is refused");
  const rWarn = await attestArcRelease({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW, counterparty: guard("DENY", "warn") });
  ok(rWarn.ok === true && rWarn.counterparty?.decision === "DENY", "warn: DENY at release is reported and the release still attested");
  asked.length = 0;
  const rOff = await attestArcRelease({ agent_id: "moved-agent", hold: HOLD }, priv, { now: NOW, counterparty: guard("ALLOW", "warn") });
  ok(rOff.ok === false && asked.length === 0, "off-surface release refused before any paid check");
  for (const [kind, fn] of [["hold", attestArcHold], ["release", attestArcRelease]]) {
    asked.length = 0;
    let bad = false;
    try { await fn({ agent_id: "hold-agent", hold: { ...HOLD, orderId: "0x1234" } }, priv, { now: NOW, counterparty: guard("ALLOW", "warn") }); } catch { bad = true; }
    ok(bad && asked.length === 0, `${kind} with malformed terms fails before any paid check`);
  }
  const rThrow = await attestArcRelease({ agent_id: "hold-agent", hold: HOLD }, priv, { now: NOW, counterparty: async () => { throw new Error("boom"); } });
  ok(rThrow.ok === false && /counterparty/.test(rThrow.reason ?? ""), "a guard that throws fails closed at release");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};
main();
