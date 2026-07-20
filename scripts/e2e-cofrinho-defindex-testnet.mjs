#!/usr/bin/env node
// REAL cofrinho (DeFindex vault) e2e on Stellar testnet — portão 2 do
// docs/cofrinho-defindex-decision.md.
//
// Proves the "cofre de dólar" path end-to-end on a live network: deploy a
// smart wallet bound to a secp256r1 passkey, fund it with the vault's USDC,
// then DEPOSIT into and WITHDRAW from the DeFindex USDC vault authorized ONLY
// by a genuine WebAuthn assertion — the exact auth shape lib/cofrinho.ts
// produces in the browser (mirrors scripts/e2e-passkey-pay-testnet.mjs).
//
// Vault: usdc_paltalabs_vault from defindex-io/stellar-contracts
// public/testnet.contracts.json. Its asset is Blend testnet USDC
// (USDC:GATALTGT…, SAC CAQCFVLO…) — NOT the app's testnet USDC issuer.
// On MAINNET there is no such mismatch: passkey.ts issuer GA5ZSEJYB37…
// derives SAC CCW67TSZ… which IS the Circle USDC the mainnet vaults use
// (verified 20/07/2026).
//
// Run:
//   DEPLOYER_SECRET=$(stellar keys show slippay-deployer) \
//     WASM_HASH=<smart-wallet hash> node scripts/e2e-cofrinho-defindex-testnet.mjs
// Deployer must hold Blend testnet USDC (faucet:
// https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com/getAssets?userId=<G..>).
import * as S from "../apps/web/node_modules/@stellar/stellar-sdk/lib/index.js";
import { execSync } from "node:child_process";
import { webcrypto, createHash } from "node:crypto";

const { rpc, xdr, Keypair, Networks, TransactionBuilder, Operation, Address, hash, nativeToScVal, scValToNative } = S;
const { subtle } = webcrypto;

const RPC = process.env.RPC || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.PASSPHRASE || Networks.TESTNET;
const CLI_NET = process.env.CLI_NETWORK || "testnet";
const SOURCE = process.env.SOURCE || "slippay-deployer";
const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET;
const WASM_HASH = process.env.WASM_HASH;
const VAULT = process.env.VAULT || "CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN";
const USDC_SAC = process.env.USDC_SAC || "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";
const FUND_USDC = process.env.FUND_USDC || "1000000000";   // 100 USDC into wallet
const DEPOSIT = process.env.DEPOSIT || "500000000";        // 50 USDC into the vault
const MAX_ABS = process.env.MAX_ABS || "1000000000";
const EXPLORER = "https://stellar.expert/explorer/testnet/tx/";

const server = new rpc.Server(RPC, { allowHttp: false });
const log = (...a) => console.log(...a);
const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const scAddr = (id) => new Address(id).toScVal();
const i128 = (n) => nativeToScVal(BigInt(n), { type: "i128" });
const vecI128 = (ns) => xdr.ScVal.scvVec(ns.map(i128));
const sha256 = (buf) => createHash("sha256").update(buf).digest();

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
function normalizeLowS(sig64) {
  const r = sig64.subarray(0, 32);
  let s = BigInt("0x" + Buffer.from(sig64.subarray(32, 64)).toString("hex"));
  if (s > P256_N / 2n) {
    s = P256_N - s;
    return Buffer.concat([r, Buffer.from(s.toString(16).padStart(64, "0"), "hex")]);
  }
  return Buffer.from(sig64);
}

/** Read-only contract call via simulation. */
async function view(caller, contract, fn, args = []) {
  const tx = new TransactionBuilder(new S.Account(caller, "0"), { fee: "100", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract, function: fn, args }))
    .setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`view ${fn}: ${sim.error.split("\n")[0]}`);
  return scValToNative(sim.result.retval);
}

