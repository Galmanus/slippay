// Red-team the LIVE AgentVault with the agent's session key treated as stolen. Read-only: every
// attack is an eth_call simulation of `spend` from a fresh random address (plus, with --relayer,
// one POST through the production relayer, which refuses before anything is broadcast), so this
// script never sends a transaction and never spends gas.
//
// Each attack names the custom error the vault must answer with; the run fails (exit 1) unless
// every attack is refused with exactly that error. Writes a markdown and a JSON report.
//
// usage (Node >= 22.18):
//   node packages/arc-agent/scripts/arc-redteam.mjs --network mainnet --vault 0x… --merchant 0x… \
//     --agent-key-file ~/.slippay/arc-mainnet-agent.key [--settled-tx 0x…] \
//     [--relayer https://api.slippay.cc/api/v1/arc] [--out docs/arc/redteam-mainnet]
import { createECDH, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  BaseError, ContractFunctionRevertedError, concatHex, createPublicClient, decodeFunctionData, defineChain, http, toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { agentVaultAbi } from "../src/abi.ts";
import { ARC_NETWORKS } from "../src/constants.ts";
import { attestationHash, signSpend } from "../src/intent.ts";

const { values: opt } = parseArgs({
  options: {
    network: { type: "string" },
    vault: { type: "string" },
    merchant: { type: "string" },
    "agent-key-file": { type: "string" },
    "settled-tx": { type: "string" },
    relayer: { type: "string" },
    out: { type: "string" },
  },
});
const network = opt.network;
if ((network !== "mainnet" && network !== "testnet") || !opt.vault || !opt.merchant || !opt["agent-key-file"]) {
  console.error("usage: arc-redteam.mjs --network mainnet|testnet --vault 0x… --merchant 0x… --agent-key-file f [--settled-tx 0x…] [--relayer url] [--out path]");
  process.exit(2);
}
const NET = ARC_NETWORKS[network];
const chain = defineChain({
  id: NET.chainId, name: network === "mainnet" ? "Arc" : "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [NET.rpcUrl] } },
});
const pub = createPublicClient({ chain, transport: http(NET.rpcUrl) });
const remote = await pub.getChainId();
if (remote !== NET.chainId) throw new Error(`RPC ${NET.rpcUrl} is chain ${remote}, expected ${NET.chainId} (${network})`);

let key = readFileSync(opt["agent-key-file"].replace(/^~/, process.env.HOME ?? "~"), "utf8").trim();
if (!key.startsWith("0x")) key = "0x" + key;
const stolen = privateKeyToAccount(key); // the "leaked" agent key
const thief = privateKeyToAccount(generatePrivateKey()).address; // where the attacker wants the money
const caller = privateKeyToAccount(generatePrivateKey()).address; // anyone can call spend()
const vault = opt.vault;
const session = await pub.readContract({ address: vault, abi: agentVaultAbi, functionName: "getSession", args: [stolen.address] });
if (!session.exists) throw new Error(`no session for ${stolen.address} on ${vault}`);
const block = await pub.getBlock();
const now = block.timestamp;

/** A request signed with the stolen key, as an attacker would build it. */
async function forged({ to = opt.merchant, amount = session.perTxCap, nonce = session.nonce, deadline = now + 300n, attestation = "0x" } = {}) {
  const intent = { agentSigner: stolen.address, to, amount, nonce, deadline, orderId: toHex(randomBytes(32)) };
  const s = await signSpend({ account: stolen, vault, chainId: NET.chainId, intent, pqThreshold: session.pqThreshold });
  return { req: { agentSigner: stolen.address, to, amount, deadline, orderId: intent.orderId, ecdsaSig: s.ecdsaSig, slhSig: s.slhSig, attestation }, digest: s.digest };
}

// P-256 ECDSA over a raw 32-byte digest with a key the attacker controls (Node's sign() always
// hashes first, so k*G comes from ECDH and the rest is modular arithmetic). The script checks
// each forged attestation on Arc's own P-256 precompile, so a BadAttestation below means "right
// message, wrong key", not a malformed signature.
const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const P256_PRECOMPILE = "0x0000000000000000000000000000000000000100";
const big = (b) => BigInt("0x" + Buffer.from(b).toString("hex"));
const mod = (a, m) => ((a % m) + m) % m;
function inv(a, m) {
  let [r0, r1, s0, s1] = [mod(a, m), m, 1n, 0n];
  while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  return mod(s0, m);
}
function scalar() {
  for (;;) { const k = big(randomBytes(32)); if (k > 0n && k < P256_N) return k; }
}
function point(k) {
  const e = createECDH("prime256v1");
  e.setPrivateKey(Buffer.from(k.toString(16).padStart(64, "0"), "hex"));
  const p = e.getPublicKey(); // 0x04 ‖ x ‖ y
  return { x: toHex(p.subarray(1, 33)), y: toHex(p.subarray(33, 65)) };
}
async function attackerAttestation(digest) {
  const h = attestationHash(digest);
  const d = scalar();
  const Q = point(d);
  for (;;) {
    const k = scalar();
    const r = mod(BigInt(point(k).x), P256_N);
    let s = mod(inv(k, P256_N) * (BigInt(h) + r * d), P256_N);
    if (!r || !s) continue;
    if (s > P256_N / 2n) s = P256_N - s;
    const sig = concatHex([toHex(r, { size: 32 }), toHex(s, { size: 32 })]);
    const v = await pub.call({ to: P256_PRECOMPILE, data: concatHex([h, sig, Q.x, Q.y]) });
    if (BigInt(v.data ?? "0x0") !== 1n) throw new Error("forged attestation does not verify under the attacker's key");
    return sig;
  }
}

/** Simulate spend(req) at the latest block; returns the custom error name, or "SETTLES". */
async function simulate(req) {
  try {
    await pub.simulateContract({ account: caller, address: vault, abi: agentVaultAbi, functionName: "spend", args: [req] });
    return "SETTLES";
  } catch (e) {
    const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    return rev?.data?.errorName ?? `unexpected: ${String(e?.shortMessage ?? e?.message ?? e).slice(0, 120)}`;
  }
}

const attacks = [];
async function attack(name, expected, run) {
  const observed = await run();
  attacks.push({ name, expected, observed, pass: observed === expected });
  console.error(`${observed === expected ? "PASS" : "FAIL"}  ${name}: expected ${expected}, got ${observed}`);
}

await attack("stolen agent key pays the attacker", "RecipientNotAllowed", async () =>
  simulate((await forged({ to: thief, amount: 1n })).req));
await attack("stolen agent key, one unit above the per-tx cap", "AmountExceedsCap", async () =>
  simulate((await forged({ amount: session.perTxCap + 1n })).req));
await attack("stolen agent key, valid spend to the merchant, no attestation", "BadAttestation", async () =>
  simulate((await forged()).req));
await attack("stolen agent key, valid P-256 attestation from the attacker's own key", "BadAttestation", async () => {
  const f = await forged();
  return simulate({ ...f.req, attestation: await attackerAttestation(f.digest) });
});
await attack("tampered amount on a validly signed request (relayer or MITM)", "BadSignature", async () => {
  const f = await forged({ amount: 1n });
  return simulate({ ...f.req, amount: 2n });
});
if (session.nonce > 0n) {
  await attack("re-signed with a used nonce and a fresh deadline", "BadSignature", async () =>
    simulate((await forged({ nonce: session.nonce - 1n })).req));
}
await attack("deadline in the past", "Expired", async () =>
  simulate((await forged({ deadline: now - 1n })).req));
if (opt["settled-tx"]) {
  // The vault checks the deadline before the signature: an old tx dies on Expired, a recent one
  // (deadline still ahead) on BadSignature, because its nonce is already used.
  const tx = await pub.getTransaction({ hash: opt["settled-tx"] });
  const { args } = decodeFunctionData({ abi: agentVaultAbi, data: tx.input });
  const expected = now > args[0].deadline ? "Expired" : "BadSignature";
  await attack(`byte-for-byte replay of settled tx ${opt["settled-tx"].slice(0, 10)}…`, expected, async () => simulate(args[0]));
}

if (opt.relayer) {
  const relay = async (f) => {
    const r = f.req;
    const res = await fetch(`${opt.relayer.replace(/\/$/, "")}/${network}/spend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vault, agentSigner: r.agentSigner, to: r.to, amount: r.amount.toString(), deadline: r.deadline.toString(),
        orderId: r.orderId, ecdsaSig: r.ecdsaSig, slhSig: r.slhSig,
      }),
    });
    const j = await res.json().catch(() => ({}));
    return { label: `HTTP ${res.status} ${j.error ?? ""}`.trim(), message: j.message ?? null, txHash: j.txHash ?? null };
  };
  // Both requests are ones the vault itself would revert (off-allowlist / above perTxCap), so even
  // an attester that signed them could not get them broadcast: the relayer simulates every spend
  // and never sends one that reverts. Never relay an in-bounds request from here: it would settle.
  for (const [name, f] of [
    ["stolen agent key asks the production relayer to pay the attacker", await forged({ to: thief, amount: 1n })],
    ["stolen agent key asks the production relayer for more than the cap", await forged({ amount: session.perTxCap + 1n })],
  ]) {
    const sim = await simulate(f.req);
    if (sim === "SETTLES") throw new Error(`refusing to relay "${name}": it would settle`);
    const r = await relay(f);
    const pass = r.label === "HTTP 403 attestation_refused" && !r.txHash;
    attacks.push({ name, expected: "HTTP 403 attestation_refused", observed: r.label, detail: r.message, pass });
    console.error(`${pass ? "PASS" : "FAIL"}  ${name}: got ${r.label}${r.message ? ` (${r.message})` : ""}`);
  }
}

const passed = attacks.filter((a) => a.pass).length;
const report = {
  network, chainId: NET.chainId, block: block.number.toString(), at: new Date(Number(now) * 1000).toISOString(),
  vault, agentSigner: stolen.address, merchant: opt.merchant,
  session: { perTxCap: session.perTxCap.toString(), windowCap: session.windowCap.toString(), attestThreshold: session.attestThreshold.toString(), nonce: session.nonce.toString() },
  attacks, passed, total: attacks.length,
};
const out = opt.out ?? `docs/arc/redteam-${network}`;
writeFileSync(`${out}.json`, JSON.stringify(report, null, 2) + "\n");
const usdc = (v) => (Number(v) / 1e6).toFixed(2);
writeFileSync(`${out}.md`, [
  `# AgentVault red-team, Arc ${network}`,
  "",
  `The agent's session key is treated as stolen. Every attack below was run against the live vault`,
  `[\`${vault}\`](${NET.explorer}/address/${vault}) at block ${report.block} (${report.at}): an \`eth_call\``,
  "simulation of `spend` from a random address, or a request through the production relayer. Nothing was",
  "broadcast. Generated by `packages/arc-agent/scripts/arc-redteam.mjs`.",
  "",
  `Session under attack: agent \`${stolen.address}\`, per-payment cap ${usdc(session.perTxCap)} USDC, window cap`,
  `${usdc(session.windowCap)} USDC, ${session.attestThreshold === 0n ? "every spend needs" : `spends above ${usdc(session.attestThreshold)} USDC need`} a fresh attestation from the integrity attester.`,
  "",
  "| Attack | Expected refusal | Observed | Result |",
  "| --- | --- | --- | --- |",
  ...attacks.map((a) => `| ${a.name} | \`${a.expected}\` | \`${a.observed}\` | ${a.pass ? "PASS" : "FAIL"} |`),
  "",
  `**${passed}/${attacks.length} refused as expected.**`,
  "",
  "What a stolen agent key cannot do here: pay anyone off the allowlist, exceed the per-payment cap, settle",
  "without a fresh attestation from the session's attester, forge that attestation, or reuse an old signature.",
  "The Foundry suite `contracts-evm/test/AgentVaultCompromise.t.sol` covers the stronger case where the",
  "attester key is stolen too: the on-chain caps, allowlist, expiry and revocation still bound the loss.",
  "",
].join("\n"));
console.error(`${passed}/${attacks.length} refused as expected · wrote ${out}.md and ${out}.json`);
process.exit(passed === attacks.length ? 0 : 1);
