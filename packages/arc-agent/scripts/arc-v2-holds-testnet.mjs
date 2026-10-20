// Exercise AgentVaultV2 pay-on-delivery holds on Arc TESTNET, end to end, with real transactions:
// register an ERC-8004 identity for a fresh agent, fund the vault, install an attester-gated
// session, then run the three ways a hold can end and the refusals around them:
//
//   hold A -> released by the agent's signature (+ attestation), relayed by a stranger -> payee paid
//   hold B -> refunded early by the payee (waiving is always allowed)
//   hold C -> refunded by a stranger once releaseBy has passed
//   refused (eth_call): owner withdrawing held funds, a forged release signature, a release with
//   no attestation, an early refund by the owner, a second release, a hold longer than 30 days.
//
// The agent, payee and stranger keys are throwaway and live only in this process. With
// --attester-url the hold and release attestations come from a running slippay-attester
// (/arc/attest-hold, /arc/attest-release): the script registers the agent's surface there and
// pins the attester's P-256 key in the session. Without it, a throwaway local P-256 key stands in.
// Each transaction is simulated before it is sent; any unexpected outcome stops the run. Prints
// a JSON summary on stdout.
//
// usage (Node >= 22.18, run from the repo root, after `forge build` in contracts-evm):
//   node packages/arc-agent/scripts/arc-v2-holds-testnet.mjs \
//     --owner-key-file ~/.slippay/arc-testnet-deployer.key --vault 0x… [--agent-id N] [--fund 0.20] \
//     [--attester-url http://127.0.0.1:8790]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, decodeEventLog, defineChain,
  formatUnits, hashTypedData, http, keccak256, parseAbi, parseUnits, toHex, encodePacked,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ARC_MIN_MAX_FEE_PER_GAS, ARC_NETWORKS, ARC_USDC } from "../src/constants.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// The same P-256 implementation the production attester signs with.
const { p256 } = createRequire(`${ROOT}/packages/slippay-attester/src/arc.mjs`)("@noble/curves/p256");

const { values: opt } = parseArgs({
  options: {
    "owner-key-file": { type: "string" },
    vault: { type: "string" },
    "agent-id": { type: "string" },
    fund: { type: "string", default: "0.20" },
    "attester-url": { type: "string" },
  },
});
const addr = /^0x[0-9a-fA-F]{40}$/;
if (!addr.test(opt.vault ?? "")) throw new Error("--vault missing or malformed");
if (opt["agent-id"] && !/^\d+$/.test(opt["agent-id"])) throw new Error("--agent-id must be an integer");
const readKey = (f) => {
  const k = readFileSync(f.replace(/^~/, process.env.HOME ?? "~"), "utf8").trim();
  return k.startsWith("0x") ? k : "0x" + k;
};
const owner = privateKeyToAccount(readKey(opt["owner-key-file"]));
const agent = privateKeyToAccount(generatePrivateKey());
const payeeKey = generatePrivateKey();
const payee = privateKeyToAccount(payeeKey);
const stranger = privateKeyToAccount(generatePrivateKey());

const NET = ARC_NETWORKS.testnet;
const chain = defineChain({
  id: NET.chainId, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [NET.rpcUrl] } },
});
const pub = createPublicClient({ chain, transport: http(NET.rpcUrl) });
const walletOf = (account) => createWalletClient({ chain, account, transport: http(NET.rpcUrl) });
if ((await pub.getChainId()) !== NET.chainId) throw new Error("RPC is not Arc testnet");
const GWEI = 1_000_000_000n;
const fees = { maxFeePerGas: 25n * GWEI, maxPriorityFeePerGas: 1n * GWEI };
if (fees.maxFeePerGas < ARC_MIN_MAX_FEE_PER_GAS) throw new Error("fee below Arc floor");
const usdc6 = (s) => parseUnits(s, 6);

const vault = opt.vault;
const { abi } = JSON.parse(readFileSync(`${ROOT}/contracts-evm/out/AgentVaultV2.sol/AgentVaultV2.json`, "utf8"));
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const read = (functionName, args = []) => pub.readContract({ address: vault, abi, functionName, args });
const usdcOf = (a) => pub.readContract({ address: ARC_USDC, abi: erc20, functionName: "balanceOf", args: [a] });
const txs = {};

