# amotion Project Spec

amotion is a runtime control layer for LLM agents.

Its credible core is the agent's own operating state. The runtime observes
execution telemetry and converts it into control policy:

```text
Agent execution telemetry
  -> Operating signals
  -> Operating state
  -> Operating policy
  -> Agent loop / adapter
```

Operating signals are observable facts, not inferred feelings:

- tool success or tool error
- retry
- validation pass or validation fail
- retrieval hit or retrieval miss
- progress or stall
- low or high self-reported confidence

The operating policy can affect:

- whether the loop should proceed, verify, replan, escalate, or abort
- retry budget
- verification and human-confirmation gates
- planning horizon and max steps
- tool-use threshold
- autonomy

Core idea:

> Emotion is not expression. Emotion is runtime resource allocation.

## MVP Scope

The current core is:

```text
AgentSignal
-> OperatingState
-> OperatingPolicy
```

`AgentRuntime` owns this loop state and exposes `observe`, `decide`, and `tick`.
Hard control decisions such as `abort` and `escalate` should come from this
agent telemetry path.

The user-affect path still exists, but it is optional and lower authority:

```text
User message
  -> Emotion analyzer
  -> AffectiveState
  -> RuntimePolicy / external caution signal
```

User affect may make the agent slower, more careful, more confirmatory, or more
supportive. It must not be the sole source for hard stop decisions.

## Local Model Path

The optional affect analyzer uses `TransformerEmotionAnalyzer`, powered by
Transformers.js and local ONNX text-classification models.

The current default model is:

```text
onnx-community/tanaos-emotion-detection-v1-ONNX
```

For richer fine-grained classification, the analyzer can be configured with
GoEmotions-style ONNX models such as:

```text
SamLowe/roberta-base-go_emotions-onnx
```

`RuleAnalyzer` is retained only as a fallback when a local model cannot be
loaded.

Provider LLM and local LLM integrations should stay outside the default core
dependency graph.

## Evaluation

Evaluation has two tracks:

- Primary: operating trace -> `AgentRuntime` -> `OperatingPolicy`
- Secondary: user message -> affect analyzer -> `RuntimePolicy`

The benchmark should prove that an operating-state-aware agent wastes fewer
steps, avoids blind retry loops, verifies under uncertainty, and does not
over-abort healthy runs.

The current strategy is documented in [`EVALUATION.md`](./EVALUATION.md). The
implementation sketch lives in [`docs/EVAL_DESIGN.md`](./docs/EVAL_DESIGN.md),
with fixture and runner sketches in [`evals/`](./evals/).
