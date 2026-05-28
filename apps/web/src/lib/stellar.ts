import {
  Account,
  Asset,
  Horizon,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { USDC_ASSET_CODE } from "@slippay/shared";

const HORIZON: Record<string, string> = {
  TESTNET: "https://horizon-testnet.stellar.org",
  PUBLIC:  "https://horizon.stellar.org",
};

export async function fetchSequence(network: "TESTNET" | "PUBLIC", publicKey: string): Promise<string> {
  const server = new Horizon.Server(HORIZON[network]!);
  const account = await server.loadAccount(publicKey);
  return account.sequence;
}

export async function submitSignedTx(network: "TESTNET" | "PUBLIC", signedXdr: string): Promise<{ hash: string }> {
  const server = new Horizon.Server(HORIZON[network]!);
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASES[network]!);
  const res = await server.submitTransaction(tx);
  return { hash: (res as { hash: string }).hash };
}

const ISSUERS: Record<string, string> = {
  // Testnet issuer is overridable for local demos via VITE_USDC_ISSUER so a
  // self-controlled test issuer can mint USDC to the buyer wallet. Mainnet
  // is never overridable.
  TESTNET: (import.meta.env.VITE_USDC_ISSUER as string | undefined) ??
           "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  PUBLIC:  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

const PASSPHRASES: Record<string, string> = {
  TESTNET: Networks.TESTNET,
  PUBLIC:  Networks.PUBLIC,
};

export interface BuildAtomicTxArgs {
  buyerPublicKey: string;
  buyerSequence: string;
  merchantAddress: string;
  platformAddress: string;
  usdcAmount: string;
  platformFeeBp: number;
  memo: string;
  network: "TESTNET" | "PUBLIC";
  maxTime: number;
}

export async function buildAtomicTx(args: BuildAtomicTxArgs): Promise<string> {
  const total = Number(args.usdcAmount);
  if (!isFinite(total) || total <= 0) throw new Error("invalid_amount");
  const fee = total * (args.platformFeeBp / 10_000);
  const merchantShare = (total - fee).toFixed(7);
  const feeShare = fee.toFixed(7);

  const issuer = ISSUERS[args.network];
  const usdc = new Asset(USDC_ASSET_CODE, issuer);

  const account = new Account(args.buyerPublicKey, args.buyerSequence);
  const memoBytes = Buffer.from(args.memo, "hex");
  if (memoBytes.length !== 32) throw new Error("invalid_memo");

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASES[args.network],
    memo: Memo.hash(memoBytes),
    timebounds: { minTime: 0, maxTime: args.maxTime },
  })
    .addOperation(Operation.payment({
      destination: args.merchantAddress,
      asset: usdc,
      amount: merchantShare,
    }))
    .addOperation(Operation.payment({
      destination: args.platformAddress,
      asset: usdc,
      amount: feeShare,
    }))
    .build();

  return tx.toXDR();
}
