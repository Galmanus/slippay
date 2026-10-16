import { describe, expect, it } from "vitest";
import {
  ContractFunctionRevertedError, UserRejectedRequestError, encodeErrorResult, encodeEventTopics,
  encodeFunctionData, getAddress, parseAbi, zeroAddress, type Address, type Hex, type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_NETWORKS, ARC_USDC, agentVaultAbi } from "@slippay/arc-agent";
import {
  ARC_FEE_FLOOR, NEVER, addChainParams, agentIdFromLogs, agentRegistrationURI, arcFees, buildSessionArgs,
  deriveStep, explainError, formatUsdc, isContractNo, generateAgentKeys, loadFlow, mcpConfig, parseNetwork, parseRecipients,
  parseUsdc, readVaultState, resolveDeploy, saveFlow, sessionPolicyHash, storageKey, usdcToNativeWei, validateLimits, vaultAddressAt,
  ArcFlowError, type ArcReader, type LimitsForm, type SessionLimits,
} from "./arcVault.ts";
import { AGENT_VAULT_BYTECODE, AGENT_VAULT_CONSTRUCTOR_ABI } from "./agentVaultBytecode.ts";

const OWNER = getAddress("0x1111111111111111111111111111111111111111");
const VAULT = getAddress("0x2222222222222222222222222222222222222222");
const SHOP = getAddress("0x3333333333333333333333333333333333333333");
const SHOP2 = getAddress("0x4444444444444444444444444444444444444444");
const AGENT = getAddress("0x5555555555555555555555555555555555555555");
const NOW = 1_800_000_000; // 2027-01-15
const CTX = { owner: OWNER, vault: VAULT, maxAbsolutePerTx: 1_000_000_000n, nowSec: NOW };
const FORM: LimitsForm = { perTx: "50", window: "200", windowSeconds: 86_400, recipients: SHOP, expiresOn: "", pqAbove: "" };

describe("parseNetwork", () => {
  it("defaults to testnet and only switches on an explicit ?network=mainnet", () => {
    expect(parseNetwork("")).toBe("testnet");
    expect(parseNetwork("?network=testnet")).toBe("testnet");
    expect(parseNetwork("?network=mainnet")).toBe("mainnet");
    expect(parseNetwork("?foo=1&network=MAINNET")).toBe("mainnet");
    expect(parseNetwork("?network=main")).toBe("testnet");
  });
});

describe("parseUsdc / formatUsdc", () => {
  it("parses decimal USDC into 6-decimal units, accepting a PT decimal comma", () => {
    expect(parseUsdc("12.5")).toBe(12_500_000n);
    expect(parseUsdc(" 1,50 ")).toBe(1_500_000n);
    expect(parseUsdc("0.000001")).toBe(1n);
    expect(parseUsdc("1000")).toBe(1_000_000_000n);
    expect(parseUsdc("0")).toBe(0n);
  });
  it("rejects anything ambiguous instead of guessing", () => {
    for (const bad of ["", "abc", "-1", "1.1234567", "1.000,50", "1,000.5", "1e6", "0x10", "1.", ".5"]) {
      expect(parseUsdc(bad), bad).toBeNull();
    }
  });
  it("formats 6-decimal units back without trailing zeros", () => {
    expect(formatUsdc(12_500_000n)).toBe("12.5");
    expect(formatUsdc(1n)).toBe("0.000001");
    expect(formatUsdc(0n)).toBe("0");
    expect(formatUsdc(2_000_000n)).toBe("2");
  });
  it("converts 6-decimal ERC-20 units to the 18-decimal native value Arc uses for sends", () => {
    expect(usdcToNativeWei(1_000_000n)).toBe(10n ** 18n);
    expect(usdcToNativeWei(1n)).toBe(10n ** 12n);
  });
});

