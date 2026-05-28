# Slippay Smart Wallet · Security Audit v0.1

**Date:** 2026-05-28 · **Auditor:** Claudin (internal · adversarial pass)
**Scope:** `contracts/smart-wallet/src/lib.rs`, `scripts/policy-checkout-spike-server.mjs`, `apps/web/src/pages/PolicySubscribe.tsx`
**Network state at audit:** v0.1 testnet only · template `CBG62CSW...UNASO`

This audit is **internal**. It does not substitute for a third-party audit by OpenZeppelin, Trail of Bits, Certora, Halborn, or equivalent. Mainnet deployment with real customer funds must wait until both the findings below are addressed AND an independent firm signs off on the post-fix code.

The auditor's mindset: assume hostile attackers, hostile merchants, compromised admins, MITM on the server, and motivated adversaries with access to public source code. Every finding below has a concrete exploit path or attack chain.

---

## Severity ladder

- **CRITICAL** — directly enables fund theft, full wallet drain, or admin compromise. **Block mainnet.**
- **HIGH** — significant impact under realistic conditions. Mainnet only after mitigation.
- **MEDIUM** — partial impact or unlikely-but-possible. Should be fixed; document if accepted.
- **LOW** — hygiene, observability, defense-in-depth. Acceptable to defer.

---

## CRITICAL findings

### C1 · `__check_auth` fall-through accepts any non-zero signature → universal wallet drain

**File:** `contracts/smart-wallet/src/lib.rs:278-313`

**The bug.** When an auth context does not match an installed policy (any
context that is not a `token.transfer` to a registered merchant in the
right token with amount under cap and interval elapsed), `__check_auth`
falls through to a stub that requires only that the signature blob is
non-zero. The stub returns `Ok(())` for any 64-byte payload with a single
non-zero byte.

**Exploit path.**
1. Attacker learns the v0.1 placeholder signature `[0x01; 64]` (it is in
   the open-source repo at `scripts/policy-checkout-spike-server.mjs:262`).
2. Attacker calls `SAC.transfer(victim_wallet, attacker_address, full_balance)`
   on the native or any SAC where the victim wallet has funds.
3. Soroban host invokes the wallet's `__check_auth` with the transfer
   context. `try_match_policy` returns `Ok(false)` because no policy
   exists for `attacker_address`.
4. `all_matched` becomes false, the loop falls through to the stub.
5. The stub checks the pubkey exists (yes, init was called) and the
   signature is non-zero (yes, `[0x01; 64]`).
6. `Ok(())` is returned. Transfer executes. Funds gone.

**Why this defeats the entire "Stripe-impossible" thesis.** The product
sells "the policy limit lives in the wallet, not in Slippay's database."
The 13 unit tests prove the *positive* path (policy-matched transfers
are correctly gated). But the *negative* path (transfers outside the
policy) is currently fully open. An attacker doesn't need to break the
policy — they just route around it.

**Severity.** CRITICAL. This is the highest-impact finding. It must close
before any mainnet deploy with real funds.

**Fix.** One line. Change the fall-through to default-deny in v0.1, then
implement real `secp256r1_verify` in v0.2:

```rust
// Replace lines 306-313:
let sig_bytes = signature.to_array();
if sig_bytes.iter().all(|b| *b == 0) {
    return Err(Error::SignatureInvalid);
}
let _ = signature_payload;
Ok(())

// With:
//
// v0.1 default-deny on fall-through. Non-policy-matched transfers
// REQUIRE a real secp256r1 signature, which v0.1 does not yet emit.
// Until secp256r1_verify is wired in v0.2, every non-matched context
// is rejected. This collapses the "Stripe-impossible" property back
// onto the policy invariant.
let _ = (signature_payload, signature, _pubkey);
Err(Error::SignatureInvalid)
```

**Falsifiable check.** After the fix, repeat the spike → charge flow on
testnet with the SDK code unchanged. The within-cap charge should still
succeed (policy match path). A new test, "transfer to non-policy address",
should fail with `Error::SignatureInvalid`. If it succeeds, the fix did
not land.

---

### C2 · Init front-running between `deploy` and `init`

**File:** `scripts/policy-checkout-spike-server.mjs:120-145`

**The bug.** `stellar contract deploy` and the subsequent `init`
invocation are two separate transactions. Between them, any party
watching the chain can inject their own `init(adversary_pubkey,
adversary_cred_id, adversary_admin)` call. The contract's `init` only
guards against double-init, not against the wrong party initing first.

**Exploit path.**
1. Spike server submits `deploy` → contract id `C123...` lands at ledger N.
2. Adversary's bot subscribed to ledger feed sees the deploy and
   immediately submits `init(adv_pubkey, adv_cred_id, adv_admin_addr)`
   targeting `C123...`. Adversary's tx lands at ledger N+1.
