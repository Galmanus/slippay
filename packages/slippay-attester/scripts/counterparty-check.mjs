#!/usr/bin/env node
// A-Identity counterparty check from the command line, paid with a Circle Gateway nanopayment.
//
//   mainnet risk_check (ALLOW / WARN / DENY), what the Arc cohort pilot counts as external usage:
//     ARC_PAYER_KEY_FILE=~/.slippay/<payer>.key node scripts/counterparty-check.mjs \
//       --counterparty 0x… --amount-usd 25
//   testnet probe (A-Identity's only paid Arc-testnet route, proves the payment path end to end):
//     ARC_PAYER_KEY_FILE=~/.slippay/arc-testnet-deployer.key node scripts/counterparty-check.mjs --probe
//
// The payer is an EOA with a Gateway balance (packages/arc-agent/scripts/gateway-deposit.mjs).
// Prints the verdict as JSON; exit 0 on ALLOW/WARN, 1 on DENY, 2 on UNVERIFIABLE or usage errors.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { AID_PAYTO, checkCounterparty, gatewayAddress, payAndFetch } from "../src/counterparty.mjs";

const PROBE_URL = "https://a-identity.xyz/api/x402/nano/data";

const { values: opt } = parseArgs({
  options: {
    counterparty: { type: "string" },
    "amount-usd": { type: "string" },
    probe: { type: "boolean" },
    "key-file": { type: "string" },
    "timeout-ms": { type: "string" },
  },
});
const keyFile = (opt["key-file"] ?? process.env.ARC_PAYER_KEY_FILE)?.replace(/^~/, process.env.HOME ?? "~");
if (!keyFile) {
  console.error("set --key-file or ARC_PAYER_KEY_FILE to a file holding the payer's private key");
  process.exit(2);
}
const privKey = readFileSync(keyFile, "utf8").trim();
const timeoutMs = Number(opt["timeout-ms"] ?? 30_000); // CLI tolerates a Render cold start; the gate uses the 4 s default
console.error(`payer ${gatewayAddress(privKey)}`);

if (opt.probe) {
  const r = await payAndFetch(PROBE_URL, { method: "GET" }, {
    privKey, timeoutMs, policy: { network: "eip155:5042002", maxAmount: 1000n, payTo: AID_PAYTO },
  });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 2);
}

if (!opt.counterparty || opt["amount-usd"] == null) {
  console.error("usage: counterparty-check.mjs --counterparty <0x… | #agentId> --amount-usd <n>   |   --probe");
  process.exit(2);
}
const v = await checkCounterparty({ counterparty: opt.counterparty, amountUsd: Number(opt["amount-usd"]) }, { privKey, timeoutMs });
console.log(JSON.stringify(v, null, 2));
process.exit(v.decision === "DENY" ? 1 : v.decision === "UNVERIFIABLE" ? 2 : 0);