describe("parseRecipients", () => {
  it("splits on lines, commas and spaces, checksums and de-duplicates", () => {
    const r = parseRecipients(`${SHOP.toLowerCase()}\n${SHOP2}, ${SHOP}\n\n`);
    expect(r.addresses).toEqual([SHOP, SHOP2]);
    expect(r.invalid).toEqual([]);
  });
  it("reports entries that are not addresses", () => {
    const r = parseRecipients(`${SHOP}\nnot-an-address\n0x123`);
    expect(r.addresses).toEqual([SHOP]);
    expect(r.invalid).toEqual(["not-an-address", "0x123"]);
  });
  it("rejects a mixed-case address with a bad checksum (likely a typo)", () => {
    const bad = SHOP.slice(0, 2) + "a" + "A".repeat(39); // mixed case, wrong checksum
    expect(parseRecipients(bad).invalid).toEqual([bad]);
  });
});

describe("validateLimits", () => {
  it("returns on-chain units for a valid form", () => {
    const r = validateLimits(FORM, CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      perTxCap: 50_000_000n, windowCap: 200_000_000n, windowSeconds: 86_400n, expiresAt: 0n,
      recipients: [SHOP], pqThreshold: null,
    });
  });
  it("turns an expiry date into the end of that local day", () => {
    const r = validateLimits({ ...FORM, expiresOn: "2027-03-01" }, CTX);
    expect(r.ok && r.value.expiresAt).toBe(BigInt(Math.floor(new Date(2027, 2, 1, 23, 59, 59).getTime() / 1000)));
  });
  it("keeps the optional post-quantum threshold", () => {
    const r = validateLimits({ ...FORM, pqAbove: "10" }, CTX);
    expect(r.ok && r.value.pqThreshold).toBe(10_000_000n);
  });
  const cases: [string, Partial<LimitsForm>, string, string][] = [
    ["empty per-payment cap", { perTx: "" }, "perTx", "required"],
    ["bad amount", { perTx: "lots" }, "perTx", "invalid_amount"],
    ["zero per-payment cap", { perTx: "0" }, "perTx", "zero"],
    ["above the vault ceiling", { perTx: "1000.000001", window: "2000" }, "perTx", "above_ceiling"],
    ["window below per-payment", { window: "49" }, "window", "window_below_per_tx"],
    ["window above 100x per-payment", { perTx: "1", window: "100.000001" }, "window", "window_above_100x"],
    ["window too short", { windowSeconds: 30 }, "windowSeconds", "window_too_short"],
    ["no recipients", { recipients: "  " }, "recipients", "no_recipients"],
    ["bad recipient", { recipients: `${SHOP}\nxyz` }, "recipients", "bad_address"],
    ["owner as recipient", { recipients: OWNER }, "recipients", "self_recipient"],
    ["vault as recipient", { recipients: VAULT.toLowerCase() }, "recipients", "self_recipient"],
    ["zero address recipient", { recipients: zeroAddress }, "recipients", "self_recipient"],
    ["expiry in the past", { expiresOn: "2020-01-01" }, "expiresOn", "expiry_past"],
    ["bad expiry date", { expiresOn: "31/12/2027" }, "expiresOn", "invalid_date"],
    ["pq threshold that never applies", { pqAbove: "50" }, "pqAbove", "pq_never_applies"],
    ["bad pq threshold", { pqAbove: "x" }, "pqAbove", "invalid_amount"],
  ];
  for (const [name, patch, field, code] of cases) {
    it(`rejects ${name}`, () => {
      const r = validateLimits({ ...FORM, ...patch }, CTX);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect((r.errors as Record<string, string>)[field]).toBe(code);
    });
  }
  it("caps the allowlist size (gas)", () => {
    const many = Array.from({ length: 51 }, (_, i) => getAddress(`0x${(i + 0x100).toString(16).padStart(40, "0")}`)).join("\n");
    const r = validateLimits({ ...FORM, recipients: many }, CTX);
    expect(!r.ok && r.errors.recipients).toBe("too_many_recipients");
  });
});

