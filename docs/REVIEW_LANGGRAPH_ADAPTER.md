# Review — `@amotion/adapters-langgraph` plan

Reviewer position (Person A) on the LangGraph adapter design dated 2026-05-20.
This records what I endorse and what I would change *before* committing to the
plan. It does not assign owners — that decision is the maintainer's.

Verification note: the two code claims in the plan's §16 were checked against
the current branch and are both accurate (see "Blocking prerequisites").

## Verdict

**Endorse the direction.** Proving amotion on a real, public orchestration
runtime via a controlled A/B is the correct credibility move — it removes the
objection that the value is an artifact of a self-built loop. The isomorphism
argument is genuine: LangGraph's stateful graph ↔ accumulated `OperatingState`,
conditional routing ↔ the control ladder, interrupt/HITL ↔
`requireConfirmation`/`escalate`, checkpoint ↔ replay. My comments below are
about **sequencing and falsification risk**, not architecture.

## Supported as-is (adopt without change)

1. **Separate package** (`@amotion/adapters-langgraph`), not folded into the
   framework-neutral `@amotion/adapters`. Correct: a concrete framework
   dependency should not pollute the neutral package, and it versions
   independently.
2. **Thin adapter that does not own the loop.** The user keeps defining the
   graph; the adapter supplies state shape, policy node, routing helper, signal
   extractors, interrupt helpers. Avoids reinventing a runtime.
3. **Do not persist the `AgentRuntime` instance.** Checkpoint only the
   serializable `OperatingState` + signals + policy + episode metadata, and
   rebuild the runtime each policy node. This is the right call for LangGraph
   checkpoint/replay and is the strongest single insight in the plan.
4. **Signals are observable execution facts, not emotion judgments** (§6 framing).
5. **Hard vs. advisory split** (§4): `abort`→`END` and irreversible-action
   `requireConfirmation`→interrupt are enforced; advisory fields
   (`retryBudget`, `toolUsageThreshold`, `maxSteps`, `autonomy`) are exposed but
   not over-interpreted until the bench validates a mapping.
6. **The non-goals** (§15), especially "user affect is never route authority"
   and "do not auto-detect irreversibility."

## Changes I would make before/within the plan

1. **Front-load a minimal comparative bench; do not defer all bench to Phase 4.**
   The bench is the entire justification, so the Phase-1 fake-graph integration
   test should already emit *comparative* metrics (naive vs. governed: wasted
   tool calls, step-exhaustion, doomed-loop abort latency), not only route
   assertions. Get a falsification signal before the API hardens.

2. **tau-bench before SWE-bench.** amotion's mechanism targets wasted retries,
   doomed loops, and step-exhaustion. SWE-bench failures are dominated by
   "couldn't solve it," where that mechanism is marginal to the headline number
   — a poor place to anchor credibility. A tool/user-interaction bench
   (tau-bench style) exercises tool-failure and retry dynamics directly.
   Suggested order: fake deterministic → tau-bench subset → *then* SWE-bench
   Lite if useful.

3. **Name the calibration trap.** The circuit-breaker count and the
   friction/uncertainty thresholds are explicitly *tunable guesses*. The
   bench's headline guardrail is "do not regress healthy-run success." Tuning
   those thresholds on the same tasks that measure success is overfitting. Use
   a **held-out task split** — calibrate on one set, report on another — and
   make success-non-regression on held-out tasks a **hard gate**.

4. **Downgrade auto `stall`/`retry` extractors.** `tool_success`/`tool_error`
   are trivial (try/catch). "Stall = key state unchanged" and "retry = same
   action again" require state-diffing and action-identity heuristics that are
   graph-specific *guesses* — exactly what the operating-state philosophy says a
   signal must not be. For v1, expose the extractor hook and ship stall/retry
   only as clearly-labeled best-effort or user-supplied, so noise is not
   imported under an "observable facts" banner.

5. **Make the confirmation/irreversibility gap explicit.** §9 gates
   `requireConfirmation` on "next action is irreversible," but §15 forbids
   auto-detecting irreversibility. Therefore confirmation gating is **inert
   unless the user annotates actions as irreversible.** State this loudly in the
   API or a reviewer will read the gate as broken.

6. **Define state-channel merge semantics under branching.** `signals: [...prev,
   ...pending]` needs an explicit LangGraph channel reducer, and parallel
   branches that both append will double-count. v1 should either assume linear
   graphs or define the reducer plus an episode/dedup key.

## Blocking prerequisites (promote from §16 "recommended")

The plan lists these as recommended; I would treat #1 and #2 as **blocking**,
because the replay-based credibility argument (§13–14) depends on them:

1. **The eval runner silently ignores part of the contract.**
   `evals/eval-runner.ts` `scoreOperatingPolicy` checks
   `control/stop/requireVerification/requireConfirmation/retryBudget/autonomy/maxSteps`
   but **not** `expectedFinal.state`, `consecutiveFailures`, or `stepCount`.
   Those fields exist in the canonical contract today, so any fixture asserting
   them passes vacuously. Replay cannot be the credibility leg of the bench
   while it checks less than it claims. (Introduced by the contract
   reconciliation — mine to fix.)

2. **`AgentRuntime.reset()` does not clear external affect.** `reset()` rebuilds
   `currentState` but leaves `this.affect` set, so a reused runtime leaks the
   previous episode's caution into the next — making multi-episode replay
   non-deterministic.

3/4. **Corepack-only `pnpm` failure and missing CI** are real but genuinely
   non-blocking for the adapter; schedule them whenever convenient.

## Suggested classification of the work (not an assignment)

Offered only to help routing; the maintainer decides owners.

- **Contract / semantics (A-type):** the irreversibility-annotation contract,
  the channel-merge/episode-key semantics, the held-out calibration protocol,
  the route-mapping spec.
- **Implementation / eval (B-type):** prerequisite fixes #1–#2, signal
  extractors, policy node, routing helper, interrupt helpers, fake-graph
  integration test with comparative metrics, bench harness.

## Bottom line

Build it — with the bench's minimal form present from Phase 1, tau-bench ahead
of SWE-bench, a held-out split guarding the success-regression claim, and the
two blocking prerequisites fixed first.