/** Sign a recorded auth entry for WALLET with a REAL WebAuthn assertion, the
 *  exact re-clothing lib/cofrinho.ts does (nonce kept, expiration refreshed). */
async function passkeySignEntry(entry, walletId, kp) {
  const creds = entry.credentials().address();
  const { sequence } = await server.getLatestLedger();
  const sigExp = sequence + 200;
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(PASSPHRASE)),
      nonce: creds.nonce(),
      signatureExpirationLedger: sigExp,
      invocation: entry.rootInvocation(),
    })
  );
  const payload = hash(preimage.toXDR());
  const clientDataJSON = Buffer.from(JSON.stringify({
    type: "webauthn.get",
    challenge: b64url(payload),
    origin: "https://app.slippay.cc",
  }));
  const authenticatorData = Buffer.from(Array.from({ length: 37 }, (_, i) => (i * 7) & 0xff));
  const signBase = Buffer.concat([authenticatorData, sha256(clientDataJSON)]);
  const rawSig = Buffer.from(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, signBase));
  const sig64 = normalizeLowS(rawSig);
  const sBig = BigInt("0x" + Buffer.from(rawSig.subarray(32, 64)).toString("hex"));
  const okLocal = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, rawSig, signBase);
  log(`  [debug] raw sig verifies locally: ${okLocal} · s was ${sBig > P256_N / 2n ? "HIGH (normalized)" : "low"}`);
  const walletAuth = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Passkey"),
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("authenticator_data"), val: xdr.ScVal.scvBytes(authenticatorData) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("client_data_json"), val: xdr.ScVal.scvBytes(clientDataJSON) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("signature"), val: xdr.ScVal.scvBytes(sig64) }),
    ]),
  ]);
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
      address: new Address(walletId).toScAddress(),
      nonce: creds.nonce(),
      signatureExpirationLedger: sigExp,
      signature: walletAuth,
    })),
    rootInvocation: entry.rootInvocation(),
  });
}

/** Invoke `fn(args)` on VAULT with `from = WALLET`, authorized only by the
 *  passkey: record-simulate, re-sign the wallet's auth entry, submit. */
