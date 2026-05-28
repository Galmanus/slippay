#!/usr/bin/env node
// Policy-checkout spike HTTP server.
//
// Single POST endpoint `/api/policy-checkout/spike` that deploys a fresh
// slippay-smart-wallet instance on Stellar testnet, calls init() with
// placeholder passkey material, and calls install_policy() with the
// merchant/amount/interval supplied in the request body. Returns JSON
// with the new contract id + tx hashes + stellar.expert URLs.
//
// This is the trusted setup oracle described in DEPLOYED.md. It holds the
// slippay-deployer testnet key via stellar-cli's keyring and shells out
// to stellar contract invoke for each step. Latency is ~25-45s per
// request — acceptable for a spike demo, NOT production.
//
// Run from the repo root:
//   node scripts/policy-checkout-spike-server.mjs
//   # listens on http://localhost:8787
//
// In production, Vite's dev server proxies /api/* to this port; nginx
// would do the same. The frontend hits the same path regardless.

import { createServer } from "node:http";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

const execFile = promisify(_execFile);
const PORT = Number(process.env.PORT ?? 8787);
const NETWORK = process.env.NETWORK ?? "testnet";
const DEPLOYER_KEY = process.env.DEPLOYER_KEY ?? "slippay-deployer";

// Load wasm hash + template from the deployed env file.
const DEPLOY_ENV_PATH = new URL(
  "../contracts/smart-wallet/.testnet-deploy.env",
  import.meta.url,
);
function loadEnv() {
  const txt = readFileSync(DEPLOY_ENV_PATH, "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const ENV = loadEnv();
const WASM_HASH = ENV.SLIPPAY_SMART_WALLET_WASM_HASH_TESTNET;
if (!WASM_HASH) {
  console.error("missing SLIPPAY_SMART_WALLET_WASM_HASH_TESTNET");
  process.exit(1);
}

// Placeholder passkey material. v0.2 replaces with real WebAuthn credentials.
const PLACEHOLDER_PUBKEY =
  "04" + "01".repeat(32) + "02".repeat(32);
const PLACEHOLDER_CRED_ID = "03".repeat(32);

// v0.1 admin = the trusted setup oracle, i.e. this server's signing
// key. The wallet's `install_policy` and `revoke_policy` require this
// address's `require_auth`. v0.2 migrates admin to the wallet's own
// contract address so the user's passkey gates these mutations.
async function getAdminAddress() {
  const { stdout } = await execFile("stellar", ["keys", "address", DEPLOYER_KEY]);
  return stdout.toString().trim();
}

// Demo merchant + token. The TOKEN constant is the native XLM SAC; for v0.1
// we don't actually move USDC, we just install a policy that names this
// token. v0.2 wires USDC SAC.
const DEMO_MERCHANT = "GAE5HOWKZVVL5AOZQVJOZFY2ZB7Z2YK6PV4UKWOWB3KQWQCHY2PBVJMM";
const DEMO_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

async function stellar(args, opts = {}) {
  const t0 = Date.now();
  const { stdout, stderr } = await execFile("stellar", args, {
    maxBuffer: 8 * 1024 * 1024,
    ...opts,
  });
  const dt = Date.now() - t0;
  return { stdout: stdout.toString(), stderr: stderr.toString(), dt };
}

// Parse a stellar.expert tx URL out of stellar-cli stdout. The CLI prints
// `🔗 https://stellar.expert/explorer/testnet/tx/<hash>` on every submit.
function parseTxHash(stdout) {
  const m = stdout.match(/explorer\/testnet\/tx\/([0-9a-f]{64})/);
  return m ? m[1] : null;
}

async function deployAndInstall({
  amount_per_charge,
  max_per_charge,
  interval_seconds,
  expires_at,
}) {
  // Step 1: deploy fresh instance from wasm hash.
  const deploy = await stellar([
    "contract", "deploy",
    "--network", NETWORK,
    "--source", DEPLOYER_KEY,
    "--wasm-hash", WASM_HASH,
  ]);
  // stellar-cli prints the contract id on the last line of stdout.
  const wallet = deploy.stdout.trim().split(/\r?\n/).pop().trim();
  if (!wallet.startsWith("C") || wallet.length !== 56) {
    throw new Error(`deploy: unexpected contract id '${wallet}'`);
  }

  // Step 2: init wallet with admin = the deployer's G-account.
  const adminAddr = await getAdminAddress();
  const init = await stellar([
    "contract", "invoke",
    "--network", NETWORK,
    "--source", DEPLOYER_KEY,
    "--id", wallet,
    "--",
    "init",
    "--passkey_pubkey", PLACEHOLDER_PUBKEY,
    "--passkey_cred_id", PLACEHOLDER_CRED_ID,
    "--admin", adminAddr,
  ]);
  const initTx = parseTxHash(init.stdout + init.stderr);

  // Step 3: install_policy.
  const install = await stellar([
    "contract", "invoke",
    "--network", NETWORK,
    "--source", DEPLOYER_KEY,
    "--id", wallet,
    "--",
    "install_policy",
    "--merchant", DEMO_MERCHANT,
    "--token", DEMO_TOKEN,
    "--amount_per_charge", String(amount_per_charge),
    "--max_per_charge", String(max_per_charge),
    "--interval_seconds", String(interval_seconds),
    "--expires_at", String(expires_at),
  ]);
  const policyTx = parseTxHash(install.stdout + install.stderr);

  return {
    wallet_contract_id: wallet,
    init_tx: initTx,
    policy_tx: policyTx,
    wallet_url: `https://stellar.expert/explorer/testnet/contract/${wallet}`,
    init_tx_url: initTx
      ? `https://stellar.expert/explorer/testnet/tx/${initTx}`
      : null,
    policy_tx_url: policyTx
      ? `https://stellar.expert/explorer/testnet/tx/${policyTx}`
      : null,
    network: NETWORK,
    timing_ms: { deploy: deploy.dt, init: init.dt, install: install.dt },
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid JSON body");
  }
}

const server = createServer(async (req, res) => {
  // CORS for the Vite dev server on :5173.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  if (req.url !== "/api/policy-checkout/spike") {
    res.writeHead(404, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "not_found" }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    // Defaults match the policy-checkout-spec demo registry.
    const params = {
      amount_per_charge: body.amount_per_charge ?? 29_000_000,
      max_per_charge: body.max_per_charge ?? 35_000_000,
      interval_seconds: body.interval_seconds ?? 2_592_000,
      expires_at: body.expires_at ?? 0,
    };
    console.log(
      new Date().toISOString(),
      "spike_create",
      JSON.stringify(params),
    );
    const result = await deployAndInstall(params);
    console.log(
      new Date().toISOString(),
      "spike_created",
      result.wallet_contract_id,
      `(${result.timing_ms.deploy + result.timing_ms.init + result.timing_ms.install}ms)`,
    );
    res.writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify(result));
  } catch (err) {
    console.error(new Date().toISOString(), "spike_error", err.message);
    res.writeHead(500, { "content-type": "application/json" })
      .end(JSON.stringify({ error: "server_error", message: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`policy-checkout-spike-server :${PORT}`);
  console.log(`network=${NETWORK} deployer=${DEPLOYER_KEY} wasm_hash=${WASM_HASH.slice(0,16)}...`);
});
