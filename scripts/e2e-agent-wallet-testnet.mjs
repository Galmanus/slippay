#!/usr/bin/env node
// Agent-wallet enforcement e2e on Stellar testnet.
//
// Proves the money-shot: a delegated agent, signing with its own ed25519
// session key (WalletAuth::Agent), can move funds WITHIN its on-chain budget,
// and the contract REJECTS a transfer ABOVE the per-tx cap — no human in the
// loop, enforced in __check_auth.
//
// Run (sdk resolved from apps/web):
//   NODE_PATH=apps/web/node_modules node scripts/e2e-agent-wallet-testnet.mjs
import * as S from "../apps/web/node_modules/@stellar/stellar-sdk/lib/index.js";
import { execSync } from "node:child_process";

const { rpc, xdr, Keypair, Networks, TransactionBuilder, Operation, Address, Asset, nativeToScVal, hash, BASE_FEE } = S;

const RPC = process.env.RPC || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.PASSPHRASE || Networks.TESTNET;
const CLI_NET = process.env.CLI_NETWORK || "testnet";
const SOURCE = process.env.SOURCE || "slippay-deployer";
const WALLET = process.env.WALLET || "CB65SDIIMRVZJBAEWVKNAAYHKUP5WWR2JCHNOTGWYAGHWPTJS7CRBSKN";
const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET;
// Amounts (7-decimal stroops). Small defaults; override for mainnet.
const PER_TX = process.env.PER_TX || "50000000";
const WINDOW_CAP = process.env.WINDOW_CAP || "200000000";
const FUND = process.env.FUND || "100000000";
const WITHIN = process.env.WITHIN || "30000000";
const OVER = process.env.OVER || "80000000";
const server = new rpc.Server(RPC, { allowHttp: false });

const log = (...a) => console.log(...a);
const sh = (cmd) => { log("· " + cmd.replace(DEPLOYER_SECRET ?? "x", "***")); return execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim(); };

const NATIVE_SAC = Asset.native().contractId(PASSPHRASE);

function scAddr(id) { return new Address(id).toScVal(); }
function i128(n) { return nativeToScVal(BigInt(n), { type: "i128" }); }

// Build a SorobanAuthorizedInvocation for nativeSac.transfer(from, to, amount).
function transferInvocation(from, to, amount) {
  return new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(NATIVE_SAC).toScAddress(),
        functionName: "transfer",
        args: [scAddr(from), scAddr(to), i128(amount)],
      })
    ),
    subInvocations: [],
  });
}

// Sign an agent WalletAuth::Agent credential over the host payload.
function signAgentAuth(agent, invocation, nonce, sigExpLedger) {
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(PASSPHRASE)),
      nonce: xdr.Int64.fromString(String(nonce)),
      signatureExpirationLedger: sigExpLedger,
      invocation,
    })
  );
  const payload = hash(preimage.toXDR());
  const sig = agent.sign(payload); // 64-byte ed25519
  const walletAuth = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Agent"),
    xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("session_pubkey"), val: xdr.ScVal.scvBytes(agent.rawPublicKey()) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("signature"), val: xdr.ScVal.scvBytes(sig) }),
    ]),
  ]);
  const creds = new xdr.SorobanAddressCredentials({
    address: new Address(WALLET).toScAddress(),
    nonce: xdr.Int64.fromString(String(nonce)),
    signatureExpirationLedger: sigExpLedger,
    signature: walletAuth,
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(creds),
    rootInvocation: invocation,
  });
}

