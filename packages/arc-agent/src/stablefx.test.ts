import { describe, expect, it, vi } from "vitest";
import { recoverTypedDataAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  PERMIT2_ADDRESS, STABLEFX_ENVS, STABLEFX_TOKENS, StableFxError, checkQuoteRequest, executeTakerSwap,
  signFundingPresign, signTradeQuote, stableFxClient, verifyFundingPresign, verifyTradeQuote,
  type FundingPresign, type StableFxQuote, type StableFxTrade, type TakerTerms,
} from "./stablefx.ts";

// Shapes follow https://developers.circle.com/stablefx/quickstarts/fx-trade-taker with the real Arc
// mainnet addresses (docs/arc/stablefx.md): the taker sells 1000 BRLA (18 decimals) for USDC.
const TAKER = privateKeyToAccount(("0x" + "22".repeat(32)) as Hex);
const NOW = 1_800_000_000;
const QUOTE_ID = "c4d1da72-111e-4d52-bdbf-2e74a2d803d5";
const QUOTE_ID_HEX = "0x" + "c4d1da72111e4d52bdbf2e74a2d803d5".padStart(64, "0");
const LIVE = STABLEFX_ENVS.live;
const BRLA = STABLEFX_TOKENS.live.BRLA!.address;
const USDC = STABLEFX_TOKENS.live.USDC!.address;
const ZERO = "0x0000000000000000000000000000000000000000";

const TRADE_TYPES = {
  EIP712Domain: [{ name: "name", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
  Consideration: [
    { name: "quoteId", type: "string" }, { name: "base", type: "address" }, { name: "quote", type: "address" },
    { name: "baseAmount", type: "uint256" }, { name: "quoteAmount", type: "uint256" }, { name: "maturity", type: "uint256" },
  ],
  TraderDetails: [
    { name: "consideration", type: "Consideration" }, { name: "recipient", type: "address" },
    { name: "fee", type: "uint256" }, { name: "authorizer", type: "address" },
  ],
  TokenPermissions: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }],
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" }, { name: "spender", type: "address" }, { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }, { name: "witness", type: "TraderDetails" },
  ],
};

type Msg = Record<string, any>;
function quote(over: Partial<StableFxQuote> = {}, msg: (m: Msg) => void = () => {}): StableFxQuote {
  const message: Msg = {
    permitted: { token: BRLA, amount: "1000000000000000000000" },
    spender: LIVE.fxEscrow,
    nonce: 309585810,
    deadline: NOW + 600,
    witness: {
      consideration: {
        quoteId: QUOTE_ID_HEX, base: USDC, quote: BRLA,
        baseAmount: "180000000", quoteAmount: "1000000000000000000000", maturity: NOW + 1800,
      },
      recipient: TAKER.address,
      fee: 270000,
      authorizer: ZERO,
    },
  };
  msg(message);
  return {
    id: QUOTE_ID, rate: "0.18",
    from: { currency: "BRLA", amount: "1000.00" }, to: { currency: "USDC", amount: "180.00" },
    createdAt: new Date((NOW - 5) * 1000).toISOString(), expiresAt: new Date((NOW + 300) * 1000).toISOString(),
    fee: { currency: "USDC", amount: "0.27" },
    typedData: { domain: { name: "Permit2", chainId: LIVE.chainId, verifyingContract: PERMIT2_ADDRESS }, types: structuredClone(TRADE_TYPES), primaryType: "PermitWitnessTransferFrom", message },
    ...over,
  };
}
const terms: TakerTerms = {
  sell: { currency: "BRLA", amount: "1000.00" }, buy: { currency: "USDC", minAmount: "179.50" },
  recipient: TAKER.address, tenor: "instant",
};
const trade = (over: Partial<StableFxTrade> = {}): StableFxTrade => ({
  id: "c2558cd1-98b5-4ccd-90b8-96891512af20", contractTradeId: "24", status: "pending_settlement", rate: "0.18",
  from: { currency: "BRLA", amount: "1000.00" }, to: { currency: "USDC", amount: "180.00" },
  quoteId: QUOTE_ID, createDate: "2026-10-20T12:00:00Z", updateDate: "2026-10-20T12:00:00Z", ...over,
});
function presign(msg: (m: Msg) => void = () => {}, over: Partial<FundingPresign> = {}): FundingPresign {
  const message: Msg = { permitted: { token: BRLA, amount: "1000000000000000000000" }, spender: LIVE.fxEscrow, nonce: "42", deadline: String(NOW + 600), witness: { id: "24" } };
  msg(message);
  return {
    typedData: {
      domain: { name: "Permit2", chainId: LIVE.chainId, verifyingContract: PERMIT2_ADDRESS },
      types: {
        EIP712Domain: TRADE_TYPES.EIP712Domain,
        TokenPermissions: TRADE_TYPES.TokenPermissions,
        SingleTradeWitness: [{ name: "id", type: "uint256" }],
        PermitWitnessTransferFrom: [
          { name: "permitted", type: "TokenPermissions" }, { name: "spender", type: "address" }, { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }, { name: "witness", type: "SingleTradeWitness" },
        ],
      },
      primaryType: "PermitWitnessTransferFrom",
      message,
    },
    deliverables: [{ currency: "BRLA", amount: "1000.00" }],
    receivables: [{ currency: "USDC", amount: "180.00" }],
    ...over,
  };
}

