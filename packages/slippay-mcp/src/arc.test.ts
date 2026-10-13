import { describe, expect, it, vi } from "vitest";
import { keccak256, stringToHex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { slhKeygen } from "@slippay/arc-agent";
import { arcPay, formatUsdc, parseUsdc, remainingWindowBudget, type ArcDeps, type ArcSessionView } from "./arc.ts";

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
