/**
 * txguard.ts — decode a Stellar XDR transaction into a human-readable summary.
 * Used for WYSIWYS (What You Sign Is What You See) pre-confirm modal.
 */
import { TransactionBuilder, Networks } from "@stellar/stellar-sdk";

const PASS: Record<string, string> = { TESTNET: Networks.TESTNET, PUBLIC: Networks.PUBLIC };

export interface OpSummary { type: string; destination?: string; amount?: string; assetCode?: string }
export interface TxSummary { source: string; fee: string; memo?: string; operations: OpSummary[] }

export function decodeTx(xdr: string, network: "TESTNET" | "PUBLIC"): TxSummary {
  const tx = TransactionBuilder.fromXDR(xdr, PASS[network]!) as unknown as {
    source: string;
    fee: string | number;
    memo?: { type?: string; value?: unknown };
    operations: Array<{
      type: string;
      destination?: string;
      amount?: string;
      asset?: { isNative?: () => boolean; code?: string };
    }>;
  };
  const ops: OpSummary[] = (tx.operations ?? []).map((op) => {
    if (op.type === "payment") {
      return {
        type: "payment",
        destination: op.destination,
        amount: op.amount,
        assetCode: op.asset?.isNative?.() ? "XLM" : op.asset?.code,
      };
    }
    return { type: op.type };
  });
  return {
    source: tx.source,
    fee: String(tx.fee),
    memo:
      tx.memo && tx.memo.type === "text" && typeof tx.memo.value === "string"
        ? tx.memo.value
        : undefined,
    operations: ops,
  };
}
