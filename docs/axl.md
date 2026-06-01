# Axl — a proof-carrying policy language for agent payments

Axl is a small declarative language that compiles one agent policy block into the
concrete, externally-checkable guarantees a money agent needs. It does **not**
invent new inference primitives — it unifies existing, commodity mechanisms
(capability scoping, structured output, deterministic checks, SMT verification)
behind one syntax, and adds the discipline that the load-bearing checks are
**code and proof, never the model's own promise**. The value is the unification
and the provable guarantee, not the novelty of any single primitive.

> **Status, stated first (competence > marketing).** The agent_wallet that Axl
> governs is on **Stellar testnet**, **self-audited internally** (no third-party
> audit yet). The SMT proof is of the *epoch-state invariant*; the real-time
> window bound follows by a *stated geometric lemma, not yet mechanized*. Axl
> applies to **decidable** policy (arithmetic, membership, bounded state); for
> irreducibly fuzzy judgments ("is this suspicious?") it does not apply and an
> LLM is necessary. Do not read past this paragraph as a claim of mainnet,
> third-party audit, or universal proof.

---

## The agent block

```
agent Settlement {
  bind      -> [read_balance, propose_settlement]    // capability scope
  constrain -> SettlementDecision                    // output schema
  prove     -> decision.amount <= account.balance    // decidable predicate
  prove     -> decision.recipient in account.allowlist
  invariant -> sliding_window(ceiling = 2) bound 2   // policy bound, SMT-proved
}
```

The compiler (`axlc`) lowers this to: a filtered `tools` array, an
`output_config.format` JSON-schema, a set of deterministic predicate checkers,
and an SMT-LIB proof obligation discharged by z3.

## The four primitives

Each primitive's guarantee holds **even if the agent's model is fully
compromised** (successful prompt injection, jailbreak), because none of them
depends on the model behaving — they are enforced by the request-builder and by
code/solvers outside the model's reach.

### `bind` — capability scope (mechanical)
Compiles a capability list against a tool registry into the exact `tools=[...]`
array passed to the model. A capability not bound has **no schema in the action
space**, so the model cannot emit a valid tool call for it — regardless of any
injection. Maps to the Anthropic/OpenAI `tools` parameter; defends OWASP LLM06
(Excessive Agency). Default-deny, fail-closed (an unknown capability is a
config error, never a silent drop). Enforced in the orchestrator that builds the
request, outside the agent — that placement *is* the guarantee.