3. Spike server's `init` lands at ledger N+2 and PANICS with
   `AlreadyInitialized`.
4. Adversary now controls the wallet. They can install any policy
   they want. The user who paid for the deploy lost the wallet.

**Severity.** CRITICAL on mainnet. On testnet (current) it merely breaks
demos. On mainnet, attackers will absolutely run this bot.

**Fix.** Atomic deploy+init in a single transaction. Stellar smart
contract deploy supports a constructor pattern — pass the init args to
the deploy operation. Otherwise, the server must build a multi-op tx
that deploys then calls init in one envelope. `stellar-cli` may not
support this directly; the SDK does.

Alternative: rather than `init`-after-deploy, have a single function
`init_or_panic_if_called_before` that *requires* admin auth and runs
the init only when called as the deploy's first op.

---

### C3 · Single-key admin = full drain on key compromise

**File:** `contracts/smart-wallet/src/lib.rs:171-181, 215-223`

**The bug.** The admin address is a single Ed25519 G-account stored on
disk at `~/.config/stellar/identity/slippay-deployer.toml` in plaintext.
Compromise of that file (or of the server it runs on) yields the ability
to install any policy on any wallet ever deployed.

**Exploit path.**
1. Attacker gains read access to `~/.config/stellar/identity/`
   (server compromise, supply chain attack on a Node dependency,
   misconfigured backup, etc.).
2. Attacker calls `install_policy(merchant=attacker, max=i128::MAX,
   interval=1, expires_at=0)` on every wallet that admin governs.
3. Attacker immediately calls `SAC.transfer(wallet, attacker, balance)`
   on each. The policy-match path now authorizes since policy says
   attacker is the merchant and max is unbounded.

**Severity.** CRITICAL on mainnet given v0.1's single-admin design.

**Fix options.**
1. **v0.1 fix:** admin key in HSM or hardware key with rate-limited
   signing. Document explicitly that admin is the single point of
   failure.
2. **v0.2 plan:** admin migrates to be the wallet's own contract
   address. install/revoke flow through `__check_auth` which requires
   the user's passkey. Compromise of the spike server no longer
   compromises wallets.

The v0.1 fix is mainnet-acceptable IF combined with a per-wallet
spending cap (see H1).

---

### C4 · `install_policy` overwrites silently with no diff event

**File:** `contracts/smart-wallet/src/lib.rs:203-209`

**The bug.** Re-installing a policy for an existing merchant overwrites
the previous policy. The emitted `policy_installed` event only shows
the NEW policy. Indexers and the user-facing UI cannot detect that the
max was raised from $35 to $35000 unless they were already storing the
prior state.

**Exploit path (assumes admin compromise per C3).**
1. Admin (compromised) installs policy `{merchant=X, max=35}` legitimately.
2. Later, attacker calls `install_policy(merchant=X, max=35000)`.
3. The wallet now allows X to charge $35000 per cycle. The user, watching
   only the most recent event, may dismiss it as "subscription updated."

**Severity.** CRITICAL when combined with C3. HIGH on its own.

**Fix.** Emit a `policy_updated` event with the OLD and NEW values when
overwriting (read the old policy, compare, emit a richer event). OR:
require explicit `revoke_policy` before `install_policy` can replace.
The second is more secure; the first is easier to retrofit.

---

### S1 · CORS `*` + no auth + no rate limit on spike server

**File:** `scripts/policy-checkout-spike-server.mjs:404, 416-451`

**The bug.** The spike server exposes `/api/policy-checkout/spike` and
`/api/policy-checkout/charge` with `Access-Control-Allow-Origin: *` and
no authentication, no rate limiting. Any website on the internet can
make the server execute Stellar transactions paid for by the admin.

**Exploit path.**
1. Attacker creates a webpage with a hidden JS loop that POSTs to
   `/api/policy-checkout/spike` 100x/sec.
2. Victim visits the page (or attacker visits it themselves). Browser's
   CORS doesn't block the request because of the wildcard.
3. Each request costs the admin ~0.5-1 XLM in fees (deploy + 3 invokes
   + funding). 9994 XLM balance drains in ~3 hours of sustained spam.

Even without the malicious-page vector, anyone with curl can drain the
admin via simple `for i in {1..10000}; do curl ... &; done`.

**Severity.** CRITICAL for any public deploy. Currently mitigated by
the server running on localhost only.

**Fix.**
1. Replace `*` with a specific origin allow-list (the production app's
   URL).
2. Add a per-IP rate limit (e.g., 1 spike per IP per hour).
3. Add a bearer token or signed request requirement.
4. Add a daily admin-spend cap (max XLM spent per 24h) so a misconfig
   can't drain the whole admin in one shot.
