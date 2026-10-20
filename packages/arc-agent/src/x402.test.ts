import { describe, expect, it } from "vitest";
import { recoverTypedDataAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gatewayAuthorizationTypedData, selectGatewayOption, signGatewayAuthorization, x402Fetch } from "./x402.ts";

// Same vector as packages/slippay-attester/src/counterparty.test.mjs (the noble implementation),
// so both x402 buyers are pinned to one set of bytes.
const ACCOUNT = privateKeyToAccount(("0x" + "11".repeat(32)) as Hex);
const VECTOR = {
  address: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
  signature:
    "0xb5bf64b4be90e9e097ff2f819b476facb8abc19b718afd5bd55add839222fec53eaae33035dd22695f41fab1a72117e429aa5183ae48d1a3c9bd762f38b70c521c",
  chainId: 5042,
  verifyingContract: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE",
  authorization: {
    from: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
    to: "0xd305607510e0db2c95807173c7a05bea53c1ed36",
    value: 5000n,
    validAfter: 1760900000n,
    validBefore: 1761505100n,
    nonce: ("0x" + "ab".repeat(32)) as Hex,
  },
} as const;

const NOW = 1760900600;
const URL_ = "https://seller.test/api/thing";
const MAINNET = { network: "eip155:5042", maxAmount: 10_000n } as const;

const option = (over: Record<string, unknown> = {}) => ({
  scheme: "exact",
  network: "eip155:5042",
  asset: "0x3600000000000000000000000000000000000000",
  amount: "5000",
  payTo: "0xd305607510e0db2c95807173c7a05bea53c1ed36",
  maxTimeoutSeconds: 3600,
  extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: "0x77777777dcc4d5a8b6e418fd04d8997ef11000ee" },
  ...over,
});
const challenge = (accepts: unknown[]) => ({ x402Version: 2, resource: { url: URL_ }, accepts });

/** Fake seller at the network boundary: first call → 402 (challenge in the header), then `then`. */
function seller(o: { accepts?: unknown[]; first?: Response; then?: () => Response } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    if (calls.length === 1) {
      if (o.first) return o.first;
      const c = challenge(o.accepts ?? [option()]);
      return new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
        headers: { "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(c)).toString("base64") },
      });
    }
    return o.then ? o.then() : new Response(JSON.stringify({ answer: 42 }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetch, calls };
}
const paymentOf = (init: RequestInit) => {
  const h = new Headers(init.headers).get("payment-signature");
  return h ? JSON.parse(Buffer.from(h, "base64").toString("utf8")) : null;
};
const nonce = ("0x" + "cd".repeat(32)) as Hex;

describe("signGatewayAuthorization", () => {
  it("matches the shared viem/noble vector byte for byte", async () => {
    expect(ACCOUNT.address).toBe(VECTOR.address);
    const sig = await signGatewayAuthorization(ACCOUNT, VECTOR);
    expect(sig).toBe(VECTOR.signature);
  });
});

describe("selectGatewayOption", () => {
  it("accepts the Arc mainnet Gateway option under the cap", () => {
    expect(selectGatewayOption(challenge([option()]), MAINNET).amount).toBe("5000");
  });
  it.each([
    ["price above the cap", option({ amount: "10001" }), /above cap/],
    ["a foreign verifyingContract", option({ extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: "0x000000000000000000000000000000000000dEaD" } }), /verifyingContract/],
    ["another asset", option({ asset: "0x000000000000000000000000000000000000dEaD" }), /asset/],
    ["a non-exact scheme", option({ scheme: "upto" }), /scheme/],
    ["a non-batching option", option({ extra: { name: "USD Coin", version: "2" } }), /Gateway batching/],
  ])("refuses %s", (_name, opt, reason) => {
    expect(() => selectGatewayOption(challenge([opt]), MAINNET)).toThrow(reason);
  });
  it.each([
    ["Infinity (JSON 1e309)", Infinity],
    ["1e30 seconds", 1e30],
    ["a fraction", 3600.5],
    ["a negative number", -1],
    ["more than 30 days", 30 * 86400 + 1],
  ])("refuses a seller-chosen maxTimeoutSeconds of %s", (_name, t) => {
    expect(() => selectGatewayOption(challenge([option({ maxTimeoutSeconds: t })]), MAINNET)).toThrow(/maxTimeoutSeconds/);
  });
  it("refuses when the seller does not offer the policy's network", () => {
    expect(() => selectGatewayOption(challenge([option({ network: "eip155:8453" })]), MAINNET)).toThrow(/not offered/);
  });
  it("refuses a payee outside the allowlist when one is given", () => {
    const p = { ...MAINNET, payTo: ["0x000000000000000000000000000000000000bEEF" as const] };
    expect(() => selectGatewayOption(challenge([option()]), p)).toThrow(/payTo/);
  });
});

