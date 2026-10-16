import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, getAddress, toEventSelector, type Address, type Hex, type Log } from "viem";
import { agentVaultAbi } from "./abi.ts";
import { AGENT_SPEND_EVENTS, aggregate, parseVaultRegistry, spendEventsFromLogs, type SpendEvent, type VaultMeta } from "./metrics.ts";

const DAY = 86_400;
const NOW = new Date("2026-10-16T12:00:00Z");
const nowSec = NOW.getTime() / 1000;

const V_INT: Address = "0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2";
const V_EXT: Address = "0x00000000000000000000000000000000000e7E01"; // checksummed
const VAULTS: VaultMeta[] = [
  { network: "testnet", address: V_INT, fromBlock: 67_019_314, owner: "0x1cDB3F62257De815DDdAd3176e37Ff1F1916A735", label: "slippay-e2e", external: false },
  { network: "testnet", address: V_EXT, fromBlock: 1, owner: "0x00000000000000000000000000000000000000aa", label: "pilot-a", external: true },
];

let seq = 0;
function ev(p: Partial<SpendEvent> & { blockTimestamp: number }): SpendEvent {
  seq += 1;
  return {
    vault: V_INT,
    agentSigner: "0x422e911cb36090cbeba21cdea73d0c454287606a",
    agentId: 897_273n,
    to: "0xb83a837083100c0a99bfc44693c177ba0b31b393",
    amount: 1_000_000n,
    orderId: `0x${seq.toString(16).padStart(64, "0")}` as Hex,
    txHash: `0x${(seq + 0xabc000).toString(16).padStart(64, "0")}` as Hex,
    logIndex: 0,
    blockNumber: BigInt(seq),
    ...p,
  };
}

describe("aggregate: dedupe", () => {
  it("counts the same (txHash, logIndex) once, even with different hex case", () => {
    const a = ev({ blockTimestamp: nowSec - 60, amount: 500_000n, logIndex: 28 });
    const dupe = { ...a, txHash: a.txHash.toUpperCase().replace("0X", "0x") as Hex };
    const m = aggregate([a, a, dupe], VAULTS, NOW);
    expect(m.payments).toBe(1);
    expect(m.volumeUsdc).toBe("0.5");
  });

  it("keeps two AgentSpend logs of the same tx (different logIndex) as two payments", () => {
    const a = ev({ blockTimestamp: nowSec - 60, logIndex: 3 });
    const b = { ...a, logIndex: 7, orderId: "0x01" as Hex };
    expect(aggregate([a, b], VAULTS, NOW).payments).toBe(2);
  });
});

describe("aggregate: registry", () => {
  it("separates external (pilot) vaults from Slippay-owned ones", () => {
    const m = aggregate(
      [
        ev({ vault: V_INT, blockTimestamp: nowSec - 100 }),
        ev({ vault: V_INT, blockTimestamp: nowSec - 90 }),
        ev({ vault: V_EXT, blockTimestamp: nowSec - 80, amount: 250_000n }),
      ],
      VAULTS,
      NOW,
    );
    expect(m.payments).toBe(3);
    expect(m.activeWallets).toBe(2);
    expect(m.externalPayments).toBe(1);
    expect(m.external.payments).toBe(1);
    expect(m.external.activeWallets).toBe(1);
    expect(m.external.volumeUsdc).toBe("0.25");
    expect(m.volumeUsdc).toBe("2.25");
  });

  it("matches vault addresses case-insensitively (registry checksummed, logs lowercase)", () => {
    const m = aggregate([ev({ vault: V_EXT.toLowerCase() as Address, blockTimestamp: nowSec })], VAULTS, NOW);
    expect(m.externalPayments).toBe(1);
  });

  it("never counts spends from vaults that are not in the registry, but reports them", () => {
    const stray = ev({ vault: "0x000000000000000000000000000000000000dEaD", blockTimestamp: nowSec });
    const m = aggregate([stray], VAULTS, NOW);
    expect(m.payments).toBe(0);
    expect(m.activeWallets).toBe(0);
    expect(m.unregisteredEvents).toBe(1);
  });

  it("refuses a registry with the same vault address twice (networks must not be mixed)", () => {
    const mixed = [...VAULTS, { ...VAULTS[0]!, network: "mainnet" as const }];
    expect(() => aggregate([], mixed, NOW)).toThrow(/duplicate vault/i);
  });

  it("lists every registered vault in perVault, including ones with no spends", () => {
    const m = aggregate([ev({ vault: V_INT, blockTimestamp: nowSec })], VAULTS, NOW);
    expect(m.perVault.map((v) => [v.label, v.payments])).toEqual([
      ["slippay-e2e", 1],
      ["pilot-a", 0],
    ]);
    expect(m.activeWallets).toBe(1);
  });
});