async function mined(hash, label) {
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
  const cost = formatUnits(r.gasUsed * r.effectiveGasPrice, 18);
  console.error(`${label}: ${r.status} · gas ${r.gasUsed} · ${cost} USDC · ${NET.explorer}/tx/${hash}`);
  if (r.status !== "success") throw new Error(`${label} reverted`);
  txs[label] = { hash, block: r.blockNumber.toString() };
  return r;
}
/** Simulate, then send, from `account`. */
async function send(account, functionName, args, label) {
  const call = { address: vault, abi, functionName, args };
  await pub.simulateContract({ account, ...call });
  return mined(await walletOf(account).writeContract({ ...call, ...fees }), label);
}
/** eth_call that must revert with exactly `errorName`. */
const refusals = {};
async function expectRevert(account, functionName, args, errorName, label) {
  try {
    await pub.simulateContract({ account, address: vault, abi, functionName, args });
  } catch (e) {
    const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    const got = rev?.data?.errorName;
    if (got !== errorName) throw new Error(`${label}: expected ${errorName}, got ${got ?? e.shortMessage ?? e}`);
    console.error(`refused · ${label} · ${got}`);
    refusals[label] = got;
    return;
  }
  throw new Error(`${label}: expected ${errorName}, but the call would succeed`);
}

const vaultOwner = await read("owner");
if (vaultOwner.toLowerCase() !== owner.address.toLowerCase()) throw new Error(`vault owner is ${vaultOwner}, not ${owner.address}`);
console.error(`owner ${owner.address} · ${formatUnits(await pub.getBalance({ address: owner.address }), 18)} USDC`);
console.error(`agent ${agent.address} · payee ${payee.address} · stranger ${stranger.address}`);

