// Counterparty check over Circle Gateway nanopayments (A-Identity risk_check on Arc). Proves: the
// EIP-3009 authorization digest and signature match viem byte-for-byte; a paid call replays the
// identical request with a Payment-Signature the seller can verify; a 402 that asks for more than
// the cap, a foreign Gateway contract, a different payee or another network is REFUSED before any
// signature exists; timeouts and odd verdicts come back UNVERIFIABLE; WARN mode never blocks.
//
// Run:  node src/counterparty.test.mjs
import {
  AID_PAYTO, GATEWAY_NETWORKS, checkCounterparty, counterpartyGate, gatewayAddress,
  gatewayAuthorizationDigest, signGatewayAuthorization,
} from "./counterparty.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };

// Computed with viem 2.55.2 (packages/arc-agent): hashTypedData + privateKeyToAccount.signTypedData
// over the GatewayWalletBatched domain on Arc mainnet. Independent EIP-712 implementation.
const PRIV = "0x" + "11".repeat(32);
const VECTOR = {
  address: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
  digest: "0xe34178700029222cd65e0ccc1cdef0a26ce805467cb794b0549d8de7a5fc8988",
  signature: "0xb5bf64b4be90e9e097ff2f819b476facb8abc19b718afd5bd55add839222fec53eaae33035dd22695f41fab1a72117e429aa5183ae48d1a3c9bd762f38b70c521c",
  chainId: 5042,
  verifyingContract: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE",
  authorization: {
    from: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
    to: "0xd305607510e0db2c95807173c7a05bea53c1ed36",
    value: "5000",
    validAfter: "1760900000",
    validBefore: "1761505100",
    nonce: "0x" + "ab".repeat(32),
  },
};

const NOW = 1760900600;
const URL_ = "https://aid.test/api/x402/gateway/tools/risk_check";

// The Arc-mainnet option exactly as A-Identity served it on 2026-10-19 (Base option trimmed).
const arcOption = (over = {}) => ({
  scheme: "exact",
  network: "eip155:5042",
  asset: "0x3600000000000000000000000000000000000000",
  amount: "5000",
  maxAmountRequired: "5000",
  payTo: "0xd305607510e0db2c95807173c7a05bea53c1ed36",
  maxTimeoutSeconds: 3600,
  resource: URL_,
  extra: {
    name: "GatewayWalletBatched",
    version: "1",
    verifyingContract: "0x77777777dcc4d5a8b6e418fd04d8997ef11000ee",
    minValiditySeconds: 604800,
  },
  ...over,
});
const challenge = (accepts) => ({ x402Version: 2, error: "payment required", resource: { url: URL_ }, accepts });

// Fake seller at the network boundary: first call → 402, paid call → `paid` response.
function seller({ accepts = [arcOption()], paid = { status: 200, body: { decision: "ALLOW", risk: "low", reasons: ["ok"] } }, first } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (calls.length === 1 && first) return first;
    if (calls.length === 1) {
      const c = challenge(accepts);
      return new Response(JSON.stringify(c), {
        status: 402,
        headers: { "content-type": "application/json", "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(c)).toString("base64") },
      });
    }
    return new Response(JSON.stringify(paid.body), { status: paid.status, headers: { "content-type": "application/json" } });
  };
  return { fetch, calls };
}
const decodeHeader = (init) => {
  const h = new Headers(init.headers).get("payment-signature");
  return h ? JSON.parse(Buffer.from(h, "base64").toString("utf8")) : null;
};
const run = (fetch, over = {}) =>
  checkCounterparty({ counterparty: "0x000000000000000000000000000000000000bEEF", amountUsd: 2 }, { privKey: PRIV, fetch, url: URL_, now: NOW, ...over });

