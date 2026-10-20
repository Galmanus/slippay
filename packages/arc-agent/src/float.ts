// The x402 float: how an AgentVault pays Circle Gateway nanopayments.
//
// Gateway needs an EOA signature, the vault is a contract. So the session allowlists one float
// EOA; when its Gateway balance can't cover a call, the vault tops the float up with an ordinary
// agent spend (attested, inside perTxCap and the window cap), and the float deposits into the
// Gateway Wallet. Exposure stays where the vault puts it: a compromised float can lose at most
// what the window let through, and Gateway deposits only leave via Gateway's 7-day withdrawal.
import {
  createPublicClient, createWalletClient, defineChain, http, parseAbi, parseUnits,
  type LocalAccount,
} from "viem";
import { ARC_GATEWAY, ARC_GATEWAY_DOMAIN, ARC_MIN_MAX_FEE_PER_GAS, ARC_NETWORKS, ARC_USDC, type ArcNetwork } from "./constants.ts";

/** Balances in 6-decimal USDC units; tx results are hashes. */
export type FloatDeps = {
  gatewayBalance(): Promise<bigint>;
  walletBalance(): Promise<bigint>;
  topUpFromVault(amount: bigint): Promise<string>;
  deposit(amount: bigint): Promise<string>;
  sleep(ms: number): Promise<void>;
};

export type FloatFunding = { topUpTx?: string; depositTx?: string; gatewayBefore: bigint; gatewayAfter: bigint };

/**
 * Make the float's Gateway balance cover `need`. Deposits at least `topUp` at a time so the next
 * calls are free; tops up from the vault only when the float wallet can't cover the deposit plus
 * `gasReserve`; deposits once and then waits for Gateway to credit it (never deposits twice).
 */
export async function ensureGatewayFloat(
  need: bigint,
  d: FloatDeps,
  o: { topUp: bigint; gasReserve: bigint; pollMs?: number; maxPolls?: number },
): Promise<FloatFunding> {
  const gatewayBefore = await d.gatewayBalance();
  if (gatewayBefore >= need) return { gatewayBefore, gatewayAfter: gatewayBefore };

  const deficit = need - gatewayBefore > o.topUp ? need - gatewayBefore : o.topUp;
  const wallet = await d.walletBalance();
  let topUpTx: string | undefined;
  if (wallet < deficit + o.gasReserve) {
    const short = deficit + o.gasReserve - wallet;
    topUpTx = await d.topUpFromVault(short > o.topUp ? short : o.topUp);
  }
  const depositTx = await d.deposit(deficit);

  for (let i = 0; i < (o.maxPolls ?? 45); i++) {
    const g = await d.gatewayBalance();
    if (g >= need) return { topUpTx, depositTx, gatewayBefore, gatewayAfter: g };
    await d.sleep(o.pollMs ?? 4_000);
  }
  throw new Error(`deposit ${depositTx} mined; Gateway has not credited it yet (try again shortly)`);
}

const erc20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const gatewayAbi = parseAbi(["function deposit(address token, uint256 value)"]);
const GWEI = 1_000_000_000n;

/** FloatDeps against the live chain and Gateway API (same sequence as scripts/gateway-deposit.mjs). */
export function liveFloatDeps(p: {
  network: ArcNetwork;
  floatAccount: LocalAccount;
  rpcUrl?: string;
  topUpFromVault: (amount: bigint) => Promise<string>;
}): FloatDeps {
  const net = ARC_NETWORKS[p.network];
  const gw = ARC_GATEWAY[p.network];
  const rpc = p.rpcUrl ?? net.rpcUrl;
  const chain = defineChain({
    id: net.chainId, name: p.network === "mainnet" ? "Arc" : "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } },
  });
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({ chain, account: p.floatAccount, transport: http(rpc) });
  const fees = { maxFeePerGas: 25n * GWEI, maxPriorityFeePerGas: 1n * GWEI };
  if (fees.maxFeePerGas < ARC_MIN_MAX_FEE_PER_GAS) throw new Error("fee below Arc floor");
  const mined = async (hash: `0x${string}`, what: string) => {
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (r.status !== "success") throw new Error(`${what} reverted: ${hash}`);
    return hash;
  };

  return {
    gatewayBalance: async () => {
      const r = await fetch(`${gw.api}/balances`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "USDC", sources: [{ depositor: p.floatAccount.address, domain: ARC_GATEWAY_DOMAIN }] }),
        signal: AbortSignal.timeout(15_000),
      });
      const j = (await r.json().catch(() => ({}))) as { balances?: { balance?: string }[] };
      if (!r.ok) throw new Error(`Gateway API ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
      return parseUnits(j.balances?.[0]?.balance ?? "0", 6);
    },
    walletBalance: () =>
      pub.readContract({ address: ARC_USDC, abi: erc20, functionName: "balanceOf", args: [p.floatAccount.address] }),
    topUpFromVault: p.topUpFromVault,
    deposit: async (amount) => {
      const allowance = await pub.readContract({
        address: ARC_USDC, abi: erc20, functionName: "allowance", args: [p.floatAccount.address, gw.wallet],
      });
      if (allowance < amount) {
        await mined(await wallet.writeContract({ address: ARC_USDC, abi: erc20, functionName: "approve", args: [gw.wallet, amount], ...fees }), "approve");
      }
      await pub.simulateContract({ account: p.floatAccount, address: gw.wallet, abi: gatewayAbi, functionName: "deposit", args: [ARC_USDC, amount] });
      return mined(await wallet.writeContract({ address: gw.wallet, abi: gatewayAbi, functionName: "deposit", args: [ARC_USDC, amount], ...fees }), "Gateway deposit");
    },
    sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
  };
}
