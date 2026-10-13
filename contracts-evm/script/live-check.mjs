// Live check of AgentVault against a real Arc node, with zero funds and zero deployment.
//
// Injects ArcLiveHarness runtime code via eth_call state override, then runs the full flow
// (native USDC deposit, ERC-8004-checked session install, classical spend, PQ-missing,
// PQ-tampered, PQ-valid) against Arc's real SLH-DSA precompile (0x1800…0004) and real USDC.
//
// usage: node script/live-check.mjs [testnet|mainnet] [agentId]   (needs `forge build` first)
// env:   CAST=/path/to/cast (default: cast on PATH)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { slh_dsa_sha2_128s as slh } from "@noble/post-quantum/slh-dsa.js";

const NETWORKS = {
  testnet: { rpc: "https://rpc.testnet.arc.io", identity: "0x8004A818BFB912233c491871b3d84c89A494BD9e" },
  mainnet: { rpc: "https://rpc.mainnet.arc.io", identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" },
};
const netName = process.argv[2] ?? "testnet";
const agentId = process.argv[3] ?? "1";
const net = NETWORKS[netName];
if (!net) throw new Error(`unknown network ${netName}`);

const CAST = process.env.CAST ?? "cast";
const HARNESS = "0x000000000000000000000000000000000000a11c";
const artifact = new URL("../out/ArcLiveHarness.sol/ArcLiveHarness.json", import.meta.url);
const code = JSON.parse(readFileSync(artifact, "utf8")).deployedBytecode.object;

const cast = (...args) => execFileSync(CAST, args, { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const hex = (u8) => "0x" + Buffer.from(u8).toString("hex");
const words = (raw) => raw.slice(2).match(/.{64}/g);
const callHarness = (sig, ...args) =>
  cast(
    "call", HARNESS, sig, ...args,
    "--rpc-url", net.rpc,
    "--override-code", `${HARNESS}:${code}`,
    "--override-balance", `${HARNESS}:1000000000000000000000`, // 1,000 native USDC (18 dec)
  );

const agentPk = hex(randomBytes(32));
const agent = cast("wallet", "address", "--private-key", agentPk);
const merchant = hex(randomBytes(20));
const { secretKey, publicKey } = slh.keygen(randomBytes(48));
const deadline = String(Math.floor(Date.now() / 1000) + 3600);

const [vaultW, dSmall, dBig] = words(callHarness("prepare(address,address,address,uint64)", net.identity, agent, merchant, deadline));
const vault = "0x" + vaultW.slice(24);
const ecdsaSmall = cast("wallet", "sign", "--no-hash", "--private-key", agentPk, "0x" + dSmall);
const ecdsaBig = cast("wallet", "sign", "--no-hash", "--private-key", agentPk, "0x" + dBig);
const t0 = performance.now();
const slhBig = hex(slh.sign(Buffer.from(dBig, "hex"), secretKey));
const slhSignMs = performance.now() - t0;

const input = [net.identity, agentId, agent, hex(publicKey), merchant, deadline, ecdsaSmall, ecdsaBig, slhBig];
const raw = callHarness(
  "run((address,uint256,address,bytes32,address,uint64,bytes,bytes,bytes))",
  `(${input.join(",")})`,
);
const w = words(raw);
const n = (i) => BigInt("0x" + w[i]);
const result = {
  network: netName,
  vault: "0x" + w[0].slice(24),
  vaultBalanceAfterNativeDeposit: n(1),
  merchantDelta: n(2),
  gasClassicalSpend: n(3),
  gasPqSpend: n(4),
  pqMissingRejected: n(5) === 1n,
  pqTamperedRejected: n(6) === 1n,
  pqValidAccepted: n(7) === 1n,
  finalNonce: n(8),
  slhSignMs: Math.round(slhSignMs),
};

const checks = [
  ["vault address stable between prepare and run", result.vault.toLowerCase() === vault.toLowerCase()],
  ["native 100 USDC deposit visible as 100e6 on ERC-20 interface", result.vaultBalanceAfterNativeDeposit === 100_000_000n],
  ["PQ-required spend without SLH-DSA rejected", result.pqMissingRejected],
  ["PQ spend with tampered SLH-DSA rejected", result.pqTamperedRejected],
  ["PQ spend with valid SLH-DSA accepted", result.pqValidAccepted],
  ["merchant received 1 + 10 USDC", result.merchantDelta === 11_000_000n],
  ["nonce advanced to 2", result.finalNonce === 2n],
];
console.log(JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