describe("buildSessionArgs", () => {
  const base: SessionLimits = {
    agentSigner: AGENT, agentId: 7n, perTxCap: 2_000_000n, windowCap: 4_000_000n, windowSeconds: 86_400n,
    expiresAt: 0n, recipients: [SHOP], pqThreshold: null,
  };
  it("builds installSession args with the attester gate and PQ off", () => {
    const [signer, c] = buildSessionArgs(base);
    expect(signer).toBe(AGENT);
    expect(c).toMatchObject({
      agentId: 7n, perTxCap: 2_000_000n, windowCap: 4_000_000n, windowSeconds: 86_400n, expiresAt: 0n,
      pqThreshold: NEVER, slhVk: `0x${"00".repeat(32)}`, allowRecipients: [SHOP],
      attesterX: `0x${"00".repeat(32)}`, attesterY: `0x${"00".repeat(32)}`, attestThreshold: NEVER,
    });
    expect(c.policyHash).toBe(sessionPolicyHash(base));
    expect(NEVER).toBe((1n << 128n) - 1n);
  });
  it("encodes against the AgentVault ABI from @slippay/arc-agent", () => {
    const data = encodeFunctionData({ abi: agentVaultAbi, functionName: "installSession", args: buildSessionArgs(base) });
    expect(data.slice(0, 10)).toMatch(/^0x[0-9a-f]{8}$/);
  });
  it("sets the PQ threshold and SLH verifying key together", () => {
    const vk = `0x${"ab".repeat(32)}` as Hex;
    const [, c] = buildSessionArgs({ ...base, pqThreshold: 1_000_000n, slhVk: vk });
    expect(c.pqThreshold).toBe(1_000_000n);
    expect(c.slhVk).toBe(vk);
  });
  it("mirrors the contract's own InvalidConfig checks", () => {
    expect(() => buildSessionArgs({ ...base, pqThreshold: 1_000_000n })).toThrow(/slhVk/);
    expect(() => buildSessionArgs({ ...base, perTxCap: 0n })).toThrow();
    expect(() => buildSessionArgs({ ...base, windowCap: 1_000_000n })).toThrow();
    expect(() => buildSessionArgs({ ...base, windowCap: 200_000_001n })).toThrow();
    expect(() => buildSessionArgs({ ...base, windowSeconds: 59n })).toThrow();
    expect(() => buildSessionArgs({ ...base, recipients: [] })).toThrow();
    expect(() => buildSessionArgs({ ...base, recipients: [zeroAddress] })).toThrow();
    expect(() => buildSessionArgs({ ...base, agentSigner: zeroAddress })).toThrow();
  });
  it("hashes the policy deterministically, independent of recipient order and case", () => {
    const a = sessionPolicyHash({ ...base, recipients: [SHOP, SHOP2] });
    const b = sessionPolicyHash({ ...base, recipients: [SHOP2.toLowerCase() as Address, SHOP] });
    expect(a).toBe(b);
    expect(sessionPolicyHash({ ...base, perTxCap: 3_000_000n })).not.toBe(sessionPolicyHash(base));
  });
});

