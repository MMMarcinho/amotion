# amotion Project Spec

amotion is an emotion runtime layer for LLM agents.

It converts user emotional signals into runtime control policies that can influence agent operating dynamics:

- reasoning depth
- planning horizon
- memory retrieval
- tool-use threshold
- response pacing
- risk posture
- execution threshold

Core idea:

> Emotion is not expression. Emotion is runtime resource allocation.

## Pipeline

```text
User Input
  -> Emotion Analyzer
  -> Affective State Manager
  -> Runtime Policy Mapper
  -> Agent Adapter
  -> LLM Agent Runtime
```

## MVP Scope

The first version focuses on:

```text
Emotion Signal
-> Affective State
-> Runtime Policy
```

The default analyzer is `TransformerEmotionAnalyzer`, powered by Transformers.js and a local ONNX text-classification model.

The current default model is:

```text
onnx-community/tanaos-emotion-detection-v1-ONNX
```

It is an ONNX text emotion classifier usable with Transformers.js. The analyzer maps model labels into amotion's runtime dimensions.

For richer fine-grained classification, the analyzer can be configured with GoEmotions-style ONNX models such as:

```text
SamLowe/roberta-base-go_emotions-onnx
```

`RuleAnalyzer` is retained only as a fallback when a local model cannot be loaded.

## Local Model Path

The local inference path is privacy-preserving by default:

- Transformers.js for browser and Node.js transformer pipelines backed by ONNX Runtime.
- ONNX Runtime Mobile for on-device inference on iOS and Android.
- GoEmotions-style or DistilRoBERTa-style emotion classifiers as local affect estimators.

Provider LLM and local LLM integrations should stay outside the default core dependency graph.