// 1. ERC-8004 identity for the agent (owned by the vault owner, as on mainnet)
let agentId;
if (opt["agent-id"]) {
  agentId = BigInt(opt["agent-id"]);
} else {
  const identityAbi = parseAbi([
    "function register(string tokenURI) returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ]);
  const card = { name: "Slippay AgentVaultV2 holds test agent", description: "Arc testnet agent that exercises AgentVaultV2 pay-on-delivery holds." };
  const tokenURI = `data:application/json;base64,${Buffer.from(JSON.stringify(card)).toString("base64")}`;
  const regArgs = { address: NET.identityRegistry, abi: identityAbi, functionName: "register", args: [tokenURI] };
  await pub.simulateContract({ account: owner, ...regArgs });
  const r = await mined(await walletOf(owner).writeContract({ ...regArgs, ...fees }), "ERC-8004 register");
  agentId = r.logs
    .filter((l) => l.address.toLowerCase() === NET.identityRegistry.toLowerCase())
    .map((l) => { try { return decodeEventLog({ abi: identityAbi, ...l }); } catch { return null; } })
    .find((e) => e?.eventName === "Transfer").args.tokenId;
}
console.error(`agentId ${agentId}`);

// 2. fund the vault (Arc: native and ERC-20 USDC are one balance); the payee gets gas to refund
await mined(await walletOf(owner).sendTransaction({ to: vault, value: parseUnits(opt.fund, 18), ...fees }), `fund vault ${opt.fund}`);
await mined(await walletOf(owner).sendTransaction({ to: payee.address, value: parseUnits("0.01", 18), ...fees }), "payee gas 0.01");
await mined(await walletOf(owner).sendTransaction({ to: stranger.address, value: parseUnits("0.01", 18), ...fees }), "stranger gas 0.01");

// 3. attester: the running service, or a throwaway local P-256 key
const AIA_DOMAIN = keccak256(toHex("SlippayAIA.arc.v1"));
const attesterAgentId = `v2-holds-${agent.address.toLowerCase()}`;
async function attesterCall(path, payload) {
  const r = await fetch(`${opt["attester-url"]}${path}`, {
    method: payload ? "POST" : "GET", headers: { "content-type": "application/json" },
    body: payload ? JSON.stringify(payload, (_, v) => (typeof v === "bigint" ? v.toString() : v)) : undefined,
  });
  const out = await r.json();
  if (!r.ok || out.ok === false) throw new Error(`attester ${path}: ${r.status} ${out.reason ?? out.error ?? ""}`);
  return out;
}
let attesterKey, signLocal;
if (opt["attester-url"]) {
  attesterKey = (await attesterCall("/pubkey")).p256;
  await attesterCall("/register", { agent_id: attesterAgentId, allowed_recipients: [payee.address.toLowerCase()], max_amount: usdc6("0.10").toString() });
  console.error(`attester ${opt["attester-url"]} · surface ${attesterAgentId} registered`);
} else {
  const priv = p256.utils.randomPrivateKey();
  const pubKey = p256.getPublicKey(priv, false); // 0x04 ‖ x ‖ y
  attesterKey = { x: toHex(pubKey.slice(1, 33)), y: toHex(pubKey.slice(33, 65)) };
  signLocal = (digest) => {
    const h = keccak256(encodePacked(["bytes32", "bytes32"], [AIA_DOMAIN, digest]));
    return "0x" + p256.sign(h.slice(2), priv, { prehash: false, lowS: true }).toCompactHex();
  };
}
/** Attestation for a hold (kind "hold") or for its release; the service must land on our digest. */
async function attest(kind, terms, digest) {
  if (signLocal) return signLocal(digest);
  const out = await attesterCall(kind === "hold" ? "/arc/attest-hold" : "/arc/attest-release", { agent_id: attesterAgentId, hold: terms });
  if (out.digest !== digest) throw new Error(`attester ${kind} digest ${out.digest} != vault ${digest}`);
  return out.attestation;
}

// 4. session: 0.10/tx, 0.30/day, payee only, attester on every hold and every agent release
const now = () => BigInt(Math.floor(Date.now() / 1000));
const session = {
  agentId, slhVk: `0x${"00".repeat(32)}`, perTxCap: usdc6("0.10"), windowCap: usdc6("0.30"),
  windowSeconds: 86_400n, expiresAt: now() + 86_400n, pqThreshold: (1n << 128n) - 1n, policyHash: toHex(randomBytes(32)),
  allowRecipients: [payee.address], attesterX: attesterKey.x, attesterY: attesterKey.y,
  attestThreshold: 0n,
};
await send(owner, "installSession", [agent.address, session], "install session");

// signing: the agent signs EIP-712 typed data; each digest is checked against the vault's own view
const domain = { name: "SlippayAgentVault", version: "1", chainId: NET.chainId, verifyingContract: vault };
const holdTerms = new Map(); // holdId -> the terms the attester recomputes it from
async function makeHold(amount, releaseBy, label) {
  const { nonce } = await read("getSession", [agent.address]);
  const deadline = now() + 300n;
  const orderId = toHex(randomBytes(32));
  const message = { agentSigner: agent.address, payee: payee.address, amount, nonce, deadline, releaseBy, orderId };
  const typed = {
    domain, primaryType: "Hold", message,
    types: { Hold: [
      { name: "agentSigner", type: "address" }, { name: "payee", type: "address" }, { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint64" }, { name: "deadline", type: "uint64" }, { name: "releaseBy", type: "uint64" },
      { name: "orderId", type: "bytes32" },
    ] },
  };
  const digest = hashTypedData(typed);
  const onchain = await read("holdDigest", [agent.address, payee.address, amount, nonce, deadline, releaseBy, orderId]);
  if (digest !== onchain) throw new Error(`hold digest mismatch: local ${digest}, vault ${onchain}`);
  const terms = { vault, chainId: NET.chainId, ...message };
  holdTerms.set(digest, terms);
  const req = {
    agentSigner: agent.address, payee: payee.address, amount, deadline, releaseBy, orderId,
    ecdsaSig: await agent.signTypedData(typed), slhSig: "0x", attestation: await attest("hold", terms, digest),
  };
  await send(owner, "hold", [req], label);
  return digest; // holdId
}
async function releaseSigs(holdId, signer = agent) {
  const typed = { domain, primaryType: "Release", message: { holdId }, types: { Release: [{ name: "holdId", type: "bytes32" }] } };
  const d = hashTypedData(typed);
  const onchain = await read("releaseDigest", [holdId]);
  if (d !== onchain) throw new Error(`release digest mismatch: local ${d}, vault ${onchain}`);
  return { ecdsaSig: await signer.signTypedData(typed), attestation: await attest("release", holdTerms.get(holdId), d) };
}
const status = async (holdId) => ["None", "Open", "Released", "Refunded"][(await read("getHold", [holdId])).status];
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

// 5. hold A: 0.05, released by the agent
const a = usdc6("0.05");
const holdA = await makeHold(a, now() + 3_600n, "hold A 0.05");
const bal = await usdcOf(vault);
expect((await read("totalHeld")) === a, "totalHeld after hold A");
expect((await read("freeBalance")) === bal - a, "freeBalance after hold A");
await expectRevert(owner, "withdraw", [owner.address, bal], "InsufficientFreeBalance", "owner withdraws the held funds");
const forged = await releaseSigs(holdA, stranger);
await expectRevert(stranger, "release", [holdA, forged.ecdsaSig, forged.attestation], "BadSignature", "release signed by a stranger");
const sigsA = await releaseSigs(holdA);
await expectRevert(stranger, "release", [holdA, sigsA.ecdsaSig, "0x"], "BadAttestation", "release with no attestation");
await expectRevert(owner, "refund", [holdA], "HoldNotExpired", "owner refunds before releaseBy");
const payeeBefore = await usdcOf(payee.address);
// relayed by the stranger: an owner-sent release skips the agent signature, so it would prove nothing
await send(stranger, "release", [holdA, sigsA.ecdsaSig, sigsA.attestation], "release A (agent-signed)");
expect((await usdcOf(payee.address)) - payeeBefore === a, "payee paid by release A");
expect((await status(holdA)) === "Released", "hold A status");
await expectRevert(owner, "release", [holdA, sigsA.ecdsaSig, sigsA.attestation], "HoldNotOpen", "release A twice");
await expectRevert(owner, "hold", [{
  agentSigner: agent.address, payee: payee.address, amount: 1n, deadline: now() + 300n, releaseBy: now() + 31n * 86_400n,
  orderId: toHex(randomBytes(32)), ecdsaSig: "0x", slhSig: "0x", attestation: "0x",
}], "BadReleaseWindow", "hold longer than 30 days");

// 6. hold B: 0.04, refunded early by the payee
const b = usdc6("0.04");
const holdB = await makeHold(b, now() + 3_600n, "hold B 0.04");
await send(payee, "refund", [holdB], "refund B (payee, early)");
expect((await status(holdB)) === "Refunded", "hold B status");

// 7. hold C: 0.03, refunded by a stranger once releaseBy has passed
const c = usdc6("0.03");
const releaseByC = now() + 45n;
const holdC = await makeHold(c, releaseByC, "hold C 0.03");
await expectRevert(stranger, "refund", [holdC], "HoldNotExpired", "stranger refunds C before releaseBy");
for (;;) {
  const blk = await pub.getBlock();
  if (blk.timestamp >= releaseByC) break;
  await new Promise((r) => setTimeout(r, 3_000));
}
await send(stranger, "refund", [holdC], "refund C (stranger, after releaseBy)");
expect((await status(holdC)) === "Refunded", "hold C status");
expect((await read("totalHeld")) === 0n, "totalHeld back to 0");

const s = await read("getSession", [agent.address]);
console.log(JSON.stringify({
  network: "testnet", chainId: NET.chainId, vault, owner: owner.address, agentSigner: agent.address, agentId: agentId.toString(),
  payee: payee.address, holds: { A: holdA, B: holdB, C: holdC },
  vaultUsdc: formatUnits(await usdcOf(vault), 6), freeBalance: formatUnits(await read("freeBalance"), 6), totalHeld: "0",
  payeeUsdc: formatUnits(await usdcOf(payee.address), 6), windowSpent: formatUnits(s.curSpent, 6), nonce: s.nonce.toString(),
  txs, refusals,
}, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
