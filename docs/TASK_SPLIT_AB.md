# A/B Task Split

This document defines the two-person collaboration model for the next phase of
amotion.

Recommended assignment:

- **Person A: Claude** — product semantics, architecture language, API boundary.
- **Person B: Codex** — executable behavior, tests, fixtures, local validation.

The key direction is:

```text
User affect influences interaction posture.
Agent operating state controls action.
```

amotion should not make the agent mirror the user's emotion. It should let the
agent allocate runtime resources according to observable execution state, while
using user affect only as an optional caution signal.

## Important Clarification: Local Model Dependency

Person B may touch local-model evaluation later, but **the main B track should
not depend on local models**.

The primary B track is operating-runtime validation:

```text
AgentSignal trace
-> AgentRuntime
-> OperatingPolicy
-> expected control behavior
```

This path is deterministic and does not require `TransformerEmotionAnalyzer`,
Hugging Face downloads, ONNX runtime, or any local model.

Local model work belongs to the secondary user-affect track:

```text
User message
-> Emotion analyzer
-> AffectiveState
-> RuntimePolicy / caution signal
```

That track can be handled after the operating runtime is stable.

## Person A: Claude

### Mission

Person A defines what the system means.

A's job is to make the conceptual model crisp enough that tests, fixtures,
adapters, and future APIs do not drift into conflicting interpretations.

### Core Questions

Person A should answer:

- What is an `AgentSignal`?
- What is an `OperatingState`?
- What does each state dimension mean?
- When should the runtime `proceed`, `verify`, `replan`, `escalate`, or `abort`?
- Which controls are hard controls, and which are advisory?
- How does user affect influence caution without becoming the main driver?
- Which public types should become stable by v1?

### Primary Deliverables

1. `docs/OPERATING_RUNTIME.md`
   - Define every `AgentSignal` type.
   - Define every `OperatingState` field.
   - Explain `OperatingConfig`: decay, rest values, effects, thresholds, retry budget.
   - Explain every `OperatingPolicy` field.
   - Define the decision ladder: abort, escalate, replan, verify, proceed.
   - State clearly that user affect cannot trigger hard stop decisions by itself.

2. `docs/API_CONTRACT.md`
   - Mark which fields are stable contract candidates.
   - Mark which fields are experimental.
   - Define compatibility expectations for v1.
   - Separate core operating APIs from optional user-affect APIs.

3. Roadmap refinement
   - Keep v0.2 focused on the operating runtime.
   - Keep v0.3 focused on trace replay and eval scaffold.
   - Keep v0.4 focused on real adapter behavior.
   - Keep v0.5 focused on end-to-end A/B experiments.

### Non-Goals

Person A should not spend time implementing runners, test harnesses, or adapter
code unless it is needed to clarify semantics.

Person A should avoid designing around emotional expression. The target is
runtime resource allocation, not simulated feeling.

### Definition of Done

Person A is done when Person B can read the docs and implement tests, fixtures,
trace replay, and adapter behavior without asking what each policy decision is
supposed to mean.

## Person B: Codex

### Mission

Person B proves that the system behaves as described.

B's job is to turn the conceptual model into executable checks: tests,
fixtures, replay tools, and adapter prototypes.

### Core Questions

Person B should answer:

- Does the reducer keep state bounded?
- Does decay pull state back toward rest?
- Do failures increase friction and uncertainty?
- Does progress restore confidence and momentum?
- Does the circuit breaker stop doomed loops?
- Does the runtime avoid over-aborting healthy runs?
- Can a saved signal trace reproduce an expected policy timeline?
- Can an adapter make `OperatingPolicy` control a real loop?

### Primary Deliverables

1. Reducer and runtime tests
   - Add tests for decay toward rest.
   - Add tests for recovery after a rough run.
   - Add tests for long noisy traces staying in range.
   - Add tests for `budgetUsed`, `load`, and `stepCount`.
   - Add tests for failure counter behavior.

2. Operating fixtures
   - Doomed tool loop.
   - Transient failure then recovery.
   - Retrieval misses requiring verification.
   - Validation failures requiring replan or abort.
   - Repeated retry/stall causing escalation.
   - Healthy run that should not over-abort.
   - Rough patch followed by recovery.

3. Trace replay
   - Read `OperatingEvalCase` fixtures.
   - Feed each signal into `AgentRuntime`.
   - Record the policy at each step.
   - Assert `expectedTimeline` and `expectedFinal`.
   - Return structured failures.

4. Eval split
   - Keep `evaluateOperatingRuntime` separate from user-affect analyzer eval.
   - Report operating score and affect score separately.
   - Do not combine them into a single product score.

5. Adapter helper prototype
   - Make `policy.stop` terminate the loop.
   - Make `requireVerification` call a verification hook.
   - Make `control === "replan"` call a replan hook.
   - Make `control === "escalate"` call an escalation hook.
   - Make `requireConfirmation` call a confirmation hook before irreversible actions.

### Local Model Work

If local model evaluation is assigned to Person B, it should be treated as a
separate secondary task after the operating runtime track is stable.

That later task includes:

- Running `TransformerEmotionAnalyzer` with cached local files.
- Verifying `AMOTION_LOCAL_FILES_ONLY=true`.
- Scoring user-affect fixtures.
- Comparing rule fallback vs local transformer behavior.

This is not required for the primary operating-runtime milestone.

### Non-Goals

Person B should not redefine the semantics of `OperatingPolicy` while writing
tests. If the implementation and docs disagree, B should flag the mismatch and
ask A to resolve the meaning.

Person B should not let local model availability block deterministic operating
runtime work.

### Definition of Done

Person B is done when the operating runtime has executable evidence:

- Tests pass.
- Fixtures cover the important scenarios.
- Trace replay can verify expected timelines.
- Adapter prototype shows that policy can actually control an agent loop.

## Dependency Map

```text
A: Operating runtime semantics
  -> B: reducer/runtime tests
  -> B: fixtures
  -> B: trace replay
  -> B: adapter prototype
  -> A+B: API contract and final roadmap
```

Some work can happen in parallel:

| Work | Owner | Can Start Immediately | Depends On |
|---|---|---:|---|
| Operating runtime docs | A | Yes | None |
| Reducer/runtime tests | B | Yes | Existing code |
| Fixture list | B | Yes | Existing behavior, then A review |
| Trace replay | B | Yes | Fixture shape |
| Adapter semantics | A | Yes | Operating docs |
| Adapter prototype | B | After initial docs | Adapter semantics |
| API contract | A | Later | Docs + tests + adapter lessons |
| Local model eval | B | Later | Affect fixtures + cached model |

## Recommended Execution Order

1. A writes `OPERATING_RUNTIME.md` draft.
2. B adds reducer/runtime tests in parallel.
3. B expands operating fixtures.
4. A reviews fixture expectations against the docs.
5. B implements trace replay.
6. A defines adapter semantics.
7. B builds adapter helper prototype.
8. A and B jointly finalize API contract.

## Success Criteria

The phase succeeds when the project can make this claim with evidence:

> Given an observable agent execution trace, amotion can decide when to proceed,
> verify, replan, escalate, or abort, and those decisions improve loop behavior
> compared with a blind agent loop.

