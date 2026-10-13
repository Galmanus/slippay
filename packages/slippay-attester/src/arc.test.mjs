// AIA over Arc (AgentVault) smoke test. Proves: the attester recomputes the EXACT EIP-712 spend
// digest the Solidity vault computes (shared vector), signs attestationHash(digest) with P-256 only
// for in-surface spends, the signature verifies for that spend and no other, and off-surface or
// over-cap spends are REFUSED (fail-closed).
//
// Run isolated:  SLIPPAY_ATTESTER_DATA=/tmp/arc-surfaces.json node src/arc.test.mjs
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import { commitSurface } from "./oracle.mjs";
import { arcAttestationHash, arcSpendDigest, attestArc, p256PublicKey, verifyArc } from "./arc.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };

// Shared with contracts-evm/test/DigestVector.t.sol and packages/arc-agent tests.
const VECTOR = {
  vault: "0x0000000000000000000000000000000000a6E57a",
  chainId: 5042002,
  agentSigner: "0xe05fcC23807536bEe418f142D19fa0d21BB0cfF7",
  to: "0x000000000000000000000000000000000000bEEF",
  amount: "12345678",
  nonce: "7",
  deadline: "1900000000",
  orderId: "0x" + Buffer.from(
    (await import("@noble/hashes/sha3")).keccak_256(new TextEncoder().encode("order-vector-1")),
  ).toString("hex"),
};
const CONTRACT_DIGEST = "0xf450939119bd18f8cbd5790121d3b1eb191e0bf0d97be1cb5d1e8a96ec37c9a8";
const CONTRACT_AIA = "0xbf14908c0ed47b67620581006a48130915e3776e33c006d45552abce5d4a7254";

const priv = sha256(new TextEncoder().encode("slippay-arc-attester-test-seed"));
const NOW = 1_900_000_000 - 60; // the vector deadline is 60 s ahead of "now"

const main = async () => {
  ok(arcSpendDigest(VECTOR) === CONTRACT_DIGEST, "spend digest == AgentVault.spendDigest (shared vector)");
  ok(arcAttestationHash(CONTRACT_DIGEST) === CONTRACT_AIA, "attestation hash == AgentVault.attestationHash");

  const pk = p256PublicKey(priv);
  ok(/^0x[0-9a-f]{64}$/.test(pk.x) && /^0x[0-9a-f]{64}$/.test(pk.y), "P-256 public key exposed as 32-byte x,y");

  commitSurface({ agent_id: "arc-agent-1", allowed_recipients: [VECTOR.to.toLowerCase()], max_amount: "20000000" });

  const good = await attestArc({ agent_id: "arc-agent-1", spend: VECTOR }, priv, { now: NOW });
  ok(good.ok === true, "in-surface spend is attested");
  ok(good.digest === CONTRACT_DIGEST, "attester recomputed the digest itself (did not trust the caller)");
  ok(/^0x[0-9a-f]{128}$/.test(good.attestation ?? ""), "attestation is 64-byte r||s");
  const sig = p256.Signature.fromCompact(good.attestation.slice(2));
  ok(p256.verify(sig, CONTRACT_AIA.slice(2), p256.getPublicKey(priv, false), { prehash: false }), "P-256 signature verifies over attestationHash(digest)");
  ok(verifyArc({ spend: VECTOR, attestation: good.attestation, pubkey: pk }).valid, "verifyArc accepts it");
  ok(!verifyArc({ spend: { ...VECTOR, amount: "12345679" }, attestation: good.attestation, pubkey: pk }).valid, "same attestation fails for a different amount (bound)");
  ok(!verifyArc({ spend: { ...VECTOR, nonce: "8" }, attestation: good.attestation, pubkey: pk }).valid, "same attestation fails for the next nonce (single-use)");

  const off = await attestArc({ agent_id: "arc-agent-1", spend: { ...VECTOR, to: "0x000000000000000000000000000000000000dEaD" } }, priv, { now: NOW });
  ok(off.ok === false && /outside the committed surface/.test(off.reason), "off-surface recipient refused (fail-closed)");
  const big = await attestArc({ agent_id: "arc-agent-1", spend: { ...VECTOR, amount: "20000001" } }, priv, { now: NOW });
  ok(big.ok === false && /exceeds the committed cap/.test(big.reason), "over-cap amount refused");
  const unknown = await attestArc({ agent_id: "nobody", spend: VECTOR }, priv, { now: NOW });
  ok(unknown.ok === false, "agent without a committed surface refused");
  const far = await attestArc({ agent_id: "arc-agent-1", spend: VECTOR }, priv, { now: NOW - 3600 });
  ok(far.ok === false && /deadline/.test(far.reason), "deadline too far in the future refused (bounded validity)");
  const late = await attestArc({ agent_id: "arc-agent-1", spend: VECTOR }, priv, { now: 1_900_000_001 });
  ok(late.ok === false && /deadline/.test(late.reason), "already-expired intent refused");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};
main();
