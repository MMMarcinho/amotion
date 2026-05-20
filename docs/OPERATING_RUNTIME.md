# Operating Runtime — Semantics

This document defines what the agent operating runtime *means*. It is the
Person A contract: fixtures, tests, the trace-replay runner, and adapters
should be implementable from this without guessing intent.

**Source of truth.** Code is canonical. This doc explains rationale and
invariants and points at the implementation for values:

- `packages/core/src/agent/signals.ts`
- `packages/core/src/agent/operating-state.ts`
- `packages/core/src/agent/operating-config.ts`
- `packages/core/src/agent/operating-policy.ts`
- `packages/core/src/agent/agent-runtime.ts`
- `packages/core/src/agent/eval-contract.ts`

Where a value is quoted below, treat the code as authoritative if they ever
disagree — and flag the mismatch.

## The model in one line

```text
User affect influences interaction posture.   (optional, advisory)
Agent operating state controls action.         (primary, authoritative)
```

The runtime never makes the agent mirror the user's emotion. It allocates
runtime resources from **observable execution state**, and treats user affect
only as an optional caution input.

## Invariant vs. tunable

Two kinds of statements live in this doc. Do not confuse them:

- **Invariant** — a design contract. Tests should pin it; it does not change
  without a deliberate semantic decision (and likely a major version bump).
- **Tunable** — a parameter calibrated by evaluation (v0.3+). It may change
  freely pre-v1. Tests should assert *direction and bounds*, never an exact
  tuned value.

The numeric effect deltas and most thresholds are **tunable** and currently
hand-set guesses. Do not document or test them as if they were meaningful
constants.

## AgentSignal — observable events

An `AgentSignal` is a fact the agent's loop reports about what just happened.
It is **not** a feeling and **not** a request. (Definitions: `signals.ts`.)

| Signal | Meaning (what was observed) |
|---|---|
| `tool_success` | A tool/action returned a usable result. |
| `tool_error` | A tool/action failed or errored. **Counts as a failure.** |
| `retry` | The agent re-attempted the same action. Not a failure. |
| `validation_pass` | A verification/check succeeded. |
| `validation_fail` | A verification/check failed. **Counts as a failure.** |
| `retrieval_hit` | Relevant context was found. |
| `retrieval_miss` | No relevant context was found. |
| `self_report` | Model-reported confidence; carries a `confidence` in [0,1]. |
| `progress` | Measurable advancement toward the task goal. |
| `stall` | A step that produced no progress. Not a failure. |

`weight` (default 1, clamped to [0,1]) scales the magnitude of an event.

**Invariant:** only `tool_error` and `validation_fail` are *failures* for the
circuit-breaker. `retry`, `stall`, and `retrieval_miss` raise friction or
uncertainty but never advance the failure counter.

## OperatingState — derived dimensions

Smoothed dimensions in [0,1], plus exact counters. (Definitions:
`operating-state.ts`.)

| Field | Meaning | Raised by | Lowered by | Kind |
|---|---|---|---|---|
| `uncertainty` | How unsure the run is. | misses, failures, low self-report | hits, passes, high self-report | invariant concept / tunable deltas |
| `friction` | How much is going wrong. | errors, retries, validation fails, stalls | successes, progress | invariant concept / tunable deltas |
| `confidence` | Reinforced by things working. | successes, passes, hits, progress | failures, misses | invariant concept / tunable deltas |
| `momentum` | Progress vs. being stuck. | progress, successes | stalls, errors | invariant concept / tunable deltas |
| `load` | Fraction of episode budget consumed. | every observed step (`stepCost`) | — | invariant concept / tunable cost |
| `consecutiveFailures` | Exact run of back-to-back failures. | `tool_error`, `validation_fail` | reset to 0 by `tool_success`/`validation_pass`/`progress` | **invariant, exact** |
| `stepCount` | Exact count of observed signals. | every observe | — | **invariant, exact** |
| `budgetUsed` | Unclamped accumulator behind `load`. | every observe (`stepCost`) | — | invariant / tunable cost |

**Invariants:**
- All smoothed dimensions stay within [0,1]; `load` within [0,1].
- `consecutiveFailures` and `stepCount` are exact integers, never smoothed.
- Counters reset/advance per the failure rule above.

## OperatingConfig — the knobs

Shape and defaults: `operating-config.ts`.

- `decay` — per-signal pull of each smoothed dimension toward its `rest`
  value. **Tunable.**