describe("generateAgentKeys", () => {
  it("creates an ECDSA agent key and, only when asked, an SLH-DSA pair", () => {
    const k = generateAgentKeys({ pq: false });
    expect(k.agentKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(k.agentAddress).toBe(privateKeyToAccount(k.agentKey).address);
    expect(k.slhSecret).toBeUndefined();
    expect(k.slhVk).toBeUndefined();
    expect(generateAgentKeys({ pq: false }).agentKey).not.toBe(k.agentKey);
  });
  it("SLH secret is the 64-byte form SLIPPAY_ARC_SLH_SECRET expects", () => {
    const k = generateAgentKeys({ pq: true });
    expect(k.slhSecret).toMatch(/^0x[0-9a-f]{128}$/);
    expect(k.slhVk).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("mcpConfig", () => {
  const agentKey = `0x${"11".repeat(32)}` as Hex;
  it("emits the slippay MCP server with the Arc env the server reads", () => {
    const cfg = JSON.parse(mcpConfig({ vault: VAULT, agentKey, network: "testnet" }));
    const s = cfg.mcpServers.slippay;
    expect(s.command).toBe("npx");
    expect(s.args).toEqual(["-y", "@slippay/mcp"]);
    expect(s.env).toEqual({
      SLIPPAY_ARC_NETWORK: "testnet",
      SLIPPAY_ARC_VAULT: VAULT,
      SLIPPAY_ARC_AGENT_KEY: agentKey,
      SLIPPAY_ARC_RELAYER_URL: "https://api.slippay.cc/api/v1/arc",
      SLIPPAY_ARC_RPC_URL: "https://rpc.testnet.arc.io",
    });
  });
  it("adds the SLH secret only when there is one, and points mainnet at mainnet", () => {
    const slh = `0x${"22".repeat(64)}` as Hex;
    const env = JSON.parse(mcpConfig({ vault: VAULT, agentKey, slhSecret: slh, network: "mainnet" })).mcpServers.slippay.env;
    expect(env.SLIPPAY_ARC_SLH_SECRET).toBe(slh);
    expect(env.SLIPPAY_ARC_NETWORK).toBe("mainnet");
    expect(env.SLIPPAY_ARC_RPC_URL).toBe("https://rpc.mainnet.arc.io");
  });
  it("refuses malformed secrets rather than emitting a config that fails later", () => {
    expect(() => mcpConfig({ vault: VAULT, agentKey: "0x1234" as Hex, network: "testnet" })).toThrow();
    expect(() => mcpConfig({ vault: VAULT, agentKey, slhSecret: "0xabcd" as Hex, network: "testnet" })).toThrow();
    expect(() => mcpConfig({ vault: "0xnope" as Address, agentKey, network: "testnet" })).toThrow();
  });
});

describe("wallet helpers", () => {
  it("builds wallet_addEthereumChain params for each Arc network", () => {
    expect(addChainParams("testnet")).toEqual({
      chainId: "0x4cef52", chainName: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: ["https://rpc.testnet.arc.io"], blockExplorerUrls: ["https://explorer.testnet.arc.io"],
    });
    expect(addChainParams("mainnet").chainId).toBe("0x13b2");
    expect(addChainParams("mainnet").rpcUrls).toEqual(["https://rpc.mainnet.arc.io"]);
  });
  it("never offers a max fee below 25 gwei (Arc drops < 20 gwei silently)", () => {
    expect(ARC_FEE_FLOOR).toBe(25_000_000_000n);
    expect(arcFees(undefined)).toEqual({ maxFeePerGas: ARC_FEE_FLOOR, maxPriorityFeePerGas: 1_000_000_000n });
    expect(arcFees(1n).maxFeePerGas).toBe(ARC_FEE_FLOOR);
    expect(arcFees(20_000_000_000n).maxFeePerGas).toBe(41_000_000_000n);
  });
  it("predicts the CREATE address from owner + nonce", () => {
    const sender = "0x6ac7ea33f8831ea9dcc53393aaa88b25a785dbf0";
    expect(vaultAddressAt(sender, 0).toLowerCase()).toBe("0xcd234a471b72ba2f1ccf0a70fcaba648a5eecd8d");
    expect(vaultAddressAt(sender, 1).toLowerCase()).toBe("0x343c43a37d37dff08ae8c4a11544c718abb4fcf8");
  });
});

describe("ERC-8004 identity", () => {
  it("builds an on-chain data: registration file naming the vault", () => {
    const uri = agentRegistrationURI({ name: "  Agente Café  ", vault: VAULT, network: "testnet" });
    expect(uri.startsWith("data:application/json;base64,")).toBe(true);
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(uri.split(",")[1]!), (c) => c.charCodeAt(0))));
    expect(json.type).toBe("https://eips.ethereum.org/EIPS/eip-8004#registration-v1");
    expect(json.name).toBe("Agente Café");
    expect(json.services).toContainEqual({ name: "agentWallet", endpoint: `eip155:5042002:${VAULT}` });
  });
  it("falls back to a default name and caps long names", () => {
    const dec = (u: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(u.split(",")[1]!), (c) => c.charCodeAt(0))));
    expect(dec(agentRegistrationURI({ name: " ", vault: VAULT, network: "mainnet" })).name).toBe("Slippay agent");
    expect(dec(agentRegistrationURI({ name: "x".repeat(200), vault: VAULT, network: "mainnet" })).name).toHaveLength(64);
  });

  const registry = getAddress("0x8004A818BFB912233c491871b3d84c89A494BD9e");
  const transfer = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"]);
  const log = (address: Address, to: Address, tokenId: bigint, from: Address = zeroAddress) =>
    ({ address, data: "0x", topics: encodeEventTopics({ abi: transfer, eventName: "Transfer", args: { from, to, tokenId } }) }) as unknown as Log;
  it("reads the minted agentId from the registry's Transfer log", () => {
    expect(agentIdFromLogs([log(registry, OWNER, 42n)], registry, OWNER)).toBe(42n);
  });
  it("ignores other contracts, other recipients and non-mint transfers", () => {
    expect(agentIdFromLogs([log(SHOP, OWNER, 1n)], registry, OWNER)).toBeNull();
    expect(agentIdFromLogs([log(registry, SHOP, 2n)], registry, OWNER)).toBeNull();
    expect(agentIdFromLogs([log(registry, OWNER, 3n, SHOP)], registry, OWNER)).toBeNull();
    expect(agentIdFromLogs([{ address: registry, data: "0x", topics: [] } as unknown as Log], registry, OWNER)).toBeNull();
  });
});

