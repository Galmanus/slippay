// Circle StableFX taker client (RFQ on Arc): quote -> sign the trade permit -> create the trade ->
// sign the funding permit -> fund; FxEscrow settles on-chain. Slippay's use is BRLA <-> USDC for
// the Pix <-> dollar account. Shapes, addresses and every ambiguity are in docs/arc/stablefx.md.
//
// SECURITY: the quote and the funding presign are server-built EIP-712 payloads that move the
// taker's tokens through Permit2. They never decide what we sign. Before a signature exists we pin
// the chain, the Permit2 contract (verifyingContract), the spender (FxEscrow), the exact type
// layout, the token and amount pulled, the tokens and amounts of the consideration, the recipient,
// the quote id and the deadlines, against what the caller accepted. Anything else is refused and
// nothing is signed. Mirrors x402.ts refusing a seller-chosen verifyingContract.
import { getAddress, isAddress, isAddressEqual, parseUnits, type Address, type Hex, type LocalAccount } from "viem";

export type StableFxEnv = "sandbox" | "live";

/** API base and the chain its key settles on (TEST key -> Arc testnet, LIVE key -> Arc mainnet). */
export const STABLEFX_ENVS = {
  sandbox: { baseUrl: "https://api-sandbox.circle.com", chainId: 5042002, fxEscrow: "0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10" as Address },
  live: { baseUrl: "https://api.circle.com", chainId: 5042, fxEscrow: "0xe2E5F173576B513d994073CCbDaCBE027d43DFe6" as Address },
} as const;

/** Uniswap Permit2, the same address on every EVM chain; code present on both Arc networks. */
export const PERMIT2_ADDRESS: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export type Token = { address: Address; decimals: number };
/**
 * Only tokens whose address and decimals were verified on-chain (2026-10-20). Other currencies
 * StableFX lists are refused until someone does the same; BRLA has no published testnet address.
 */
export const STABLEFX_TOKENS: Record<StableFxEnv, Partial<Record<string, Token>>> = {
  live: {
    USDC: { address: "0x3600000000000000000000000000000000000000", decimals: 6 },
    EURC: { address: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1", decimals: 6 },
    BRLA: { address: "0x75700e137c05B2beb2b3A436cCB551652E3D8B11", decimals: 18 },
  },
  sandbox: {
    USDC: { address: "0x3600000000000000000000000000000000000000", decimals: 6 },
    EURC: { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 },
  },
};

/** Quotes under 10 USDC fail (technical guide). */
export const STABLEFX_MIN_USDC = "10";
const TENORS = ["instant", "hourly", "daily"] as const;
export type Tenor = (typeof TENORS)[number];
/** Longest tenor is 1 day; a permit valid for longer than this is refused. */
const MAX_DEADLINE_SECONDS = 2 * 24 * 60 * 60;
const ZERO: Address = "0x0000000000000000000000000000000000000000";

export type Money = { currency: string; amount: string };
export type QuoteRequest = {
  from: { currency: string; amount?: string };
  to: { currency: string; amount?: string };
  tenor: Tenor;
  type: "tradable" | "reference";
  recipientAddress: string;
};
export type TypedField = { name: string; type: string };
export type Permit2TypedData = {
  domain: { name: string; chainId: number | string; verifyingContract: string };
  types: Record<string, TypedField[]>;
  primaryType: string;
  message: Record<string, unknown>;
};
export type StableFxQuote = {
  id: string;
  rate: number | string;
  from: Money;
  to: Money;
  createdAt: string;
  expiresAt: string;
  fee?: unknown;
  collateral?: unknown;
  typedData?: Permit2TypedData;
};
export type StableFxTrade = {
  id: string;
  contractTradeId: string;
  status: string;
  rate?: number | string;
  from: Money;
  to: Money;
  quoteId: string;
  createDate?: string;
  updateDate?: string;
  [k: string]: unknown;
};
export type FundingPresign = { typedData: Permit2TypedData; deliverables: Money[]; receivables: Money[] };

/** What the taker agreed to: sell exactly this, receive at least that (net of fee), to here. */
export type TakerTerms = {
  sell: { currency: string; amount: string };
  buy: { currency: string; minAmount: string };
  recipient: Address;
  tenor: Tenor;
};

export class StableFxError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "StableFxError";
  }
}

