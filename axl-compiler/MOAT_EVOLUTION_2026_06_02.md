# Axl moat evolution — overnight synthesis (2026-06-02)

> Manuel asked: make Axl an indispensable piece that creates a moat; launch agents to
> perfect the language. This is the synthesis + what I shipped while you slept.
> Branch only, nothing deployed, mainnet contract untouched.

## Method

- Read all 3 enforcement layers first-hand (axl-compiler 4592 LOC, smart-wallet
  lib.rs 1071 LOC, the SMT/z3 path) + ran a multi-agent workflow: 5 deep readers,
  4 design lenses, adversarial verify panel.
- Baseline before touching anything: `cargo test` green (18 integration + 135 lib),
  z3 4.8.14 present, branch `feat/policy-checkout`.

## The counter-intuitive finding (this is the load-bearing insight)

**The proof is NOT the moat.** All four independent readers converged on this,
grounded in the code:

| Reader | Verdict (quoted) |
|---|---|
| compile-surface | invariant moat is "narrow … competitor reproduces the WHOLE invariant layer in days" |
| proof-engine | "the honest moat is NOT the per-policy proof (a few engineer-weeks for an FV hire)" |
| on-chain | "replicable by a funded competitor with property-based testing and **no SMT at all**" |
| team brief (agent-governance-x402.md:50-51) | "the window is the advantage; **the standard is the moat** … No forcing function yet." |

Therefore the naive direction — add `token_bucket` / `per_recipient` as a second
proven family — is **sophisticated theater**: each new proof is just more for a
competitor to port. Widening the language ≠ deepening the moat.

Disanalogy (vs a patent moat): a patent makes replication *illegal*; a ported z3
model makes replication *a few engineer-weeks*. There is no legal or algorithmic
barrier here. The only durable barrier is **adoption of the artifact as a standard**.

## Where the real moat is — three gaps the readers found IN THE CODE

1. **The proof-to-chain triple is not build-enforced.** The `axlc-gate` CI workflow
   asserted in `contracts/smart-wallet/src/test.rs:1424` **does not exist**;
   `test.yml` never runs cargo/axlc/z3/conformance. The proof can silently drift
   from the deployed contract on any PR. *Biggest gap between claim and reality.*
2. **The certified bound is hard-coded, not read from a certificate.** `test.rs:1490`
   uses `window_cap*2` as a Rust literal. If axlc proved K=3 the conformance test
   would not track it. The proof↔chain agreement is by human review, not artifact.
3. **`ssl_hash` is provenance theater.** The contract pins it immutably but does not
   interpret it (`lib.rs:170-176`); both e2e scripts default it to `'ab'.repeat(32)`,
   never a sha256 of the actual spec. A spend is not cryptographically tied to the
   proved policy.

## The thesis: proof-carrying policy

> The moat is not proving more. It is making the existing proof **inescapable**
> (a real gate), **portable** (a third party can verify it), and **bound to the
> deployment** (the on-chain session is tied to the exact proved spec).

That converts a replicable proof into a **forcing function / standard**: to
interoperate on the network, your policy must carry a verifiable certificate. A
competitor can match a window counter; they cannot unilaterally mint *your*
certificate format and have the network's contracts require it. The grammar
becomes the standard — the one moat the readers say does not exist yet.

This is exactly the "standard is the moat / no forcing function yet" gap, made
load-bearing.

## What I shipped tonight (axl-compiler, language layer only)

`axlc certify` / `axlc verify-cert` — **proof-carrying certificates**:

- `axlc certify <spec.axl>` runs the existing z3 discharge and emits a
  deterministic JSON certificate: `{ spec_sha256, agent, family, ceiling M,
  bound K, tight, minimal, verdict, onchain_params, backend }`.
- `axlc verify-cert <spec.axl> <cert.json>` recomputes the spec hash, re-discharges,
  and asserts byte-equality with the certificate. Exit 0 = valid, 2 = mismatch/
  refuted. **This is what a CI merge-gate or a third-party auditor runs** — it
  closes gap #1.
