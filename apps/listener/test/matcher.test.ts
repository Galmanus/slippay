import { describe, it, expect, afterEach } from "vitest";
import { matchPaymentToOrder, type StellarPaymentEvent } from "../src/matcher.js";

const order = {
  id: "ord-1",
  memo: "ab".repeat(32),
  usdc_amount: "10.0000000",
  merchant_stellar_address: "G" + "M".repeat(55),
  platform_fee_bp: 100,
};

const validEvent: StellarPaymentEvent = {
  memo_type: "hash",
  memo_b64: Buffer.from("ab".repeat(32), "hex").toString("base64"),
  successful: true,
  asset_code: "USDC",
  asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  to: "G" + "M".repeat(55),
  amount: "9.9000000",
  hash: "txhash",
};

describe("matchPaymentToOrder", () => {
  afterEach(() => { delete process.env.STELLAR_USDC_ISSUER_OVERRIDE; });

  it("matches valid USDC payment with correct memo + amount", () => {
    expect(matchPaymentToOrder(validEvent, order, "TESTNET")).toEqual({ outcome: "paid" });
  });

  it("returns underpaid when amount short", () => {
    const e = { ...validEvent, amount: "5.0000000" };
    expect(matchPaymentToOrder(e, order, "TESTNET")).toEqual({ outcome: "underpaid", expected: "9.9000000", received: "5.0000000" });
  });

  it("ignores when memo doesnt match", () => {
    const e = { ...validEvent, memo_b64: Buffer.from("cd".repeat(32), "hex").toString("base64") };
    expect(matchPaymentToOrder(e, order, "TESTNET").outcome).toBe("ignore");
  });

  it("ignores when wrong asset", () => {
    const e = { ...validEvent, asset_code: "XLM", asset_issuer: undefined };
    expect(matchPaymentToOrder(e, order, "TESTNET").outcome).toBe("ignore");
  });

  it("ignores unsuccessful tx", () => {
    const e = { ...validEvent, successful: false };
    expect(matchPaymentToOrder(e, order, "TESTNET").outcome).toBe("ignore");
  });

  it("matches when STELLAR_USDC_ISSUER_OVERRIDE overrides expected issuer", () => {
    const customIssuer = "GCUSTOM" + "X".repeat(49);
    process.env.STELLAR_USDC_ISSUER_OVERRIDE = customIssuer;
    const e = { ...validEvent, asset_issuer: customIssuer };
    expect(matchPaymentToOrder(e, order, "TESTNET")).toEqual({ outcome: "paid" });
  });

  it("ignores when issuer doesnt match override", () => {
    process.env.STELLAR_USDC_ISSUER_OVERRIDE = "GCUSTOM" + "X".repeat(49);
    // validEvent still has the Circle testnet issuer, not the override
    expect(matchPaymentToOrder(validEvent, order, "TESTNET").outcome).toBe("ignore");
  });
});