describe("flow persistence (public pointers only, never secrets)", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } };
  };
  it("keys records by network and owner", () => {
    expect(storageKey("testnet", OWNER)).toBe(`slippay.arcAgent.v1.testnet.${OWNER.toLowerCase()}`);
  });
  it("round-trips the public pointers", () => {
    const { s } = mem();
    saveFlow(s, { network: "testnet", owner: OWNER, vault: VAULT, vaultNonce: 3, agentId: "9", identityFromBlock: "100", agentSigner: AGENT, fundSkipped: true, configSaved: false });
    expect(loadFlow(s, "testnet", OWNER)).toEqual({ network: "testnet", owner: OWNER, vault: VAULT, vaultNonce: 3, agentId: "9", identityFromBlock: "100", agentSigner: AGENT, fundSkipped: true, configSaved: false });
    expect(loadFlow(s, "mainnet", OWNER)).toBeNull();
  });
  it("drops any field that is not a whitelisted public pointer", () => {
    const { s, m } = mem();
    const secret = `0x${"99".repeat(32)}`;
    saveFlow(s, { network: "testnet", owner: OWNER, vault: VAULT, agentKey: secret, slhSecret: secret } as never);
    const raw = [...m.values()].join("");
    expect(raw).not.toContain("99".repeat(32));
    expect(raw).not.toMatch(/agentKey|slhSecret/);
  });
  it("treats corrupt, mismatched or ill-typed records as absent", () => {
    const { s, m } = mem();
    m.set(storageKey("testnet", OWNER), "{not json");
    expect(loadFlow(s, "testnet", OWNER)).toBeNull();
    m.set(storageKey("testnet", OWNER), JSON.stringify({ v: 1, network: "mainnet", owner: OWNER }));
    expect(loadFlow(s, "testnet", OWNER)).toBeNull();
    m.set(storageKey("testnet", OWNER), JSON.stringify({ v: 1, network: "testnet", owner: OWNER, vault: "nope", agentId: "x1" }));
    expect(loadFlow(s, "testnet", OWNER)).toEqual({ network: "testnet", owner: OWNER });
  });
  it("survives a storage that throws (private mode, blocked site data)", () => {
    const boom = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadFlow(boom, "testnet", OWNER)).toBeNull();
    expect(() => saveFlow(boom, { network: "testnet", owner: OWNER })).not.toThrow();
    expect(loadFlow(null, "testnet", OWNER)).toBeNull();
  });
});

