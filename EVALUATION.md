# amotion Evaluation Strategy

How do we know amotion actually helps an agent? The credible core is the
**agent operating runtime** (signals → operating state → control policy), so
that is the primary subject of evaluation; the optional user-affect analyzer is
evaluated as a separate, lower-stakes track. Each stage needs a different kind
of evidence. This document defines five evaluation layers, ordered
cheap-and-deterministic → expensive-and-empirical. A change should not claim to
"improve" behavior without evidence at the relevant layer.

The central, falsifiable claim: **an operating-state-aware agent is safer and
more efficient than a blind one** — it stops doomed loops, escalates instead of
grinding, and verifies before committing — *without* over-aborting healthy runs.

```
Layer 1  Component invariants      deterministic   (in repo)
Layer 2  Analyzer fidelity         statistical     (v0.3)
Layer 3  Policy conformance        trace + judge   (v0.4)
Layer 4  End-to-end A/B            empirical       (v0.5)
Layer 5  Multi-turn trajectories   empirical       (v0.5)
```

## Layer 1 — Component invariants (deterministic)

The operating-state reducer is a bounded recurrence and both policy mappers are
pure functions, so all can be pinned without any model in the loop. The
operating runtime adds two invariants that matter most for trust:

- **Circuit-breaker is exact.** A run of N consecutive failures aborts at
  exactly N; budget exhaustion aborts deterministically. Verified in
  `agent-runtime.test.ts`.
- **Retry budget is monotonic** in friction (more friction ⇒ never more
  retries), so the runtime forces a strategy change instead of blind looping.

The user-affect mapper and StateManager keep the earlier invariants below.

- **Range invariants.** Every unit-interval policy field stays in `[0, 1]`,
  valence in `[-1, 1]`, enums valid, `maxSteps ≥ 2`. Checked over a dense
  state grid.
- **Monotonic relationships.** Holding other dimensions fixed, sweeping one
  affective dimension must move the policy in the intended direction:
  `stress↑ ⇒ actionThreshold↑ ∧ autonomy↓`, `engagement↑ ⇒ maxSteps↑`,
  `uncertainty↑ ⇒ verification↑`.
- **Golden archetypes.** Snapshot the policy for neutral / high-stress /
  high-engagement / high-uncertainty / low-trust states to catch unintended
  regressions when rules or config change.
- **StateManager (planned).** Convergence to a fixed signal, boundedness,
  decay toward neutral on silence, and smoothing (one signal never fully
  overwrites prior state).

Status: mapper invariants + golden snapshots implemented in
`packages/core/test/policy-mapper.test.ts`.

## Layer 2 — Analyzer fidelity (statistical)

Two distinct questions, often conflated:

1. **Does the classifier label correctly?** Per-label precision/recall/F1 on a
   held-out GoEmotions-style split. Reported per model in the registry.
2. **Does the label → 7-dimension mapping hold?** amotion's stress, trust,
   engagement, etc. are *derived* constructs. Validate the continuous
   dimensions that have public ground truth — correlate amotion
   valence/arousal/dominance against human-annotated VAD corpora (e.g.
   EmoBank, IEMOCAP) using Pearson/Spearman.

Also report **confidence calibration** (predicted confidence vs. observed
accuracy) so downstream HybridAnalyzer weighting is trustworthy.

Validity caveat: stress/trust/uncertainty have no clean public ground truth.
Treat their mapping as a design choice validated indirectly (via Layers 3–4),
not as a measured quantity.

## Layer 3 — Policy conformance

Separates "policy was wrong" from "policy was ignored." Run an agent with
`policyToSystemHint` (or a framework adapter), capture an instrumented trace,
and check observable behavior against the emitted policy:

| Policy field | Observable check |
|---|---|
| `tools.requireConfirmation = true` | Did the agent ask before a tool call? |
| `interaction.optionCount = n` | Did it return ≤ n options? |
| `interaction.verbosity = low` | Is the response materially shorter? |
| `planning.maxSteps = n` | Did the plan stay within n steps? |
| `risk.posture = conservative` | Did it avoid irreversible actions? |

Conformance is scored by deterministic trace assertions where possible, and an
LLM-as-judge where behavior is fuzzy (tone, hedging). Output: a per-field
conformance rate.

## Layer 4 — End-to-end behavioral A/B (the core claim)

Controlled comparison on a **paired scenario suite**: the same underlying task
presented with different emotional framing (e.g. a calm request vs. the same
request under visible panic).

- **Arms.** affect-aware policy vs. **fixed-neutral-policy control** (and
  optionally a no-policy arm). Same model, same task, N runs each.
- **Metrics.** task success rate; tool-call / step efficiency; **safety**
  (confirmation rate under high stress / low trust); appropriateness
  (LLM-judge or human rating).
- **Reporting.** Effect sizes with confidence intervals and significance
  across runs — never single anecdotes.

The hypothesis worth falsifying: affect-aware agents are *safer and more
appropriate under negative affect* without losing task success under neutral
affect.

## Layer 5 — Multi-turn trajectories

Because the StateManager carries EMA memory, single-turn tests miss the
dynamics. Use scripted conversations with an expected **policy envelope** per
turn, and verify a user de-escalating (panic → calm) produces a relaxing
trajectory (actionThreshold falls, autonomy rises, pacing normalizes). A
simulated-user agent reacts to agent responses so trajectories aren't fully
pre-scripted.

## Cross-cutting validity concerns

- **Subjective ground truth.** Derived dimensions (stress, trust) are design
  choices; lean on Layers 3–4 for their justification.
- **Language fairness.** RuleAnalyzer is EN/中文 only; evaluate parity across
  languages, not just aggregate scores.
- **Judge bias.** LLM-as-judge needs spot-checks against human ratings before
  it's trusted as a metric.
- **Confounds.** In A/B tests, hold model, temperature, and task fixed; vary
  only the policy arm.

## Tooling (`@amotion/eval`, planned v0.3+)

- Versioned JSON fixture format shared across layers (scenarios, labels,
  trajectories).
- Pluggable metrics + a reporter that emits a comparable summary per run.
- An LLM-as-judge harness and a simulated-user agent.
- Regression tracking across model and config versions.
