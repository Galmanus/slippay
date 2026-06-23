import { decodeTx, localHash, assertPaymentMatches, type TxSummary } from "./txguard.ts";
import { attachSignature, rawSignHash } from "./privyWallet.ts";
import { submitSignedTx } from "./stellar.ts";

export async function authorizePayment(args: {
  xdr: string;
  network: "TESTNET" | "PUBLIC";
  walletId: string;
  publicKey: string;
  privy: any;
  confirm: (s: TxSummary) => Promise<boolean>;
  expect: { destination: string; amount: string; assetCode: string };
}): Promise<{ hash: string }> {
  const summary = decodeTx(args.xdr, args.network);            // 1. decode the REAL xdr
  assertPaymentMatches(summary, args.expect);                 // 2. machine assert (threat #3)
  if (!(await args.confirm(summary))) {                        // 3. human confirm (threat #1)
    throw new Error("operação cancelada pelo usuário");
  }
  const hash = localHash(args.xdr, args.network);             // 4. hash re-derived LOCALLY (never from server)
  const sig = await rawSignHash(args.privy, args.walletId, hash); // 5. Privy signs the hash
  const signed = attachSignature(args.xdr, args.network, args.publicKey, sig); // 6. attach + submit
  return submitSignedTx(args.network, signed);
}
