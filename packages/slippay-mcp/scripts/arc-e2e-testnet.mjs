// End-to-end AgentVault demo on Arc testnet, from a single funded key.
//
//   1. deploy AgentVault (owner = funded key)        4. install a session (PQ above 1 USDC)
//   2. register the agent in ERC-8004 (agentId)      5. agent pays 0.5 USDC (classical) and
//   3. fund the vault with native USDC                  2 USDC (hybrid ECDSA + SLH-DSA)
//
// Spends go through the same arcPay() the MCP tool uses. Relay: if SLIPPAY_ARC_RELAYER_URL is set,
// intents are POSTed to that Slippay API (e.g. a local `deno run -A supabase/functions/api/index.ts`
// with ARC_TESTNET_RELAYER_KEY/ARC_TESTNET_RELAYER_VAULTS); otherwise the funded key relays them
// in-process with the same rules (simulate first, >= 25 gwei). Prints receipts and full-tx gas.
//
// usage: pnpm --filter @slippay/mcp build && forge build (in contracts-evm) &&
//        ARC_FUNDED_KEY_FILE=~/.slippay/arc-testnet-deployer.key node scripts/arc-e2e-testnet.mjs
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  createPublicClient, createWalletClient, decodeErrorResult, decodeEventLog, formatUnits, http, parseAbi, toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { ARC_NETWORKS, agentVaultAbi, slhKeygen } from "@slippay/arc-agent";
import { arcPay } from "../dist/arc.js";

const NET = ARC_NETWORKS.testnet;
const keyFile = process.env.ARC_FUNDED_KEY_FILE?.replace(/^~/, process.env.HOME ?? "~");
if (!keyFile) throw new Error("set ARC_FUNDED_KEY_FILE to a file holding a funded Arc testnet private key");
const funded = privateKeyToAccount(readFileSync(keyFile, "utf8").trim());
const transport = http(NET.rpcUrl);
const pub = createPublicClient({ chain: arcTestnet, transport });
const wallet = createWalletClient({ chain: arcTestnet, transport, account: funded });
const GWEI = 1_000_000_000n;
const fees = { maxFeePerGas: 25n * GWEI, maxPriorityFeePerGas: 1n * GWEI }; // Arc floor is 20 gwei
const explorer = (h) => `${NET.explorer}/tx/${h}`;
const usdc = (wei18) => formatUnits(wei18, 18);

async function mined(hash, label) {
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 30_000 });
  const cost = r.gasUsed * r.effectiveGasPrice;
  console.log(`${label}: ${r.status} · block ${r.blockNumber} · gas ${r.gasUsed} · cost ${usdc(cost)} USDC · ${explorer(hash)}`);
  if (r.status !== "success") throw new Error(`${label} reverted`);
  return r;
}

const balance = await pub.getBalance({ address: funded.address });
console.log(`funded key ${funded.address} · balance ${usdc(balance)} USDC`);
if (balance < 8n * 10n ** 18n) throw new Error("need >= 8 testnet USDC (5 to the vault + gas) — faucet.circle.com, Arc Testnet");

// 1. deploy
const artifact = JSON.parse(readFileSync(new URL("../../../contracts-evm/out/AgentVault.sol/AgentVault.json", import.meta.url), "utf8"));
const deployHash = await wallet.deployContract({
  abi: artifact.abi, // full artifact ABI: the SDK's agentVaultAbi omits the constructor
  bytecode: artifact.bytecode.object,
  args: [funded.address, "0x3600000000000000000000000000000000000000", NET.identityRegistry, 100_000_000n],
  ...fees,
});
const vault = (await mined(deployHash, "deploy AgentVault")).contractAddress;
console.log(`vault ${vault}`);

