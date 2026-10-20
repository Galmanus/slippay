// Stand up one AgentVault on Arc MAINNET for the Slippay pilot: deploy, register the agent in
// ERC-8004, fund the vault, install a session gated by the production integrity attester.
//
// The session is deliberately small (the vault is unaudited): per-payment and per-day caps in
// cents, one allowed recipient, 30-day expiry, attestThreshold 0 so EVERY spend needs the
// attester (which runs the A-Identity counterparty check), no post-quantum leg (pqThreshold max).
// Each step is simulated before it is sent; any revert stops the run. Prints a JSON summary.
//
// usage (Node >= 22.18, run from the repo root, after `forge build` in contracts-evm):
//   node packages/arc-agent/scripts/arc-mainnet-setup.mjs --yes-mainnet \
//     --owner-key-file ~/.slippay/arc-mainnet-deployer.key --agent-key-file ~/.slippay/arc-mainnet-agent.key \
//     --merchant 0x… --attester-x 0x… --attester-y 0x… \
//     [--fund 0.40] [--per-tx 0.20] [--window 0.30] [--max-abs 1] [--allow 0x…,0x…]
//   Add a session to a vault that already exists (no deploy, no ERC-8004 register, no funding):
//     … --vault 0x… --agent-id N [--allow merchant,float]
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, decodeEventLog, defineChain, formatUnits, http, parseAbi, parseUnits, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { agentVaultAbi } from "../src/abi.ts";
import { ARC_MIN_MAX_FEE_PER_GAS, ARC_NETWORKS, ARC_USDC } from "../src/constants.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const { values: opt } = parseArgs({
  options: {
    "yes-mainnet": { type: "boolean" },
    "owner-key-file": { type: "string" },
    "agent-key-file": { type: "string" },
    merchant: { type: "string" },
    "attester-x": { type: "string" },
    "attester-y": { type: "string" },
    fund: { type: "string", default: "0.40" },
    "per-tx": { type: "string", default: "0.20" },
    window: { type: "string", default: "0.30" },
    "max-abs": { type: "string", default: "1" },
    vault: { type: "string" },
    "agent-id": { type: "string" },
    allow: { type: "string" },
  },
});
if (!opt["yes-mainnet"]) {
  console.error("refusing to run without --yes-mainnet (deploys a contract and moves real USDC)");
  process.exit(2);
}
const hex32 = /^0x[0-9a-fA-F]{64}$/;
const addr = /^0x[0-9a-fA-F]{40}$/;
for (const [k, re] of [["merchant", addr], ["attester-x", hex32], ["attester-y", hex32]]) {
  if (!re.test(opt[k] ?? "")) throw new Error(`--${k} missing or malformed`);
}
const allowRecipients = opt.allow ? opt.allow.split(",").map((a) => a.trim()) : [opt.merchant];
if (!allowRecipients.every((a) => addr.test(a))) throw new Error("--allow must be comma-separated addresses");
if (opt.vault && (!addr.test(opt.vault) || !/^\d+$/.test(opt["agent-id"] ?? ""))) throw new Error("--vault needs a valid address and --agent-id N");
const readKey = (f) => {
  const k = readFileSync(f.replace(/^~/, process.env.HOME ?? "~"), "utf8").trim();
  return k.startsWith("0x") ? k : "0x" + k;
};
const owner = privateKeyToAccount(readKey(opt["owner-key-file"]));
const agent = privateKeyToAccount(readKey(opt["agent-key-file"]));

const NET = ARC_NETWORKS.mainnet;
const chain = defineChain({
  id: NET.chainId, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [NET.rpcUrl] } },
});
const pub = createPublicClient({ chain, transport: http(NET.rpcUrl) });
const wallet = createWalletClient({ chain, account: owner, transport: http(NET.rpcUrl) });
if ((await pub.getChainId()) !== NET.chainId) throw new Error("RPC is not Arc mainnet");
const GWEI = 1_000_000_000n;
const fees = { maxFeePerGas: 25n * GWEI, maxPriorityFeePerGas: 1n * GWEI };
if (fees.maxFeePerGas < ARC_MIN_MAX_FEE_PER_GAS) throw new Error("fee below Arc floor");
const usdc6 = (s) => parseUnits(s, 6);