5. Front the server with nginx + fail2ban + WAF.

---

### S2 · `/charge` accepts any wallet from the request → cross-wallet abuse

**File:** `scripts/policy-checkout-spike-server.mjs:442-450`

**The bug.** `/api/policy-checkout/charge` reads `body.wallet` as the
SAC.transfer source. The merchant is hardcoded to `DEMO_MERCHANT`. If
any wallet on mainnet has an active policy with merchant=DEMO_MERCHANT,
anyone can call this endpoint to charge that wallet.

**Exploit path.**
1. Real customer Alice has a policy on her wallet that allows
   `DEMO_MERCHANT` to charge $29/30d (because she subscribed to a
   Slippay-operated demo merchant).
2. Attacker hits `/api/policy-checkout/charge` with `wallet=Alice's_wallet`
   every 30 days + 1 second. Slippay's admin signs the transfer (because
   admin authorizes the SAC.transfer; the wallet's `__check_auth`
   authorizes the policy match).
3. Funds drain from Alice's wallet to `DEMO_MERCHANT` on each call.

Note: this is "by design" in v0.1 because the merchant *is* DEMO_MERCHANT
and the policy authorized them. But the demo server should not be a
public trigger — only the actual merchant business logic should fire
charges.

**Severity.** HIGH on mainnet. Mitigated on testnet where there are no
real customers.

