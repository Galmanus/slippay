import { describe, expect, it, vi } from "vitest";
import { keccak256, stringToHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { slhKeygen } from "@slippay/arc-agent";
import {
  arcPay, arcReceipts, arcX402Fetch, formatUsdc, parseUsdc, remainingWindowBudget,
  type ArcDeps, type ArcSessionView, type SpendLog, type X402ToolDeps,
} from "./arc.ts";

const VAULT: Address = "0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2";
const MERCHANT: Address = "0x000000000000000000000000000000000000bEEF";
const account = privateKeyToAccount("0x00000000000000000000000000000000000000000000000000000000000a11ce");
const NOW = 1_900_000_000;

function session(over: Partial<ArcSessionView> = {}): ArcSessionView {
  return {
    exists: true,
    revoked: false,
    agentId: 1n,
    perTxCap: 100_000_000n,
    windowCap: 300_000_000n,
    pqThreshold: 50_000_000n,
    windowSeconds: 86_400n,
    expiresAt: 0n,
    epochStart: BigInt(NOW - 100),
    curSpent: 0n,
    prevSpent: 0n,
    nonce: 4n,
    ...over,
  };
}

function deps(s: ArcSessionView, allowed = true) {
  const relay = vi.fn(async () => ({ txHash: `0x${"cd".repeat(32)}`, status: "success", explorerUrl: "x" }));
  const d: ArcDeps = {
    readSession: async () => s,
    isAllowed: async () => allowed,
    now: () => NOW,
    relay,
  };
  return { d, relay };
}

const cfg = { vault: VAULT, chainId: 5042002, account };

describe("parseUsdc", () => {
  it("parses decimal USDC strictly to 6-decimal units", () => {
    expect(parseUsdc("12.5")).toBe(12_500_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(parseUsdc("100")).toBe(100_000_000n);
  });
  it("rejects zero, negatives, garbage and sub-micro precision", () => {
    for (const bad of ["0", "-1", "abc", "1.0000001", "", "1e3"]) expect(() => parseUsdc(bad)).toThrow();
  });
});

describe("formatUsdc", () => {
  it("renders 6-decimal units without trailing zeros", () => {
    expect(formatUsdc(12_500_000n)).toBe("12.5");
    expect(formatUsdc(100_000_000n)).toBe("100");
    expect(formatUsdc(1n)).toBe("0.000001");
    expect(formatUsdc(10n)).toBe("0.00001");
    expect(formatUsdc(0n)).toBe("0");
  });
});

describe("remainingWindowBudget", () => {
  it("mirrors the vault's weighted sliding window", () => {
    // half of a new epoch elapsed: prev 200 weighs 100, cur 50 -> 300 - 150 = 150 left
    const s = session({ prevSpent: 200_000_000n, curSpent: 50_000_000n, epochStart: BigInt(NOW - 43_200) });
    expect(remainingWindowBudget(s, NOW)).toBe(150_000_000n);
  });
  it("rolls the epoch lazily like the contract (>= 2 windows -> fully decayed)", () => {
    const s = session({ prevSpent: 300_000_000n, curSpent: 300_000_000n, epochStart: BigInt(NOW - 2 * 86_400) });
    expect(remainingWindowBudget(s, NOW)).toBe(300_000_000n);
  });
});

describe("arcPay refuses locally, before signing or relaying", () => {
  const cases: [string, ArcSessionView, boolean, string, RegExp][] = [
    ["no session", session({ exists: false }), true, "1", /no AgentVault session/],
    ["revoked", session({ revoked: true }), true, "1", /revoked/],
    ["expired", session({ expiresAt: BigInt(NOW - 1) }), true, "1", /expired/],
    ["over per-tx cap", session(), true, "100.000001", /per-transaction cap/],
    ["recipient not allowlisted", session(), false, "1", /allowlist/],
    ["window budget", session({ curSpent: 299_500_000n }), true, "1", /window/],
  ];
  for (const [name, s, allowed, amount, err] of cases) {
    it(name, async () => {
      const { d, relay } = deps(s, allowed);
      await expect(arcPay(d, cfg, { to: MERCHANT, amount })).rejects.toThrow(err);
      expect(relay).not.toHaveBeenCalled();
    });
  }
  it("above pqThreshold without an SLH-DSA key", async () => {
    const { d, relay } = deps(session());
    await expect(arcPay(d, cfg, { to: MERCHANT, amount: "60" })).rejects.toThrow(/SLH-DSA/);
    expect(relay).not.toHaveBeenCalled();
  });
});

describe("arcPay relays a signed intent", () => {
  it("classical spend uses the on-chain nonce, a hashed orderId and a 5-minute deadline", async () => {
    const { d, relay } = deps(session());
    const r = await arcPay(d, cfg, { to: MERCHANT, amount: "12.5", orderId: "pedido-42" });
    expect(relay).toHaveBeenCalledTimes(1);
    const body = (relay.mock.calls[0] as unknown[])[0] as Record<string, string>;
    expect(body.vault).toBe(VAULT);
    expect(body.agentSigner).toBe(account.address);
    expect(body.amount).toBe("12500000");
    expect(body.deadline).toBe(String(NOW + 300));
    expect(body.orderId).toBe(keccak256(stringToHex("pedido-42")));
    expect(body.slhSig).toBe("0x");
    expect(body.ecdsaSig).toMatch(/^0x[0-9a-f]{130}$/);
    expect(r.pq).toBe(false);
    expect(r.txHash).toBe(`0x${"cd".repeat(32)}`);
  });

  it("hybrid spend above pqThreshold carries a 7856-byte SLH-DSA signature", async () => {
    const { d, relay } = deps(session());
    const { secretKey } = slhKeygen(new Uint8Array(48).fill(9));
    const r = await arcPay(d, { ...cfg, slhSecretKey: secretKey }, { to: MERCHANT, amount: "60" });
    const body = (relay.mock.calls[0] as unknown[])[0] as Record<string, string>;
    expect((body.slhSig!.length - 2) / 2).toBe(7856);
    expect(r.pq).toBe(true);
  }, 30_000);
});

describe("arcX402Fetch — agents buy x402 services with vault-bounded money", () => {
  const FLOAT = privateKeyToAccount("0x00000000000000000000000000000000000000000000000000000000000f10a7");
  const xcfg = { vault: VAULT, chainId: 5042, account, floatAccount: FLOAT, maxPerCall: 50_000n };
  function xdeps(o: { allowed?: boolean; amount?: bigint; session?: ArcSessionView; paidButLost?: boolean } = {}) {
    const ensureFloat = vi.fn(async () => ({ gatewayBefore: 0n, gatewayAfter: 100_000n, topUpTx: "0xtop", depositTx: "0xdep" }));
    const x402 = vi.fn(async (_url: string, _init: unknown, opts: { policy: { maxAmount: bigint }; beforePay?: (a: bigint) => Promise<void> }) => {
      await opts.beforePay?.(o.amount ?? 5_000n);
      const paid = { amount: o.amount ?? 5_000n, payTo: MERCHANT, network: "eip155:5042" };
      if (o.paidButLost) return { status: 0, ok: false, body: "", paid, error: "fetch failed: do not retry" };
      return { status: 200, ok: true, body: '{"decision":"ALLOW"}', paid };
    });
    const d: X402ToolDeps = {
      isAllowed: vi.fn(async () => o.allowed ?? true),
      readSession: async () => o.session ?? session({ windowCap: 300_000n, perTxCap: 200_000n }),
      now: () => NOW,
      x402: x402 as unknown as X402ToolDeps["x402"],
      ensureFloat,
    };
    return { d, x402, ensureFloat };
  }

  it("refuses without a float key, before any request", async () => {
    const { d, x402 } = xdeps();
    await expect(arcX402Fetch(d, { ...xcfg, floatAccount: undefined }, { url: "https://s.test" })).rejects.toThrow(/SLIPPAY_ARC_FLOAT_KEY/);
    expect(x402).not.toHaveBeenCalled();
  });

  it("refuses when the float is not on the session allowlist, before any request", async () => {
    const { d, x402 } = xdeps({ allowed: false });
    await expect(arcX402Fetch(d, xcfg, { url: "https://s.test" })).rejects.toThrow(/allowlist/);
    expect(x402).not.toHaveBeenCalled();
    expect(d.isAllowed).toHaveBeenCalledWith(VAULT, account.address, FLOAT.address);
  });

  for (const [name, s, re] of [
    ["revoked", session({ revoked: true }), /revoked/],
    ["expired", session({ expiresAt: BigInt(NOW - 1) }), /expired/],
    ["missing", session({ exists: false }), /no AgentVault session/],
  ] as const) {
    it(`refuses when the session is ${name}, before any request (the float's Gateway balance is not spendable after revocation)`, async () => {
      const { d, x402 } = xdeps({ session: s });
      await expect(arcX402Fetch(d, xcfg, { url: "https://s.test" })).rejects.toThrow(re);
      expect(x402).not.toHaveBeenCalled();
    });
  }

  it("passes the configured payee allowlist to the x402 policy", async () => {
    const { d, x402 } = xdeps();
    await arcX402Fetch(d, { ...xcfg, payTo: [MERCHANT] }, { url: "https://s.test" });
    expect((x402.mock.calls[0]![2] as { policy: { payTo?: string[] } }).policy.payTo).toEqual([MERCHANT]);
  });

  it("flags doNotRetry when the payment went out but the answer was lost", async () => {
    const { d } = xdeps({ paidButLost: true });
    const r = await arcX402Fetch(d, xcfg, { url: "https://s.test" });
    expect(r).toMatchObject({ ok: false, doNotRetry: true, paid: { amountUsdc: "0.005" } });
  });

  it("caps the price at min(env cap, caller cap); a caller can lower the cap, never raise it", async () => {
    const low = xdeps();
    await arcX402Fetch(low.d, xcfg, { url: "https://s.test", maxUsdc: "0.01" });
    expect((low.x402.mock.calls[0]![2] as { policy: { maxAmount: bigint } }).policy.maxAmount).toBe(10_000n);
    const high = xdeps();
    await arcX402Fetch(high.d, xcfg, { url: "https://s.test", maxUsdc: "5" });
    expect((high.x402.mock.calls[0]![2] as { policy: { maxAmount: bigint; network: string } }).policy).toMatchObject({ maxAmount: 50_000n, network: "eip155:5042" });
  });

  it("pays from the float, funding it with exactly the seller's price, and reports both", async () => {
    const { d, x402, ensureFloat } = xdeps({ amount: 5_000n });
    const r = await arcX402Fetch(d, xcfg, { url: "https://s.test/x", method: "POST", body: "{}" });
    expect(ensureFloat).toHaveBeenCalledWith(5_000n);
    expect((x402.mock.calls[0]![2] as { account: { address: string } }).account.address).toBe(FLOAT.address);
    expect(r).toMatchObject({ status: 200, ok: true, paid: { amountUsdc: "0.005", payTo: MERCHANT }, funding: { topUpTx: "0xtop", depositTx: "0xdep", gatewayUsdc: "0.1" } });
  });
});

describe("arcReceipts — the on-chain record of what the agent paid", () => {
  const AGENT = account.address;
  const log = (block: bigint): SpendLog => ({
    txHash: `0x${block.toString(16).padStart(64, "0")}`, blockNumber: block, to: MERCHANT, amount: 100_000n,
    orderId: `0x${"00".repeat(32)}`, attested: true, pq: false,
  });
  it("walks back chunk by chunk, newest first, and stops once it has enough", async () => {
    const at = [95_000n, 71_000n, 70_500n, 40_000n];
    const spendLogs = vi.fn(async (_a: string, from: bigint, to: bigint) => at.filter((b) => b >= from && b <= to).map(log));
    const r = await arcReceipts({ latestBlock: async () => 100_000n, spendLogs }, { agent: AGENT, floorBlock: 0n, chunk: 10_000n }, 2);
    expect(r.map((x) => x.block)).toEqual(["95000", "71000"]);
    expect(spendLogs).toHaveBeenCalledTimes(3); // 90001..100000, 80001..90000, 70001..80000
    expect(r[0]).toMatchObject({ to: MERCHANT, amountUsdc: "0.1", attested: true });
  });
  it("never reads below the floor block", async () => {
    const spendLogs = vi.fn(async () => [] as SpendLog[]);
    await arcReceipts({ latestBlock: async () => 100_000n, spendLogs }, { agent: AGENT, floorBlock: 85_000n, chunk: 10_000n }, 5);
    expect(spendLogs.mock.calls.map((c) => [c[1], c[2]])).toEqual([[90_001n, 100_000n], [85_000n, 90_000n]]);
  });
});
