#!/usr/bin/env node
// SlipPay integrity oracle — HTTP service (zero web deps, Node http).
// The chain-agnostic endpoint any rail calls before settling:
//   GET  /pubkey                     → the attester ed25519 key (register it via
//                                       the Soroban set_attester, or verify anywhere)
//   POST /register {agent_id, allowed_recipients, allowed_tools?, max_amount}
//                                     → commits the agent's surface, returns commitment
//   POST /attest   {agent_id, subscription_id, charges_done, recipient, amount, tools_used?}
//                                     → { ok, not_after, signature } | { ok:false, reason }
//   POST /verify   {subscription_id, charges_done, not_after, signature, pubkey}
//                                     → { valid }
//   POST /arc/attest {agent_id, spend:{vault, chainId, agentSigner, to, amount, nonce, deadline, orderId}}
//                                     → { ok, attestation (P-256 r‖s), digest, pubkey:{x,y} } | 403
//                                       (AgentVault on Arc; the attester recomputes the digest)
//
// Keys: SLIPPAY_ATTESTER_SECRET (ed25519, 64-hex) and SLIPPAY_ATTESTER_P256_SECRET (P-256 for
// Arc, 64-hex). If unset, demo keys are derived from fixed seeds (DEV ONLY — set real secrets).
//
// Counterparty check on /arc/attest (A-Identity risk_check, paid with Gateway nanopayments):
//   SLIPPAY_COUNTERPARTY_MODE      off (default) | warn (verdict logged + returned, never blocks)
//                                  | enforce (DENY and UNVERIFIABLE refuse the attestation)
//   SLIPPAY_COUNTERPARTY_KEY_FILE  payer EOA with a Gateway balance on Arc mainnet
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha256";
import { commitSurface, attest, verifyAttestation, publicKeyHex, hexToBytes } from "./oracle.mjs";
import { attestArc, p256PublicKey } from "./arc.mjs";
import { checkCounterparty, counterpartyGuard, gatewayAddress } from "./counterparty.mjs";

const PORT = Number(process.env.PORT || 8790);
// Loopback by default: /register is unauthenticated and, with the counterparty check on, every
// /arc/attest spends from the payer's Gateway balance. Set HOST=0.0.0.0 only behind auth.
const HOST = process.env.HOST || "127.0.0.1";
const priv = process.env.SLIPPAY_ATTESTER_SECRET
  ? hexToBytes(process.env.SLIPPAY_ATTESTER_SECRET)
  : sha256(new TextEncoder().encode("slippay-attester-dev-seed")); // DEV ONLY
const p256Priv = process.env.SLIPPAY_ATTESTER_P256_SECRET
  ? hexToBytes(process.env.SLIPPAY_ATTESTER_P256_SECRET)
  : sha256(new TextEncoder().encode("slippay-attester-p256-dev-seed")); // DEV ONLY

const cpMode = process.env.SLIPPAY_COUNTERPARTY_MODE ?? "off";
let counterparty, cpPayer;
if (cpMode !== "off") {
  const keyFile = process.env.SLIPPAY_COUNTERPARTY_KEY_FILE?.replace(/^~/, process.env.HOME ?? "~");
  if (!keyFile) throw new Error(`SLIPPAY_COUNTERPARTY_MODE=${cpMode} needs SLIPPAY_COUNTERPARTY_KEY_FILE`);
  const payerKey = readFileSync(keyFile, "utf8").trim();
  cpPayer = gatewayAddress(payerKey);
  counterparty = counterpartyGuard({ mode: cpMode, check: (q) => checkCounterparty(q, { privKey: payerKey }) });
}

const body = (req) => new Promise((res) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { res(d ? JSON.parse(d) : {}); } catch { res({}); } }); });
const json = (r, code, obj) => { r.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); r.end(JSON.stringify(obj)); };

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/pubkey") return json(res, 200, { pubkey: await publicKeyHex(priv), p256: p256PublicKey(p256Priv) });
    if (req.method === "POST" && req.url === "/arc/attest") {
      const v = await attestArc(await body(req), p256Priv, { counterparty });
      if (v.counterparty) process.stderr.write(`counterparty ${v.counterparty.decision}${v.counterparty.block ? " BLOCKED" : ""} · ${(v.counterparty.reasons ?? []).join("; ") || v.counterparty.error || ""}\n`);
      return json(res, v.ok ? 200 : 403, v);
    }
    if (req.method === "POST" && req.url === "/register") return json(res, 200, { commitment: commitSurface(await body(req)) });
    if (req.method === "POST" && req.url === "/attest") {
      const v = await attest(await body(req), priv);
      return json(res, v.ok ? 200 : 403, v); // 403 when the agent is refused — fail-closed
    }
    if (req.method === "POST" && req.url === "/verify") return json(res, 200, await verifyAttestation(await body(req)));
    json(res, 404, { error: "not found" });
  } catch (e) { json(res, 400, { error: String(e?.message ?? e) }); }
});

server.listen(PORT, HOST, async () => {
  process.stderr.write(`slippay-attester on ${HOST}:${PORT} · attester ${await publicKeyHex(priv)} · key=${process.env.SLIPPAY_ATTESTER_SECRET ? "env" : "DEV-seed"} · p256=${process.env.SLIPPAY_ATTESTER_P256_SECRET ? "env" : "DEV-seed"} · counterparty=${cpMode}${cpPayer ? ` payer ${cpPayer}` : ""}\n`);
});