describe("x402Fetch", () => {
  it("returns a free resource untouched, without paying or calling beforePay", async () => {
    let before = 0;
    const fetch = (async () => new Response("free", { status: 200 })) as unknown as typeof globalThis.fetch;
    const r = await x402Fetch(URL_, {}, { account: ACCOUNT, policy: MAINNET, fetch, beforePay: async () => void before++ });
    expect(r).toMatchObject({ status: 200, ok: true, body: "free", paid: null });
    expect(before).toBe(0);
  });

  it("pays once: beforePay sees the price, then the identical request is replayed with a valid signature", async () => {
    const s = seller();
    const seen: bigint[] = [];
    const r = await x402Fetch(URL_, { method: "POST", body: '{"q":1}' }, {
      account: ACCOUNT, policy: MAINNET, fetch: s.fetch, now: NOW, nonce, beforePay: async (amount) => void seen.push(amount),
    });
    expect(seen).toEqual([5000n]);
    expect(r).toMatchObject({ status: 200, ok: true, paid: { amount: 5000n, network: "eip155:5042" } });
    expect(s.calls).toHaveLength(2);
    expect(s.calls[1]!.init.method).toBe("POST");
    expect(s.calls[1]!.init.body).toBe('{"q":1}');
    const p = paymentOf(s.calls[1]!.init);
    const a = p.payload.authorization;
    expect(a).toMatchObject({ from: ACCOUNT.address, value: "5000", nonce });
    expect(Number(a.validBefore) - NOW).toBeGreaterThanOrEqual(7 * 86400 + 100);
    const signer = await recoverTypedDataAddress({
      ...gatewayAuthorizationTypedData({
        chainId: 5042,
        verifyingContract: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE",
        authorization: { ...a, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore) },
      }),
      signature: p.payload.signature,
    });
    expect(signer).toBe(ACCOUNT.address);
  });

  it("refuses before signing or funding when the 402 breaks the policy", async () => {
    const s = seller({ accepts: [option({ amount: "999999" })] });
    let before = 0;
    const r = await x402Fetch(URL_, {}, { account: ACCOUNT, policy: MAINNET, fetch: s.fetch, beforePay: async () => void before++ });
    expect(r.paid).toBeNull();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/above cap/);
    expect(before).toBe(0);
    expect(s.calls).toHaveLength(1);
  });

  it("does not pay when beforePay fails (e.g. the float could not be funded)", async () => {
    const s = seller();
    const r = await x402Fetch(URL_, {}, {
      account: ACCOUNT, policy: MAINNET, fetch: s.fetch, beforePay: async () => { throw new Error("Gateway has not credited it yet"); },
    });
    expect(r).toMatchObject({ ok: false, paid: null });
    expect(r.error).toMatch(/credited/);
    expect(s.calls).toHaveLength(1);
  });

  it("refuses an absurd maxTimeoutSeconds before funding (beforePay never runs)", async () => {
    const big = { ...challenge([option()]), accepts: [{ ...option(), maxTimeoutSeconds: "__INF__" }] };
    const headerJson = JSON.stringify(big).replace('"__INF__"', "1e309");
    let before = 0;
    const fetch = (async () =>
      new Response("{}", { status: 402, headers: { "PAYMENT-REQUIRED": Buffer.from(headerJson).toString("base64") } })) as unknown as typeof globalThis.fetch;
    const r = await x402Fetch(URL_, {}, { account: ACCOUNT, policy: MAINNET, fetch, beforePay: async () => void before++ });
    expect(before).toBe(0);
    expect(r).toMatchObject({ ok: false, paid: null });
    expect(r.error).toMatch(/maxTimeoutSeconds/);
  });

  it("a lost answer after payment is reported as paid with status 0 and a do-not-retry error", async () => {
    let n = 0;
    const s = seller();
    const fetch = (async (url: string, init: RequestInit) => {
      if (++n === 2) throw new TypeError("fetch failed");
      return s.fetch(url, init);
    }) as unknown as typeof globalThis.fetch;
    const r = await x402Fetch(URL_, {}, { account: ACCOUNT, policy: MAINNET, fetch });
    expect(r).toMatchObject({ status: 0, ok: false, paid: { amount: 5000n } });
    expect(r.error).toMatch(/do not retry/);
  });

  it("never pays twice: a second 402 after payment is reported, not retried", async () => {
    const s = seller({ then: () => new Response("still 402", { status: 402 }) });
    const r = await x402Fetch(URL_, {}, { account: ACCOUNT, policy: MAINNET, fetch: s.fetch });
    expect(r).toMatchObject({ status: 402, ok: false, paid: { amount: 5000n } });
    expect(s.calls).toHaveLength(2);
  });
});
