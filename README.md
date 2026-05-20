# amotion

Runtime control layer for LLM agents.

amotion converts an agent's **operating signals** into runtime control policy.
The signals are observable execution facts — tool errors, retries, failed
verifications, retrieval misses, stalls, low self-reported confidence — not
inferred feelings. The runtime turns them into mechanical control decisions:
**proceed / verify / replan / escalate / abort**.

## Core Idea

> Emotion is not expression. Emotion is runtime resource allocation.

The "affective state" amotion tracks is the **agent's own operating state**,
derived from what the run actually did. That makes every decision auditable
against the trace: an agent that keeps failing accrues `friction`, loses
`momentum`, and the runtime escalates or stops it instead of grinding forever.

User emotion is supported too, but only as an **optional external signal** that
can make the agent more cautious — never as the thing that drives the loop.

## Pipeline

```text
Agent execution telemetry        (optional) User affect
        |                                 |
        v                                 v
   Operating Signals  ----------------> AgentRuntime
                                          |
                              Operating State (uncertainty,
                              friction, confidence, momentum, load)
                                          |
                                          v
                              Operating Policy  (proceed / verify /
                              replan / escalate / abort, retry budget,
                              verification & confirmation gates, autonomy)
```

## What Operating State Drives

- control decision (proceed / verify / replan / escalate / abort)
- retry budget (fewer retries as friction rises — forces a strategy change)
- verification & human-confirmation gates
- planning horizon and step bounds
- tool-use threshold
- autonomy
- a deterministic circuit-breaker (consecutive failures / budget exhaustion)

## Install

```sh
pnpm add amotion
```

## Usage — agent operating runtime

```ts
import { AgentRuntime } from "amotion";

const rt = new AgentRuntime();

while (true) {
  const result = runOneStep();
  const policy = rt.tick(
    result.ok ? { type: "tool_success" } : { type: "tool_error" }
  );

  if (policy.stop) break;                 // circuit-breaker tripped
  if (policy.control === "escalate") askHuman();
  if (policy.requireVerification) verifyBeforeActing();
}
```

See [`examples/agent-loop`](./examples/agent-loop) for a runnable comparison
of a naive loop vs. a runtime-governed loop on a flaky tool.

## Usage — optional user-affect signal

The original user-affect path still exists. Treat its output as one external
input that nudges caution, not as ground truth about the user's mind.

```ts
import { Amotion, policyToSystemHint } from "amotion";

const amotion = new Amotion();
const result = await amotion.process({ message: "我现在有点焦虑，不知道该怎么办" });
const hint = policyToSystemHint(result.policy);
```

## Design Principle

amotion does not directly control the LLM.
It outputs runtime policy.
The agent's loop (or an adapter) translates policy into concrete behavior.

## Optional: User-Affect Analyzer

This is the **external, optional** signal path. It estimates user emotion from
text and exposes it as a caution input to the runtime. It is inherently noisy
and culturally loaded — see [EVALUATION.md](./EVALUATION.md) for how its
fidelity is measured and [ROADMAP.md](./ROADMAP.md) for where it fits.

The analyzer is `TransformerEmotionAnalyzer`.

It uses Transformers.js (`@huggingface/transformers`) with a local ONNX text-classification model:

```ts
import { TransformerEmotionAnalyzer } from "amotion";

const analyzer = new TransformerEmotionAnalyzer({
  model: "onnx-community/tanaos-emotion-detection-v1-ONNX",
});
```

The classifier output is mapped into amotion runtime dimensions such as `stress`, `uncertainty`, `engagement`, `trust`, `valence`, `arousal`, and `dominance`.

The first run downloads model files from Hugging Face unless the model is already cached or `pipelineOptions.local_files_only` is enabled.

If you use a mirror, set `HF_ENDPOINT` before running the app:

```sh
HF_ENDPOINT=https://hf-mirror.com pnpm --filter @amotion/basic-node dev
```

You can also configure it in code:

```ts
const analyzer = new TransformerEmotionAnalyzer({
  remoteHost: "https://hf-mirror.com",
});
```

To run against a manually downloaded local model:

```sh
AMOTION_MODEL=/Users/marco/github/models/tanaos-emotion-detection-v1-ONNX \
AMOTION_LOCAL_FILES_ONLY=true \
pnpm --filter @amotion/basic-node dev
```

For richer fine-grained labels, you can configure a GoEmotions ONNX model:

```ts
const analyzer = new TransformerEmotionAnalyzer({
  model: "SamLowe/roberta-base-go_emotions-onnx",
});
```

`RuleAnalyzer` still exists only as a lightweight fallback when local model loading is unavailable. It is not the primary analyzer.

## Packages

- `amotion`: core schema, analyzer, state manager, policy mapper, runtime class, and prompt hint helper.
- `@amotion/adapters`: framework-neutral adapter helpers for generic agents and future framework integrations.

## Development

```sh
pnpm install
pnpm test
pnpm build
pnpm --filter @amotion/basic-node dev
pnpm --filter @amotion/playground dev
```

## Evaluation Design

The primary evaluation plan lives in [EVALUATION.md](./EVALUATION.md).
The implementation sketch lives in [docs/EVAL_DESIGN.md](./docs/EVAL_DESIGN.md).

It separates two questions:

- whether operating telemetry produces the right control decisions
- whether optional user-affect signals produce useful caution adjustments

The executable trace replay harness and sample fixtures live in [evals/](./evals/).

## MVP Non-goals

- clinical emotion diagnosis
- mental health advice
- anthropomorphic claims
- provider LLM integrations in core
- training pipeline

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full plan.

- v0.2: finish the agent operating runtime and document every control decision.
- v0.3: add trace replay, eval fixtures, and the `@amotion/eval` scaffold.
- v0.4: ship a real agent adapter that consumes `OperatingPolicy`.
- v0.5: run end-to-end A/B experiments against blind control loops.
- v1.0: freeze the public runtime interfaces and publish benchmark results.
