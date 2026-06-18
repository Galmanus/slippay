// Solana adapter. Implements ChainAdapter against Solana + the slippay_mandate
// program (bounded-autonomy moat, proven 5/5 on 2026-06-17).
//
// - payOneTime    = a 2-transfer SPL split (merchant + platform fee), the Solana
//                   analogue of the Stellar 2-op atomic payment.
// - approveRecurring = the single SPL `approve` that delegates bounded spend to
//                   the mandate PDA (mirrors the Stellar SEP-41 allowance). The
//                   PDA is derived from owner+mint, not the passed spender.
//
// Wallet/signing is bound by increment 4 (passkey/relayer biometric signer).
// Until a wallet is bound, connectWallet() throws; the payment builders are
// otherwise complete.

import {
  Connection, PublicKey, Transaction, type TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  createApproveInstruction,
} from "@solana/spl-token";
import type {
  ChainAdapter, AddressCheck, OneTimePayArgs, ApproveArgs, PayResult,
} from "../types.ts";
import { usdcMint, rpcUrl, toBaseUnits, splitFee } from "./usdc.ts";
import { mandatePda } from "./mandate.ts";

/** The biometric signer (passkey/relayer), bound at increment 4. */
export interface SolanaSigner {
  publicKey: PublicKey;
  signTransaction(tx: Transaction): Promise<Transaction>;
}

let bound: SolanaSigner | null = null;
/** Bind the active Solana wallet signer (called by the wallet layer). */
export function bindSolanaWallet(signer: SolanaSigner | null): void { bound = signer; }
function requireSigner(): SolanaSigner {
  if (!bound) throw new Error("no solana wallet bound — biometric signer is increment 4");
  return bound;
}

function connection(): Connection { return new Connection(rpcUrl(), "confirmed"); }

async function signSendConfirm(conn: Connection, ixs: TransactionInstruction[], payer: PublicKey): Promise<string> {
  const signer = requireSigner();
  const tx = new Transaction().add(...ixs);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer;
  const signed = await signer.signTransaction(tx);
  const sig = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

export const solanaAdapter: ChainAdapter = {
  id: "solana",

  async connectWallet(): Promise<string> {
    return requireSigner().publicKey.toBase58();
  },

  isValidAddress(addr: string): boolean {
    try { return PublicKey.isOnCurve(new PublicKey(addr.trim())); }
    catch { return false; }
  },

  async checkReceiveAddress(addr: string): Promise<AddressCheck> {
    const a = addr.trim();
    if (!this.isValidAddress(a)) return { validFormat: false, accountExists: null, hasUsdcTrustline: null };
    try {
      const conn = connection();
      const owner = new PublicKey(a);
      const wallet = await conn.getAccountInfo(owner);
      // Stellar "USDC trustline" ⇄ Solana "recipient has a USDC ATA". USDC can't
      // land without it; surface at input time (mirrors checkReceiveAddress).
      const ata = getAssociatedTokenAddressSync(usdcMint(), owner, true);
      const ataInfo = await conn.getAccountInfo(ata);
      return { validFormat: true, accountExists: wallet !== null, hasUsdcTrustline: ataInfo !== null };
    } catch {
      // Network/RPC error — never assert existence we couldn't verify.
      return { validFormat: true, accountExists: null, hasUsdcTrustline: null };
    }
  },

  async payOneTime(a: OneTimePayArgs): Promise<PayResult> {
    const conn = connection();
    const mint = usdcMint();
    const buyer = new PublicKey(a.buyerAddress);
    const merchant = new PublicKey(a.merchantAddress);
    const platform = new PublicKey(a.platformAddress);

    const total = toBaseUnits(a.usdcAmount);
    const { merchant: merchantUnits, fee } = splitFee(total, a.platformFeeBp);

    const buyerAta = getAssociatedTokenAddressSync(mint, buyer);
    const merchantAta = getAssociatedTokenAddressSync(mint, merchant);
    const platformAta = getAssociatedTokenAddressSync(mint, platform);

    const ixs: TransactionInstruction[] = [
      // Idempotent: no-op if the ATA already exists. Buyer fronts rent.
      createAssociatedTokenAccountIdempotentInstruction(buyer, merchantAta, merchant, mint),
      createTransferInstruction(buyerAta, merchantAta, buyer, merchantUnits),
    ];
    if (fee > 0n) {
      ixs.push(createAssociatedTokenAccountIdempotentInstruction(buyer, platformAta, platform, mint));
      ixs.push(createTransferInstruction(buyerAta, platformAta, buyer, fee));
    }
    // TODO(increment 4): attach order id (a.memoHex) via the SPL Memo program for
    // on-chain order binding (Stellar Memo.hash parity). Backend currently binds
    // by buyer+recipient+amount.

    const hash = await signSendConfirm(conn, ixs, buyer);
    return { hash };
  },

  async approveRecurring(a: ApproveArgs): Promise<PayResult> {
    const conn = connection();
    const mint = usdcMint();
    const owner = new PublicKey(a.buyerAddress);
    const ownerAta = getAssociatedTokenAddressSync(mint, owner);

    // The single signature that delegates bounded spend: approve the mandate PDA
    // (derived from owner+mint) as the SPL delegate up to the cap. durationSecs is
    // ignored — an SPL delegate has no ledger ttl. Caps/allowlist are set
    // separately via SlippayMandate.initMandate at subscription setup.
    const spenderPda = mandatePda(owner, mint);
    const amount = toBaseUnits(a.capUsdc); // 6-dp base units

    const ix = createApproveInstruction(ownerAta, spenderPda, owner, amount);
    const hash = await signSendConfirm(conn, [ix], owner);
    return { hash };
  },
};