/** Thin client over the documented endpoints. Throws StableFxError on any non-2xx answer. */
export function stableFxClient(o: { apiKey: string; env: StableFxEnv; fetch?: typeof fetch; timeoutMs?: number }) {
  const base = `${STABLEFX_ENVS[o.env].baseUrl}/v1/exchange/stablefx`;
  const fetchFn = o.fetch ?? globalThis.fetch;
  const call = async (method: "GET" | "POST", path: string, body?: unknown) => {
    const res = await fetchFn(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${o.apiKey}`,
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(o.timeoutMs ?? 15_000),
    });
    const text = await res.text();
    if (!res.ok) throw new StableFxError(res.status, `StableFX ${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : undefined;
  };
  return {
    requestQuote: (req: QuoteRequest) => call("POST", "/quotes", req) as Promise<StableFxQuote>,
    createTrade: (b: { idempotencyKey: string; quoteId: string; address: string; message: unknown; signature: string }) =>
      call("POST", "/trades", b) as Promise<StableFxTrade>,
    getTrade: (id: string) => call("GET", `/trades/${encodeURIComponent(id)}`) as Promise<StableFxTrade>,
    fundingPresign: (b: { contractTradeIds: string[]; type: "taker" | "maker"; fundingMode?: "gross" }) =>
      call("POST", "/signatures/funding/presign", b) as Promise<FundingPresign>,
    fund: (b: { type: "taker" | "maker"; fundingMode?: "gross"; signature: string; permit2: unknown }) =>
      call("POST", "/fund", b) as Promise<void>,
  };
}
export type StableFxClient = ReturnType<typeof stableFxClient>;

// ------------------------------------------------------------------ helpers

function token(env: StableFxEnv, currency: string): Token {
  const t = STABLEFX_TOKENS[env][currency];
  if (!t) throw new Error(`currency ${currency} is not usable on StableFX ${env} here (no verified token address/decimals)`);
  return t;
}
const DECIMAL = /^\d+(\.\d+)?$/;
function units(amount: string, t: Token, what: string): bigint {
  if (!DECIMAL.test(String(amount))) throw new Error(`${what}: bad amount ${amount}`);
  return parseUnits(String(amount), t.decimals);
}
function uint(v: unknown, what: string): bigint {
  if (typeof v === "bigint" && v >= 0n) return v;
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  throw new Error(`${what}: malformed uint ${String(v)}`);
}
function addr(v: unknown, what: string): Address {
  if (typeof v !== "string" || !isAddress(v, { strict: false })) throw new Error(`${what}: bad address ${String(v)}`);
  return getAddress(v);
}
const same = (a: unknown, b: Address) => typeof a === "string" && isAddress(a, { strict: false }) && isAddressEqual(a as Address, b);
const obj = (v: unknown, what: string) => {
  if (!v || typeof v !== "object") throw new Error(`${what} missing`);
  return v as Record<string, any>;
};

const DOMAIN_TYPES: TypedField[] = [
  { name: "name", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
];
const TOKEN_PERMISSIONS: TypedField[] = [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }];
const permitWitness = (witnessType: string): TypedField[] => [
  { name: "permitted", type: "TokenPermissions" }, { name: "spender", type: "address" }, { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" }, { name: "witness", type: witnessType },
];
/** The trade permit's exact layout (quickstart "Create an FX trade as a taker"). */
const TRADE_TYPES: Record<string, TypedField[]> = {
  EIP712Domain: DOMAIN_TYPES,
  Consideration: [
    { name: "quoteId", type: "string" }, { name: "base", type: "address" }, { name: "quote", type: "address" },
    { name: "baseAmount", type: "uint256" }, { name: "quoteAmount", type: "uint256" }, { name: "maturity", type: "uint256" },
  ],
  TraderDetails: [
    { name: "consideration", type: "Consideration" }, { name: "recipient", type: "address" },
    { name: "fee", type: "uint256" }, { name: "authorizer", type: "address" },
  ],
  TokenPermissions: TOKEN_PERMISSIONS,
  PermitWitnessTransferFrom: permitWitness("TraderDetails"),
};
/** The single-trade funding permit's exact layout ("Generate funding presign data"). */
const FUNDING_TYPES: Record<string, TypedField[]> = {
  EIP712Domain: DOMAIN_TYPES,
  TokenPermissions: TOKEN_PERMISSIONS,
  SingleTradeWitness: [{ name: "id", type: "uint256" }],
  PermitWitnessTransferFrom: permitWitness("SingleTradeWitness"),
};
const canon = (types: Record<string, TypedField[]>) =>
  JSON.stringify(Object.keys(types).sort().map((k) => [k, (types[k] ?? []).map((f) => [f.name, f.type])]));

/** Domain, primary type and exact type layout: the parts that decide what a signature means. */
function checkEnvelope(env: StableFxEnv, td: Permit2TypedData, expected: Record<string, TypedField[]>, what: string) {
  const d = obj(td.domain, `${what} domain`);
  if (d.name !== "Permit2") throw new Error(`${what}: domain name ${d.name} is not Permit2`);
  if (Number(d.chainId) !== STABLEFX_ENVS[env].chainId) throw new Error(`${what}: chain id ${d.chainId} is not Arc ${env} (${STABLEFX_ENVS[env].chainId})`);
  if (!same(d.verifyingContract, PERMIT2_ADDRESS)) throw new Error(`${what}: verifyingContract ${d.verifyingContract} is not Permit2`);
  if (td.primaryType !== "PermitWitnessTransferFrom") throw new Error(`${what}: primaryType ${td.primaryType} is not PermitWitnessTransferFrom`);
  if (canon(td.types ?? {}) !== canon(expected)) throw new Error(`${what}: EIP-712 types differ from the documented layout`);
}

function checkPermit(env: StableFxEnv, m: Record<string, any>, sellToken: Token, maxUnits: bigint, now: number, what: string): bigint {
  if (!same(m.spender, STABLEFX_ENVS[env].fxEscrow)) throw new Error(`${what}: spender ${m.spender} is not FxEscrow on Arc ${env}`);
  const p = obj(m.permitted, `${what} permitted`);
  if (!same(p.token, sellToken.address)) throw new Error(`${what}: pulls token ${p.token}, not the token being sold`);
  const amount = uint(p.amount, `${what} permitted amount`);
  if (amount > maxUnits) throw new Error(`${what}: permitted amount ${amount} exceeds the accepted ${maxUnits}`);
  uint(m.nonce, `${what} nonce`);
  const deadline = uint(m.deadline, `${what} deadline`);
  if (deadline <= BigInt(now)) throw new Error(`${what}: deadline ${deadline} is in the past`);
  if (deadline > BigInt(now + MAX_DEADLINE_SECONDS)) throw new Error(`${what}: deadline ${deadline} is more than 2 days out`);
  return amount;
}

/** Hex form of the quote UUID the trade witness carries (left-padded to 32 bytes). */
const quoteIdHex = (id: string) => "0x" + id.replace(/-/g, "").toLowerCase().padStart(64, "0");

// ------------------------------------------------------------------ guards

/** Refuse a quote request before it is sent. */
export function checkQuoteRequest(env: StableFxEnv, req: QuoteRequest): void {
  if (!TENORS.includes(req.tenor)) throw new Error(`unknown tenor ${req.tenor} (instant, hourly or daily)`);
  if (req.type !== "tradable" && req.type !== "reference") throw new Error(`quote type must be tradable or reference`);
  const from = token(env, req.from?.currency);
  const to = token(env, req.to?.currency);
  if (req.from.currency === req.to.currency) throw new Error(`same currency on both sides (${req.from.currency})`);
  if ((req.from.amount === undefined) === (req.to.amount === undefined)) throw new Error("give exactly one amount, on from or on to");
  const [side, t] = req.from.amount !== undefined ? [req.from, from] : [req.to, to];
  const v = units(side.amount!, t, `${side.currency} amount`);
  if (v === 0n) throw new Error("amount must be positive");
  if (side.currency === "USDC" && v < parseUnits(STABLEFX_MIN_USDC, 6)) throw new Error(`${side.amount} USDC is below the ${STABLEFX_MIN_USDC} USDC minimum`);
  if (!isAddress(req.recipientAddress ?? "", { strict: false })) throw new Error(`bad recipient address ${req.recipientAddress}`);
}

/**
 * Check a tradable quote against the taker's terms. Returns the sell units it will pull. `taker`
 * (the signing address) is the only authorizer allowed besides the zero address.
 */
export function verifyTradeQuote(env: StableFxEnv, q: StableFxQuote, terms: TakerTerms, now: number, taker?: Address): bigint {
  if (!q.typedData) throw new Error("quote has no typed data to sign (reference quote?)");
  const expires = Date.parse(q.expiresAt);
  if (!(expires / 1000 > now)) throw new Error(`quote ${q.id} expired at ${q.expiresAt}`);
  const sell = token(env, terms.sell.currency);
  const buy = token(env, terms.buy.currency);
  if (q.from?.currency !== terms.sell.currency || q.to?.currency !== terms.buy.currency) {
    throw new Error(`quote is ${q.from?.currency} -> ${q.to?.currency}, the taker accepted ${terms.sell.currency} -> ${terms.buy.currency}`);
  }
  const sellUnits = units(terms.sell.amount, sell, "accepted sell amount");
  if (units(q.from.amount, sell, "quote sell amount") !== sellUnits) {
    throw new Error(`quote sells ${q.from.amount} ${q.from.currency}, the taker accepted ${terms.sell.amount}`);
  }
  const minBuy = units(terms.buy.minAmount, buy, "minimum buy amount");

  const td = q.typedData;
  checkEnvelope(env, td, TRADE_TYPES, "trade permit");
  const m = obj(td.message, "trade permit message");
  const pulled = checkPermit(env, m, sell, sellUnits, now, "trade permit");

  const w = obj(m.witness, "trade permit witness");
  const c = obj(w.consideration, "trade consideration");
  if (!same(c.quote, sell.address) || !same(c.base, buy.address)) {
    throw new Error(`consideration base/quote tokens are ${c.base}/${c.quote}, expected ${buy.address}/${sell.address}`);
  }
  if (uint(c.quoteAmount, "consideration quoteAmount") !== pulled) throw new Error(`consideration quoteAmount differs from the permitted amount`);
  const baseAmount = uint(c.baseAmount, "consideration baseAmount");
  if (baseAmount < minBuy) throw new Error(`quote buys ${baseAmount} units, below the taker's minimum ${minBuy}`);
  const fee = uint(w.fee, "witness fee");
  if (fee > baseAmount || baseAmount - fee < minBuy) {
    throw new Error(`net of the fee (${fee}), the taker gets ${baseAmount - (fee > baseAmount ? baseAmount : fee)} units, below its minimum ${minBuy}`);
  }
  if (String(c.quoteId).toLowerCase() !== quoteIdHex(q.id)) throw new Error(`witness quoteId ${c.quoteId} is not quote ${q.id}`);
  if (uint(c.maturity, "consideration maturity") <= BigInt(now)) throw new Error("consideration maturity is in the past");
  if (!same(w.recipient, terms.recipient)) throw new Error(`witness recipient ${w.recipient} is not the taker's recipient ${terms.recipient}`);
  if (!same(w.authorizer, ZERO) && !(taker && same(w.authorizer, taker))) throw new Error(`witness authorizer ${w.authorizer} is neither zero nor the taker`);
  return pulled;
}

/** Check a single-trade taker funding presign against the created trade and the terms. */
export function verifyFundingPresign(env: StableFxEnv, p: FundingPresign, trade: StableFxTrade, terms: TakerTerms, now: number): bigint {
  const sell = token(env, terms.sell.currency);
  const sellUnits = units(terms.sell.amount, sell, "accepted sell amount");
  if (trade.from?.currency !== terms.sell.currency || units(trade.from.amount, sell, "trade sell amount") !== sellUnits) {
    throw new Error(`trade sells ${trade.from?.amount} ${trade.from?.currency}, the taker accepted ${terms.sell.amount} ${terms.sell.currency}`);
  }
  checkEnvelope(env, p.typedData, FUNDING_TYPES, "funding permit");
  const m = obj(p.typedData.message, "funding permit message");
  const pulled = checkPermit(env, m, sell, sellUnits, now, "funding permit");
  if (pulled !== sellUnits) throw new Error(`funding permit amount ${pulled} is not the trade's ${sellUnits}`);
  const w = obj(m.witness, "funding witness");
  if (uint(w.id, "funding witness id") !== uint(trade.contractTradeId, "contractTradeId")) {
    throw new Error(`funding witness is for trade id ${w.id}, not contract trade ${trade.contractTradeId}`);
  }
  const d = p.deliverables ?? [];
  if (d.length !== 1 || d[0]!.currency !== terms.sell.currency || units(d[0]!.amount, sell, "deliverable") !== sellUnits) {
    throw new Error(`deliverables ${JSON.stringify(d)} don't match the trade's ${terms.sell.amount} ${terms.sell.currency}`);
  }
  return pulled;
}

// ------------------------------------------------------------------ signing (only after the guards)

/** viem wants uints as bigint: convert by the payload's own (already verified) types. */
function normalize(types: Record<string, TypedField[]>, type: string, v: unknown): unknown {
  if (type.startsWith("uint")) return uint(v, type);
  if (type === "address") return addr(v, type);
  const fields = types[type];
  if (!fields) return v;
  const o = obj(v, type);
  return Object.fromEntries(fields.map((f) => [f.name, normalize(types, f.type, o[f.name])]));
}
function signVerified(account: LocalAccount, td: Permit2TypedData): Promise<Hex> {
  const { EIP712Domain: _d, ...types } = td.types;
  return account.signTypedData({
    domain: { name: td.domain.name, chainId: Number(td.domain.chainId), verifyingContract: getAddress(td.domain.verifyingContract) },
    types,
    primaryType: td.primaryType,
    message: normalize(td.types, td.primaryType, td.message) as Record<string, unknown>,
  } as Parameters<LocalAccount["signTypedData"]>[0]);
}

/** Verify the quote, then sign its trade permit. Nothing is signed if a check fails. */
export async function signTradeQuote(env: StableFxEnv, account: LocalAccount, q: StableFxQuote, terms: TakerTerms, now: number): Promise<Hex> {
  verifyTradeQuote(env, q, terms, now, account.address);
  return signVerified(account, q.typedData!);
}

/** Verify the funding presign, then sign it. Nothing is signed if a check fails. */
export async function signFundingPresign(
  env: StableFxEnv, account: LocalAccount, p: FundingPresign, trade: StableFxTrade, terms: TakerTerms, now: number,
): Promise<Hex> {
  verifyFundingPresign(env, p, trade, terms, now);
  return signVerified(account, p.typedData);
}

/** Statuses the docs use for a created trade waiting for funding ("pending" in one example). */
const CREATED = new Set(["pending_settlement", "pending"]);

/**
 * The whole taker side for one trade: quote, sign, create, presign, sign, fund (gross, via the
 * API). The wallet must already have approved Permit2 on the token it sells. Returns the quote and
 * the created trade; poll getTrade until `taker_funded`, then the maker settles.
 */
export async function executeTakerSwap(
  client: StableFxClient, env: StableFxEnv, account: LocalAccount, terms: TakerTerms,
  opts: { now?: number; idempotencyKey?: string } = {},
): Promise<{ quote: StableFxQuote; trade: StableFxTrade }> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const req: QuoteRequest = {
    from: { currency: terms.sell.currency, amount: terms.sell.amount },
    to: { currency: terms.buy.currency },
    tenor: terms.tenor,
    type: "tradable",
    recipientAddress: terms.recipient,
  };
  checkQuoteRequest(env, req);
  const quote = await client.requestQuote(req);
  const signature = await signTradeQuote(env, account, quote, terms, now);
  const trade = await client.createTrade({
    idempotencyKey: opts.idempotencyKey ?? crypto.randomUUID(),
    quoteId: quote.id,
    address: account.address,
    message: quote.typedData!.message,
    signature,
  });
  if (trade.quoteId !== quote.id || !CREATED.has(trade.status) || !trade.contractTradeId ||
      trade.from?.currency !== quote.from.currency || trade.from?.amount !== quote.from.amount ||
      trade.to?.currency !== quote.to.currency || trade.to?.amount !== quote.to.amount) {
    throw new Error(`created trade ${trade.id} does not match quote ${quote.id} (status ${trade.status})`);
  }
  const presign = await client.fundingPresign({ contractTradeIds: [trade.contractTradeId], type: "taker", fundingMode: "gross" });
  const fundSig = await signFundingPresign(env, account, presign, trade, terms, now);
  await client.fund({ type: "taker", fundingMode: "gross", signature: fundSig, permit2: presign.typedData.message });
  return { quote, trade };
}
