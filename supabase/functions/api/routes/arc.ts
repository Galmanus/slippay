// POST /v1/arc/:network/spend — relay an agent-signed AgentVault spend on Arc.
// Safety model and limits live in lib/arc/relayer.ts. Dormant (503) until the network's relayer
// key is configured; vaults must be pinned via env, so deploying this route is safe unfunded.
//
// env (per network, NET = TESTNET | MAINNET):
//   ARC_<NET>_RELAYER_KEY     0x… private key of a small USDC gas float (NOT user funds)
//   ARC_<NET>_RELAYER_VAULTS  comma-separated AgentVault addresses the relayer will pay for
//   ARC_<NET>_RPC             optional RPC override
//   ARC_RELAYER_GAS_CAP       default 800000 (hybrid PQ spend ~266k execution + 7.9 KB calldata)
//   ARC_RELAYER_MAX_FEE_WEI   default 200 gwei (Arc base fee floor is 20 gwei)
//   ARC_ATTESTER_URL          optional, e.g. http://127.0.0.1:8791 (packages/slippay-attester). When
//                             a spend arrives without an attestation and its amount is above the
//                             session's attestThreshold, the relayer asks the attester (which runs
//                             the A-Identity counterparty check) and refuses if it refuses.
import { Hono } from "hono";
import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc, arcTestnet } from "viem/chains";
import { agentVaultAbi } from "@slippay/arc-agent";
import { rateLimit } from "../middleware/rate_limit.ts";
import { type ArcRpc, type ParsedSpend, RelayError, relaySpend } from "../lib/arc/relayer.ts";

type Net = { chain: Chain; env: "TESTNET" | "MAINNET"; rpc: string; explorer: string };
const NETWORKS: Record<string, Net> = {
  testnet: { chain: arcTestnet, env: "TESTNET", rpc: "https://rpc.testnet.arc.io", explorer: "https://explorer.testnet.arc.io" },
  mainnet: { chain: arc, env: "MAINNET", rpc: "https://rpc.mainnet.arc.io", explorer: "https://explorer.arc.io" },
};

function viemRpc(net: Net, privateKey: Hex): ArcRpc {
  const transport = http(Deno.env.get(`ARC_${net.env}_RPC`) ?? net.rpc);
  const account = privateKeyToAccount(privateKey);
  const pub = createPublicClient({ chain: net.chain, transport });
  const wallet = createWalletClient({ chain: net.chain, transport, account });
  return {
    call: async (tx) => {
      await pub.call({ account: account.address, to: tx.to, data: tx.data });
    },
    estimateGas: (tx) => pub.estimateGas({ account: account.address, to: tx.to, data: tx.data }),
    feesPerGas: async () => {
      const f = await pub.estimateFeesPerGas();
      return { maxFeePerGas: f.maxFeePerGas, maxPriorityFeePerGas: f.maxPriorityFeePerGas };
    },
    send: (tx) => wallet.sendTransaction(tx),
    waitReceipt: async (hash, timeoutMs) => {
      try {
        const r = await pub.waitForTransactionReceipt({ hash, timeout: timeoutMs });
        return { status: r.status, blockNumber: r.blockNumber };
      } catch {
        return null;
      }
    },
  };
}

/** Integrity attester client (agent_id = the agent signer address, lowercase). */
function attesterFor(net: Net): ((s: ParsedSpend) => Promise<Hex>) | undefined {
  const url = Deno.env.get("ARC_ATTESTER_URL")?.replace(/\/$/, "");
  if (!url) return undefined;
  const pub = createPublicClient({ chain: net.chain, transport: http(Deno.env.get(`ARC_${net.env}_RPC`) ?? net.rpc) });
  return async (s) => {
    const session = await pub.readContract({
      address: s.vault as Hex, abi: agentVaultAbi, functionName: "getSession", args: [s.agentSigner as Hex],
    });
    if (s.amount <= session.attestThreshold) return "0x";
    const res = await fetch(`${url}/arc/attest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent_id: s.agentSigner.toLowerCase(),
        spend: {
          vault: s.vault, chainId: net.chain.id, agentSigner: s.agentSigner, to: s.to, amount: s.amount.toString(),
          nonce: session.nonce.toString(), deadline: s.deadline.toString(), orderId: s.orderId,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.reason ?? `attester HTTP ${res.status}`);
    return j.attestation as Hex;
  };
}

const r = new Hono();

// Unauthenticated (agents may not hold an API key) → strict per-IP limiter, like /v1/relayer.
r.use("/*", rateLimit({ capacity: 20, refillPerSec: 0.2, scope: "arc-relayer" }));

r.post("/:network/spend", async (c) => {
  const net = NETWORKS[c.req.param("network")];
  if (!net) return c.json({ error: "unknown_network" }, 404);
  const key = Deno.env.get(`ARC_${net.env}_RELAYER_KEY`);
  if (!key) return c.json({ error: "relayer_disabled" }, 503);
  const allowedVaults = new Set(
    (Deno.env.get(`ARC_${net.env}_RELAYER_VAULTS`) ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const body = await c.req.json().catch(() => null);
  try {
    const res = await relaySpend(body, {
      rpc: viemRpc(net, key as Hex),
      allowedVaults,
      gasCap: BigInt(Deno.env.get("ARC_RELAYER_GAS_CAP") ?? "800000"),
      maxFeeCap: BigInt(Deno.env.get("ARC_RELAYER_MAX_FEE_WEI") ?? "200000000000"),
      attest: attesterFor(net),
    });
    return c.json({ ...res, explorerUrl: `${net.explorer}/tx/${res.txHash}` });
  } catch (e) {
    if (e instanceof RelayError) {
      return c.json({ error: e.code, message: e.message }, e.status as 400 | 403 | 422 | 503);
    }
    console.error("arc relayer failure", e);
    return c.json({ error: "relay_failed" }, 502);
  }
});

export default r;
