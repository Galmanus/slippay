import type { Address } from "viem";

/** Arc network facts used by the SDK (verified live 2026-10-13; see docs/arc/ARC_KNOWLEDGE.md). */
export const ARC_USDC: Address = "0x3600000000000000000000000000000000000000";
export const ARC_PQ_PRECOMPILE: Address = "0x1800000000000000000000000000000000000004";
/** Arc drops transactions with maxFeePerGas below this, silently (no receipt). */
export const ARC_MIN_MAX_FEE_PER_GAS = 20_000_000_000n;
/** SLH-DSA-SHA2-128s signature length in bytes (FIPS 205). */
export const SLH_DSA_SIG_BYTES = 7856;

export const ARC_NETWORKS = {
  mainnet: {
    chainId: 5042,
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorer: "https://explorer.arc.io",
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
  },
  testnet: {
    chainId: 5042002,
    rpcUrl: "https://rpc.testnet.arc.io",
    explorer: "https://explorer.testnet.arc.io",
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
  },
} as const;

export type ArcNetwork = keyof typeof ARC_NETWORKS;