async function mined(hash, label) {
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  const cost = formatUnits(r.gasUsed * r.effectiveGasPrice, 18);
  console.error(`${label}: ${r.status} · gas ${r.gasUsed} · ${cost} USDC · ${NET.explorer}/tx/${hash}`);
  if (r.status !== "success") throw new Error(`${label} reverted`);
  return r;
}

console.error(`owner ${owner.address} · ${formatUnits(await pub.getBalance({ address: owner.address }), 18)} USDC · agent ${agent.address}`);

let vault, agentId, deployHash, fundHash;
if (opt.vault) {
  vault = opt.vault;
  agentId = BigInt(opt["agent-id"]);
  const vaultOwner = await pub.readContract({ address: vault, abi: agentVaultAbi, functionName: "owner" });
  if (vaultOwner.toLowerCase() !== owner.address.toLowerCase()) throw new Error(`vault owner is ${vaultOwner}, not ${owner.address}`);
  console.error(`existing vault ${vault} · agentId ${agentId} · installing a session only`);
} else {
// 1. deploy (owner = funded key; absolute per-tx ceiling baked in as an immutable)
const artifact = JSON.parse(readFileSync(`${ROOT}/contracts-evm/out/AgentVault.sol/AgentVault.json`, "utf8"));
const deployArgs = [owner.address, ARC_USDC, NET.identityRegistry, usdc6(opt["max-abs"])];
deployHash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: deployArgs, ...fees });
vault = (await mined(deployHash, "deploy AgentVault")).contractAddress;

// 2. ERC-8004 identity for the agent
const identityAbi = parseAbi([
  "function register(string tokenURI) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
const regArgs = { address: NET.identityRegistry, abi: identityAbi, functionName: "register", args: ["https://slippay.cc/agents/arc-mainnet-pilot.json"] };
await pub.simulateContract({ account: owner, ...regArgs });
const regReceipt = await mined(await wallet.writeContract({ ...regArgs, ...fees }), "ERC-8004 register");
agentId = regReceipt.logs
  .filter((l) => l.address.toLowerCase() === NET.identityRegistry.toLowerCase())
  .map((l) => { try { return decodeEventLog({ abi: identityAbi, ...l }); } catch { return null; } })
  .find((e) => e?.eventName === "Transfer").args.tokenId;

// 3. fund the vault (Arc: native and ERC-20 USDC are one balance)
fundHash = await wallet.sendTransaction({ to: vault, value: parseUnits(opt.fund, 18), ...fees });
await mined(fundHash, `fund vault ${opt.fund} USDC`);
}

// 4. session gated by the production attester on every spend
const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400);
const session = {
  agentId, slhVk: `0x${"00".repeat(32)}`, perTxCap: usdc6(opt["per-tx"]), windowCap: usdc6(opt.window),
  windowSeconds: 86_400n, expiresAt, pqThreshold: (1n << 128n) - 1n, policyHash: toHex(randomBytes(32)),
  allowRecipients, attesterX: opt["attester-x"], attesterY: opt["attester-y"], attestThreshold: 0n,
};
const sessArgs = { address: vault, abi: agentVaultAbi, functionName: "installSession", args: [agent.address, session] };
await pub.simulateContract({ account: owner, ...sessArgs });
await mined(await wallet.writeContract({ ...sessArgs, ...fees }), "install session");

const vaultBal = await pub.readContract({ address: ARC_USDC, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [vault] });
console.log(JSON.stringify({
  network: "mainnet", chainId: NET.chainId, vault, owner: owner.address, agentSigner: agent.address, agentId: agentId.toString(),
  merchant: opt.merchant, allowRecipients, vaultUsdc: formatUnits(vaultBal, 6), perTxCap: opt["per-tx"], windowCap: opt.window,
  expiresAt: expiresAt.toString(), attestThreshold: "0", deployTx: deployHash, fundTx: fundHash,
}, null, 2));