async function agentTransfer(agent, deployer, to, amount, label) {
  const { sequence } = await server.getLatestLedger();
  const sigExp = sequence + 200;
  const nonce = Math.floor(Math.random() * 1e15);
  const invocation = transferInvocation(WALLET, to, amount);
  const authEntry = signAgentAuth(agent, invocation, nonce, sigExp);

  const op = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeInvokeContract(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(NATIVE_SAC).toScAddress(),
        functionName: "transfer",
        args: [scAddr(WALLET), scAddr(to), i128(amount)],
      })
    ),
    auth: [authEntry],
  });

  const src = await server.getAccount(deployer.publicKey());
  const tx = new TransactionBuilder(src, { fee: String(Number(BASE_FEE) * 100), networkPassphrase: PASSPHRASE })
    .addOperation(op).setTimeout(60).build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    log(`\n[${label}] amount=${amount} → REJECTED at auth: ${sim.error}\n`);
    return { rejected: true, error: sim.error };
  }
  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(deployer);
  const sent = await server.sendTransaction(assembled);
  let res = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) { await new Promise(r => setTimeout(r, 1000)); res = await server.getTransaction(sent.hash); }
  log(`\n[${label}] amount=${amount} → ${res.status} · tx ${sent.hash}`);
  log(`  https://stellar.expert/explorer/testnet/tx/${sent.hash}\n`);
  return { rejected: false, status: res.status, hash: sent.hash };
}

async function main() {
  if (!DEPLOYER_SECRET) { console.error("DEPLOYER_SECRET required"); process.exit(1); }
  const deployer = Keypair.fromSecret(DEPLOYER_SECRET);
  const agent = Keypair.random();
  const agentPubHex = agent.rawPublicKey().toString("hex");
  const recipient = Keypair.random().publicKey();
  log("native SAC:", NATIVE_SAC);
  log("agent ed25519 pubkey:", agentPubHex);
  log("recipient:", recipient);

  // 0. Init the wallet (dummy passkey; admin = deployer). Idempotent-ish: ignore if already init.
  log("\n=== init wallet (admin = deployer) ===");
  const PUBKEY = "04" + "01".repeat(32) + "02".repeat(32);
  const CRED = "03".repeat(32);
  sh(`stellar contract invoke --network ${CLI_NET} --source ${SOURCE} --id ${WALLET} -- init --passkey_pubkey ${PUBKEY} --passkey_cred_id ${CRED} --admin ${deployer.publicKey()} >/dev/null 2>&1 || true`);

  // 1. Install an agent session keyed by the REAL agent pubkey (admin-signed via CLI).
  //    per_tx_cap 5 XLM, window 20 XLM / 24h, allowlist = [recipient] (A2: non-empty required).
  log("=== install_agent_session (real ed25519 pubkey, non-empty allowlist) ===");
  sh(`stellar contract invoke --network ${CLI_NET} --source ${SOURCE} --id ${WALLET} -- install_agent_session --session_pubkey ${agentPubHex} --token ${NATIVE_SAC} --per_tx_cap ${PER_TX} --window_seconds 86400 --window_cap ${WINDOW_CAP} --expires_at 0 --allow_recipients '["${recipient}"]' >/dev/null 2>&1 || true`);

  // 2. Fund the wallet contract with 10 XLM via the native SAC (deployer → wallet).
  log("=== fund wallet with XLM ===");
  sh(`stellar contract invoke --network ${CLI_NET} --source ${SOURCE} --id ${NATIVE_SAC} -- transfer --from ${deployer.publicKey()} --to ${WALLET} --amount ${FUND} >/dev/null 2>&1 || true`);

  // 3. Agent transfer WITHIN per-tx cap → must succeed.
  const ok = await agentTransfer(agent, deployer, recipient, WITHIN, "WITHIN cap");

  // 4. Agent transfer ABOVE per-tx cap → must be rejected.
  const over = await agentTransfer(agent, deployer, recipient, OVER, "OVER cap");

  log("=== RESULT ===");
  log("within-cap transfer:", ok.rejected ? "REJECTED (unexpected)" : `${ok.status} ${ok.hash ?? ""}`);
  log("over-cap transfer:  ", over.rejected ? `REJECTED ✓ (${over.error})` : `${over.status} (unexpected — should reject)`);
}

main().catch(e => { console.error(e); process.exit(1); });