describe("aggregate: 28-day active window", () => {
  it("includes a spend exactly 28 days before now and excludes one a second earlier", () => {
    const m = aggregate(
      [
        ev({ vault: V_INT, blockTimestamp: nowSec - 28 * DAY }),
        ev({ vault: V_EXT, blockTimestamp: nowSec - 28 * DAY - 1 }),
      ],
      VAULTS,
      NOW,
    );
    expect(m.activeWallets).toBe(2);
    expect(m.activeWallets28d).toBe(1);
    expect(m.perVault.find((v) => v.label === "slippay-e2e")!.activeIn28d).toBe(true);
    expect(m.perVault.find((v) => v.label === "pilot-a")!.activeIn28d).toBe(false);
    expect(m.external.activeWallets28d).toBe(0);
  });

  it("does not count spends after `now` as active in the window", () => {
    const m = aggregate([ev({ blockTimestamp: nowSec + 1 })], VAULTS, NOW);
    expect(m.activeWallets28d).toBe(0);
  });
});

describe("aggregate: active days (UTC)", () => {
  it("splits spends one second apart across UTC midnight into two days", () => {
    const midnight = Date.UTC(2026, 9, 14) / 1000; // 2026-10-14T00:00:00Z
    const m = aggregate([ev({ blockTimestamp: midnight - 1 }), ev({ blockTimestamp: midnight })], VAULTS, NOW);
    expect(m.activeDays).toBe(2);
    expect(m.days).toEqual(["2026-10-13", "2026-10-14"]);
  });

  it("buckets by UTC, not local time: 00:00:01Z and 23:59:59Z are the same day", () => {
    const day = Date.UTC(2026, 9, 14) / 1000;
    const m = aggregate([ev({ blockTimestamp: day + 1 }), ev({ blockTimestamp: day + DAY - 1 })], VAULTS, NOW);
    expect(m.activeDays).toBe(1);
  });

  it("reports days per vault and overall without double-counting a shared day", () => {
    const t = Date.UTC(2026, 9, 15, 10) / 1000;
    const m = aggregate(
      [ev({ vault: V_INT, blockTimestamp: t }), ev({ vault: V_EXT, blockTimestamp: t + 60 }), ev({ vault: V_EXT, blockTimestamp: t + DAY })],
      VAULTS,
      NOW,
    );
    expect(m.activeDays).toBe(2);
    expect(m.external.activeDays).toBe(2);
    expect(m.perVault.find((v) => v.label === "slippay-e2e")!.activeDays).toBe(1);
    expect(m.perVault.find((v) => v.label === "pilot-a")!.days).toEqual(["2026-10-15", "2026-10-16"]);
  });
});

describe("aggregate: USDC volume", () => {
  it("formats 6-decimal base units exactly (0.5 + 2 = 2.5)", () => {
    const m = aggregate([ev({ blockTimestamp: nowSec, amount: 500_000n }), ev({ blockTimestamp: nowSec, amount: 2_000_000n })], VAULTS, NOW);
    expect(m.volumeUsdc).toBe("2.5");
  });

  it("keeps the smallest unit and sums beyond 2^53 without float error", () => {
    const big = 9_007_199_254_740_993n; // 2^53 + 1 base units
    const m = aggregate([ev({ blockTimestamp: nowSec, amount: big }), ev({ blockTimestamp: nowSec, amount: 1n })], VAULTS, NOW);
    expect(m.volumeUsdc).toBe("9007199254.740994");
    expect(m.volumeBaseUnits).toBe("9007199254740994");
  });

  it("returns zeros for no events", () => {
    const m = aggregate([], VAULTS, NOW);
    expect(m).toMatchObject({ payments: 0, externalPayments: 0, activeWallets: 0, activeWallets28d: 0, activeDays: 0, volumeUsdc: "0" });
  });
});

// Logs of testnet tx 0x8cb9df02…5bbb (the 0.5 USDC e2e spend, block 67019327): one AgentSpend from the
// vault plus the two Transfer logs Arc emits for a single USDC transfer (native 18-dec system log + ERC-20 6-dec).
// That vault was deployed from 07bacd0, whose AgentSpend has no `attested` field (topic0 0xb23766a7…).
const TX: Hex = "0x8cb9df02fc39a4733f861ae30c22a2cc783806a6e2de44832d1fe50427aa5bbb";
const BLOCK = 67_019_327n;
const base = { blockNumber: BLOCK, blockHash: `0x${"11".repeat(32)}` as Hex, transactionHash: TX, transactionIndex: 0, removed: false };
const E2E_LOGS: Log[] = [
  {
    ...base,
    address: "0x9ff0a12cc3cd4654150527040cc6481ded01c8f2",
    topics: [
      "0xb23766a70bdcd5c077e8109059bcb7d83253800574f0306b6f7d954160830602",
      "0x000000000000000000000000422e911cb36090cbeba21cdea73d0c454287606a",
      "0x00000000000000000000000000000000000000000000000000000000000db0f9",
      "0x000000000000000000000000b83a837083100c0a99bfc44693c177ba0b31b393",
    ],
    data: "0x000000000000000000000000000000000000000000000000000000000007a120fcf9e38fa945ab7062eb4d7173398fbf1d80c71d1527f7b880f394b0f141550400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    logIndex: 28,
  },
  {
    ...base,
    address: "0xfffffffffffffffffffffffffffffffffffffffe",
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x0000000000000000000000009ff0a12cc3cd4654150527040cc6481ded01c8f2",
      "0x000000000000000000000000b83a837083100c0a99bfc44693c177ba0b31b393",
    ],
    data: "0x00000000000000000000000000000000000000000000000006f05b59d3b20000",
    logIndex: 29,
  },
  {
    ...base,
    address: "0x3600000000000000000000000000000000000000",
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x0000000000000000000000009ff0a12cc3cd4654150527040cc6481ded01c8f2",
      "0x000000000000000000000000b83a837083100c0a99bfc44693c177ba0b31b393",
    ],
    data: "0x000000000000000000000000000000000000000000000000000000000007a120",
    logIndex: 30,
  },
] as Log[];

