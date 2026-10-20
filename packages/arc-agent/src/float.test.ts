import { describe, expect, it } from "vitest";
import { ensureGatewayFloat, parseGatewayBalance, type FloatDeps } from "./float.ts";

/**
 * In-memory float: a wallet balance, the Gateway API balance, and the Gateway Wallet's on-chain
 * balance. A deposit lands on-chain at once; the API credits it after `creditAfterPolls` reads.
 */
function fake(s: { wallet: bigint; gateway: bigint; creditAfterPolls?: number }) {
  const log: string[] = [];
  let pending = 0n;
  let reads = 0;
  let onchain = s.gateway;
  const deps: FloatDeps = {
    depositedOnChain: async () => onchain,
    gatewayBalance: async () => {
      if (pending && ++reads > (s.creditAfterPolls ?? 0)) {
        s.gateway += pending;
        pending = 0n;
      }
      return s.gateway;
    },
    walletBalance: async () => s.wallet,
    topUpFromVault: async (amount) => {
      log.push(`topUp ${amount}`);
      s.wallet += amount;
      return "0xtopup";
    },
    deposit: async (amount) => {
      log.push(`deposit ${amount}`);
      if (amount > s.wallet) throw new Error("wallet short");
      s.wallet -= amount;
      pending += amount;
      onchain += amount;
      return "0xdeposit";
    },
    sleep: async () => {},
  };
  return { deps, log, s };
}
const O = { topUp: 100_000n, gasReserve: 20_000n, maxPolls: 5 };

describe("ensureGatewayFloat", () => {
  it("does nothing when Gateway already covers the call", async () => {
    const f = fake({ wallet: 0n, gateway: 10_000n });
    const r = await ensureGatewayFloat(5_000n, f.deps, O);
    expect(f.log).toEqual([]);
    expect(r).toEqual({ gatewayBefore: 10_000n, gatewayAfter: 10_000n });
  });

  it("deposits from the float wallet without touching the vault when the wallet holds enough", async () => {
    const f = fake({ wallet: 200_000n, gateway: 0n });
    const r = await ensureGatewayFloat(5_000n, f.deps, O);
    expect(f.log).toEqual(["deposit 100000"]); // at least one top-up's worth, so the next calls are free
    expect(r).toMatchObject({ depositTx: "0xdeposit", gatewayBefore: 0n, gatewayAfter: 100_000n });
    expect(r.topUpTx).toBeUndefined();
  });

  it("tops up from the vault first when the wallet cannot cover the deposit plus gas", async () => {
    const f = fake({ wallet: 0n, gateway: 0n });
    const r = await ensureGatewayFloat(5_000n, f.deps, O);
    expect(f.log).toEqual(["topUp 120000", "deposit 100000"]);
    expect(r).toMatchObject({ topUpTx: "0xtopup", depositTx: "0xdeposit", gatewayAfter: 100_000n });
    expect(f.s.wallet).toBe(20_000n); // the gas reserve stays in the wallet
  });

  it("keeps the gas reserve: tops up when the wallet covers the deposit but not the gas for it", async () => {
    const f = fake({ wallet: 110_000n, gateway: 0n });
    await ensureGatewayFloat(5_000n, f.deps, O);
    expect(f.log).toEqual(["topUp 100000", "deposit 100000"]);
    expect(f.s.wallet).toBeGreaterThanOrEqual(20_000n);
  });

  it("deposits only the deficit when it is larger than one top-up", async () => {
    const f = fake({ wallet: 500_000n, gateway: 1_000n });
    await ensureGatewayFloat(151_000n, f.deps, O);
    expect(f.log).toEqual(["deposit 150000"]);
  });

  it("waits for Gateway to credit the deposit", async () => {
    const f = fake({ wallet: 200_000n, gateway: 0n, creditAfterPolls: 3 });
    const r = await ensureGatewayFloat(5_000n, f.deps, O);
    expect(r.gatewayAfter).toBe(100_000n);
  });

  it("a retry while Gateway still has not credited deposits nothing new (one top-up, one deposit in total)", async () => {
    const f = fake({ wallet: 0n, gateway: 0n, creditAfterPolls: 999 });
    await expect(ensureGatewayFloat(5_000n, f.deps, O)).rejects.toThrow(/not credited/);
    await expect(ensureGatewayFloat(5_000n, f.deps, O)).rejects.toThrow(/not credited|has credited only/);
    await expect(ensureGatewayFloat(5_000n, f.deps, O)).rejects.toThrow(/not credited|has credited only/);
    expect(f.log).toEqual(["topUp 120000", "deposit 100000"]);
  });

  it("throws after maxPolls without crediting, having deposited exactly once", async () => {
    const f = fake({ wallet: 200_000n, gateway: 0n, creditAfterPolls: 99 });
    await expect(ensureGatewayFloat(5_000n, f.deps, O)).rejects.toThrow(/deposit 0xdeposit mined; Gateway has not credited it yet/);
    expect(f.log).toEqual(["deposit 100000"]);
  });
});

describe("parseGatewayBalance", () => {
  const F = "0xe75D597f414EBa88Bf4226a3Ad8e0FAe46B1edC1";
  it("reads the depositor's balance as 6-decimal units", () => {
    expect(parseGatewayBalance({ balances: [{ domain: 26, depositor: F, balance: "0.095000" }] }, F)).toBe(95_000n);
  });
  it("an empty balances list means nothing deposited yet", () => {
    expect(parseGatewayBalance({ balances: [] }, F)).toBe(0n);
  });
  it.each([
    ["no balances field", {}],
    ["balances is not a list", { balances: "0" }],
    ["an entry without a balance", { balances: [{ domain: 26, depositor: F }] }],
    ["a non-numeric balance", { balances: [{ domain: 26, depositor: F, balance: "lots" }] }],
  ])("throws on a malformed response: %s", (_n, j) => {
    expect(() => parseGatewayBalance(j, F)).toThrow(/Gateway/);
  });
});
