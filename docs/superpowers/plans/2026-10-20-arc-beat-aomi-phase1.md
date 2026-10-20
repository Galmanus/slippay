# Arc: limits that survive compromise + vault-funded x402 (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Slippay on Arc demonstrably stronger than Aomi Labs where Aomi admits a gap (policy enforced off-chain, in their runtime) and match them where they lead (agents buying x402 services), before Demo Day 2026-11-05.

**Architecture:** No contract change in this phase. (1) Prove, with a Foundry invariant suite and a read-only attack run against the live mainnet vault, that the AgentVault bound holds even when the agent key AND the attester key are stolen. (2) Give the vault a way to pay any Circle Gateway x402 seller: a "float" EOA that sits on the session allowlist, is topped up by ordinary bounded vault spends, deposits into Gateway, and signs the nanopayments. Exposure stays inside the session's window cap because every top-up is a vault spend. (3) Expose it as an MCP tool in the existing `@slippay/mcp` server.

**Tech Stack:** Solidity 0.8.28 + Foundry (osaka), viem 2.55.2, Node >= 22.18, vitest, @modelcontextprotocol/sdk 1.29.0 (already a dependency of packages/slippay-mcp).

**Spec:** Conversation of 2026-10-20 ("faz o que for preciso para que o slippay seja mais foda/sofisticado/poderoso do que a aomi") + competitor facts in memory `project_arc_competitors_aomi_trustless.md`. Aomi's own statements this plan answers: "Controls are enforced outside the model" (aomi.dev home) and "The direction for V2 is to make that computation independently verifiable" (aomi.dev/research/introducing-the-aomi-task-api).

## Global Constraints

- Arc mainnet chainId 5042, RPC https://rpc.mainnet.arc.io; testnet 5042002, RPC https://rpc.testnet.arc.io (not rpc.testnet.arc.network, 502s).
- USDC 0x3600000000000000000000000000000000000000; native and ERC-20 USDC are one balance.
- Gateway Wallet mainnet 0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE, testnet 0x0077777d7EBA4688BDeF3E311b846F25870A19B9; Gateway API https://gateway-api.circle.com/v1 (testnet gateway-api-testnet.circle.com); Arc Gateway domain 26.
- Gateway nanopayment = EIP-3009 TransferWithAuthorization under EIP-712 domain {name "GatewayWalletBatched", version "1", chainId, verifyingContract = Gateway Wallet}; validBefore >= now + 7d + 100; random 32-byte nonce; EOA only.
- Fees: maxFeePerGas >= 20 gwei (use 25 gwei), priority 1 gwei.
- Every mainnet write script requires `--yes-mainnet`; the red-team script never broadcasts (public client only).
- Git author `Manuel Guilherme <m.galmanus@gmail.com>`; no Claude co-author trailer.
- No new npm dependencies.

## Review Focus

- Seller 402 that asks for more than the per-call cap, a non-Gateway scheme, another network or a non-USDC asset: refuse before any signature or top-up.
- Gateway API slow to credit a fresh deposit: the tool must return a clear "deposit mined, not credited yet" error, never sign against a balance it has not seen.
- Float key missing or float address not on the session allowlist: the tool refuses with the reason before touching the vault.
- Seller that returns 402 again after payment, or 5xx: report `paymentSent: true` with the status, never retry-pay.
- Red-team run against an RPC that is not Arc mainnet: abort before any call.

---

### Task 1: Total-compromise invariant suite (Foundry)

**Files:**
- Create: `contracts-evm/test/AgentVaultCompromise.t.sol`

**Interfaces:**
- Consumes: `AgentVault` (src), `MockUSDC`, `MockPQ`, `MockIdentity` (test/mocks/Mocks.sol), `vm.signP256` for attestations (same encoding as `_attest` in AgentVault.t.sol: r‖s, 64 bytes, low-s).
- Produces: nothing other tasks import.

- [ ] **Step 1: Write the handler + invariants.** Handler `Attacker` holds the agent key and the attester P-256 key. Fuzzed actions: `spendTo(uint256 toSeed, uint256 amount)` where `to` is one of {merchant, attacker, owner, vault, random}; signs valid ECDSA + valid attestation for whatever it picks, so only the vault's own checks stand in the way; `warp(uint32 dt)`; `replayLast()`. Ghost state: list of (timestamp, amount, to) for every spend that did not revert. Session: perTxCap 20e6, windowCap 30e6, windowSeconds 1 days, attestThreshold 0, allowlist [merchant], expiresAt now + 30 days. Owner revokes at a fuzzed point via `revokeNow()`.
  Invariants:
  - `invariant_onlyAllowlistedEverPaid`: `usdc.balanceOf(attacker) == 0` and every ghost spend has `to == merchant`.
  - `invariant_anyRealWindowBoundedByTwiceCap`: for every ghost spend i, sum of amounts with timestamp in [t_i, t_i + 1 days) <= 60e6.
  - `invariant_perTxBounded`: every ghost amount <= 20e6.
  - `invariant_nothingAfterRevokeOrExpiry`: no ghost spend has timestamp >= revokedAt (when set) or >= expiresAt.
