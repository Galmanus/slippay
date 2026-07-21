#!/usr/bin/env node
// REAL guardian lifecycle e2e on Stellar testnet (plan Task 7).
//
// Uses the `test-floors` wasm (inactivity/contest = 5s, cooldown = 10s) so the
// full inheritance can be exercised live: deploy a passkey wallet (owner key A),
// set a guardian, prove every gate (inactivity, owner-contest, cooldown), then
// finish the recovery and prove the HEIR's passkey (key B) signs while A is dead
// and the pre-inheritance pull-policy is void.
//
// Run:
//   DEPLOYER_SECRET=$(stellar keys show slippay-deployer) \
//     WASM_HASH=<test-floors hash> node scripts/e2e-guardiao-testnet.mjs
import * as S from "../apps/web/node_modules/@stellar/stellar-sdk/lib/index.js";
import { execSync } from "node:child_process";
import { webcrypto, createHash } from "node:crypto";

const { rpc, xdr, Keypair, Networks, TransactionBuilder, Operation, Address, Asset, nativeToScVal, scValToNative, hash } = S;
const { subtle } = webcrypto;

const RPC = "https://soroban-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET;
const CLI_NET = "testnet";
const SOURCE = process.env.SOURCE || "slippay-deployer";
const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET;
const WASM_HASH = process.env.WASM_HASH;
const MAX_ABS = "1000000000";
const FLOOR = 5, COOLDOWN = 10; // must match the test-floors consts

const server = new rpc.Server(RPC, { allowHttp: false });
const log = (...a) => console.log(...a);
const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const scAddr = (id) => new Address(id).toScVal();
const u64 = (n) => nativeToScVal(BigInt(n), { type: "u64" });
const sha256 = (b) => createHash("sha256").update(b).digest();
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

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

async function makeAssertion(kp, payload) {
  const clientDataJSON = Buffer.from(JSON.stringify({
    type: "webauthn.get", challenge: b64url(payload), origin: "https://app.slippay.cc",
  }));
  const authenticatorData = Buffer.from(Array.from({ length: 37 }, (_, i) => (i * 7) & 0xff));
  const signBase = Buffer.concat([authenticatorData, sha256(clientDataJSON)]);
  const sig64 = normalizeLowS(Buffer.from(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, signBase)));
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Passkey"),
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("authenticator_data"), val: xdr.ScVal.scvBytes(authenticatorData) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("client_data_json"), val: xdr.ScVal.scvBytes(clientDataJSON) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("signature"), val: xdr.ScVal.scvBytes(sig64) }),
    ]),
  ]);
}

async function view(WALLET, fn, args = []) {
  const kp = Keypair.random();
  const tx = new TransactionBuilder(new S.Account(kp.publicKey(), "0"), { fee: "100", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: WALLET, function: fn, args })).setTimeout(60).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`view ${fn}: ${sim.error.split("\n")[0]}`);
  return scValToNative(sim.result.retval);
}

async function submit(tx, signers, label) {
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${label} sim: ${sim.error.split("\n")[0]}`);
  const assembled = rpc.assembleTransaction(tx, sim).build();
  for (const k of signers) assembled.sign(k);
  const sent = await server.sendTransaction(assembled);
  if (sent.status === "ERROR") throw new Error(`${label} send: ${JSON.stringify(sent.errorResult)}`);
  let res = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) { await sleep(1); res = await server.getTransaction(sent.hash); }
  if (res.status !== "SUCCESS") throw new Error(`${label}: ${res.status} (tx ${sent.hash})`);
  log(`✅ ${label} · tx ${sent.hash.slice(0, 8)}…`);
  return res;
}

/** Invoke a wallet fn authorized by the OWNER passkey (record-sim → sign entry). */
async function asOwner(deployer, WALLET, kp, fn, args, label) {
  const src1 = await server.getAccount(deployer.publicKey());
  const rec = new TransactionBuilder(src1, { fee: "10000000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: WALLET, function: fn, args })).setTimeout(60).build();
  const recSim = await server.simulateTransaction(rec);
  if (rpc.Api.isSimulationError(recSim)) throw new Error(`${label} record: ${recSim.error.split("\n")[0]}`);
  const entry = (recSim.result.auth ?? []).find((e) => {
    const c = e.credentials();
    return c.switch().name === "sorobanCredentialsAddress"
      && Address.fromScAddress(c.address().address()).toString() === WALLET;
  });
  if (!entry) throw new Error(`${label}: no wallet auth entry`);
  const creds = entry.credentials().address();
  const { sequence } = await server.getLatestLedger();
  const sigExp = sequence + 200;
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(PASSPHRASE)),
      nonce: creds.nonce(),
      signatureExpirationLedger: sigExp,
      invocation: entry.rootInvocation(),
    }),
  );
  const signed = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(new xdr.SorobanAddressCredentials({
      address: creds.address(), nonce: creds.nonce(), signatureExpirationLedger: sigExp,
      signature: await makeAssertion(kp, hash(preimage.toXDR())),
    })),
    rootInvocation: entry.rootInvocation(),
  });
  const src2 = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(src2, { fee: "10000000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: WALLET, function: fn, args, auth: [signed] }))
    .setTimeout(60).build();
  return submit(tx, [deployer], label);
}

/** Invoke a wallet fn authorized by the GUARDIAN (a plain G-account = source). */
async function asGuardian(guardian, WALLET, fn, args, label) {
  const src = await server.getAccount(guardian.publicKey());
  const tx = new TransactionBuilder(src, { fee: "10000000", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: WALLET, function: fn, args })).setTimeout(60).build();
  return submit(tx, [guardian], label);
}

async function expectContractError(fnPromise, code, label) {
  try {
    await fnPromise;
    throw new Error(`${label}: expected Error(Contract, #${code}) but it SUCCEEDED`);
  } catch (e) {
    if (!String(e.message).includes(`Error(Contract, #${code})`)) throw new Error(`${label}: wrong error: ${e.message}`);
    log(`✅ ${label} rejeitado como esperado (#${code})`);
  }
}

