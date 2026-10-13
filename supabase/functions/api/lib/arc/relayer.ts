// Gas-sponsor relayer for Slippay AgentVault on Arc.
//
// NON-CUSTODIAL: the relayer key pays GAS only (in USDC — Arc's gas token). Funds move only
// when AgentVault verifies the agent's own ECDSA signature (and SLH-DSA above the session's
// pqThreshold) and the on-chain caps/allowlist pass. Worst case if abused = wasted gas, bounded
// by: (1) only pinned vault addresses, (2) only the `spend` call, (3) mandatory eth_call
// simulation before broadcast (a spend that would revert is never sent), (4) gas and fee caps,
// (5) the route's per-IP rate limit. Arc silently drops txs below 20 gwei, so fees are floored.
import { z } from "zod";
import { encodeSpendCall } from "@slippay/arc-agent";
import type { Hex } from "viem";

export interface ArcRpc {
  /** eth_call; must throw when the call would revert. */
  call(tx: { to: Hex; data: Hex }): Promise<void>;
  estimateGas(tx: { to: Hex; data: Hex }): Promise<bigint>;
  feesPerGas(): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>;
  send(tx: { to: Hex; data: Hex; gas: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }): Promise<Hex>;
  waitReceipt(hash: Hex, timeoutMs: number): Promise<{ status: "success" | "reverted"; blockNumber: bigint } | null>;
}

export class RelayError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export type RelayPolicy = { rpc: ArcRpc; allowedVaults: Set<string>; gasCap: bigint; maxFeeCap: bigint };
export type RelayResult = { txHash: Hex; status: "success" | "reverted" | "pending"; blockNumber?: string };

const GWEI = 1_000_000_000n;
/** Arc mempool floor is 20 gwei; stay a little above it. */
const MIN_MAX_FEE = 25n * GWEI;
const MIN_PRIORITY = 1n * GWEI;
const SLH_SIG_BYTES = 7856;
const MAX_U128 = (1n << 128n) - 1n;
const MAX_U64 = (1n << 64n) - 1n;

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hexBytes = (n: number) => z.string().regex(new RegExp(`^0x[0-9a-fA-F]{${n * 2}}$`));
const uintString = (max: bigint) =>
  z.string().regex(/^[0-9]{1,39}$/).transform((s) => BigInt(s)).refine((v) => v > 0n && v <= max);

const SpendRequest = z.object({
  vault: address,
  agentSigner: address,
  to: address,
  amount: uintString(MAX_U128),
  deadline: uintString(MAX_U64),
  orderId: hexBytes(32),
  ecdsaSig: hexBytes(65),
  slhSig: z.union([z.literal("0x"), hexBytes(SLH_SIG_BYTES)]),
});

export async function relaySpend(body: unknown, p: RelayPolicy): Promise<RelayResult> {
  const parsed = SpendRequest.safeParse(body);
  if (!parsed.success) throw new RelayError("invalid_request", parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const r = parsed.data;

  if (!p.allowedVaults.has(r.vault.toLowerCase())) {
    throw new RelayError("vault_not_allowed", "vault is not pinned for this relayer", 403);
  }
  if (r.deadline < BigInt(Math.floor(Date.now() / 1000))) throw new RelayError("expired", "intent deadline has passed");

  const to = r.vault as Hex;
  const data = encodeSpendCall(
    {
      agentSigner: r.agentSigner as Hex,
      to: r.to as Hex,
      amount: r.amount,
      nonce: 0n, // not part of calldata: the vault binds its own current nonce into the digest
      deadline: r.deadline,
      orderId: r.orderId as Hex,
    },
    { ecdsaSig: r.ecdsaSig as Hex, slhSig: r.slhSig as Hex },
  );

  try {
    await p.rpc.call({ to, data });
  } catch (e) {
    throw new RelayError("simulation_reverted", e instanceof Error ? e.message.slice(0, 300) : "reverted", 422);
  }

  const estimate = await p.rpc.estimateGas({ to, data });
  if (estimate > p.gasCap) throw new RelayError("gas_cap", `gas estimate ${estimate} exceeds cap ${p.gasCap}`, 422);
  const gas = (estimate * 12n) / 10n;

  const fees = await p.rpc.feesPerGas();
  if (fees.maxFeePerGas > p.maxFeeCap) {
    throw new RelayError("fee_cap", `network maxFeePerGas ${fees.maxFeePerGas} exceeds cap`, 503);
  }
  const maxFeePerGas = fees.maxFeePerGas > MIN_MAX_FEE ? fees.maxFeePerGas : MIN_MAX_FEE;
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas > MIN_PRIORITY ? fees.maxPriorityFeePerGas : MIN_PRIORITY;

  const txHash = await p.rpc.send({ to, data, gas, maxFeePerGas, maxPriorityFeePerGas });
  // Arc finality is sub-second; a short wait gives the caller a final answer in the common case.
  const receipt = await p.rpc.waitReceipt(txHash, 10_000);
  if (!receipt) return { txHash, status: "pending" };
  return { txHash, status: receipt.status, blockNumber: receipt.blockNumber.toString() };
}
