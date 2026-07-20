// Cofrinho — deposit/withdraw a passkey smart-wallet's USDC into the DeFindex
// yield vault, authorized by a live Face ID / fingerprint tap and gas-sponsored
// by the relayer. This is what makes the yield vault usable by a normal person
// (the "mãe" flow): no browser extension, no seed phrase, no wallet-connect.
//
// HOW IT WORKS (mirrors lib/wallet.ts payViaRelayer, the mainnet-proven pattern):
//   1. The DeFindex SDK builds the deposit/withdraw invocation (correct footprint
//      + sub-invocation tree) with the smart wallet as `caller`.
//   2. We take that invocation, compute the Soroban auth payload hash, and the
//      device passkey (Face ID) signs it — the ONLY human action.
//   3. We attach the passkey assertion as the smart wallet's auth entry, set the
//      tx source to the relayer sponsor, simulate + assemble, and POST to the
//      relayer, which pays gas only. Funds move solely because the on-chain
//      __check_auth accepts the Face ID assertion — the relayer cannot move them.
//
// ⚠️ STATUS: NOT YET PROVEN END-TO-END ON A LIVE VAULT. Gated behind a pinned
// mainnet vault (VITE_DEFINDEX_USDC_VAULT) + relayer allowlist (RELAYER_DEFINDEX_
// VAULT). Before enabling for real money, run a testnet e2e against a DeFindex
// testnet USDC vault and confirm settlement, exactly like the payment path was
// proven (scripts/e2e-passkey-pay-testnet.mjs). Do not flip the env until then.

import {
  Address, BASE_FEE, hash, Networks, Operation, rpc, TransactionBuilder, xdr,
} from "@stellar/stellar-sdk";
import { getAssertion } from "./passkey.ts";
import { buildDepositTx, buildWithdrawTx } from "./defindex.ts";
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

/** Extract the single invokeHostFunction op + the smart-wallet auth entry from
 *  an SDK-built tx XDR, so we can re-source it to the sponsor and re-sign the
 *  wallet's auth with a passkey. Returns the host function and the auth entry
 *  whose credentials address is `walletId`. */
function extractInvoke(sdkXdr: string, passphrase: string, walletId: string): {
  func: xdr.HostFunction;
  authEntry: xdr.SorobanAuthorizationEntry;
} {
  const tx = TransactionBuilder.fromXDR(sdkXdr, passphrase);
  if ("innerTransaction" in tx) throw new Error("unexpected fee-bump tx from SDK");
  const ops = tx.operations;
  if (ops.length !== 1) throw new Error(`expected 1 op, got ${ops.length}`);
  const op = ops[0] as { type: string; func?: xdr.HostFunction; auth?: xdr.SorobanAuthorizationEntry[] };
  if (op.type !== "invokeHostFunction" || !op.func) throw new Error("not an invokeHostFunction op");
  const entries = op.auth ?? [];
  const authEntry = entries.find((e) => {
    const c = e.credentials();
    if (c.switch().name !== "sorobanCredentialsAddress") return false;
    return Address.fromScAddress(c.address().address()).toString() === walletId;
  });
  if (!authEntry) throw new Error("no smart-wallet auth entry found in SDK tx");
  return { func: op.func, authEntry };
}

/** Compute the Soroban auth payload hash the passkey must sign for an address-
 *  credentials auth entry (network id + nonce + expiration + root invocation). */
function authPayload(entry: xdr.SorobanAuthorizationEntry, passphrase: string): Uint8Array {
  const creds = entry.credentials().address();
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(toB(new TextEncoder().encode(passphrase))),
      nonce: creds.nonce(),
      signatureExpirationLedger: creds.signatureExpirationLedger(),
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

/** Deposit or withdraw `usdcAmount` between the passkey wallet and the cofrinho,
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
  if (!cofrinhoPasskeyEnabled()) throw new Error("cofrinho ainda não está disponível");
  const passphrase = opts.acct.network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
  const server = new rpc.Server(RPC[opts.acct.network]!, { allowHttp: false });

  // 1. SDK builds the correct deposit/withdraw invocation for our smart wallet.
  const sdkXdr = opts.mode === "deposit"
    ? await buildDepositTx(opts.acct.walletId, opts.usdcAmount)
    : await buildWithdrawTx(opts.acct.walletId, opts.usdcAmount);

  const { func, authEntry } = extractInvoke(sdkXdr, passphrase, opts.acct.walletId);

  // 2. Face ID signs the auth payload for this exact invocation.
  const payload = authPayload(authEntry, passphrase);
  const a = await getAssertion(payload, opts.credId);

  // 3. Re-clothe the wallet's auth entry with the passkey signature.
  const creds = authEntry.credentials().address();
  const signedEntry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: creds.address(),
        nonce: creds.nonce(),
        signatureExpirationLedger: creds.signatureExpirationLedger(),
        signature: passkeySig(a),
      }),
    ),
    rootInvocation: authEntry.rootInvocation(),
  });

  // 4. Source = relayer sponsor (pays gas). Simulate + assemble + hand off.
  const op = Operation.invokeHostFunction({ func, auth: [signedEntry] });
  const src = await server.getAccount(opts.sponsor);
  const tx = new TransactionBuilder(src, { fee: String(Number(BASE_FEE) * 1000), networkPassphrase: passphrase })
    .addOperation(op).setTimeout(60).build();
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
