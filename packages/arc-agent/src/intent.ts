import {
  concatHex, encodeFunctionData, hashTypedData, hexToBytes, keccak256, stringToHex, toHex,
  type Address, type Hex, type LocalAccount,
} from "viem";
import { slh_dsa_sha2_128s } from "@noble/post-quantum/slh-dsa.js";
import { agentVaultAbi } from "./abi.ts";

/** One agent spend as AgentVault verifies it (amount in 6-decimal USDC units). */
export type SpendIntent = {
  agentSigner: Address;
  to: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  orderId: Hex;
};

export type SignedSpend = {
  digest: Hex;
  ecdsaSig: Hex;
  /** "0x" when the amount is at or below the session's pqThreshold. */
  slhSig: Hex;
  pq: boolean;
};

const SPEND_TYPES = {
  Spend: [
    { name: "agentSigner", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint64" },
    { name: "deadline", type: "uint64" },
    { name: "orderId", type: "bytes32" },
  ],
} as const;

/** EIP-712 typed data mirroring AgentVault.spendDigest (domain "SlippayAgentVault" v1). */
export function spendTypedData(p: { vault: Address; chainId: number; intent: SpendIntent }) {
  return {
    domain: { name: "SlippayAgentVault", version: "1", chainId: p.chainId, verifyingContract: p.vault },
    types: SPEND_TYPES,
    primaryType: "Spend" as const,
    message: p.intent,
  };
}

export function spendDigest(p: { vault: Address; chainId: number; intent: SpendIntent }): Hex {
  return hashTypedData(spendTypedData(p));
}

/** SLH-DSA-SHA2-128s keypair. publicKey (32 bytes) is the session's `slhVk`. Keep secretKey off-chain. */
export function slhKeygen(seed?: Uint8Array): { secretKey: Uint8Array; publicKey: Hex } {
  const { secretKey, publicKey } = slh_dsa_sha2_128s.keygen(seed);
  return { secretKey, publicKey: toHex(publicKey) };
}

/**
 * Sign a spend intent. Always ECDSA (typed data); above `pqThreshold` also SLH-DSA over the same
 * 32-byte digest, which AgentVault checks with Arc's PQ precompile. SLH-DSA signing is slow
 * (~2.7 s in JS, measured 2026-10-13), so keep it for high-value spends.
 */
export async function signSpend(p: {
  account: LocalAccount;
  vault: Address;
  chainId: number;
  intent: SpendIntent;
  pqThreshold: bigint;
  slhSecretKey?: Uint8Array;
}): Promise<SignedSpend> {
  const typed = spendTypedData(p);
  const digest = hashTypedData(typed);
  const pq = p.intent.amount > p.pqThreshold;
  if (pq && !p.slhSecretKey) {
    throw new Error("amount exceeds pqThreshold: an SLH-DSA secret key is required to sign this spend");
  }
  const ecdsaSig = await p.account.signTypedData(typed);
  const slhSig: Hex = pq
    ? toHex(slh_dsa_sha2_128s.sign(hexToBytes(digest), p.slhSecretKey!))
    : "0x";
  return { digest, ecdsaSig, slhSig, pq };
}

const AIA_DOMAIN = keccak256(stringToHex("SlippayAIA.arc.v1"));

/** What the integrity attester signs with P-256 to clear one spend (AgentVault.attestationHash). */
export function attestationHash(digest: Hex): Hex {
  return keccak256(concatHex([AIA_DOMAIN, digest]));
}

/** Calldata for AgentVault.spend(SpendRequest) — submit from any relayer EOA (gas is paid in USDC on Arc). */
export function encodeSpendCall(
  intent: SpendIntent,
  sigs: { ecdsaSig: Hex; slhSig: Hex; attestation?: Hex },
): Hex {
  return encodeFunctionData({
    abi: agentVaultAbi,
    functionName: "spend",
    args: [
      {
        agentSigner: intent.agentSigner,
        to: intent.to,
        amount: intent.amount,
        deadline: intent.deadline,
        orderId: intent.orderId,
        ecdsaSig: sigs.ecdsaSig,
        slhSig: sigs.slhSig,
        attestation: sigs.attestation ?? "0x",
      },
    ],
  });
}