describe("spendEventsFromLogs", () => {
  const ts = new Map([[BLOCK, 1_791_900_000]]);

  it("filters on both AgentSpend layouts: v1 (deployed testnet vault) and v2 (current source, + attested)", () => {
    expect(AGENT_SPEND_EVENTS.map((e) => toEventSelector(e)).sort()).toEqual([
      "0x9ea5d6476f343b4e6156c9888553bf6c5c6cc7bc3da0f648a0b8bba450c013a8",
      "0xb23766a70bdcd5c077e8109059bcb7d83253800574f0306b6f7d954160830602",
    ]);
  });

  it("decodes a v2 AgentSpend (emitted by vaults built from the current AgentVault.sol)", () => {
    const v2: Log = {
      ...base,
      address: V_EXT.toLowerCase() as Address,
      topics: encodeEventTopics({
        abi: agentVaultAbi,
        eventName: "AgentSpend",
        args: { agentSigner: "0x00000000000000000000000000000000000000a1", agentId: 5n, to: "0x00000000000000000000000000000000000000b2" },
      }) as Log["topics"],
      data: encodeAbiParameters(
        [{ type: "uint256" }, { type: "bytes32" }, { type: "uint64" }, { type: "bool" }, { type: "bool" }],
        [1_234_567n, `0x${"ab".repeat(32)}`, 3n, true, true],
      ),
      logIndex: 4,
    } as Log;
    const out = spendEventsFromLogs([v2, ...E2E_LOGS], ts);
    expect(out.map((e) => [e.vault, e.agentId, e.amount, e.logIndex])).toEqual([
      [V_EXT, 5n, 1_234_567n, 4],
      [V_INT, 897_273n, 500_000n, 28],
    ]);
  });

  it("decodes only the AgentSpend log of a spend tx, never the two USDC Transfer logs", () => {
    const out = spendEventsFromLogs(E2E_LOGS, ts);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      vault: "0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2", // checksummed, like the decoded topics
      agentSigner: getAddress("0x422e911cb36090cbeba21cdea73d0c454287606a"),
      agentId: 897_273n,
      to: getAddress("0xb83a837083100c0a99bfc44693c177ba0b31b393"),
      amount: 500_000n,
      orderId: "0xfcf9e38fa945ab7062eb4d7173398fbf1d80c71d1527f7b880f394b0f1415504",
      txHash: TX,
      logIndex: 28,
      blockNumber: BLOCK,
      blockTimestamp: 1_791_900_000,
    });
  });

  it("skips logs flagged removed (reorged out)", () => {
    expect(spendEventsFromLogs([{ ...E2E_LOGS[0]!, removed: true }], ts)).toHaveLength(0);
  });

  it("throws when a block timestamp is missing instead of guessing a day", () => {
    expect(() => spendEventsFromLogs(E2E_LOGS, new Map())).toThrow(/timestamp/i);
  });
});

describe("parseVaultRegistry", () => {
  const good = { network: "testnet", address: V_INT, fromBlock: 67_019_314, owner: VAULTS[0]!.owner, label: "slippay-e2e", external: false };

  it("accepts a well-formed registry", () => {
    expect(parseVaultRegistry([good])).toEqual([good]);
  });

  it('rejects external given as a string (a "false" string is truthy and would inflate pilot counts)', () => {
    expect(() => parseVaultRegistry([{ ...good, external: "false" }])).toThrow(/external/);
  });

  it.each([
    ["network", { ...good, network: "devnet" }],
    ["address", { ...good, address: "0x1234" }],
    ["owner", { ...good, owner: undefined }],
    ["fromBlock", { ...good, fromBlock: "67019314" }],
    ["fromBlock", { ...good, fromBlock: -1 }],
    ["label", { ...good, label: "" }],
  ])("rejects a bad %s", (field, entry) => {
    expect(() => parseVaultRegistry([entry])).toThrow(new RegExp(field));
  });

  it("rejects a registry that is not an array", () => {
    expect(() => parseVaultRegistry({ vaults: [good] })).toThrow(/array/);
  });
});
