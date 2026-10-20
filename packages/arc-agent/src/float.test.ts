import { describe, expect, it } from "vitest";
import { ensureGatewayFloat, type FloatDeps } from "./float.ts";

/** In-memory float: a wallet balance, a Gateway balance, and a deposit Gateway credits after `creditAfterPolls` reads. */
function fake(s: { wallet: bigint; gateway: bigint; creditAfterPolls?: number }) {
  const log: string[] = [];
  let pending = 0n;
  let reads = 0;
  const deps: FloatDeps = {
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

  it("throws after maxPolls without crediting, having deposited exactly once", async () => {
    const f = fake({ wallet: 200_000n, gateway: 0n, creditAfterPolls: 99 });
    await expect(ensureGatewayFloat(5_000n, f.deps, O)).rejects.toThrow(/deposit 0xdeposit mined; Gateway has not credited it yet/);
    expect(f.log).toEqual(["deposit 100000"]);
  });
});