describe("deriveStep", () => {
  const all = { connected: true, chainOk: true, vault: true, identity: true, funded: true, session: true, configSaved: true };
  it("walks the steps in on-chain dependency order", () => {
    expect(deriveStep({ ...all, connected: false })).toBe("connect");
    expect(deriveStep({ ...all, chainOk: false })).toBe("connect");
    expect(deriveStep({ ...all, vault: false })).toBe("vault");
    expect(deriveStep({ ...all, identity: false })).toBe("identity");
    expect(deriveStep({ ...all, funded: false })).toBe("fund");
    expect(deriveStep({ ...all, session: false })).toBe("limits");
    expect(deriveStep({ ...all, configSaved: false })).toBe("config");
    expect(deriveStep(all)).toBe("activate");
  });
  it("never goes past a missing vault, whatever else is set", () => {
    expect(deriveStep({ ...all, vault: false, identity: true, session: true })).toBe("vault");
  });
});

describe("explainError", () => {
  it("recognises a wallet rejection, however it is wrapped", () => {
    expect(explainError({ code: 4001, message: "User rejected" })).toEqual({ code: "rejected" });
    expect(explainError({ message: "x", cause: { code: 4001 } })).toEqual({ code: "rejected" });
    expect(explainError(new UserRejectedRequestError(new Error("no")))).toEqual({ code: "rejected" });
  });
  it("names the AgentVault revert", () => {
    const err = new ContractFunctionRevertedError({
      abi: agentVaultAbi, functionName: "installSession",
      data: encodeErrorResult({ abi: agentVaultAbi, errorName: "ExceedsAbsoluteCeiling" }),
    });
    expect(explainError({ message: "wrapped", cause: err })).toEqual({ code: "reverted", reason: "ExceedsAbsoluteCeiling" });
  });
  it("maps wrong chain, low balance and our own precondition errors", () => {
    expect(explainError({ name: "ChainMismatchError", message: "chain" })).toEqual({ code: "wrong_chain" });
    expect(explainError(new Error("insufficient funds for gas * price + value"))).toEqual({ code: "insufficient_funds" });
    expect(explainError(new ArcFlowError("not_owner"))).toEqual({ code: "not_owner" });
    expect(explainError(new Error("something else"))).toEqual({ code: "unknown" });
  });
});

// Fake Arc RPC: `vaults` maps address → owner of an AgentVault deployed there. Anything else has no code.
function fakeReader(o: { vaults?: Record<string, Address>; latest: number; pending?: number; down?: boolean }): ArcReader {
  const vaults = Object.fromEntries(Object.entries(o.vaults ?? {}).map(([a, w]) => [a.toLowerCase(), w]));
  const net = () => { if (o.down) throw Object.assign(new Error("HTTP request failed."), { name: "HttpRequestError" }); };
  return {
    getCode: async ({ address }: { address: Address }) => { net(); return vaults[address.toLowerCase()] ? "0xc0de" : undefined; },
    call: async () => ({ data: "0xc0de" }),
    getTransactionCount: async ({ blockTag }: { blockTag: string }) => (blockTag === "pending" ? o.pending ?? o.latest : o.latest),
    readContract: async ({ address, functionName }: { address: Address; functionName: string }) => {
      const owner = vaults[address.toLowerCase()];
      switch (functionName) {
        case "owner": return owner;
        case "usdc": return ARC_USDC;
        case "identity": return ARC_NETWORKS.testnet.identityRegistry;
        case "maxAbsolutePerTx": return 1_000_000_000n;
        case "balanceOf": return 0n;
        default: throw new Error(functionName);
      }
    },
  } as unknown as ArcReader;
}

