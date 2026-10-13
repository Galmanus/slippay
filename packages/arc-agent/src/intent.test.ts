import { describe, expect, it } from "vitest";
import { decodeFunctionData, keccak256, recoverAddress, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { slh_dsa_sha2_128s } from "@noble/post-quantum/slh-dsa.js";
import { agentVaultAbi } from "./abi.ts";
import { encodeSpendCall, signSpend, slhKeygen, spendDigest, type SpendIntent } from "./intent.ts";

// Same inputs as contracts-evm/test/DigestVector.t.sol — the Solidity contract is the source of truth.
const VAULT: Address = "0x0000000000000000000000000000000000a6E57a";
const AGENT = privateKeyToAccount("0x00000000000000000000000000000000000000000000000000000000000a11ce");
const VECTOR: SpendIntent = {
  agentSigner: AGENT.address,
  to: "0x000000000000000000000000000000000000bEEF",
  amount: 12_345_678n,
  nonce: 7n,
  deadline: 1_900_000_000n,
  orderId: keccak256(stringToHex("order-vector-1")),
};
const CONTRACT_DIGEST: Hex = "0xf450939119bd18f8cbd5790121d3b1eb191e0bf0d97be1cb5d1e8a96ec37c9a8";

describe("spendDigest", () => {
  it("matches the AgentVault contract digest for the shared vector", () => {
    expect(AGENT.address).toBe("0xe05fcC23807536bEe418f142D19fa0d21BB0cfF7");
    expect(spendDigest({ vault: VAULT, chainId: 5042002, intent: VECTOR })).toBe(CONTRACT_DIGEST);
  });

  it("binds the chain id (testnet digest differs from mainnet)", () => {
    expect(spendDigest({ vault: VAULT, chainId: 5042, intent: VECTOR })).not.toBe(CONTRACT_DIGEST);
  });
});

describe("signSpend", () => {
  it("classical path: ECDSA recovers to the agent and no SLH-DSA signature is produced", async () => {
    const s = await signSpend({ account: AGENT, vault: VAULT, chainId: 5042002, intent: VECTOR, pqThreshold: 50_000_000n });
    expect(s.digest).toBe(CONTRACT_DIGEST);
    expect(await recoverAddress({ hash: s.digest, signature: s.ecdsaSig })).toBe(AGENT.address);
    expect(s.slhSig).toBe("0x");
    expect(s.pq).toBe(false);
  });

  it("above pqThreshold without an SLH-DSA key refuses to sign", async () => {
    await expect(
      signSpend({ account: AGENT, vault: VAULT, chainId: 5042002, intent: VECTOR, pqThreshold: 1n }),
    ).rejects.toThrow(/SLH-DSA/);
  });

  it("hybrid path: produces a 7856-byte SLH-DSA signature over the same digest", async () => {
    const keys = slhKeygen(new Uint8Array(48).fill(7));
    expect(keys.publicKey).toMatch(/^0x[0-9a-f]{64}$/);
    const s = await signSpend({
      account: AGENT,
      vault: VAULT,
      chainId: 5042002,
      intent: VECTOR,
      pqThreshold: 1n,
      slhSecretKey: keys.secretKey,
    });
    expect(s.pq).toBe(true);
    const sig = Buffer.from(s.slhSig.slice(2), "hex");
    expect(sig.length).toBe(7856);
    const ok = slh_dsa_sha2_128s.verify(
      sig,
      Buffer.from(s.digest.slice(2), "hex"),
      Buffer.from(keys.publicKey.slice(2), "hex"),
    );
    expect(ok).toBe(true);
  }, 30_000);
});

describe("encodeSpendCall", () => {
  it("encodes AgentVault.spend with the intent and signatures", () => {
    const data = encodeSpendCall(VECTOR, { ecdsaSig: "0x1234", slhSig: "0x" });
    const decoded = decodeFunctionData({ abi: agentVaultAbi, data });
    expect(decoded.functionName).toBe("spend");
    expect(decoded.args).toEqual([
      VECTOR.agentSigner,
      VECTOR.to,
      VECTOR.amount,
      VECTOR.deadline,
      VECTOR.orderId,
      "0x1234",
      "0x",
    ]);
  });
});