/** Fake fetch recording calls; answers by path. */
function fakeApi(answers: Record<string, (body: any) => { status?: number; json?: unknown }>) {
  const calls: { method: string; url: string; headers: Headers; body: any }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init.method ?? "GET", url, headers: new Headers(init.headers), body });
    const path = new URL(url).pathname;
    const key = Object.keys(answers).find((k) => path === k || path.startsWith(k + "/"));
    if (!key) return new Response("not found", { status: 404 });
    const a = answers[key]!(body);
    return new Response(a.json === undefined ? "" : JSON.stringify(a.json), { status: a.status ?? 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("stableFxClient — the documented HTTP shapes", () => {
  it("quotes against the sandbox or live base URL with a Bearer key", async () => {
    for (const env of ["sandbox", "live"] as const) {
      const api = fakeApi({ "/v1/exchange/stablefx/quotes": () => ({ json: { id: "q" } }) });
      const c = stableFxClient({ apiKey: "PREFIX:ID:SECRET", env, fetch: api.fetch });
      await c.requestQuote({ from: { currency: "USDC", amount: "100.00" }, to: { currency: "EURC" }, tenor: "instant", type: "tradable", recipientAddress: TAKER.address });
      expect(api.calls[0]!.url).toBe(`${STABLEFX_ENVS[env].baseUrl}/v1/exchange/stablefx/quotes`);
      expect(api.calls[0]!.method).toBe("POST");
      expect(api.calls[0]!.headers.get("authorization")).toBe("Bearer PREFIX:ID:SECRET");
      expect(api.calls[0]!.body).toEqual({ from: { currency: "USDC", amount: "100.00" }, to: { currency: "EURC" }, tenor: "instant", type: "tradable", recipientAddress: TAKER.address });
    }
  });

  it("creates and reads trades, asks for funding presign data and funds, at the documented paths", async () => {
    const api = fakeApi({
      "/v1/exchange/stablefx/trades": () => ({ json: trade() }),
      "/v1/exchange/stablefx/signatures/funding/presign": () => ({ json: presign() }),
      "/v1/exchange/stablefx/fund": () => ({}),
    });
    const c = stableFxClient({ apiKey: "k", env: "live", fetch: api.fetch });
    await c.createTrade({ idempotencyKey: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", quoteId: QUOTE_ID, address: TAKER.address, message: { a: 1 }, signature: "0x01" });
    await c.getTrade("c2558cd1-98b5-4ccd-90b8-96891512af20");
    await c.fundingPresign({ contractTradeIds: ["24"], type: "taker", fundingMode: "gross" });
    await c.fund({ type: "taker", fundingMode: "gross", signature: "0x02", permit2: { b: 2 } });
    expect(api.calls.map((x) => `${x.method} ${new URL(x.url).pathname}`)).toEqual([
      "POST /v1/exchange/stablefx/trades",
      "GET /v1/exchange/stablefx/trades/c2558cd1-98b5-4ccd-90b8-96891512af20",
      "POST /v1/exchange/stablefx/signatures/funding/presign",
      "POST /v1/exchange/stablefx/fund",
    ]);
    expect(api.calls[2]!.body).toEqual({ contractTradeIds: ["24"], type: "taker", fundingMode: "gross" });
    expect(api.calls[3]!.body).toEqual({ type: "taker", fundingMode: "gross", signature: "0x02", permit2: { b: 2 } });
  });

  it("throws StableFxError with the HTTP status on a non-2xx answer", async () => {
    const api = fakeApi({ "/v1/exchange/stablefx/quotes": () => ({ status: 400, json: { message: "Amount less than the minimum" } }) });
    const c = stableFxClient({ apiKey: "k", env: "sandbox", fetch: api.fetch });
    const p = c.requestQuote({ from: { currency: "USDC", amount: "5" }, to: { currency: "EURC" }, tenor: "instant", type: "tradable", recipientAddress: TAKER.address });
    await expect(p).rejects.toBeInstanceOf(StableFxError);
    await expect(p).rejects.toMatchObject({ status: 400 });
  });
});

describe("checkQuoteRequest — refused before anything is sent", () => {
  const ok = { from: { currency: "BRLA", amount: "1000.00" }, to: { currency: "USDC" }, tenor: "instant", type: "tradable", recipientAddress: TAKER.address } as const;
  it("accepts BRLA -> USDC on live", () => expect(() => checkQuoteRequest("live", ok)).not.toThrow());
  it.each([
    ["an unknown currency", { ...ok, to: { currency: "XYZ" } }, /currency/],
    ["a listed currency whose decimals nobody verified", { ...ok, to: { currency: "MXNB" } }, /currency/],
    ["an amount on both sides", { ...ok, to: { currency: "USDC", amount: "180.00" } }, /exactly one/],
    ["no amount at all", { ...ok, from: { currency: "BRLA" } }, /exactly one/],
    ["a USDC amount below the 10 USDC minimum", { ...ok, from: { currency: "USDC", amount: "9.99" }, to: { currency: "BRLA" } }, /minimum/],
    ["the same currency on both sides", { ...ok, to: { currency: "BRLA" } }, /same currency/],
    ["a bad recipient", { ...ok, recipientAddress: "0x1234" }, /recipient/],
    ["an unknown tenor", { ...ok, tenor: "weekly" }, /tenor/],
  ])("refuses %s", (_n, req, re) => expect(() => checkQuoteRequest("live", req as never)).toThrow(re));
  it("refuses BRLA on the sandbox (no published testnet address)", () => {
    expect(() => checkQuoteRequest("sandbox", ok)).toThrow(/BRLA/);
  });
});

describe("verifyTradeQuote — the quote's typed data must be exactly what the taker accepted", () => {
  it("accepts the documented shape with the real addresses", () => {
    expect(() => verifyTradeQuote("live", quote(), terms, NOW)).not.toThrow();
  });
  it.each<[string, () => StableFxQuote, RegExp]>([
    ["a spender that is not FxEscrow (the docs' example address)", () => quote({}, (m) => { m.spender = "0xa8f94168b4981840ba27d423f4ad6332bedee006"; }), /spender/],
    ["a verifyingContract that is not Permit2", () => { const q = quote(); q.typedData!.domain.verifyingContract = "0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE"; return q; }, /verifyingContract/],
    ["another chain id", () => { const q = quote(); q.typedData!.domain.chainId = 11155111; return q; }, /chain/],
    ["a different token pulled", () => quote({}, (m) => { m.permitted.token = USDC; }), /token/],
    ["more pulled than the taker sells", () => quote({}, (m) => { m.permitted.amount = "1000000000000000000001"; }), /amount/],
    ["a quote amount different from what was accepted", () => quote({ from: { currency: "BRLA", amount: "1000.01" } }), /sell/],
    ["a buy amount below the taker's minimum", () => quote({}, (m) => { m.witness.consideration.baseAmount = "179000000"; }), /minimum/],
    ["a net-of-fee amount below the minimum", () => quote({}, (m) => { m.witness.fee = "600000"; }), /fee/],
    ["base/quote swapped", () => quote({}, (m) => { m.witness.consideration.base = BRLA; m.witness.consideration.quote = USDC; }), /base|quote/],
    ["another recipient", () => quote({}, (m) => { m.witness.recipient = "0x379c868f6064d9c0564df05dcca170d64f8aa5e3"; }), /recipient/],
    ["an authorizer that is neither zero nor the taker", () => quote({}, (m) => { m.witness.authorizer = "0x379c868f6064d9c0564df05dcca170d64f8aa5e3"; }), /authorizer/],
    ["a witness for another quote id", () => quote({}, (m) => { m.witness.consideration.quoteId = "0x" + "ab".repeat(32); }), /quoteId/],
    ["an expired quote", () => quote({ expiresAt: new Date((NOW - 1) * 1000).toISOString() }), /expired/],
    ["a deadline in the past", () => quote({}, (m) => { m.deadline = NOW - 1; }), /deadline/],
    ["a deadline more than 2 days out", () => quote({}, (m) => { m.deadline = NOW + 3 * 86400; }), /deadline/],
    ["an extra field in the signed types", () => { const q = quote(); q.typedData!.types.TokenPermissions!.push({ name: "extra", type: "address" }); return q; }, /types/],
    ["another primary type", () => { const q = quote(); q.typedData!.primaryType = "PermitTransferFrom"; return q; }, /primaryType/],
    ["a reference quote without typed data", () => quote({ typedData: undefined }), /typed data/],
  ])("refuses %s", (_n, make, re) => expect(() => verifyTradeQuote("live", make(), terms, NOW)).toThrow(re));

  it("never signs a quote that fails the checks", async () => {
    const spy = vi.spyOn(TAKER, "signTypedData");
    await expect(signTradeQuote("live", TAKER, quote({}, (m) => { m.spender = "0xa8f94168b4981840ba27d423f4ad6332bedee006"; }), terms, NOW)).rejects.toThrow(/spender/);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("signs the verified quote so that the signature recovers to the taker", async () => {
    const q = quote();
    const sig = await signTradeQuote("live", TAKER, q, terms, NOW);
    const td = q.typedData!;
    const { EIP712Domain: _drop, ...types } = td.types;
    const m = td.message as Msg;
    const signer = await recoverTypedDataAddress({
      domain: { ...td.domain, chainId: Number(td.domain.chainId) } as never,
      types: types as never,
      primaryType: "PermitWitnessTransferFrom",
      message: {
        permitted: { token: m.permitted.token, amount: BigInt(m.permitted.amount) }, spender: m.spender, nonce: BigInt(m.nonce), deadline: BigInt(m.deadline),
        witness: {
          consideration: { ...m.witness.consideration, baseAmount: BigInt(m.witness.consideration.baseAmount), quoteAmount: BigInt(m.witness.consideration.quoteAmount), maturity: BigInt(m.witness.consideration.maturity) },
          recipient: m.witness.recipient, fee: BigInt(m.witness.fee), authorizer: m.witness.authorizer,
        },
      } as never,
      signature: sig,
    });
    expect(signer).toBe(TAKER.address);
  });
});

describe("verifyFundingPresign — the funding permit must match the trade", () => {
  it("accepts the documented shape for this trade", () => {
    expect(() => verifyFundingPresign("live", presign(), trade(), terms, NOW)).not.toThrow();
  });
  it.each<[string, () => FundingPresign, RegExp]>([
    ["a witness for another trade", () => presign((m) => { m.witness.id = "25"; }), /trade id/],
    ["a spender that is not FxEscrow", () => presign((m) => { m.spender = "0xffd21ca8F0876DaFAD7de09404E0c1f868bbf1AE"; }), /spender/],
    ["another token", () => presign((m) => { m.permitted.token = USDC; }), /token/],
    ["more than the trade's sell amount", () => presign((m) => { m.permitted.amount = "1000000000000000000001"; }), /amount/],
    ["deliverables that don't match the trade", () => presign(() => {}, { deliverables: [{ currency: "BRLA", amount: "1000.01" }] }), /deliverables/],
    ["a trade witness type (wrong payload kind)", () => { const p = presign(); p.typedData.types.SingleTradeWitness = [{ name: "ids", type: "uint256[]" }]; return p; }, /types/],
  ])("refuses %s", (_n, make, re) => expect(() => verifyFundingPresign("live", make(), trade(), terms, NOW)).toThrow(re));

  it("never signs a funding permit that fails the checks", async () => {
    const spy = vi.spyOn(TAKER, "signTypedData");
    await expect(signFundingPresign("live", TAKER, presign((m) => { m.witness.id = "25"; }), trade(), terms, NOW)).rejects.toThrow(/trade id/);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("executeTakerSwap — quote, sign, trade, presign, sign, fund", () => {
  it("runs the documented sequence and returns the funded trade", async () => {
    const api = fakeApi({
      "/v1/exchange/stablefx/quotes": () => ({ json: quote() }),
      "/v1/exchange/stablefx/trades": () => ({ json: trade() }),
      "/v1/exchange/stablefx/signatures/funding/presign": () => ({ json: presign() }),
      "/v1/exchange/stablefx/fund": () => ({}),
    });
    const c = stableFxClient({ apiKey: "k", env: "live", fetch: api.fetch });
    const r = await executeTakerSwap(c, "live", TAKER, terms, { now: NOW, idempotencyKey: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });
    expect(api.calls.map((x) => new URL(x.url).pathname)).toEqual([
      "/v1/exchange/stablefx/quotes", "/v1/exchange/stablefx/trades",
      "/v1/exchange/stablefx/signatures/funding/presign", "/v1/exchange/stablefx/fund",
    ]);
    expect(api.calls[0]!.body).toEqual({ from: { currency: "BRLA", amount: "1000.00" }, to: { currency: "USDC" }, tenor: "instant", type: "tradable", recipientAddress: TAKER.address });
    expect(api.calls[1]!.body).toMatchObject({ idempotencyKey: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", quoteId: QUOTE_ID, address: TAKER.address, message: quote().typedData!.message });
    expect(api.calls[1]!.body.signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(api.calls[3]!.body).toMatchObject({ type: "taker", fundingMode: "gross", permit2: presign().typedData.message });
    expect(r.trade.contractTradeId).toBe("24");
  });

  it("stops after the quote when the quote fails the checks: no trade is created", async () => {
    const api = fakeApi({
      "/v1/exchange/stablefx/quotes": () => ({ json: quote({}, (m) => { m.witness.recipient = "0x379c868f6064d9c0564df05dcca170d64f8aa5e3"; }) }),
      "/v1/exchange/stablefx/trades": () => ({ json: trade() }),
    });
    const c = stableFxClient({ apiKey: "k", env: "live", fetch: api.fetch });
    await expect(executeTakerSwap(c, "live", TAKER, terms, { now: NOW })).rejects.toThrow(/recipient/);
    expect(api.calls).toHaveLength(1);
  });

  it("stops before funding when the created trade doesn't match the quote", async () => {
    const api = fakeApi({
      "/v1/exchange/stablefx/quotes": () => ({ json: quote() }),
      "/v1/exchange/stablefx/trades": () => ({ json: trade({ quoteId: "00000000-0000-4000-8000-000000000000" }) }),
    });
    const c = stableFxClient({ apiKey: "k", env: "live", fetch: api.fetch });
    await expect(executeTakerSwap(c, "live", TAKER, terms, { now: NOW })).rejects.toThrow(/trade/);
    expect(api.calls).toHaveLength(2);
  });
});