### `constrain` — output schema (engine-enforced)
Compiles a named schema into `output_config.format = {type: "json_schema",
schema}` (Anthropic structured outputs, GA — grammar-level constrained decoding)
plus `strict: true` tool definitions. Fail-closed: a schema must declare
`additionalProperties: false` or the compiler refuses. Honest boundary: this is
*shape* enforcement (the response conforms to the schema); constraining *values*
(e.g. only allowlisted recipients are emittable) is a stronger, separate
mechanism — see the decode-grammar work in [mechanism 2](#mechanisms-234) — and
requires an engine you control (open-weights), not the Anthropic API.

### `prove` — decidable predicate (deterministic code, not an LLM judge)
Compiles a predicate (`lhs op rhs`, op ∈ {`<=` `<` `>=` `>` `==` `!=` `in`},
operands are dotted paths / numbers / strings) into a **deterministic checker**.
At runtime, `enforce(contract, ctx)` runs every predicate; an output that
violates one is rejected. The discipline: for **decidable** predicates — which is
most money logic (`amount <= balance`, `recipient in allowlist`, signature
valid) — `prove` compiles to CODE, never to an LLM "verifier". An LLM checking a
numeric inequality is strictly worse than computing it (see
[benchmark](#benchmark)). Only irreducibly fuzzy predicates need a judge, and
those are not proofs.

### `invariant` — policy bound (SMT-proved, fail-closed)
Compiles a policy bound to an SMT-LIB proof obligation discharged by z3. The
supported family is `sliding_window(ceiling = M)` with a claimed `bound K`; the
compiler emits the inductive proof (assume the invariant, prove every accepted
charge preserves it — UNSAT to break ⇒ sound bound over **all** action
sequences) plus the tightness and unbounded checks. `axlc prove` reports
`ISSUED K` or `REFUSED`. Fail-closed throughout: an unsupported policy family is
refused **before** any solver runs; an overclaimed bound (e.g. K=1 under M=2,
not inductive) is REFUSED; a policy with no aggregate cap is proven unbounded and
REFUSED; an absent/erroring solver is never treated as a pass.

## The compiler — `axlc`

A standalone Rust crate (`axl-compiler/`, edition 2021, **zero external
dependencies** — own lexer/parser/AST/Value/JSON/predicate engine), **189 tests
passing, clippy clean**. CLI:

```
axlc compile <file.axl> --tools t.json --schemas s.json   # inference contract as JSON
axlc request <file.axl> ...                                # the Anthropic request fragment
axlc enforce <file.axl> ... --ctx ctx.json                 # run the prove predicates (exit 2 on violation)
axlc prove   <file.axl>                                     # discharge the invariant via z3 (exit 2 on REFUSED)
axlc parse   <file.axl>                                     # the parsed AST
```

`axlc prove` auto-detects z3: the `z3` binary on PATH (preferred), else a
`python3` + `z3-solver` fallback — both verified to produce identical verdicts.
A JS reference implementation lives in `agents/axl/{bind,compile}.mjs` (the
behavioral contract, exercised by the agent test suites).

## The proofs

- `agents/axl/proofs/budget_invariant.py` — the canonical machine-checked proof
  of the deployed agent_wallet budget policy. Part A finds a counterexample to
  the naive `≤ window_cap` bound (the sliding-window straddle); Part B proves the
  invariant `prev+cur ≤ 2·window_cap` is inductive; Part C certifies K=2 is the
  tight constant. Runs in < 1s on z3.
- `agents/axl/proofs/spending_policy_prover.py` — generalizes it to a policy
  family and **issues a safety certificate or REFUSES** (per-tx-only → unbounded
  → refused). Independently adversarially reviewed: every issued certificate
  sound, refusals correct, worst real-world case ~1.5·cap (under the certified 2).
- What is proved vs stated: Z3 discharges the **epoch-state invariant**. The
  real-time sliding-window bound follows by an **overlap lemma** (a `W`-window
  touches ≤ 2 adjacent epochs because rolls fire only at `elapsed ≥ W`) — a true
  geometric premise, **stated, not yet mechanized**. The proof is over
  mathematical integers; the contract's saturating `i128` only rejects more, so
  the bound is preserved.

## Benchmark

`prove`-as-code vs an LLM-judge verifier on decidable money predicates with
deterministic ground truth. Reproducible harness (code-prove side, 0-token):
`node eval/prove_vs_judge_benchmark.mjs`. The 40-case table below is from a single
recorded run (workflow w10t6ixln); the bundled harness reproduces the code-prove
side on an 11-case decidable battery (11/11, ~57 µs/case, 0 tokens). The LLM-judge
column needs a model call and is **not** reproducible from the harness — one
recorded run, not a suite.

| | code-prove | LLM-judge |
|---|---|---|
| accuracy | 40/40 | 40/40 |
| tokens / decision | **0** | ~thousands |
| latency / decision | ~30 µs | ~seconds |

Honest reading: the **efficiency** win (tokens, latency) is real but
near-tautological — deterministic code beats an LLM call. **Accuracy tied** — the
LLM judge did not fumble these cases (an earlier prediction that it would was
wrong). The genuine differentiator the benchmark surfaces is neither: code-prove
is **correct by construction (provable)**; the LLM judge was empirically 100%
*here* but carries **no guarantee** it stays so at scale, on harder cases, or
with a weaker model. The benchmark also surfaces the buyer's objection — "the LLM
was also right, why pay for the proof?" — whose honest answer (you cannot prove
the LLM stays right) sells only to certainty-demanding buyers (regulated,
post-incident, high-assurance). Caveats: N=40, one model, one run.

## Mechanisms 2/3/4

Beyond the four primitives, three deeper guarantee-class mechanisms exist as
separate, honestly-scoped artifacts:

- **2 · semantic decode-grammar** (`agents/axl/grammar/`, 61 tests) — compiles an
  allowlist + amount bound into a grammar whose *language is exactly the allowed
  set* (an over-max numeral has no production), emitted as GBNF. Makes a bad value
  **unsamplable**, not post-checked. **Infra-gated:** running it as constrained
  decoding needs a self-hosted engine (llama.cpp/vLLM/Outlines) — not exercised
  here; the grammar is wire-ready, not run against a live model.
- **3 · TEE attestation** (`agents/tee/`, 19 tests) — an attestation envelope +
  verification + on-chain anchor (joins to the wallet's `ssl_hash`), with a MOCK
  enclave producer (real ed25519). **Infra-gated:** real Nitro/SEV vendor
  attestation is not implemented; TEE is not trustless (trusts the hardware
  vendor) and attests provenance, not correctness.
- **4 · IFC non-interference** (`agents/ifc/`, 16 tests, **fully real**) — a
  static label-propagation checker proving no high-label data reaches a lower
  sink without an explicit declassify (kills covert collusion / stego escalation).

## Honest scope & status

- **Novelty is the unification, not the primitives.** bind ≈ tool scoping,
  constrain ≈ structured outputs (GA on Anthropic/OpenAI, Outlines, GBNF),
  prove ≈ a validator, invariant ≈ SMT via z3 — each is commodity. Axl's claim is
  compiling all four from one declarative syntax with proof-carrying discipline.
- **Decidable only.** Axl proves/checks decidable policy. Fuzzy judgment is out of
  scope; the LLM remains necessary there.
- **Testnet, self-audited.** The agent_wallet is not on mainnet and has no
  third-party audit. The proof is deployment-independent (it is about policy
  logic), but Axl-the-system is not production-hardened.
- **Stellar-native.** The canonical x402 ecosystem is EVM/Base/Solana; Axl's
  Soroban proof applies to the Stellar offshoot. Cross-chain would need an EVM
  port — not done.
- **`axlc prove` requires z3** at run time (like Dafny). The crate compiles with
  zero deps; the solver is an external runtime dependency.

## File map

| area | path | tests |
|---|---|---|
| compiler (Rust) | `axl-compiler/` | 189 |
| reference (JS) | `agents/axl/{bind,compile,structured}.mjs` | 19 |
| proofs (SMT) | `agents/axl/proofs/{budget_invariant,spending_policy_prover}.py` | — |
| agents | `agents/{authority,billing,settlement,antiabuse}/` | 27 |
| mech 2 grammar | `agents/axl/grammar/` | 61 |
| mech 3 TEE | `agents/tee/` | 19 |
| mech 4 IFC | `agents/ifc/` | 16 |
| eval (ROC) | `eval/agent_governance_eval.py` | — |
| benchmark | `eval/prove_vs_judge_benchmark.mjs` | 11/11 |