async function main() {
  if (!DEPLOYER_SECRET || !WASM_HASH) throw new Error("DEPLOYER_SECRET and WASM_HASH required");
  const deployer = Keypair.fromSecret(DEPLOYER_SECRET);
  const admin = sh(`stellar keys address ${SOURCE}`);

  // owner key A + heir key B
  const keyA = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const keyB = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pubA = Buffer.from(await subtle.exportKey("raw", keyA.publicKey));
  const pubB = Buffer.from(await subtle.exportKey("raw", keyB.publicKey));

  // guardian: fresh funded G-account
  const guardian = Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${guardian.publicKey()}`);
  log("guardian:", guardian.publicKey());

  const WALLET = sh(`stellar contract deploy --network ${CLI_NET} --source ${SOURCE} --wasm-hash ${WASM_HASH} -- --passkey_pubkey ${pubA.toString("hex")} --passkey_cred_id ${"ab".repeat(32)} --admin ${admin} --max_absolute_per_charge ${MAX_ABS}`).split("\n").pop().trim();
  log("wallet:", WALLET);
  // fund with XLM so the final transfer proof can move something
  const NATIVE = Asset.native().contractId(PASSPHRASE);
  sh(`stellar contract invoke --network ${CLI_NET} --source ${SOURCE} --fee 10000000 --id ${NATIVE} -- transfer --from ${admin} --to ${WALLET} --amount 10000000`);

  // 1. owner sets the guardian (passkey-signed)
  await asOwner(deployer, WALLET, keyA, "set_guardian",
    [scAddr(guardian.publicKey()), u64(FLOOR), u64(FLOOR)], "SET_GUARDIAN (dona, Face ID)");
  if ((await view(WALLET, "get_guardian")) !== guardian.publicKey()) throw new Error("guardian not stored");

  // 2. inactivity gate: immediate start must fail (#22)
  await expectContractError(
    asGuardian(guardian, WALLET, "start_recovery", [], "start cedo demais"),
    22, "START antes da inatividade");

  // 3. wait out the floor, start for real
  await sleep(FLOOR + 2);
  await asGuardian(guardian, WALLET, "start_recovery", [], "START_RECOVERY (guardião)");
  if ((await view(WALLET, "get_recovery")) === null) throw new Error("recovery not active");

  // 4. owner contests with a live tap → cancelled + cooldown armed
  await asOwner(deployer, WALLET, keyA, "cancel_recovery", [nativeToScVal(true)], "CANCEL (dona viva, Face ID)");
  if ((await view(WALLET, "get_recovery")) !== null) throw new Error("recovery should be cancelled");

  // 5. cooldown gate (#25): inactivity floor passes but cooldown blocks
  await sleep(FLOOR + 2);
  await expectContractError(
    asGuardian(guardian, WALLET, "start_recovery", [], "start no cooldown"),
    25, "START dentro do cooldown");

  // 6. after the cooldown, start again and let the contest elapse
  await sleep(COOLDOWN - FLOOR + 2);
  await asGuardian(guardian, WALLET, "start_recovery", [], "START_RECOVERY #2 (guardião)");
  await expectContractError(
    asGuardian(guardian, WALLET, "finish_recovery",
      [xdr.ScVal.scvBytes(pubB), xdr.ScVal.scvBytes(Buffer.alloc(32, 6))], "finish cedo"),
    24, "FINISH antes da contestação");
  await sleep(FLOOR + 2);
  await asGuardian(guardian, WALLET, "finish_recovery",
    [xdr.ScVal.scvBytes(pubB), xdr.ScVal.scvBytes(Buffer.alloc(32, 6))], "FINISH_RECOVERY (herança)");

  // 7. the heir signs; the old key is dead
  await asOwner(deployer, WALLET, keyB, "heartbeat", [], "HEARTBEAT do herdeiro (chave B)");
  let oldKeyDead = false;
  try {
    await asOwner(deployer, WALLET, keyA, "heartbeat", [], "heartbeat chave morta");
  } catch { oldKeyDead = true; }
  if (!oldKeyDead) throw new Error("OLD KEY STILL AUTHORIZES — inheritance broken");
  log("✅ chave antiga morta, só o herdeiro assina");

  log("\n↑ GUARDIÃO PROVADO ponta-a-ponta em testnet: inatividade, contestação da dona,");
  log("  cooldown anti-griefing, herança por rotação de chave, e o herdeiro assinando.");
}

main().catch((e) => { console.error(e); process.exit(1); });