- [ ] **Step 2: Run** `cd contracts-evm && forge test --match-contract AgentVaultCompromise -vv`. Expected: all invariants PASS with 0 reverts counted as failures (`fail_on_revert = false`).
- [ ] **Step 3: Mutation sanity.** Temporarily change `if (!allowed[r.agentSigner][r.to])` to `if (false)` in AgentVault.sol, rerun, expect `invariant_onlyAllowlistedEverPaid` FAIL; restore with `git checkout contracts-evm/src/AgentVault.sol`, rerun, PASS.
- [ ] **Step 4: Commit** `test(contracts-evm): invariant suite — the bound holds with agent and attester keys stolen`.

### Task 2: Live mainnet red-team (read-only)

**Files:**
- Create: `packages/arc-agent/scripts/arc-redteam.mjs`
- Create (output): `docs/arc/redteam-mainnet.md`, `docs/arc/redteam-mainnet.json`

**Interfaces:**
- Consumes: `agentVaultAbi`, `encodeSpendCall`, `signSpend` (src), `ARC_NETWORKS`.
- Produces: the report files.

- [ ] **Step 1: Implement** `node packages/arc-agent/scripts/arc-redteam.mjs --network mainnet --vault 0x… --agent-key-file f --merchant 0x… [--settled-tx 0x…] [--relayer url]`. Uses only `createPublicClient`; asserts `getChainId() === 5042` first. Each attack is an `eth_call` of `spend` from a fresh random EOA, the revert decoded with `decodeErrorResult(agentVaultAbi)`:
  1. stolen agent key, pay the attacker → `RecipientNotAllowed`
  2. stolen agent key, perTxCap + 1 to the merchant → `AmountExceedsCap`
  3. stolen agent key, valid amount to the merchant, no attestation → `BadAttestation`
  4. same, attestation signed by the attacker's own P-256 key → `BadAttestation`
  5. replay the calldata of `--settled-tx` → `BadSignature` (nonce moved on)
  6. deadline in the past → `Expired`
  7. (with `--relayer`) POST the stolen-key spend to the attacker through the production relayer → HTTP 403 `attestation_refused` (the attester refuses before paying for a counterparty check).
  Writes markdown table (attack, expected, observed, PASS/FAIL) + JSON, exits 1 if any attack is not refused with the expected error.
- [ ] **Step 2: Run against mainnet** with the pilot vault, merchant and agent key; expected 7/7 PASS.
- [ ] **Step 3: Commit** script + report: `feat(arc-agent): read-only red-team of the live mainnet vault`.

### Task 3: x402 Gateway buyer in arc-agent

**Files:**
- Create: `packages/arc-agent/src/x402.ts`, `packages/arc-agent/src/x402.test.ts`
- Modify: `packages/arc-agent/src/index.ts` (export), `packages/arc-agent/src/constants.ts` (add `ARC_GATEWAY` per network: `{ wallet, api }`, `ARC_GATEWAY_DOMAIN = 26`)

**Interfaces:**
- Produces:
  - `type X402Policy = { network: "eip155:5042" | "eip155:5042002"; maxAmount: bigint; payTo?: Address[] }`
  - `selectGatewayOption(challenge: unknown, policy: X402Policy): GatewayOption` (throws the refusal reason)
  - `gatewayPaymentHeader(challenge, option, account: LocalAccount, nowSec: number, nonce: Hex): Promise<string>` (base64)
  - `x402Fetch(url: string, init: { method?: string; body?: string }, o: { account: LocalAccount; policy: X402Policy; beforePay?: (amount: bigint, option: GatewayOption) => Promise<void>; fetch?: typeof fetch; timeoutMs?: number; now?: number; nonce?: Hex }): Promise<{ status: number; ok: boolean; body: string; paid: null | { amount: bigint; payTo: Address; network: string }; error?: string }>`
- [ ] **Step 1: Failing tests** (vitest): signature for the viem vector used in `packages/slippay-attester/src/counterparty.test.mjs` (same key, authorization and expected digest `0xe3417870…8988`), so both implementations are pinned to one vector; refusals for price above cap, wrong verifyingContract, wrong asset, wrong network, non-"exact" scheme, payTo outside a given allowlist; `beforePay` called once with the amount before the paid replay and not called on a 200; no second payment when the replay answers 402 again (`paid` set, `ok:false`).
- [ ] **Step 2: Run** `pnpm --filter @slippay/arc-agent test` → new tests FAIL (module missing).
- [ ] **Step 3: Implement** with viem `signTypedData` (domain GatewayWalletBatched v1, type TransferWithAuthorization); challenge from the `PAYMENT-REQUIRED` header (base64 JSON) or the 402 body.
- [ ] **Step 4: Run** → PASS; full arc-agent suite green.
- [ ] **Step 5: Commit** `feat(arc-agent): x402 buyer over Circle Gateway nanopayments`.

### Task 4: Float funding (vault → float EOA → Gateway)

**Files:**
- Create: `packages/arc-agent/src/float.ts`, `packages/arc-agent/src/float.test.ts`

