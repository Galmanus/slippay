// Cofrinho — deposit/withdraw a passkey smart-wallet's USDC into the DeFindex
// yield vault, authorized by a live Face ID / fingerprint tap and gas-sponsored
// by the relayer. This is what makes the yield vault usable by a normal person
// (the "mãe" flow): no browser extension, no seed phrase, no wallet-connect.
//
// HOW IT WORKS (proven on testnet in scripts/e2e-cofrinho-defindex-testnet.mjs):
//   1. Build the vault deposit/withdraw invocation with the smart wallet as
//      `from` and RECORD-SIMULATE it (sponsor as source) — the RPC returns the
//      exact auth entry (nonce + full invocation tree) the wallet must sign.
//      No DeFindex API on the path: the vault contract is invoked directly.
//   2. Compute the Soroban auth payload hash for that entry and the device
//      passkey (Face ID) signs it — the ONLY human action.
//   3. Re-clothe the wallet's auth entry with the passkey assertion, simulate +
//      assemble with the relayer sponsor as source, and POST to the relayer,
//      which pays gas only. Funds move solely because the on-chain __check_auth
//      accepts the Face ID assertion — the relayer cannot move them.
//
// Gated behind a pinned vault (VITE_DEFINDEX_USDC_VAULT + VITE_DEFINDEX_ENABLED)
// client-side and RELAYER_DEFINDEX_VAULT on the relayer. Fail-closed: no vault
// pinned → throws before any network call.

import {
  Address, BASE_FEE, hash, Networks, Operation, rpc, TransactionBuilder, xdr,
} from "@stellar/stellar-sdk";
import { getAssertion } from "./passkey.ts";
import { depositArgs, withdrawArgs, vaultId } from "./defindex.ts";
import type { Account } from "./account.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toB = (u: Uint8Array): any => u;

const RPC: Record<string, string> = {
  TESTNET: "https://soroban-testnet.stellar.org",
  PUBLIC: "https://soroban-rpc.mainnet.stellar.gateway.fm",
};

export type CofrinhoMode = "deposit" | "withdraw";

/** Is the passkey cofrinho path available? Requires a pinned vault (client) —
 *  the relayer side is gated independently by RELAYER_DEFINDEX_VAULT. */
export function cofrinhoPasskeyEnabled(): boolean {
  return Boolean(import.meta.env.VITE_DEFINDEX_USDC_VAULT)
    && String(import.meta.env.VITE_DEFINDEX_ENABLED ?? "") === "1";
}

/** Compute the Soroban auth payload hash the passkey must sign for an address-
 *  credentials auth entry (network id + nonce + expiration + root invocation). */
function authPayload(
  entry: xdr.SorobanAuthorizationEntry,
  passphrase: string,
  sigExpirationLedger: number,
): Uint8Array {
  const creds = entry.credentials().address();
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(toB(new TextEncoder().encode(passphrase))),
      nonce: creds.nonce(),
      signatureExpirationLedger: sigExpirationLedger,
      invocation: entry.rootInvocation(),
    }),
  );
  return new Uint8Array(hash(preimage.toXDR()));
}

/** Build the passkey signature scvVec the slippay smart-wallet __check_auth
 *  expects (same shape as lib/wallet.ts). */
function passkeySig(a: { authenticatorData: Uint8Array; clientDataJSON: Uint8Array; signature: Uint8Array }): xdr.ScVal {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Passkey"),
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("authenticator_data"), val: xdr.ScVal.scvBytes(toB(a.authenticatorData)) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("client_data_json"), val: xdr.ScVal.scvBytes(toB(a.clientDataJSON)) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("signature"), val: xdr.ScVal.scvBytes(toB(a.signature)) }),
    ]),
  ]);
}

/** Deposit or withdraw `usdcAmount` between the passkey wallet and the cofre,
 *  authorized by Face ID and gas-sponsored by the relayer. Returns the settled
 *  tx hash. Throws (fail-closed) unless the vault is pinned on both sides. */
export async function moveCofrinho(opts: {
  acct: Account;
  mode: CofrinhoMode;
  usdcAmount: string;
  relayerBase: string;
  sponsor: string;
  credId?: Uint8Array;
}): Promise<string> {
  if (!cofrinhoPasskeyEnabled()) throw new Error("cofre de dólar ainda não está disponível");
  const passphrase = opts.acct.network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
  const server = new rpc.Server(RPC[opts.acct.network]!, { allowHttp: false });
  const walletId = opts.acct.walletId;

  // 1. Build the invocation and record-simulate to obtain the wallet's auth
  //    entry (correct nonce + full sub-invocation tree, straight from the RPC).
  const args = opts.mode === "deposit"
    ? depositArgs(walletId, opts.usdcAmount)
    : await withdrawArgs(walletId, opts.usdcAmount);
  const op = Operation.invokeContractFunction({ contract: vaultId(), function: opts.mode, args });
  const src1 = await server.getAccount(opts.sponsor);
  const recordTx = new TransactionBuilder(src1, { fee: String(Number(BASE_FEE) * 1000), networkPassphrase: passphrase })
    .addOperation(op).setTimeout(60).build();
  const recSim = await server.simulateTransaction(recordTx);
  if (rpc.Api.isSimulationError(recSim)) throw new Error("Não deu pra confirmar. Tente de novo.");
  const entries = recSim.result?.auth ?? [];
  const walletEntry = entries.find((e) => {
    const c = e.credentials();
    return c.switch().name === "sorobanCredentialsAddress"
      && Address.fromScAddress(c.address().address()).toString() === walletId;
  });
  if (!walletEntry) throw new Error("Não deu pra confirmar. Tente de novo.");

  // 2. Face ID signs the auth payload for this exact invocation.
  const { sequence } = await server.getLatestLedger();
  const sigExp = sequence + 200;
  const payload = authPayload(walletEntry, passphrase, sigExp);
  const a = await getAssertion(payload, opts.credId);

  // 3. Re-clothe the wallet's auth entry with the passkey signature.
  const creds = walletEntry.credentials().address();
  const signedEntry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: creds.address(),
        nonce: creds.nonce(),
        signatureExpirationLedger: sigExp,
        signature: passkeySig(a),
      }),
    ),
    rootInvocation: walletEntry.rootInvocation(),
  });

  // 4. Source = relayer sponsor (pays gas). Simulate + assemble + hand off.
  const signedOp = Operation.invokeContractFunction({
    contract: vaultId(), function: opts.mode, args, auth: [signedEntry],
  });
  const src2 = await server.getAccount(opts.sponsor);
  const tx = new TransactionBuilder(src2, { fee: String(Number(BASE_FEE) * 1000), networkPassphrase: passphrase })
    .addOperation(signedOp).setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error("Não deu pra confirmar. Tente de novo.");
  const assembled = rpc.assembleTransaction(tx, sim).build();

  const resp = await fetch(`${opts.relayerBase}/submit`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ xdr: assembled.toXDR() }),
  });
  const j = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`relayer: ${j.reason ?? j.error ?? resp.status}`);
  return j.hash as string;
}