- `spec_sha256` is a real, std-only SHA-256 of the canonicalized spec — the genuine
  value for the contract's `ssl_hash`, closing gap #3.
- `onchain` block derives the install-param relationship from the **proved** K, so
  the conformance test can read K from the cert instead of hard-coding it — closes
  gap #2.

Zero new dependencies (std-only hand-rolled SHA-256, tested against NIST vectors).
No contract change (no collision with your uncommitted `test.rs`). Nothing deployed.

### Verification (evidence, not assertion)

- `cargo test`: **211 passed, 0 failed** (lib 150 incl. 6 SHA-256 + 9 certificate;
  integration: certify 7, fidelity 36, invariant_prove 18). Baseline was 153.
- `cargo clippy --all-targets`: clean, zero warnings.
- SHA-256 verified against 5 known answers (empty, "abc", 56-byte, 55-byte
  boundary, 1,000,000×'a') sourced from python `hashlib` as an independent oracle.
- End-to-end with real z3 4.8.14:
  - `axlc certify m2` → ISSUED, exit 0, `ssl_hash` = real sha256, `window_cap_multiplier` = 2.
  - `axlc verify-cert` (fresh) → VALID, exit 0.
  - tamper `bound 2→3` → INVALID, exit 2, names the `bound` mismatch.
  - verify m2 cert against m1 spec → INVALID, exit 2, names `spec_sha256` mismatch.
  - `axlc certify none` (unbounded) → REFUSED, exit 2, `onchain: null`.

### Files (all under `axl-compiler/`, all reversible)

- `src/sha256.rs` (new) — std-only SHA-256 + hex.
- `src/certify.rs` (new) — certificate assembly, load-bearing view, fail-closed verify.
- `src/bin/axlc.rs` — `certify` + `verify-cert` subcommands, `--cert` flag.
- `src/lib.rs` — module registration + re-exports.
- `tests/certify.rs` (new) — 7 end-to-end CLI cases (skip-if-no-solver).
- this doc.

Discipline note (honest): the library core (SHA-256, certificate assembly, view,
verify) was strict TDD (red→green, watched each fail first). The CLI integration
tests in `tests/certify.rs` are regression locks over the thin glue, written after
a manual smoke test confirmed behavior — the standard tests-after caveat applies to
that glue layer only.

### Branch

Committed on `feat/axl-proof-carrying-certs` (cut from `feat/policy-checkout`).
Your uncommitted work (`Comprovante.tsx`, `test.rs`, `chainVerify.ts`) was NOT
touched or staged — it rides along in the working tree, still uncommitted.

## The fork that is YOURS to decide (not mine to commit you to)

I implemented the certificate substrate because it is the direct, reversible,
evidence-backed fix for the three gaps. But the *strategic* choice is yours:

- **(A) Standard-first** (what I built toward): make the certificate the forcing
  function — CI gate + contract requires a valid cert hash + publish the cert format.
  Moat = adoption. Failure mode: nobody else adopts → it is just internal rigor.
- **(B) Proof-depth** (multi-agent global cap is the one non-theater new proof —
  N sessions each spend 2×cap with no global ceiling, `lib.rs` confirms it is
  unenforced). Moat = closing a real composition attack. Failure mode: more to port.
- **(C) Both**, sequenced A→B.

My read of the evidence: **A first** (it is the only one the readers call a real
moat), B as a security fix regardless of moat. But this is a product-direction call
and you are the source — decide in the morning.

## Falsifiable

If `axlc verify-cert` is wired as a required CI check and the contract install is
made to require the cert hash, then within 30 days any PR that drifts the proved
bound from the deployed constant produces a red build (today: green, silent drift).
That red build is the forcing function. If it cannot be wired (e.g. z3 unavailable
in CI), the standard-moat thesis is not executable and we fall back to (B).