**Interfaces:**
- Consumes: `ARC_GATEWAY`, `ARC_GATEWAY_DOMAIN` (Task 3).
- Produces:
  - `type FloatDeps = { gatewayBalance(): Promise<bigint>; walletBalance(): Promise<bigint>; topUpFromVault(amount: bigint): Promise<string /* tx */>; deposit(amount: bigint): Promise<string /* tx */>; sleep(ms: number): Promise<void> }`
  - `ensureGatewayFloat(need: bigint, d: FloatDeps, o: { topUp: bigint; gasReserve: bigint; pollMs?: number; maxPolls?: number }): Promise<{ topUpTx?: string; depositTx?: string; gatewayBefore: bigint; gatewayAfter: bigint }>`
  - `liveFloatDeps(p: { network: ArcNetwork; floatAccount: LocalAccount; rpcUrl: string; topUpFromVault: (amount: bigint) => Promise<string> }): FloatDeps`
- Rule: if `gatewayBalance >= need` do nothing. Else `deficit = max(need - gateway, topUp)`; if `walletBalance < deficit + gasReserve`, top up from the vault by `deficit + gasReserve - walletBalance` rounded up to `topUp`; then `deposit(deficit)`; poll `gatewayBalance` until `>= need` or throw `deposit <tx> mined; Gateway has not credited it yet`.
- [ ] **Step 1: Failing tests** with fake deps: no-op when funded; deposit only when the wallet already holds enough; top-up then deposit when not; throws the not-credited error after maxPolls, after having deposited once (never twice).
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS). `liveFloatDeps` uses the same approve-if-short + `deposit(USDC, amount)` sequence as `scripts/gateway-deposit.mjs` and the Gateway `/balances` call with `{ token: "USDC", sources: [{ depositor, domain: 26 }] }`.
- [ ] **Step 5: Commit** `feat(arc-agent): Gateway float topped up by bounded vault spends`.

### Task 5: MCP tools `slippay_arc_x402_fetch` and `slippay_arc_receipts`

**Files:**
- Modify: `packages/slippay-mcp/src/arc.ts`, `packages/slippay-mcp/src/index.ts`, `packages/slippay-mcp/src/arc.test.ts`, `packages/slippay-mcp/README.md`

**Interfaces:**
- Consumes: `arcPay` (existing), `x402Fetch` (Task 3), `ensureGatewayFloat`, `liveFloatDeps` (Task 4).
- Produces:
  - `arcX402Fetch(d: ArcDeps & { x402: typeof x402Fetch; ensureFloat: (need: bigint) => Promise<unknown> }, cfg, input: { url: string; method?: string; body?: string; maxUsdc?: string }): Promise<{ status; ok; body; paid; funding? }>`
  - env: `SLIPPAY_ARC_FLOAT_KEY` (tool refuses without it), `SLIPPAY_ARC_X402_MAX_USDC` (hard per-call ceiling, default "0.05"; `maxUsdc` may only lower it), `SLIPPAY_ARC_FLOAT_TOPUP_USDC` (default "0.10").
  - `slippay_arc_receipts`: AgentSpend logs of this agent on the vault (last N, default 10): `{ txHash, block, to, amountUsdc, orderId, attested, pq }`.
- [ ] **Step 1: Failing tests:** refuses when the float address is not on the session allowlist (checked with `isAllowed`) before any fetch; per-call cap = min(env, input); `maxUsdc` above env cap is clamped not raised; `ensureFloat` receives the seller's amount.
- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS), whole `pnpm --filter @slippay/mcp test` green, `tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(mcp): agents buy x402 services with vault-bounded money on Arc`.

### Task 6: Mainnet enablement and proof

**Files:**
- Modify: `packages/arc-agent/scripts/arc-mainnet-setup.mjs` (add `--vault 0x… --agent-id N` to skip deploy/register/fund and only install a session; `--allow` comma list of recipients)
- Modify: `docs/arc/metrics.md/.json` (regenerated), `docs/arc/vaults.json` unchanged (same vault)

- [ ] **Step 1:** Generate `~/.slippay/arc-mainnet-agent2.key` and `~/.slippay/arc-mainnet-float.key` (mode 600, refuse to overwrite).
- [ ] **Step 2:** Install session for agent2 on vault 0x5316Aa47C7C8Ef468E6bc248184b0F35878772b8 with allowlist [merchant, float], same caps, attestThreshold 0, agentId 2579.
- [ ] **Step 3:** Register agent2's surface on the production attester (loopback, via ssh) with recipients [merchant, float].
- [ ] **Step 4:** Run the MCP tool end to end from a stdio client: `slippay_arc_x402_fetch` on the A-Identity risk_check (0.005 USDC). Expected: vault → float top-up tx (attested), Gateway deposit tx, paid 200 with a decision.
- [ ] **Step 5:** Run Task 2's red-team for agent2 as well; regenerate metrics; commit `feat(arc): vault-funded x402 on mainnet`.

### Phase 2 (separate plan, written after Phase 1 ships)

On-chain conditional settlement in AgentVault v2 (pay-on-delivery holds; candidate: outcome postconditions for multi-call execution). Needs: which Arc mainnet protocols an agent would call, an invariant suite at least as strong as Task 1, testnet first.
