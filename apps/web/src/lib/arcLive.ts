// Live, read-only view of Slippay's AgentVault on Arc mainnet, from the visitor's browser.
// Arc's public RPC answers CORS for app.slippay.cc, so nothing goes through our servers.
// Everything here is a read or an eth_call simulation: no key of ours is in the bundle and
// nothing is ever broadcast. Addresses and transactions are the pilot's (docs/arc/vaults.json,
// docs/arc/metrics.md, docs/arc/redteam-mainnet.md in the slippay repo).
import {
  BaseError, ContractFunctionRevertedError, createPublicClient, decodeFunctionData, defineChain, http, parseAbi,
  toHex, type Address, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const ARC_RPC = "https://rpc.mainnet.arc.io";
export const ARC_EXPLORER = "https://explorer.arc.io";
export const VAULT: Address = "0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8";
/** The pilot agent (first session); the second session's agent buys x402 services. */
export const PILOT_AGENT: Address = "0x57df927eA0c60B26304BF5369B517771d4650Ab6";
export const AGENTS: readonly Address[] = [PILOT_AGENT, "0xE4C31bA5cEb9229A9dc365D15bc6d75c681565fF"];
export const MERCHANT: Address = "0xe8BaF2DE286bbef788A97Bd30B34DD927683D239";
export const FLOAT: Address = "0xe75D597f414EBa88Bf4226a3Ad8e0FAe46B1edC1";
const USDC: Address = "0x3600000000000000000000000000000000000000";
/** First real agent payment: 0.10 USDC to the pilot merchant, 2026-10-19. */
export const SETTLED_TX: Hex = "0xd4fb46dfe0d5322ef0274709208bee79ecbf3dfeee7928fbb86f225e1565ac7b";
/** Vault-funded x402 float top-up: 0.12 USDC, attested, 2026-10-20. */
export const TOPUP_TX: Hex = "0xf822f25c3cfd611ffac1f42f6f9f8853d85753ef869f926e848e5d12b41ff49f";
export const REDTEAM_REPORT = "https://github.com/Galmanus/slippay/blob/04ac66c94eff879b065f522bbc28ebb2699b4d30/docs/arc/redteam-mainnet.md";

export const txUrl = (h: string) => `${ARC_EXPLORER}/tx/${h}`;
export const addrUrl = (a: string) => `${ARC_EXPLORER}/address/${a}`;
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const arc = defineChain({
  id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
});
const arcClient = createPublicClient({ chain: arc, transport: http(ARC_RPC) });

// The slice of AgentVault's ABI this page needs (contracts-evm/src/AgentVault.sol).
export const vaultAbi = parseAbi([
  "struct Session { uint256 agentId; bytes32 slhVk; bytes32 policyHash; uint128 perTxCap; uint128 windowCap; uint128 pqThreshold; uint128 curSpent; uint128 prevSpent; uint64 windowSeconds; uint64 expiresAt; uint64 epochStart; uint64 nonce; bool revoked; bool exists; bytes32 attesterX; bytes32 attesterY; uint128 attestThreshold; }",
  "struct SpendRequest { address agentSigner; address to; uint256 amount; uint64 deadline; bytes32 orderId; bytes ecdsaSig; bytes slhSig; bytes attestation; }",
  "function getSession(address agentSigner) view returns (Session)",
  "function spend(SpendRequest r)",
  "error NoSession()", "error SessionIsRevoked()", "error SessionExpired()", "error Expired()", "error InvalidConfig()",
  "error AmountExceedsCap()", "error RecipientNotAllowed()", "error WindowCapExceeded()", "error BadSignature()",
  "error BadPqSignature()", "error BadAttestation()", "error TransferFailed()",
]);
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export type VaultSnapshot = {
  block: bigint;
  balance: bigint; // 6-decimal USDC
  perTxCap: bigint;
  windowCap: bigint;
  settled: bigint; // sum of session nonces = spends that settled
  agents: number;
  everySpendAttested: boolean;
  expiresAt: bigint;
};

export async function readVault(): Promise<VaultSnapshot> {
  const [block, balance, ...sessions] = await Promise.all([
    arcClient.getBlockNumber(),
    arcClient.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [VAULT] }),
    ...AGENTS.map((a) => arcClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "getSession", args: [a] })),
  ]);
  const live = sessions.filter((s) => s.exists && !s.revoked);
  return {
    block,
    balance,
    perTxCap: live[0]?.perTxCap ?? 0n,
    windowCap: live[0]?.windowCap ?? 0n,
    settled: sessions.reduce((n, s) => n + s.nonce, 0n),
    agents: live.length,
    everySpendAttested: live.every((s) => s.attestThreshold === 0n),
    expiresAt: live.reduce((m, s) => (s.expiresAt > m ? s.expiresAt : m), 0n),
  };
}

