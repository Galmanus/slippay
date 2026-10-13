import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { encodeSpendCall } from "@slippay/arc-agent";
import type { Hex } from "viem";
import { type ArcRpc, RelayError, relaySpend } from "../lib/arc/relayer.ts";
import { req } from "./_helpers.ts";

const VAULT: Hex = "0x9FF0A12cc3cD4654150527040Cc6481DED01C8F2";
const AGENT: Hex = "0xe05fcC23807536bEe418f142D19fa0d21BB0cfF7";
const TO: Hex = "0x000000000000000000000000000000000000bEEF";
const ECDSA = `0x${"11".repeat(65)}` as Hex;
const ORDER = `0x${"ab".repeat(32)}` as Hex;
const GWEI = 1_000_000_000n;

function body(overrides: Record<string, unknown> = {}) {
  return {
    vault: VAULT,
    agentSigner: AGENT,
    to: TO,
    amount: "1000000",
    deadline: String(Math.floor(Date.now() / 1000) + 600),
    orderId: ORDER,
    ecdsaSig: ECDSA,
    slhSig: "0x",
    ...overrides,
  };
}

type Sent = { to: string; data: string; gas: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint };

function fakeRpc(opts: { revert?: string; gas?: bigint; maxFee?: bigint } = {}) {
  const sent: Sent[] = [];
  const rpc: ArcRpc = {
    call: async () => {
      if (opts.revert) throw new Error(opts.revert);
    },
    estimateGas: async () => opts.gas ?? 90_000n,
    feesPerGas: async () => ({ maxFeePerGas: opts.maxFee ?? 1n * GWEI, maxPriorityFeePerGas: 0n }),
    send: async (tx) => {
      sent.push(tx);
      return `0x${"cd".repeat(32)}` as Hex;
    },
    waitReceipt: async () => ({ status: "success", blockNumber: 123n }),
  };
  return { rpc, sent };
}

const policy = { allowedVaults: new Set([VAULT.toLowerCase()]), gasCap: 600_000n, maxFeeCap: 200n * GWEI };

Deno.test("arc relayer: rejects a vault that is not pinned", async () => {
  const { rpc, sent } = fakeRpc();
  const e = await assertRejects(
    () => relaySpend(body({ vault: "0x0000000000000000000000000000000000000001" }), { rpc, ...policy }),
    RelayError,
  );
  assertEquals(e.code, "vault_not_allowed");
  assertEquals(sent.length, 0);
});

Deno.test("arc relayer: rejects malformed signatures and addresses", async () => {
  const { rpc } = fakeRpc();
  for (const bad of [{ ecdsaSig: "0x1234" }, { slhSig: "0x" + "00".repeat(100) }, { to: "0xnope" }, { amount: "-1" }, { orderId: "0x12" }]) {
    const e = await assertRejects(() => relaySpend(body(bad), { rpc, ...policy }), RelayError);
    assertEquals(e.code, "invalid_request");
  }
});

Deno.test("arc relayer: accepts a 7856-byte SLH-DSA signature", async () => {
  const { rpc, sent } = fakeRpc();
  await relaySpend(body({ slhSig: "0x" + "ee".repeat(7856) }), { rpc, ...policy });
  assertEquals(sent.length, 1);
});

Deno.test("arc relayer: rejects an expired deadline without touching the chain", async () => {
  const { rpc, sent } = fakeRpc();
  const e = await assertRejects(() => relaySpend(body({ deadline: "1000" }), { rpc, ...policy }), RelayError);
  assertEquals(e.code, "expired");
  assertEquals(sent.length, 0);
});

Deno.test("arc relayer: a spend that would revert is never broadcast", async () => {
  const { rpc, sent } = fakeRpc({ revert: "execution reverted: WindowCapExceeded()" });
  const e = await assertRejects(() => relaySpend(body(), { rpc, ...policy }), RelayError);
  assertEquals(e.code, "simulation_reverted");
  assertEquals(sent.length, 0);
});

Deno.test("arc relayer: refuses when the gas estimate exceeds the cap", async () => {
  const { rpc, sent } = fakeRpc({ gas: 700_000n });
  const e = await assertRejects(() => relaySpend(body(), { rpc, ...policy }), RelayError);
  assertEquals(e.code, "gas_cap");
  assertEquals(sent.length, 0);
});

Deno.test("arc relayer: refuses when the network fee exceeds the cap", async () => {
  const { rpc, sent } = fakeRpc({ maxFee: 500n * GWEI });
  const e = await assertRejects(() => relaySpend(body(), { rpc, ...policy }), RelayError);
  assertEquals(e.code, "fee_cap");
  assertEquals(sent.length, 0);
});

Deno.test("arc relayer: broadcasts the exact spend calldata above Arc's 20 gwei floor", async () => {
  const { rpc, sent } = fakeRpc({ maxFee: 1n * GWEI, gas: 90_000n });
  const b = body();
  const res = await relaySpend(b, { rpc, ...policy });
  assertEquals(sent.length, 1);
  const tx = sent[0]!;
  assertEquals(tx.to.toLowerCase(), VAULT.toLowerCase());
  assertEquals(
    tx.data,
    encodeSpendCall(
      {
        agentSigner: AGENT,
        to: TO,
        amount: 1_000_000n,
        nonce: 0n, // nonce is not part of calldata; the vault reads its own
        deadline: BigInt(b.deadline),
        orderId: ORDER,
      },
      { ecdsaSig: ECDSA, slhSig: "0x" },
    ),
  );
  assertEquals(tx.maxFeePerGas >= 20n * GWEI, true);
  assertEquals(tx.gas >= 90_000n, true); // estimate plus headroom
  assertEquals(res.txHash, "0x" + "cd".repeat(32));
  assertEquals(res.status, "success");
});

Deno.test("arc relayer route: 503 when the network's relayer key is not configured", async () => {
  Deno.env.delete("ARC_TESTNET_RELAYER_KEY");
  const res = await req("/v1/arc/testnet/spend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body()),
  });
  assertEquals(res.status, 503);
  await res.body?.cancel();
});
