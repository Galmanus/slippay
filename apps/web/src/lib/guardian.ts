// Guardião — the family-protection surface of the passkey smart wallet, plus
// the shared "invoke anything as the wallet, Face ID signs, relayer pays gas"
// primitive (`invokeSponsored`) that cofrinho.ts also builds on.
//
// Every mutating call here follows the pattern proven on testnet in
// scripts/e2e-guardiao-testnet.mjs and scripts/e2e-cofrinho-defindex-testnet.mjs:
//   1. record-simulate the invocation (sponsor as source) to obtain the
//      wallet's auth entry (nonce + full invocation tree, straight from RPC);
//   2. the device passkey signs the Soroban auth payload — the ONLY human act;
//   3. re-clothe the entry, simulate + assemble, POST to the relayer, which
//      pays gas only (branch (d) of validateSponsorable).
//
// Views go through free simulation. Wallets deployed before the guardian wasm
// simply error on `get_guardian` — callers use `guardianSupported()` to show
// an honest "chegando" state instead of a broken button.

import {
  Address, BASE_FEE, hash, Networks, Operation, rpc, TransactionBuilder, xdr,
  Account as SdkAccount, scValToNative, nativeToScVal,
} from "@stellar/stellar-sdk";
import { getAssertion } from "./passkey.ts";
import type { Account } from "./account.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toB = (u: Uint8Array): any => u;

const RPC: Record<string, string> = {
  TESTNET: "https://soroban-testnet.stellar.org",
  PUBLIC: "https://soroban-rpc.mainnet.stellar.gateway.fm",
};

function serverFor(network: "TESTNET" | "PUBLIC"): rpc.Server {
  return new rpc.Server(RPC[network]!, { allowHttp: false });
}
function passphraseFor(network: "TESTNET" | "PUBLIC"): string {
  return network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
}

/** Read-only contract call via free simulation (no account, no key, no fee). */
export async function viewContract<T>(
  network: "TESTNET" | "PUBLIC",
  contract: string,
  fn: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const src = new SdkAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF5W", "0");
  const tx = new TransactionBuilder(src, { fee: "100", networkPassphrase: passphraseFor(network) })
    .addOperation(Operation.invokeContractFunction({ contract, function: fn, args }))
    .setTimeout(60).build();
  const sim = await serverFor(network).simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(`${fn} view failed`);
  return scValToNative(sim.result.retval) as T;
}

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

/** Invoke `fn(args)` on `contract`, authorized by the user's passkey wallet
 *  (Face ID) and gas-sponsored by the relayer. Returns the settled tx hash. */
export async function invokeSponsored(opts: {
  acct: Account;
  contract: string;
  fn: string;
  args: xdr.ScVal[];
  relayerBase: string;
  sponsor: string;
  credId?: Uint8Array;
}): Promise<string> {
  const passphrase = passphraseFor(opts.acct.network);
  const server = serverFor(opts.acct.network);
  const walletId = opts.acct.walletId;

  // 1. record-simulate to obtain the wallet's auth entry
  const op = Operation.invokeContractFunction({ contract: opts.contract, function: opts.fn, args: opts.args });
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

  // 2. Face ID signs the auth payload for this exact invocation
  const { sequence } = await server.getLatestLedger();
  const sigExp = sequence + 200;
  const creds = walletEntry.credentials().address();
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(toB(new TextEncoder().encode(passphrase))),
      nonce: creds.nonce(),
      signatureExpirationLedger: sigExp,
      invocation: walletEntry.rootInvocation(),
    }),
  );
  const payload = new Uint8Array(hash(preimage.toXDR()));
  const a = await getAssertion(payload, opts.credId);

  // 3. re-clothe, simulate, assemble, hand to the relayer (gas only)
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
  const signedOp = Operation.invokeContractFunction({
    contract: opts.contract, function: opts.fn, args: opts.args, auth: [signedEntry],
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

// ── Guardian API ─────────────────────────────────────────────────────────────

/** Defaults shown to the user: 180 days of silence, 30 days to contest. */
export const DEFAULT_INACTIVITY_SECS = 180 * 24 * 60 * 60;
export const DEFAULT_CONTEST_SECS = 30 * 24 * 60 * 60;

export interface GuardianState {
  supported: boolean;          // wallet wasm has the guardian surface
  guardian: string | null;     // address, or null when none set
  recoveryStartedAt: number | null; // unix ts, or null when no recovery active
}

/** Read the wallet's guardian state. Old-wasm wallets → supported: false. */
export async function getGuardianState(acct: Account): Promise<GuardianState> {
  try {
    const [g, r] = await Promise.all([
      viewContract<string | null>(acct.network, acct.walletId, "get_guardian"),
      viewContract<bigint | null>(acct.network, acct.walletId, "get_recovery"),
    ]);
    return {
      supported: true,
      guardian: g ?? null,
      recoveryStartedAt: r === null || r === undefined ? null : Number(r),
    };
  } catch {
    return { supported: false, guardian: null, recoveryStartedAt: null };
  }
}

function sponsoredCall(acct: Account, relayerBase: string, sponsor: string, credId: Uint8Array | undefined, fn: string, args: xdr.ScVal[]) {
  return invokeSponsored({ acct, contract: acct.walletId, fn, args, relayerBase, sponsor, credId });
}

export function setGuardian(
  acct: Account, relayerBase: string, sponsor: string, credId: Uint8Array | undefined,
  guardianAddr: string,
  inactivitySecs = DEFAULT_INACTIVITY_SECS,
  contestSecs = DEFAULT_CONTEST_SECS,
): Promise<string> {
  return sponsoredCall(acct, relayerBase, sponsor, credId, "set_guardian", [
    new Address(guardianAddr).toScVal(),
    nativeToScVal(BigInt(inactivitySecs), { type: "u64" }),
    nativeToScVal(BigInt(contestSecs), { type: "u64" }),
  ]);
}

export function removeGuardian(
  acct: Account, relayerBase: string, sponsor: string, credId: Uint8Array | undefined,
): Promise<string> {
  return sponsoredCall(acct, relayerBase, sponsor, credId, "remove_guardian", []);
}

/** "Fui eu não / cancelar" — the owner's live tap that kills a recovery. */
export function cancelRecovery(
  acct: Account, relayerBase: string, sponsor: string, credId: Uint8Array | undefined,
): Promise<string> {
  return sponsoredCall(acct, relayerBase, sponsor, credId, "cancel_recovery", [nativeToScVal(true)]);
}

/** "Confirmo que sou eu" — bumps LastAlive when nearing the threshold. */
export function heartbeat(
  acct: Account, relayerBase: string, sponsor: string, credId: Uint8Array | undefined,
): Promise<string> {
  return sponsoredCall(acct, relayerBase, sponsor, credId, "heartbeat", []);
}
