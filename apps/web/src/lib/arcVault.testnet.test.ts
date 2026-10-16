// Live Arc TESTNET run of the /agents/new actions, without a browser wallet: an EIP-1193 shim
// over a local key stands in for window.ethereum (eth_sendTransaction → sign locally → raw send).
// Skipped unless ARC_VAULT_E2E_KEY_FILE points at a funded testnet key; refuses any other chain.
//
//   ARC_VAULT_E2E_KEY_FILE=~/.slippay/arc-testnet-deployer.key node node_modules/vitest/vitest.mjs run src/lib/arcVault.testnet.test.ts
//
// Costs ~0.5 testnet USDC (0.4 paid to a throwaway merchant + gas); the rest is withdrawn back.
// Prints tx hashes only — never the funded key or the generated agent secrets.
import { describe, expect, it } from "vitest";
import {
  createPublicClient, createWalletClient, custom, decodeErrorResult, hexToBytes, http, toHex,
  type Address, type BaseError, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ARC_NETWORKS, agentVaultAbi, encodeSpendCall, signSpend } from "@slippay/arc-agent";
import {
  agentRegistrationURI, arcChain, buildSessionArgs, connectWallet, deployVault, ensureArcChain, explorerTx,
  findAgentId, fundVault, generateAgentKeys, identityOwnedBy, installSession, mcpConfig, readVaultState,
  registerIdentity, resolveDeploy, revokeSession, validateLimits, type Eip1193Provider,
} from "./arcVault.ts";

type NodeProcess = { env: Record<string, string | undefined>; getBuiltinModule(m: string): unknown };
const proc = (globalThis as { process?: NodeProcess }).process;
const keyFile = proc?.env.ARC_VAULT_E2E_KEY_FILE?.replace(/^~/, proc.env.HOME ?? "~");
const NET = ARC_NETWORKS.testnet;

function shimProvider(key: Hex): { provider: Eip1193Provider; address: Address } {
  const account = privateKeyToAccount(key);
  const chain = arcChain("testnet");
  const pub = createPublicClient({ chain, transport: http(NET.rpcUrl) });
  const wallet = createWalletClient({ account, chain, transport: http(NET.rpcUrl) });
  const big = (v: unknown) => (typeof v === "string" ? BigInt(v) : undefined);
  const provider: Eip1193Provider = {
    async request({ method, params }) {
      const p = (params ?? []) as Record<string, string>[];
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account.address];
        case "eth_chainId":
          return toHex(NET.chainId);
        case "wallet_switchEthereumChain":
          if (Number(p[0]?.chainId) !== NET.chainId) throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
          return null;
        case "eth_sendTransaction": {
          const tx = p[0]!;
          const req = await wallet.prepareTransactionRequest({
            to: tx.to as Address | undefined, data: tx.data as Hex | undefined, value: big(tx.value),
            maxFeePerGas: big(tx.maxFeePerGas), maxPriorityFeePerGas: big(tx.maxPriorityFeePerGas), gas: big(tx.gas),
          });
          return wallet.sendRawTransaction({ serializedTransaction: await wallet.signTransaction(req) });
        }
        default:
          return pub.request({ method: method as "eth_call", params: params as never });
      }
    },
  };
  return { provider, address: account.address };
}