describe("resolveDeploy (resume without ever deploying twice)", () => {
  const at = (n: number) => vaultAddressAt(OWNER, n);
  const base = { network: "testnet" as const, owner: OWNER };
  it("confirms the saved vault from chain", async () => {
    const reader = fakeReader({ vaults: { [at(5)]: OWNER }, latest: 6 });
    expect(await resolveDeploy({ ...base, vault: at(5), vaultNonce: 5, reader })).toEqual({ status: "deployed", vault: at(5) });
  });
  it("finds the vault from the nonce alone when the receipt never arrived", async () => {
    const reader = fakeReader({ vaults: { [at(5)]: OWNER }, latest: 6 });
    expect(await resolveDeploy({ ...base, vaultNonce: 5, reader })).toEqual({ status: "deployed", vault: at(5) });
  });
  it("finds it when the wallet used a later nonce than predicted", async () => {
    const reader = fakeReader({ vaults: { [at(7)]: OWNER }, latest: 9 });
    expect(await resolveDeploy({ ...base, vault: at(5), vaultNonce: 5, reader })).toEqual({ status: "deployed", vault: at(7) });
  });
  it("reports pending while the deploy is in the mempool", async () => {
    const reader = fakeReader({ latest: 5, pending: 6 });
    expect(await resolveDeploy({ ...base, vault: at(5), vaultNonce: 5, reader })).toEqual({ status: "pending" });
  });
  it("says none after a rejected signature, and keeps watching until the hint is stale", async () => {
    expect(await resolveDeploy({ ...base, vault: at(5), vaultNonce: 5, reader: fakeReader({ latest: 5 }) })).toEqual({ status: "none", stale: false });
    expect(await resolveDeploy({ ...base, vaultNonce: 5, reader: fakeReader({ latest: 20 }) })).toEqual({ status: "none", stale: true });
  });
  it("never adopts a vault owned by someone else", async () => {
    const reader = fakeReader({ vaults: { [at(5)]: SHOP }, latest: 6 });
    expect(await resolveDeploy({ ...base, vault: at(5), vaultNonce: 5, reader })).toEqual({ status: "none", stale: false });
  });
  it("throws on an RPC outage instead of concluding there is no vault", async () => {
    await expect(resolveDeploy({ ...base, vault: at(5), vaultNonce: 5, reader: fakeReader({ latest: 6, down: true }) })).rejects.toThrow();
    await expect(readVaultState({ network: "testnet", vault: at(5), reader: fakeReader({ latest: 6, down: true }) })).rejects.toThrow();
  });
});

describe("isContractNo", () => {
  it("is true only when the contract refused, never for a transport failure", () => {
    const revert = new ContractFunctionRevertedError({
      abi: agentVaultAbi, functionName: "owner", data: encodeErrorResult({ abi: agentVaultAbi, errorName: "NotOwner" }),
    });
    expect(isContractNo({ name: "ContractFunctionExecutionError", cause: revert })).toBe(true);
    expect(isContractNo({ name: "ContractFunctionExecutionError", cause: { name: "ContractFunctionZeroDataError" } })).toBe(true);
    expect(isContractNo({ name: "CallExecutionError", details: "execution reverted" })).toBe(true);
    expect(isContractNo({ name: "HttpRequestError", message: "HTTP request failed.", cause: new TypeError("fetch failed") })).toBe(false);
    expect(isContractNo({ name: "TimeoutError", message: "The request took too long to respond." })).toBe(false);
  });
});

describe("AgentVault bytecode", () => {
  it("is creation code with the 4-arg constructor the deploy step calls", () => {
    expect(AGENT_VAULT_BYTECODE).toMatch(/^0x610100604052[0-9a-f]+$/); // solc prologue (4 immutables)
    expect(AGENT_VAULT_BYTECODE.length).toBeGreaterThan(10_000);
    expect(AGENT_VAULT_CONSTRUCTOR_ABI[0].inputs.map((i) => i.type)).toEqual(["address", "address", "address", "uint256"]);
  });
  // contracts-evm/out is gitignored: when a local forge build exists, the committed bytecode must match it.
  const local = Object.values(
    import.meta.glob("../../../../contracts-evm/out/AgentVault.sol/AgentVault.json", { eager: true, import: "default" }),
  )[0] as { bytecode: { object: string } } | undefined;
  it.skipIf(!local)("matches the local forge build when one exists (stale-bytecode guard)", () => {
    expect(AGENT_VAULT_BYTECODE).toBe(local!.bytecode.object);
  });
});
