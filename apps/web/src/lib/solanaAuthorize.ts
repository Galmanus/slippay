// Solana USDC transfer security gate — mirrors authorizeTx.ts for the Stellar path.
//
// Gate order (NON-NEGOTIABLE):
//   1. build   — buildUsdcTransfer (construct the tx locally, never from server)
//   2. decode  — decodeUsdcTransfer (extract to+amount from the BUILT tx)
//   3. assert  — assertTransferMatches (machine check: decoded vs caller's expected)
//   4. confirm — human confirmation callback (user sees decoded details)
//   5. sign    — signTransaction (Privy embedded wallet) — ONLY after confirm=true
//   6. send    — sendRawTransaction + confirmTransaction on-chain
//   7. return  — { signature }
//
// Signing before human confirms is a violation of this contract.

import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { usdcMint, toBaseUnits, USDC_DECIMALS } from "./chain/solana/usdc.ts";

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Builds an SPL USDC transferChecked transaction.
 * Uses getAssociatedTokenAddress (async, handles PDAs) to derive source/dest ATAs.
 * The transaction has no blockhash set — caller must set recentBlockhash before signing.
 */
export async function buildUsdcTransfer(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  usdcAmount: string,
): Promise<Transaction> {
  const mint = usdcMint();
  const amount = toBaseUnits(usdcAmount); // bigint, 6-dp base units

  // Derive ATAs. allowOwnerOffCurve=true: PDAs are valid ATA owners.
  const fromAta = await getAssociatedTokenAddress(mint, from, true);
  const toAta = await getAssociatedTokenAddress(mint, to, true);

  const ix = createTransferCheckedInstruction(
    fromAta,
    mint,
    toAta,
    from,
    amount,
    USDC_DECIMALS,
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;
  tx.add(ix);
  return tx;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Decodes a Transaction built by buildUsdcTransfer and extracts to+amount.
 * Returns human-readable amount (USDC, NOT base units).
 *
 * Assumes the first instruction is a TransferChecked SPL instruction.
 * Throws if the instruction is absent or malformed.
 */
export function decodeUsdcTransfer(tx: Transaction): { to: string; amount: string } {
  const ix = tx.instructions[0];
  if (!ix) throw new Error("solanaAuthorize: transaction has no instructions");

  // TransferChecked layout (spl-token instruction index 12):
  // accounts: [source, mint, dest, authority, ...]
  // data: [instruction(1)] [amount(8 LE u64)] [decimals(1)]
  const accounts = ix.keys;
  if (accounts.length < 3) {
    throw new Error("solanaAuthorize: unexpected instruction account count");
  }

  // dest ATA is accounts[2]; we return the ATA address (not the owner).
  // The caller asserts this against the expected destination.
  const destAta = accounts[2]!.pubkey.toBase58();

  const data = ix.data;
  if (data.length < 10) {
    throw new Error("solanaAuthorize: instruction data too short to decode amount");
  }

  // Bytes 1-8 (LE u64) = amount in base units. Use DataView for correct LE read.
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const lo = view.getUint32(1, true);
  const hi = view.getUint32(5, true);
  const baseUnits = BigInt(lo) + (BigInt(hi) << 32n);

  // Convert to human-readable with 6 decimals.
  const whole = baseUnits / 1_000_000n;
  const frac = baseUnits % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  const amount = fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;

  return { to: destAta, amount };
}

// ---------------------------------------------------------------------------
// Assert
// ---------------------------------------------------------------------------

/**
 * Machine guard: asserts decoded transfer matches what the caller expected.
 * Throws with a diagnostic message on any mismatch — never silently continues.
 *
 * Amount tolerance: 1e-6 USDC (the minimum representable unit at 6 dp).
 * Any larger drift = sign refusal.
 */
export function assertTransferMatches(
  decoded: { to: string; amount: string },
  expect: { to: string; amount: string },
): void {
  if (decoded.to.trim() !== expect.to.trim()) {
    throw new Error(
      `solanaAuthorize: destino divergente (assinaria ${decoded.to}, esperado ${expect.to})`,
    );
  }
  const got = Number(decoded.amount);
  const want = Number(expect.amount);
  if (!Number.isFinite(got) || !Number.isFinite(want)) {
    throw new Error("solanaAuthorize: valor não numérico");
  }
  if (Math.abs(got - want) > 1e-6) {
    throw new Error(
      `solanaAuthorize: valor divergente (assinaria ${decoded.amount}, esperado ${expect.amount})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Full gate: build → decode → assert → human-confirm → sign → send
// ---------------------------------------------------------------------------

export interface AuthorizeSolanaPaymentArgs {
  connection: Connection;
  from: PublicKey;
  to: PublicKey;
  usdcAmount: string;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  confirm: (decoded: { to: string; amount: string }) => Promise<boolean>;
}

/**
 * Authorizes and executes a USDC transfer on Solana.
 *
 * Gate order enforcement:
 *   1. build  → buildUsdcTransfer
 *   2. decode → decodeUsdcTransfer
 *   3. assert → assertTransferMatches
 *   4. human confirm → confirm(decoded)   ← if false, throw (never reach sign)
 *   5. sign   → signTransaction
 *   6. send   → sendAndConfirmRawTransaction
 *   7. return → { signature }
 */
export async function authorizeSolanaPayment(
  args: AuthorizeSolanaPaymentArgs,
): Promise<{ signature: string }> {
  const { connection, from, to, usdcAmount, signTransaction, confirm } = args;

  // 1. Build
  const tx = await buildUsdcTransfer(connection, from, to, usdcAmount);

  // 2. Decode
  const decoded = decodeUsdcTransfer(tx);

  // 3. Assert (machine check before human ever sees it — catches server-side manipulation)
  const toAta = (await getAssociatedTokenAddress(usdcMint(), to, true)).toBase58();
  assertTransferMatches(decoded, { to: toAta, amount: usdcAmount });

  // 4. Human confirm — MUST happen before sign
  const approved = await confirm(decoded);
  if (!approved) {
    throw new Error("cancelado pelo usuário");
  }

  // 5. Sign — only reached if human confirmed
  const signed = await signTransaction(tx);

  // 6. Send raw + wait for on-chain confirmation
  const raw = signed.serialize();
  const signature = await sendAndConfirmRawTransaction(connection, raw, {
    commitment: "confirmed",
  });

  // 7. Return
  return { signature };
}
