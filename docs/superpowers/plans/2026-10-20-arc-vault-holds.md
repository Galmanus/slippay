# AgentVaultV2: pay-on-delivery holds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent pay into an on-chain hold that releases to the payee only on delivery and refunds itself after a deadline, under exactly the same limits as an ordinary AgentVault spend.

**Architecture:** `AgentVaultV2 is AgentVault`. V1 gets two semantics-preserving edits so V2 can reuse its checks instead of copying them: `_authorize` is split into `_checkTerms` + `_checkSignatures`, and `_pay` becomes `virtual`. V2 adds holds as accounting inside the vault (`totalHeld`), overrides `_pay` so `spend` and `withdraw` can only move the free balance, and adds `hold` / `release` / `refund`.

**Tech Stack:** Solidity 0.8.28, Foundry (osaka EVM, P-256 precompile 0x100), forge-std vendored.

**Spec:** Phase 2 directive of 2026-10-20 (conversation) + `docs/superpowers/plans/2026-10-20-arc-beat-aomi-phase1.md` (Phase 2 section).

## Design decisions

- **Release authority = the agent's signature (plus the attester above attestThreshold) or the vault owner.** The buyer side confirms delivery; with `attestThreshold = 0` a stolen agent key alone cannot release, mirroring `spend`. The payee is fixed at hold time, so even a full compromise can only pay early to an allowlisted payee, never redirect.
- **Refund = anyone after `releaseBy`, or the payee at any time.** Expiry must not need a live key; a payee waiving money is always safe. The owner cannot refund early: that would let the buyer cancel after the seller delivered.
- **Release after revoke/expiry of the session:** agent-signed release is refused (a revoked key's signature is not trusted); the owner can still release; refund still works. Held funds are never stranded.
- **Window cap is consumed at hold time and not restored on refund.** Holds can never be used to exceed limits; a refund costs budget, by design.
- **`releaseBy` in (now, now + 30 days].** Bounds how long a compromised agent can lock funds.
- **holdId = the hold's EIP-712 digest** (binds every term and the session nonce, so it is unique). Hold and spend share the session nonce; hold and release use distinct type hashes, so no signature can be replayed across operations.
- **CEI:** status and `totalHeld` are written before the only external call (USDC `transfer`).

## Global Constraints

- Do not change the observable behaviour of `AgentVault` (V1); `contracts-evm/test/AgentVault.t.sol`, `DigestVector.t.sol` and `AgentVaultCompromise.t.sol` must pass unchanged.
- Git author `Manuel Guilherme <m.galmanus@gmail.com>`, no co-author trailer. No push, no mainnet broadcast.

## Review Focus

- A hold whose payee becomes blocklisted on Arc: release reverts, refund after expiry still frees the funds (test `test_refund_afterExpiry_whenPayeeBlocked`).
- Owner `withdraw` of the whole balance while holds are open: must revert (`InsufficientFreeBalance`).
- `spend` while most of the balance is held: must not dip into held funds.
- Release exactly at `releaseBy`: refused; refund exactly at `releaseBy`: allowed (no instant where both or neither work).
- A spend signature submitted to `hold` (or a hold signature to `spend`): refused (`BadSignature`).

---

### Task 1: V1 refactor (no behaviour change) + V2 skeleton with free-balance guard

**Files:** Modify `contracts-evm/src/AgentVault.sol` (`_authorize` split; `_pay` virtual). Create `contracts-evm/src/AgentVaultV2.sol`. Test `contracts-evm/test/AgentVaultV2.t.sol`.

**Interfaces — Produces:**
- V1: `_checkTerms(Session storage s, address agentSigner, address to, uint256 amount, uint64 deadline) internal view`; `_checkSignatures(Session storage s, address agentSigner, bytes32 digest, uint256 amount, bytes calldata ecdsaSig, bytes calldata slhSig, bytes calldata attestation) internal view returns (bool pq, bool attested)`; `_pay(address,uint256) internal virtual`.
- V2: `totalHeld() returns (uint256)`, `freeBalance() returns (uint256)`, error `InsufficientFreeBalance()`.

- [ ] Run the V1 suites before the refactor and after it: same counts, all pass.
- [ ] Tests (RED): `test_withdraw_cannotTouchHeldFunds`, `test_spend_cannotUseHeldFunds` (need Task 2's `hold`, so write them in Task 2), here only `test_freeBalance_equalsBalanceWithoutHolds`.
- [ ] Commit: `refactor(contracts-evm): split AgentVault._authorize so V2 reuses its checks`.

### Task 2: `hold`, `release`, `refund`

**Files:** `contracts-evm/src/AgentVaultV2.sol`, `contracts-evm/test/AgentVaultV2.t.sol`.

**Interfaces — Produces:**
- `struct HoldRequest { address agentSigner; address payee; uint256 amount; uint64 deadline; uint64 releaseBy; bytes32 orderId; bytes ecdsaSig; bytes slhSig; bytes attestation; }`
- `HOLD_TYPEHASH = keccak256("Hold(address agentSigner,address payee,uint256 amount,uint64 nonce,uint64 deadline,uint64 releaseBy,bytes32 orderId)")`, `RELEASE_TYPEHASH = keccak256("Release(bytes32 holdId)")`, `MAX_HOLD_SECONDS = 30 days`.
- `holdDigest(agentSigner,payee,amount,nonce,deadline,releaseBy,orderId) view returns (bytes32)`, `releaseDigest(bytes32 holdId) view returns (bytes32)`.
- `hold(HoldRequest calldata) returns (bytes32 holdId)`; `release(bytes32 holdId, bytes calldata ecdsaSig, bytes calldata attestation)`; `refund(bytes32 holdId)`; `getHold(bytes32) returns (Hold)`.
- `enum HoldStatus { None, Open, Released, Refunded }`; errors `HoldNotOpen`, `HoldExpired`, `HoldNotExpired`, `BadReleaseWindow`; events `HoldCreated`, `HoldReleased`, `HoldRefunded`.

- [ ] Tests (RED → GREEN), one behaviour each: hold happy path (accounting, nonce, window consumed, event); hold refusals (payee off-list, above per-tx, window exceeded, bad sig, missing/forged attestation, `releaseBy` past / beyond 30 days, insufficient free balance, revoked, expired, spend signature replayed as hold); release (agent sig pays payee; twice → `HoldNotOpen`; at `releaseBy` → `HoldExpired`; wrong signer; gated attestation; after revoke → `SessionIsRevoked`; owner after revoke OK); refund (stranger before expiry → `HoldNotExpired`; payee early OK; anyone at `releaseBy` OK; refund-then-release and release-then-refund → `HoldNotOpen`; window not restored); withdraw/spend cannot touch held funds; Review Focus tests.
- [ ] Commit: `feat(contracts-evm): AgentVaultV2 — pay-on-delivery holds`.

### Task 3: Total-compromise invariant suite for holds

**Files:** `contracts-evm/test/AgentVaultV2Compromise.t.sol`.

- [ ] Handler holds agent + attester keys; actions: `holdTo`, `releaseOne` (valid sigs), `refundOne`, `spendTo`, `ownerWithdraw`, `warp`, `revokeNow`. Invariants: only the allowlisted payee and the owner (via withdraw) ever receive money; each hold pays at most once; `totalHeld == Σ open holds` and `totalHeld <= balance`; conservation; per-tx bound; any real window of commitments (holds + spends) ≤ 2 × windowCap; non-vacuity guard.
- [ ] Mutants, each must fail the named invariant then be restored with `git checkout`: drop the free-balance guard in `_pay`; drop the status check in `release`; drop the expiry check in `refund`; drop `_consumeWindow` in `hold`; drop the payee allowlist check.
- [ ] Commit: `test(contracts-evm): holds survive agent and attester keys stolen`.

### Task 4: Testnet deploy script

**Files:** `contracts-evm/script/DeployV2.s.sol` (forge script; reads `PRIVATE_KEY`, `USDC`, `IDENTITY`, `MAX_ABS` from env).

- [ ] `forge build` clean; broadcast only to Arc testnet and only with a funded testnet key.
- [ ] Commit: `feat(contracts-evm): AgentVaultV2 deploy script (testnet)`.