**Fix.** `/charge` should require the merchant to authenticate (e.g.,
the merchant's own G-account signs the request). For v0.1 mainnet
demo, restrict /charge to ONLY work for wallets Slippay itself just
deployed (track them in a session map or in a database).

---

## HIGH findings

### H1 · No per-wallet spend cap → v0.1 admin compromise is uncapped

**Files:** contract; server

**The bug.** A v0.1 wallet can be funded with arbitrary value. A
compromised admin (per C3) can install a policy that drains the whole
balance immediately.

**Severity.** HIGH on mainnet.

**Fix for mainnet rehearsal.** Limit per-wallet funding to a small
demo amount (e.g., $5 USDC equivalent). Document the cap explicitly.
Refuse to fund wallets beyond it.

---

### H2 · Math.random() nonce in auth entry construction

**File:** `scripts/policy-checkout-spike-server.mjs:274`

**The bug.** `Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)`
produces a 53-bit non-cryptographic nonce. Birthday collision after
~2^26.5 ≈ 95 million entries. Soroban host rejects replays, so a
collision triggers an error rather than a security incident, but it's
sloppy crypto in security-sensitive code.

**Severity.** MEDIUM in practice. Auditors mark this as HIGH on principle.

**Fix.** `crypto.randomBytes(8)` and convert to a `BigInt` for the
nonce.

---

### H3 · Admin == merchant guardrail missing

**File:** `contracts/smart-wallet/src/lib.rs:162-210`

**The bug.** Nothing in `install_policy` prevents `merchant == admin`
or `merchant == env.current_contract_address()`. A compromised admin
could install a policy where they are also the merchant and drain the
wallet to themselves.

**Severity.** HIGH given C3.

**Fix.** Reject `merchant == admin` and `merchant == env.current_contract_address()`
at install time:

```rust
if merchant == admin || merchant == env.current_contract_address() {
    panic_with_error!(&env, Error::InvalidConfig);
}
```

---

### H4 · No HTTPS on the spike server

**File:** `scripts/policy-checkout-spike-server.mjs:402-466`

**The bug.** Plain HTTP. MITM can observe wallet ids and inject
responses. Localhost-only mitigates today.

**Severity.** HIGH for any public deploy.

**Fix.** nginx in front with Let's Encrypt cert. Document the production
deployment shape in `DEPLOYED.md`.

---

### H5 · Deployer secret read from plaintext disk on every charge

**File:** `scripts/policy-checkout-spike-server.mjs:208-216`

**The bug.** Every charge invokes `stellar keys secret slippay-deployer`
which reads the plaintext seed from `~/.config/stellar/identity/`. The
secret is then materialized in process memory.

**Severity.** HIGH for production.

**Fix.** Cache the keypair in memory once at startup. Move the secret
to an encrypted env var (KMS-decrypted at boot) or an HSM. The current
"plaintext on disk" pattern is acceptable for the spike server running
on the operator's laptop, never for production.

---

## MEDIUM findings

### M1 · `xdrInvokeWithAuth` function is dead code

**File:** `scripts/policy-checkout-spike-server.mjs:347-371`

Unused after the chargeViaSdk refactor. Remove it. Dead code in
auth-handling files invites future copy-paste bugs.

### M2 · TTL extension target of ~31 days

**File:** `contracts/smart-wallet/src/lib.rs:58-59`

A policy that goes 31 days idle (no charges, no refresh) will be
archived by the host. Re-activation requires a manual storage touch.
Subscription products with rare charges (annual, biennial) will hit
this. Acceptable for v0.1 (monthly charges keep TTL fresh), but
document the constraint.

### M3 · No `revoke_all_policies` for emergency

**File:** contract

If a user wants to nuke all policies in one tx, they cannot. Each
merchant requires a separate `revoke_policy` call. For a wallet with
many merchants this is a UX/safety gap.

### M4 · No upgrade path for the wallet contract

The contract has no admin-controlled upgrade. If a CRITICAL bug is
found post-deploy, every existing wallet is stuck with the bugged
code. Migration would require deploying a fresh wallet per user and
draining the old one (assuming the drain is possible without
triggering the bug).

For v0.1 spike: acceptable. For mainnet: must have a careful upgrade
plan, either via admin-controlled wasm-hash swap OR by accepting that
wallets are immutable and any bug = stuck users.

---

## LOW findings

- **L1** · Server logs wallet addresses (privacy). Truncate to first
  8 chars in logs.
- **L2** · No log of which IP triggered which charge. Add for
  forensics.
- **L3** · `parseTxHash` regex only matches testnet URL pattern
  (`explorer/testnet/tx/...`). Mainnet rehearsal needs a generalized
  regex.
- **L4** · Unbounded `maxBuffer: 8MB` for `execFile`. Could cap lower.
- **L5** · Frontend stores chargeLog in component state only. Refresh
  loses history. Acceptable for demo, not for a real user surface.

---

## Mainnet-readiness verdict

**v0.1 as-is: NOT mainnet-ready.** Three findings are existential
(C1, C3, S1) and three more are highly exploitable (C2, C4, S2).

**Minimum work to make v0.1 mainnet-acceptable for a CAPPED demo:**

1. **C1 fix** (1 line · contract redeploy + retest) — closes the universal drain.
2. **C2 fix** (atomic deploy+init) — closes front-running.
3. **H3 fix** (admin/merchant guardrail) — closes admin self-drain.
4. **S1 fix** (origin allow-list + rate limit + spend cap) — closes public DoS.
5. **S2 fix** (merchant auth on /charge) — closes cross-wallet abuse.
6. **H1 fix** (per-wallet $5 cap) — limits blast radius.
7. **L3 fix** (mainnet URL parser) — operational, not security.

Estimated effort: **1-2 days of focused work**. The C1 fix is one line
but every fix needs redeploy + retest + verification.

**v0.1 to be considered "production-grade" requires also:**
- C3 mitigation (HSM for admin) or v0.2 (passkey admin)
- C4 fix (diff events)
- H2 (cryptographic nonces)
- H4 (HTTPS)
- H5 (secret in HSM/env)
- M4 (upgrade plan)
- Third-party audit (OpenZeppelin / Trail of Bits / Halborn) by a firm
  that is not Slippay-affiliated. **Self-audits, including this one, are
  the floor, not the ceiling.**

Estimated effort to "production-grade": **2-4 weeks plus audit
turnaround (4-12 weeks typical)**.

---

## Audit non-goals (explicit)

This audit did NOT cover:
- Static analysis tooling (cargo clippy with security lints, semgrep,
  no Soroban-specific linter exists yet)
- Formal verification of contract invariants (Certora, KEVM-equivalent)
- Property-based / fuzz testing of contract invariants
- Side-channel analysis (none expected on Soroban host)
- Reading the slippay-subscription mainnet contract (out of scope here;
  has its own audit-002 trail)
- Reading the spike server's Node dependency tree for known CVEs
  (`pnpm audit` not run as part of this pass)

A real third-party audit would cover all of the above.

---

## Auditor disclosure

This audit was performed by Claude (Claudin), an LLM acting as the
operator's pair-engineer in a single ~3-hour session that started with
zero contract code. The auditor wrote the contract under review. **An
auditor reviewing their own code is the lowest-rigor form of audit.**
The findings above are the ones the auditor could identify by reading
adversarially. There may be others the auditor missed precisely because
they are also the author.

Mainnet deployment must be gated on an external review.

---

## Suggested next actions for operator

1. **Today** · Apply C1 fix (one line) + redeploy testnet + retest.
   The current testnet wallet `CBYDPDG5...HFQP` is exploitable per C1.
2. **This week** · Apply C2, H3, S1, S2, H1 fixes. Set up nginx + HTTPS
   for public deploy.
3. **Before Rio (08/06)** · Run the demo on the patched testnet
   contract. Do NOT rehearse on mainnet until the third-party audit is
   commissioned.
4. **Before any mainnet customer** · Commission OpenZeppelin or Trail
   of Bits audit. Budget $20-40k, 2-6 weeks turnaround. Until that
   audit lands, the smart-wallet remains testnet-only.
