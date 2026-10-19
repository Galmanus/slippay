// Fund a Circle Gateway balance on Arc so an EOA can pay x402 nanopayments (A-Identity
// counterparty checks, see packages/slippay-attester/src/counterparty.mjs).
//
// approve(GatewayWallet, amount) if the allowance is short, then GatewayWallet.deposit(USDC, amount),
// then polls the Gateway API until the balance shows. Nanopayments debit this balance off-chain;
// getting USDC back out of Gateway takes a 7-day withdrawal, so deposit only what the pilot needs.
//
// usage (Node >= 22.18):
//   ARC_PAYER_KEY_FILE=~/.slippay/arc-testnet-deployer.key \
//     node packages/arc-agent/scripts/gateway-deposit.mjs --network testnet --amount 1
//   --network mainnet also needs --yes-mainnet (real USDC). --check prints balances and exits.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createPublicClient, createWalletClient, defineChain, formatUnits, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MIN_MAX_FEE_PER_GAS, ARC_NETWORKS, ARC_USDC } from "../src/constants.ts";

const GATEWAY = {
  mainnet: { wallet: "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE", api: "https://gateway-api.circle.com/v1" },
  testnet: { wallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", api: "https://gateway-api-testnet.circle.com/v1" },
};
const ARC_GATEWAY_DOMAIN = 26;
const GWEI = 1_000_000_000n;
const fees = { maxFeePerGas: 25n * GWEI, maxPriorityFeePerGas: 1n * GWEI };
if (fees.maxFeePerGas < ARC_MIN_MAX_FEE_PER_GAS) throw new Error("fee below Arc floor");

const { values: opt } = parseArgs({
  options: {
    network: { type: "string" },
    amount: { type: "string" },
    "key-file": { type: "string" },
    rpc: { type: "string" },
    check: { type: "boolean" },
    "yes-mainnet": { type: "boolean" },
  },
});
const network = opt.network;
if (network !== "mainnet" && network !== "testnet") {
  console.error("usage: gateway-deposit.mjs --network testnet|mainnet (--amount <USDC> | --check) [--key-file f] [--rpc url] [--yes-mainnet]");
  process.exit(2);
}
if (network === "mainnet" && !opt.check && !opt["yes-mainnet"]) {
  console.error("refusing a mainnet deposit without --yes-mainnet (this moves real USDC)");
  process.exit(2);
}
const keyFile = (opt["key-file"] ?? process.env.ARC_PAYER_KEY_FILE)?.replace(/^~/, process.env.HOME ?? "~");
if (!keyFile) throw new Error("set --key-file or ARC_PAYER_KEY_FILE to a file holding the payer's private key");
let key = readFileSync(keyFile, "utf8").trim();
if (!key.startsWith("0x")) key = "0x" + key;
const account = privateKeyToAccount(key);

const NET = ARC_NETWORKS[network];
const G = GATEWAY[network];
const rpc = opt.rpc ?? process.env.ARC_RPC_URL ?? NET.rpcUrl;
const chain = defineChain({
  id: NET.chainId,
  name: network === "mainnet" ? "Arc" : "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const pub = createPublicClient({ chain, transport: http(rpc) });
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const gatewayAbi = parseAbi(["function deposit(address token, uint256 value)"]);

const remoteChainId = await pub.getChainId();
if (remoteChainId !== NET.chainId) throw new Error(`RPC ${rpc} is chain ${remoteChainId}, expected ${NET.chainId} (${network})`);

async function gatewayBalance() {
  const r = await fetch(`${G.api}/balances`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources: [{ depositor: account.address, domain: ARC_GATEWAY_DOMAIN }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Gateway API ${r.status}: ${JSON.stringify(j)}`);
  return j.balances?.[0]?.balance ?? "0";
}

const onchain = await pub.readContract({ address: ARC_USDC, abi: erc20, functionName: "balanceOf", args: [account.address] });
const before = await gatewayBalance();
console.log(`${network} · payer ${account.address}`);
console.log(`  wallet USDC  ${formatUnits(onchain, 6)}`);
console.log(`  Gateway USDC ${before}`);
if (opt.check) process.exit(0);

if (!opt.amount) throw new Error("--amount <USDC> required");
const amount = parseUnits(opt.amount, 6);
if (amount <= 0n) throw new Error("amount must be positive");
// USDC is also Arc's gas token: keep a margin so approve + deposit can still pay for gas.
if (amount + parseUnits("0.05", 6) > onchain) throw new Error(`wallet holds ${formatUnits(onchain, 6)} USDC, not enough for ${opt.amount} + gas`);

const allowance = await pub.readContract({ address: ARC_USDC, abi: erc20, functionName: "allowance", args: [account.address, G.wallet] });
if (allowance < amount) {
  const hash = await wallet.writeContract({ address: ARC_USDC, abi: erc20, functionName: "approve", args: [G.wallet, amount], ...fees });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`approve reverted: ${hash}`);
  console.log(`  approve  ${NET.explorer}/tx/${hash}`);
}
await pub.simulateContract({ account, address: G.wallet, abi: gatewayAbi, functionName: "deposit", args: [ARC_USDC, amount] });
const hash = await wallet.writeContract({ address: G.wallet, abi: gatewayAbi, functionName: "deposit", args: [ARC_USDC, amount], ...fees });
const r = await pub.waitForTransactionReceipt({ hash });
if (r.status !== "success") throw new Error(`deposit reverted: ${hash}`);
console.log(`  deposit  ${NET.explorer}/tx/${hash}`);

for (let i = 0; i < 30; i++) {
  const now = await gatewayBalance();
  if (now !== before) {
    console.log(`  Gateway USDC ${before} -> ${now}`);
    process.exit(0);
  }
  await new Promise((res) => setTimeout(res, 4_000));
}
console.log("  deposit mined; Gateway API has not credited it yet (check again with --check)");
