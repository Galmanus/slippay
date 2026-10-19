// An agent pays from its AgentVault through the Slippay relayer — the production path.
//
// Signs the spend with the agent key (EIP-712, the vault's current nonce) and POSTs it to
// /v1/arc/:network/spend WITHOUT an attestation: the relayer asks the Slippay integrity attester,
// which checks the agent's committed surface and asks A-Identity about the recipient, then the
// vault verifies everything on-chain. Prints the relayer's answer and the balances that moved.
//
// usage (Node >= 22.18):
//   node packages/arc-agent/scripts/arc-pay.mjs --network mainnet --vault 0x… --to 0x… --amount 0.10 \
//     --agent-key-file ~/.slippay/arc-mainnet-agent.key [--relayer https://api.slippay.cc/api/v1/arc]
// Exit 0 when the payment settled, 1 when it was refused (the refusal is printed), 2 on usage errors.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { createPublicClient, defineChain, formatUnits, http, parseAbi, parseUnits, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { agentVaultAbi } from "../src/abi.ts";
import { ARC_NETWORKS, ARC_USDC } from "../src/constants.ts";
import { signSpend } from "../src/intent.ts";

const { values: opt } = parseArgs({
  options: {
    network: { type: "string" },
    vault: { type: "string" },
    to: { type: "string" },
    amount: { type: "string" },
    "agent-key-file": { type: "string" },
    relayer: { type: "string", default: "https://api.slippay.cc/api/v1/arc" },
    "order-label": { type: "string" },
  },
});
const network = opt.network;
if ((network !== "mainnet" && network !== "testnet") || !opt.vault || !opt.to || !opt.amount || !opt["agent-key-file"]) {
  console.error("usage: arc-pay.mjs --network mainnet|testnet --vault 0x… --to 0x… --amount <USDC> --agent-key-file f [--relayer url]");
  process.exit(2);
}
const NET = ARC_NETWORKS[network];
const chain = defineChain({
  id: NET.chainId, name: network === "mainnet" ? "Arc" : "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [NET.rpcUrl] } },
});
const pub = createPublicClient({ chain, transport: http(NET.rpcUrl) });
let key = readFileSync(opt["agent-key-file"].replace(/^~/, process.env.HOME ?? "~"), "utf8").trim();
if (!key.startsWith("0x")) key = "0x" + key;
const agent = privateKeyToAccount(key);
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const bal = async (a) => formatUnits(await pub.readContract({ address: ARC_USDC, abi: erc20, functionName: "balanceOf", args: [a] }), 6);

const session = await pub.readContract({ address: opt.vault, abi: agentVaultAbi, functionName: "getSession", args: [agent.address] });
const intent = {
  agentSigner: agent.address, to: opt.to, amount: parseUnits(opt.amount, 6), nonce: session.nonce,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 300), orderId: toHex(randomBytes(32)),
};
const sig = await signSpend({ account: agent, vault: opt.vault, chainId: NET.chainId, intent, pqThreshold: session.pqThreshold });
const before = { vault: await bal(opt.vault), to: await bal(opt.to) };

const res = await fetch(`${opt.relayer.replace(/\/$/, "")}/${network}/spend`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    vault: opt.vault, agentSigner: agent.address, to: opt.to, amount: intent.amount.toString(),
    deadline: intent.deadline.toString(), orderId: intent.orderId, ecdsaSig: sig.ecdsaSig, slhSig: sig.slhSig,
  }),
});
const body = await res.json().catch(() => ({}));
const after = { vault: await bal(opt.vault), to: await bal(opt.to) };
console.log(JSON.stringify({
  label: opt["order-label"] ?? null, agent: agent.address, to: opt.to, amount: opt.amount, http: res.status, relayer: body,
  vaultUsdc: `${before.vault} -> ${after.vault}`, recipientUsdc: `${before.to} -> ${after.to}`,
}, null, 2));
process.exit(res.ok && body.status === "success" ? 0 : 1);