// 2. ERC-8004 identity for the agent
const identityAbi = parseAbi([
  "function register(string tokenURI) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
const regHash = await wallet.writeContract({
  address: NET.identityRegistry, abi: identityAbi, functionName: "register",
  args: ["https://slippay.cc/agents/arc-e2e.json"], ...fees,
});
const regReceipt = await mined(regHash, "ERC-8004 register");
const agentId = regReceipt.logs
  .filter((l) => l.address.toLowerCase() === NET.identityRegistry.toLowerCase())
  .map((l) => { try { return decodeEventLog({ abi: identityAbi, ...l }); } catch { return null; } })
  .find((e) => e?.eventName === "Transfer").args.tokenId;
console.log(`agentId ${agentId}`);

// 3. fund the vault with a plain native send (Arc: native and ERC-20 USDC are one balance)
await mined(await wallet.sendTransaction({ to: vault, value: 5n * 10n ** 18n, ...fees }), "fund vault 5 USDC");

// 4. session: agent ECDSA key + SLH-DSA key, PQ above 1 USDC
const agent = privateKeyToAccount(generatePrivateKey());
const slh = slhKeygen(randomBytes(48));
const merchant = toHex(randomBytes(20));
await mined(
  await wallet.writeContract({
    address: vault, abi: agentVaultAbi, functionName: "installSession",
    args: [agent.address, {
      agentId, slhVk: slh.publicKey, perTxCap: 2_000_000n, windowCap: 4_000_000n, windowSeconds: 86_400n,
      expiresAt: 0n, pqThreshold: 1_000_000n, policyHash: toHex(randomBytes(32)), allowRecipients: [merchant],
      // integrity-attester gate off for this demo (threshold = max); see AgentVault.attestThreshold
      attesterX: `0x${"00".repeat(32)}`, attesterY: `0x${"00".repeat(32)}`, attestThreshold: (1n << 128n) - 1n,
    }],
    ...fees,
  }),
  "install session",
);

// 5. pay through arcPay (same code path as the MCP tool)
const relayerUrl = process.env.SLIPPAY_ARC_RELAYER_URL?.replace(/\/$/, "");
const deps = {
  readSession: async (v, a) => {
    const s = await pub.readContract({ address: v, abi: agentVaultAbi, functionName: "getSession", args: [a] });
    return { ...s };
  },
  isAllowed: (v, a, to) => pub.readContract({ address: v, abi: agentVaultAbi, functionName: "isAllowedRecipient", args: [a, to] }),
  now: () => Math.floor(Date.now() / 1000),
  relay: async (body) => {
    if (relayerUrl) {
      const r = await fetch(`${relayerUrl}/testnet/spend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(`relayer ${r.status}: ${JSON.stringify(j)}`);
      return j;
    }
    const data = (await import("@slippay/arc-agent")).encodeSpendCall(
      { ...body, amount: BigInt(body.amount), deadline: BigInt(body.deadline), nonce: 0n },
      { ecdsaSig: body.ecdsaSig, slhSig: body.slhSig },
    );
    await pub.call({ account: funded.address, to: body.vault, data }); // simulate first, like the API relayer
    const hash = await wallet.sendTransaction({ to: body.vault, data, ...fees });
    await mined(hash, "  relay");
    return { txHash: hash, status: "success", explorerUrl: explorer(hash) };
  },
};
const cfg = { vault, chainId: NET.chainId, account: agent, slhSecretKey: slh.secretKey };
console.log("agent pays 0.5 USDC (classical):", await arcPay(deps, cfg, { to: merchant, amount: "0.5", orderId: "e2e-small" }));
console.log("agent pays 2 USDC (hybrid PQ):", await arcPay(deps, cfg, { to: merchant, amount: "2", orderId: "e2e-big" }));
const merchantBal = await pub.readContract({
  address: "0x3600000000000000000000000000000000000000", abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
  functionName: "balanceOf", args: [merchant],
});
console.log(`merchant ${merchant} received ${formatUnits(merchantBal, 6)} USDC (expected 2.5)`);

// 6. the agent misbehaves: each attempt is SIGNED by the agent and sent straight to the vault
//    (bypassing arcPay's own pre-sign refusals), so the refusal shown is the on-chain one.
const { signSpend, encodeSpendCall } = await import("@slippay/arc-agent");
const vaultErrors = artifact.abi.filter((x) => x.type === "error");
async function attempt(label, to, amount, nonceOffset = 0n) {
  const s = await pub.readContract({ address: vault, abi: agentVaultAbi, functionName: "getSession", args: [agent.address] });
  const intent = {
    agentSigner: agent.address, to, amount, nonce: s.nonce + nonceOffset,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 600), orderId: toHex(randomBytes(32)),
  };
  const sig = await signSpend({ account: agent, vault, chainId: NET.chainId, intent, pqThreshold: s.pqThreshold, slhSecretKey: slh.secretKey });
  const data = encodeSpendCall(intent, { ecdsaSig: sig.ecdsaSig, slhSig: sig.slhSig });
  try {
    await pub.call({ account: funded.address, to: vault, data });
    console.log(`  ${label}: ACCEPTED (unexpected)`);
  } catch (e) {
    const raw = e?.cause?.data ?? e?.data ?? e?.walk?.()?.data;
    let name = "reverted";
    try { name = decodeErrorResult({ abi: vaultErrors, data: raw }).errorName; } catch { /* keep generic */ }
    console.log(`  ${label}: REFUSED on-chain → ${name}`);
  }
}
console.log("agent misbehaves (signed, sent directly to the vault):");
await attempt("pay 3 USDC (per-payment cap is 2)", merchant, 3_000_000n);
await attempt("pay 0.1 USDC to an address you never approved", toHex(randomBytes(20)), 100_000n);
await attempt("replay an already-used order (stale nonce)", merchant, 100_000n, -1n);
await attempt("pay 1.6 USDC (would push today's total past the 4 USDC window)", merchant, 1_600_000n);
