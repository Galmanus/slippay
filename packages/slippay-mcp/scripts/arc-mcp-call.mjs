// Call one slippay-mcp tool over stdio, the way Claude Code / Codex would, and print the result.
// Keys are read from files and handed to the server process through its environment; they are
// never printed.
//
// usage (Node >= 22.18, after building packages/arc-agent):
//   node packages/slippay-mcp/scripts/arc-mcp-call.mjs <tool> '<json args>' \
//     --network mainnet --vault 0x… --agent-key-file f [--float-key-file f] [--from-block N]
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    network: { type: "string", default: "testnet" },
    vault: { type: "string" },
    "agent-key-file": { type: "string" },
    "float-key-file": { type: "string" },
    "from-block": { type: "string" },
    relayer: { type: "string" },
  },
});
const [tool, rawArgs = "{}"] = positionals;
if (!tool || !opt.vault || !opt["agent-key-file"]) {
  console.error("usage: arc-mcp-call.mjs <tool> '<json args>' --network mainnet|testnet --vault 0x… --agent-key-file f [--float-key-file f] [--from-block N] [--relayer url]");
  process.exit(2);
}
const readKey = (f) => {
  const k = readFileSync(f.replace(/^~/, process.env.HOME ?? "~"), "utf8").trim();
  return k.startsWith("0x") ? k : "0x" + k;
};
const env = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  SLIPPAY_ARC_NETWORK: opt.network,
  SLIPPAY_ARC_VAULT: opt.vault,
  SLIPPAY_ARC_AGENT_KEY: readKey(opt["agent-key-file"]),
  ...(opt["float-key-file"] && { SLIPPAY_ARC_FLOAT_KEY: readKey(opt["float-key-file"]) }),
  ...(opt["from-block"] && { SLIPPAY_ARC_FROM_BLOCK: opt["from-block"] }),
  ...(opt.relayer && { SLIPPAY_ARC_RELAYER_URL: opt.relayer }),
};

const server = resolve(dirname(fileURLToPath(import.meta.url)), "../src/index.ts");
const transport = new StdioClientTransport({ command: process.execPath, args: [server], env, stderr: "inherit" });
const client = new Client({ name: "arc-mcp-call", version: "0.1.0" });
await client.connect(transport);
const started = Date.now();
const res = await client.callTool({ name: tool, arguments: JSON.parse(rawArgs) }, undefined, { timeout: 600_000 });
for (const c of res.content ?? []) console.log(c.type === "text" ? c.text : JSON.stringify(c));
console.error(`${tool}: ${res.isError ? "ERROR" : "ok"} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
await client.close();
process.exit(res.isError ? 1 : 0);