/** Status and block of a known transaction, read from the chain now. */
export async function verifyTx(hash: Hex) {
  const r = await arcClient.getTransactionReceipt({ hash });
  const b = await arcClient.getBlock({ blockNumber: r.blockNumber });
  return { ok: r.status === "success", block: r.blockNumber, at: new Date(Number(b.timestamp) * 1000) };
}

export type AttackKind = "payMe" | "overCap" | "wrongKey" | "replay";
export type AttackResult = { error: string; block: bigint; detail: string };

/** eth_call of spend() at the latest block from a throwaway address; returns the vault's refusal. */
async function simulate(req: {
  agentSigner: Address; to: Address; amount: bigint; deadline: bigint; orderId: Hex; ecdsaSig: Hex; slhSig: Hex; attestation: Hex;
}): Promise<{ error: string; block: bigint }> {
  const block = await arcClient.getBlockNumber();
  const caller = privateKeyToAccount(generatePrivateKey()).address;
  try {
    await arcClient.simulateContract({ account: caller, address: VAULT, abi: vaultAbi, functionName: "spend", args: [req], blockNumber: block });
    return { error: "SETTLES", block };
  } catch (e) {
    const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    const name = (rev as ContractFunctionRevertedError | null)?.data?.errorName;
    return { error: name ?? "unknown", block };
  }
}

/**
 * Run one attack against the live vault. None needs a secret: the attacker impersonates the
 * pilot agent's public address, signs with a key of their own, or replays a settled payment.
 * `visitor` is a fresh address standing in for the attacker's wallet.
 */
export async function runAttack(kind: AttackKind, visitor: Address): Promise<AttackResult> {
  const agent = PILOT_AGENT;
  const session = await arcClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "getSession", args: [agent] });
  const now = BigInt(Math.floor(Date.now() / 1000));
  const base = {
    agentSigner: agent, to: MERCHANT, amount: 1n, deadline: now + 300n,
    orderId: toHex(crypto.getRandomValues(new Uint8Array(32))),
    ecdsaSig: toHex(new Uint8Array(65)), slhSig: "0x" as Hex, attestation: "0x" as Hex,
  };
  if (kind === "payMe") {
    const r = await simulate({ ...base, to: visitor });
    return { ...r, detail: visitor };
  }
  if (kind === "overCap") {
    const r = await simulate({ ...base, amount: session.perTxCap + 1n });
    return { ...r, detail: (session.perTxCap + 1n).toString() };
  }
  if (kind === "wrongKey") {
    const attacker = privateKeyToAccount(generatePrivateKey());
    const ecdsaSig = await attacker.signTypedData({
      domain: { name: "SlippayAgentVault", version: "1", chainId: 5042, verifyingContract: VAULT },
      types: { Spend: [
        { name: "agentSigner", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint64" }, { name: "deadline", type: "uint64" }, { name: "orderId", type: "bytes32" },
      ] },
      primaryType: "Spend",
      message: { agentSigner: agent, to: MERCHANT, amount: 1n, nonce: session.nonce, deadline: base.deadline, orderId: base.orderId },
    });
    const r = await simulate({ ...base, ecdsaSig });
    return { ...r, detail: attacker.address };
  }
  const tx = await arcClient.getTransaction({ hash: SETTLED_TX });
  const { args } = decodeFunctionData({ abi: vaultAbi, data: tx.input });
  const r = await simulate(args[0] as Parameters<typeof simulate>[0]);
  return { ...r, detail: SETTLED_TX };
}

export const usdc = (v: bigint, max = 2) => (Number(v) / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: max });