async function invokeAsWallet(deployer, walletId, kp, fn, args, label) {
  const src1 = await server.getAccount(deployer.publicKey());
  const recordTx = new TransactionBuilder(src1, { fee: "10000000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: VAULT, function: fn, args }))
    .setTimeout(60).build();
  const recSim = await server.simulateTransaction(recordTx);
  if (rpc.Api.isSimulationError(recSim)) throw new Error(`${label} record-sim: ${recSim.error}`);
  const entries = recSim.result.auth ?? [];
  const walletEntry = entries.find((e) => {
    const c = e.credentials();
    return c.switch().name === "sorobanCredentialsAddress"
      && Address.fromScAddress(c.address().address()).toString() === walletId;
  });
  if (!walletEntry) throw new Error(`${label}: no wallet auth entry in recording (got ${entries.length})`);
  if (entries.length !== 1) throw new Error(`${label}: unexpected extra auth entries (${entries.length})`);

  const signedEntry = await passkeySignEntry(walletEntry, walletId, kp);
  const src2 = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(src2, { fee: "10000000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: VAULT, function: fn, args, auth: [signedEntry] }))
    .setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${label} REJECTED at auth: ${sim.error}`);
  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(deployer);
  const sent = await server.sendTransaction(assembled);
  if (sent.status === "ERROR") throw new Error(`${label} send: ${JSON.stringify(sent.errorResult)}`);
  let res = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await server.getTransaction(sent.hash);
  }
  if (res.status !== "SUCCESS") throw new Error(`${label} settled as ${res.status} (tx ${sent.hash})`);
  log(`✅ ${label} → ${res.status} · tx ${sent.hash}`);
  log(`   ${EXPLORER}${sent.hash}`);
  return res;
}

async function main() {
  if (!DEPLOYER_SECRET) throw new Error("DEPLOYER_SECRET required");
  if (!WASM_HASH) throw new Error("WASM_HASH required");
  const deployer = Keypair.fromSecret(DEPLOYER_SECRET);
  const admin = sh(`stellar keys address ${SOURCE}`);

  // 0. Asset sanity: the vault's asset must be the USDC SAC we fund with.
  const assets = await view(admin, VAULT, "get_assets");
  const vaultAsset = assets[0].address;
  log("vault asset:", vaultAsset);
  if (vaultAsset !== USDC_SAC) throw new Error(`ASSET MISMATCH: vault uses ${vaultAsset}, funding with ${USDC_SAC}`);
  log("asset check: vault USDC == funding USDC ✓");

  // 1. Device passkey (P-256). Stands in for Face ID's key.
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const rawPub = Buffer.from(await subtle.exportKey("raw", kp.publicKey));
  log("passkey secp256r1 pubkey:", rawPub.toString("hex").slice(0, 18) + "…");

  // 2. Deploy a wallet bound to this passkey.
  const credId = "ab".repeat(32);
  const WALLET = sh(`stellar contract deploy --network ${CLI_NET} --source ${SOURCE} --wasm-hash ${WASM_HASH} -- --passkey_pubkey ${rawPub.toString("hex")} --passkey_cred_id ${credId} --admin ${admin} --max_absolute_per_charge ${MAX_ABS}`).split("\n").pop().trim();
  log("wallet:", WALLET);

  // 3. Fund the wallet with the vault's USDC.
  sh(`stellar contract invoke --network ${CLI_NET} --source ${SOURCE} --fee 10000000 --id ${USDC_SAC} -- transfer --from ${admin} --to ${WALLET} --amount ${FUND_USDC}`);
  const usdc0 = await view(admin, USDC_SAC, "balance", [scAddr(WALLET)]);
  log("wallet USDC after funding:", String(usdc0));

  // 4. DEPOSIT into the vault, authorized only by the passkey.
  await invokeAsWallet(deployer, WALLET, kp, "deposit",
    [vecI128([DEPOSIT]), vecI128([DEPOSIT]), scAddr(WALLET), nativeToScVal(true)],
    "COFRINHO DEPOSIT");
  const shares = await view(admin, VAULT, "balance", [scAddr(WALLET)]);
  const usdc1 = await view(admin, USDC_SAC, "balance", [scAddr(WALLET)]);
  log("vault shares (dfTokens):", String(shares), "· wallet USDC:", String(usdc1));
  if (BigInt(shares) <= 0n) throw new Error("no vault shares after deposit");
  if (BigInt(usdc1) !== BigInt(usdc0) - BigInt(DEPOSIT)) throw new Error("wallet USDC did not decrease by deposit amount");

  // 5. WITHDRAW everything back, authorized only by the passkey.
  await invokeAsWallet(deployer, WALLET, kp, "withdraw",
    [i128(shares), vecI128(["0"]), scAddr(WALLET)],
    "COFRINHO WITHDRAW");
  const shares2 = await view(admin, VAULT, "balance", [scAddr(WALLET)]);
  const usdc2 = await view(admin, USDC_SAC, "balance", [scAddr(WALLET)]);
  log("vault shares after withdraw:", String(shares2), "· wallet USDC:", String(usdc2));
  if (BigInt(shares2) !== 0n) throw new Error("shares not fully withdrawn");
  if (BigInt(usdc2) <= BigInt(usdc1)) throw new Error("USDC did not come back on withdraw");

  log("\n↑ cofre de dólar provado ponta-a-ponta: depósito e saque no vault DeFindex");
  log("  autorizados SÓ por assertion WebAuthn (passkey), verificada on-chain.");
  log(`  round-trip: ${String(usdc0)} → deposita ${DEPOSIT} → volta ${String(BigInt(usdc2) - BigInt(usdc1))} (fees/arredondamento do vault à parte).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