const main = async () => {
  console.log("EIP-3009 over GatewayWalletBatched (vs viem)");
  ok(gatewayAddress(PRIV) === VECTOR.address, "payer address matches viem (EIP-55)");
  ok(gatewayAuthorizationDigest({ chainId: VECTOR.chainId, verifyingContract: VECTOR.verifyingContract, authorization: VECTOR.authorization }) === VECTOR.digest,
    "authorization digest matches viem hashTypedData");
  ok(signGatewayAuthorization({ chainId: VECTOR.chainId, verifyingContract: VECTOR.verifyingContract, authorization: VECTOR.authorization }, PRIV) === VECTOR.signature,
    "signature matches viem signTypedData byte-for-byte (r‖s‖v)");
  ok(GATEWAY_NETWORKS["eip155:5042"].gatewayWallet.toLowerCase() === "0x77777777dcc4d5a8b6e418fd04d8997ef11000ee"
    && GATEWAY_NETWORKS["eip155:5042002"].gatewayWallet.toLowerCase() === "0x0077777d7eba4688bdef3e311b846f25870a19b9",
    "Gateway Wallet pinned per Arc network (mainnet, testnet)");

  console.log("paid call");
  {
    const s = seller();
    const r = await run(s.fetch);
    ok(r.decision === "ALLOW" && r.paymentSent === true, "402 → sign → replay → ALLOW");
    ok(s.calls.length === 2, "exactly one replay");
    const sent = JSON.parse(s.calls[0].init.body);
    ok(sent.agentId === "0x000000000000000000000000000000000000bEEF" && sent.txContext.amountUsd === 2, "request carries counterparty and amountUsd");
    ok(s.calls[1].init.body === s.calls[0].init.body && s.calls[1].init.method === "POST", "replay is the identical request");
    const p = decodeHeader(s.calls[1].init);
    const a = p?.payload?.authorization;
    ok(p?.x402Version === 2 && JSON.stringify(p.accepted) === JSON.stringify(arcOption()), "header carries x402Version 2 and the accepted option verbatim");
    ok(a?.from === VECTOR.address && a.to.toLowerCase() === AID_PAYTO && a.value === "5000", "authorization: from payer, to pinned payee, value = price");
    ok(Number(a?.validBefore) - NOW >= 604800 && Number(a?.validAfter) <= NOW, "validity window ≥ Gateway minimum (7 days)");
    ok(p?.payload?.signature === signGatewayAuthorization({ chainId: 5042, verifyingContract: arcOption().extra.verifyingContract, authorization: a }, PRIV),
      "header signature is the payer's signature over that authorization");
  }

  console.log("refusals before signing (hostile or changed 402)");
  for (const [label, accepts, re] of [
    ["price above the cap", [arcOption({ amount: "50000", maxAmountRequired: "50000" })], /price|amount/i],
    ["foreign verifyingContract", [arcOption({ extra: { ...arcOption().extra, verifyingContract: "0x000000000000000000000000000000000000dEaD" } })], /verifyingContract|gateway/i],
    ["different payee", [arcOption({ payTo: "0x000000000000000000000000000000000000dEaD" })], /payTo|payee/i],
    ["network not offered", [arcOption({ network: "eip155:8453" })], /network/i],
    ["not a Gateway batching option", [arcOption({ extra: { ...arcOption().extra, name: "USD Coin" } })], /batch|gateway/i],
  ]) {
    const s = seller({ accepts });
    const r = await run(s.fetch);
    ok(r.decision === "UNVERIFIABLE" && r.paymentSent === false && s.calls.length === 1 && re.test(r.error ?? ""), `${label} → UNVERIFIABLE, nothing signed`);
  }

  console.log("degraded seller");
  {
    const s = seller({ paid: { status: 200, body: { decision: "MAYBE" } } });
    const r = await run(s.fetch);
    ok(r.decision === "UNVERIFIABLE" && r.paymentSent === true, "unknown decision string → UNVERIFIABLE");
  }
  {
    const s = seller({ paid: { status: 402, body: { error: "payment invalid" } } });
    const r = await run(s.fetch);
    ok(r.decision === "UNVERIFIABLE" && r.paymentSent === true && s.calls.length === 2, "paid replay rejected → UNVERIFIABLE, no retry loop");
  }
  {
    const hang = (url, init) => new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    const t0 = Date.now();
    const r = await run(hang, { timeoutMs: 50 });
    ok(r.decision === "UNVERIFIABLE" && /timeout/i.test(r.error ?? "") && Date.now() - t0 < 2000, "cold-start hang → UNVERIFIABLE after timeout");
  }
  {
    const free = new Response(JSON.stringify({ decision: "WARN", reasons: ["Moderate reputation"] }), { status: 200 });
    const s = seller({ first: free });
    const r = await run(s.fetch);
    ok(r.decision === "WARN" && r.paymentSent === false && s.calls.length === 1, "seller in free mode (200, no 402) → verdict, nothing paid");
  }

  console.log("gate");
  ok(["ALLOW", "WARN", "DENY", "UNVERIFIABLE"].every((d) => counterpartyGate({ decision: d }, "warn").block === false), "warn mode never blocks");
  ok(counterpartyGate({ decision: "DENY" }, "enforce").block === true && counterpartyGate({ decision: "UNVERIFIABLE" }, "enforce").block === true,
    "enforce blocks DENY and UNVERIFIABLE (fail-closed)");
  ok(counterpartyGate({ decision: "ALLOW" }, "enforce").block === false && counterpartyGate({ decision: "WARN" }, "enforce").block === false,
    "enforce passes ALLOW and WARN");
  let threw = false;
  try { counterpartyGate({ decision: "ALLOW" }, "off-ish"); } catch { threw = true; }
  ok(threw, "unknown gate mode throws (misconfig is loud)");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};
main();
