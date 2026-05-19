# amotion

Emotion Runtime for LLM Agents.

amotion converts emotional signals into runtime policies for LLM agents.

It does not try to make agents "feel emotions".
It makes agents affect-aware at runtime.

## Core Idea

Emotion is not expression.
Emotion is runtime resource allocation.

## Pipeline

```text
User Input
-> Emotion Analyzer
-> Affective State
-> Runtime Policy
-> Agent Adapter
```

## What Can Emotion Affect?

- reasoning depth
- planning horizon
- memory retrieval
- tool-use threshold
- response pacing
- risk posture
- execution threshold

## Install

```sh
pnpm add amotion
```

## Usage

```ts
import { Amotion, policyToSystemHint } from "amotion";

const amotion = new Amotion();

const result = await amotion.process({
  message: "我现在有点焦虑，不知道该怎么办",
});

console.log(result.policy);

const hint = policyToSystemHint(result.policy);
```

Output:

```ts
{
  signal,
  state,
  policy
}
```

## Design Principle

amotion does not directly control the LLM.
It outputs runtime policy.
Adapters translate policy into concrete agent behavior.

## Emotion Analyzer

The default analyzer is `TransformerEmotionAnalyzer`.

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

## MVP Non-goals

- clinical emotion diagnosis
- mental health advice
- anthropomorphic claims
- provider LLM integrations in core
- training pipeline

## Roadmap

- v0.1: Core schema, Transformers.js analyzer, StateManager, PolicyMapper, PromptAdapter, basic Node example.
- v0.2: React playground, policy visualization, configurable mapping rules.
- v0.3: Configurable local transformer model registry and benchmark fixtures.
- v0.4: Local LLM analyzer with Ollama-style adapters.
- v0.5: Provider LLM analyzers.
- v1.0: Stable runtime policy interface, framework adapters, benchmark demo, paper-ready experiments.