describe.skipIf(!keyFile)("arcVault actions on Arc testnet (live)", () => {
  it("deploy → identity → fund → session → spends/refusals → revoke → withdraw, and every resume read", async () => {
    const fs = proc!.getBuiltinModule("node:fs") as { readFileSync(p: string, enc: "utf8"): string };
    const { provider, address: owner } = shimProvider(fs.readFileSync(keyFile!, "utf8").trim() as Hex);
    const reader = createPublicClient({ chain: arcChain("testnet"), transport: http(NET.rpcUrl) });
    const ctx = { provider, network: "testnet" as const, owner };
    const log = (label: string, hash: string) => console.log(`${label}: ${explorerTx("testnet", hash)}`);

    expect(await connectWallet(provider)).toBe(owner);
    await ensureArcChain(provider, "testnet");

    // 1. deploy — the predicted CREATE address is what a reload would look for
    let predicted: { predictedVault: Address; nonce: number } | undefined;
    const { vault, txHash: deployHash } = await deployVault({
      ...ctx, maxAbsolutePerTx: 100_000_000n, onSubmitting: (p) => { predicted = p; },
    });
    log("deploy", deployHash);
    console.log(`vault ${vault}`);
    expect(vault).toBe(predicted!.predictedVault);
    const st0 = await readVaultState({ network: "testnet", vault, owner, reader });
    expect(st0).toMatchObject({ exists: true, ownerMatches: true, isAgentVault: true, maxAbsolutePerTx: 100_000_000n, balance: 0n });
    // resume paths: receipt lost (only nonce known) → found; rejected signature (no code, nonce unused) → none
    expect(await resolveDeploy({ network: "testnet", owner, vaultNonce: predicted!.nonce, reader })).toEqual({ status: "deployed", vault });
    const nextNonce = await reader.getTransactionCount({ address: owner });
    expect(await resolveDeploy({ network: "testnet", owner, vaultNonce: nextNonce, reader })).toEqual({ status: "none" });
    // a contract that is not an AgentVault is never adopted
    expect((await readVaultState({ network: "testnet", vault: NET.identityRegistry, owner, reader })).exists).toBe(false);

    // 2. ERC-8004 identity
    let fromBlock = 0n;
    const { agentId, txHash: regHash } = await registerIdentity({
      ...ctx, agentURI: agentRegistrationURI({ name: "web e2e agent", vault, network: "testnet" }), onSubmitting: (b) => { fromBlock = b; },
    });
    log("register identity", regHash);
    console.log(`agentId ${agentId}`);
    expect(await findAgentId({ network: "testnet", owner, fromBlock, reader })).toBe(agentId);
    expect(await identityOwnedBy({ network: "testnet", agentId, owner, reader })).toBe(true);

    // 3. fund 1 USDC (native send)
    const { txHash: fundHash } = await fundVault({ ...ctx, vault, amount: 1_000_000n });
    log("fund 1 USDC", fundHash);

    // 4. limits from the same form validation the page uses; keys generated like the page does
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const form = { perTx: "0.5", window: "1", windowSeconds: 86_400, recipients: merchant, expiresOn: "", pqAbove: "0.2" };
    const v = validateLimits(form, { owner, vault, maxAbsolutePerTx: 100_000_000n, nowSec: Math.floor(Date.now() / 1000) });
    if (!v.ok) throw new Error(`limits invalid: ${JSON.stringify(v.errors)}`);
    const keys = generateAgentKeys({ pq: true });
    const args = buildSessionArgs({ ...v.value, agentSigner: keys.agentAddress, agentId, slhVk: keys.slhVk });
    const { txHash: sessHash } = await installSession({ ...ctx, vault, args });
    log("install session", sessHash);
    const st1 = await readVaultState({ network: "testnet", vault, owner, agentSigner: keys.agentAddress, reader });
    expect(st1.exists && st1.balance).toBe(1_000_000n);
    expect(st1.exists && st1.session).toMatchObject({
      exists: true, revoked: false, agentId, perTxCap: 500_000n, windowCap: 1_000_000n, pqThreshold: 200_000n,
    });
    expect(() => JSON.parse(mcpConfig({ vault, agentKey: keys.agentKey, slhSecret: keys.slhSecret, network: "testnet" }))).not.toThrow();

    // 5. the agent pays with the generated keys (relayed by the funded key, as the relayer would)
    const agent = privateKeyToAccount(keys.agentKey);
    const slhSecretKey = hexToBytes(keys.slhSecret!);
    const relayer = createWalletClient({
      account: privateKeyToAccount(fs.readFileSync(keyFile!, "utf8").trim() as Hex), chain: arcChain("testnet"), transport: http(NET.rpcUrl),
    });
    const vaultErrors = agentVaultAbi.filter((x) => x.type === "error");
    const spend = async (to: Address, amount: bigint, send: boolean) => {
      const s = await reader.readContract({ address: vault, abi: agentVaultAbi, functionName: "getSession", args: [agent.address] });
      const intent = {
        agentSigner: agent.address, to, amount, nonce: s.nonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600), orderId: toHex(crypto.getRandomValues(new Uint8Array(32))),
      };
      const sig = await signSpend({ account: agent, vault, chainId: NET.chainId, intent, pqThreshold: s.pqThreshold, slhSecretKey });
      const data = encodeSpendCall(intent, sig);
      try {
        await reader.call({ account: owner, to: vault, data });
      } catch (e) {
        // revert data sits on the RpcRequestError a few causes down (CallExecutionError → … → data)
        const hit = (e as BaseError).walk((x) => typeof (x as { data?: unknown }).data === "string") as { data?: Hex } | null;
        if (!hit?.data) throw e;
        return { refused: decodeErrorResult({ abi: vaultErrors, data: hit.data }).errorName };
      }
      if (!send) return { refused: null };
      const hash = await relayer.sendTransaction({ to: vault, data, maxFeePerGas: 41_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n });
      const r = await reader.waitForTransactionReceipt({ hash });
      expect(r.status).toBe("success");
      return { hash, pq: sig.pq };
    };
    const small = await spend(merchant, 100_000n, true);
    log("agent pays 0.1 USDC (classical)", (small as { hash: string }).hash);
    const big = await spend(merchant, 300_000n, true);
    expect((big as { pq: boolean }).pq).toBe(true);
    log("agent pays 0.3 USDC (hybrid ECDSA + SLH-DSA)", (big as { hash: string }).hash);
    expect(await spend(merchant, 600_000n, false)).toEqual({ refused: "AmountExceedsCap" });
    const stranger = privateKeyToAccount(generatePrivateKey()).address;
    expect(await spend(stranger, 100_000n, false)).toEqual({ refused: "RecipientNotAllowed" });

    // 6. revoke (the page's lost-key recovery) → the vault refuses the agent
    const { txHash: revHash } = await revokeSession({ ...ctx, vault, agentSigner: agent.address });
    log("revoke session", revHash);
    expect(await spend(merchant, 100_000n, false)).toEqual({ refused: "SessionIsRevoked" });

    // 7. owner withdraws what is left (0.6 USDC) — not a page action yet, called directly
    const left = (await readVaultState({ network: "testnet", vault, owner, reader })) as { balance: bigint };
    expect(left.balance).toBe(600_000n);
    const owner1193 = createWalletClient({ account: owner, chain: arcChain("testnet"), transport: custom(provider) });
    const wHash = await owner1193.writeContract({
      address: vault, abi: agentVaultAbi, functionName: "withdraw", args: [owner, left.balance],
      maxFeePerGas: 41_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n,
    });
    expect((await reader.waitForTransactionReceipt({ hash: wHash })).status).toBe("success");
    log("withdraw 0.6 USDC", wHash);
  }, 240_000);
});