- `rest` — resting values dimensions drift toward absent reinforcing signals.
  **Tunable** (but `friction` rest of 0 is a deliberate choice: friction is
  *accumulated trouble*, its natural floor is "nothing wrong").
- `stepCost` — budget consumed per observed signal. **Tunable.**
- `effects` — per-signal additive deltas. **Tunable.** The *sign* of each
  delta is an invariant (a failure must not lower friction); the *magnitude*
  is not.
- `thresholds` — firing points for the decision ladder. `maxConsecutiveFailures`
  is a **near-invariant** safety bound; the rest are **tunable**.
- `retryBudget` — `base` and `frictionPenalty`. **Tunable.**

**Invariant:** decay is applied **per recorded signal, not per wall-clock
time.** There is no idle/background decay. One `observe` = one decay step plus
that event's effect.

## The decision ladder

`mapStateToOperatingPolicy` evaluates a strict priority order and returns the
first decision that fires. **The most protective decision always wins.** The
ordering itself is an **invariant**; the thresholds that trigger each rung are
tunable.

1. **`abort`** (hard stop) — `budgetUsed >= 1` OR
   `consecutiveFailures >= maxConsecutiveFailures`. The run is doomed or out of
   budget; stop. Sets `stop = true`, `autonomy = 0`.
2. **`escalate`** — high `friction` while stuck (`momentum` below
   `lowMomentum`). It keeps failing in a non-fatal way: ask a human instead of
   grinding. Sets `requireConfirmation = true`, low autonomy. Does **not**
   stop.
3. **`replan`** — high `uncertainty` while stuck. The current approach is not
   converging; change strategy. Sets `requireVerification = true`, short
   horizon.
4. **`verify`** — moderate `uncertainty` OR low `confidence`. Proceed, but
   check before committing. Sets `requireVerification = true`.
5. **`proceed`** — healthy state. Act; horizon and autonomy scale up with
   `confidence` and `momentum`.

Rationale for the order: abort protects against runaway/over-budget loops
(highest cost if missed); escalate vs. replan is distinguished by *why* the run
is stuck (friction = mechanism keeps breaking → get help; uncertainty = we
don't know enough → rethink); verify is the cheap precaution; proceed is the
default.

## Controls taxonomy

Which policy fields are binding, and how:

| Field | Class | Meaning for the loop |
|---|---|---|
| `control = "abort"`, `stop` | **Hard** | The loop MUST terminate. |
| circuit-breaker (failures/budget) | **Hard** | Deterministic; not overridable by affect. |
| `requireVerification` | **Gating** | The agent MUST run a verification step before committing; the step's content is the agent's choice. |
| `requireConfirmation` | **Gating** | The agent MUST get human confirmation before an irreversible action. |
| `control = escalate / replan / verify` | **Directive** | The agent SHOULD take the named action; how is its choice. |
| `retryBudget`, `autonomy`, `toolUsageThreshold`, `planning.*` | **Advisory** | Resource hints the agent SHOULD respect. |

## The affect boundary

**Invariant:** the optional `ExternalAffectSignal` may only *raise caution*
(lower autonomy, raise the tool-use threshold, and — past a caution bound — set
`requireConfirmation`). It can **never**:

- set `stop = true`,
- change `control` to `abort` or `escalate`,
- advance the failure counter.

Internal telemetry is the sole authority over hard and directive decisions.
This is pinned by a test today and must stay pinned.

## Semantic gotchas (read before writing tests)

These are the spots where the intuitive assumption is wrong:

1. **`retry` / `stall` do not trip the circuit-breaker.** Escalation from
   repeated retries happens via `friction`, not the failure counter.
2. **Decay is per signal, not time-based.** A `self_report` with no
   `confidence` is effectively a pure-decay step — useful for "pulls back
   toward rest" tests.
3. **`self_report` is special-cased** — it pulls `confidence` toward the
   reported value rather than applying a fixed delta.
4. **Abort triggers on `budgetUsed >= 1`, not `load`.** `load` is the clamped
   view; assert against `budgetUsed` for the breaker.
5. **Assert smoothed dimensions as ranges, exact values for counters.** Tuned
   deltas will move; the float will change, the direction will not.

## Evaluation contract

The trace-replay shape is fixed in `eval-contract.ts` (`OperatingEvalCase`,
`ExpectedStep`, `ExpectedFinal`, `OperatingEvalReport`). The runner that
consumes it and the fixtures belong to the eval track (`@amotion/eval`) and are
implemented by Person B. Policy is sampled **after** each signal is observed:
the policy at index `i` reflects signals `0..i` inclusive.
