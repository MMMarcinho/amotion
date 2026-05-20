# amotion Roadmap

amotion turns user affect into runtime control policy for LLM agents. The
guiding principle stays fixed across versions:

> Emotion is not expression. Emotion is runtime resource allocation.

This roadmap pulls **evaluation forward**. The project's central claim is
empirical — *affect-aware agents behave more appropriately than affect-blind
ones* — so measurement is treated as a first-class deliverable from v0.3 on,
not deferred to v1.0. See [EVALUATION.md](./EVALUATION.md) for the methodology
the milestones below reference.

## Status

- **v0.1 (done):** Core schema, Transformers.js analyzer, RuleAnalyzer
  fallback, HybridAnalyzer, StateManager (EMA smoothing), PolicyMapper,
  PromptAdapter, generic + LangGraph config adapters, basic Node example,
  React playground.

## v0.2 — Configurability & invariants

Make the policy layer tunable and lock its behavior with deterministic tests.

- [x] Externalize PolicyMapper baseline, firing thresholds, and attention
      coefficients into a `PolicyConfig` (`DEFAULT_POLICY_CONFIG` reproduces
      v0.1 behavior exactly).
- [x] Property tests for the mapper: range invariants, monotonic
      relationships (stress↑ ⇒ actionThreshold↑ / autonomy↓, engagement↑ ⇒
      maxSteps↑, uncertainty↑ ⇒ verification↑), and golden archetype
      snapshots.
- [ ] Property tests for StateManager: boundedness, convergence, decay,
      smoothing monotonicity.
- [ ] Playground: expose `PolicyConfig` editing and live policy diffing.
- [ ] Document the policy schema and each rule's intent.

## v0.3 — Analyzer benchmarks

Validate the parts of the system that are currently untested: classification
accuracy and the label → 7-dimension mapping.

- [ ] Configurable local transformer model registry.
- [ ] Labeled fixture corpus (versioned JSON) for analyzer regression.
- [ ] `@amotion/eval` package scaffold (fixture loader, metrics, reporter).
- [ ] Analyzer accuracy harness (per-label F1 on GoEmotions-style splits).
- [ ] VAD-correlation harness: amotion valence/arousal/dominance vs.
      human-annotated corpora (e.g. EmoBank).
- [ ] Confidence calibration report.

## v0.4 — Real agent integration & policy conformance

Move adapters from config objects to executable integrations, then measure
whether agents actually obey the emitted policy.

- [ ] Local LLM analyzer (Ollama-style adapter).
- [ ] Executable framework adapters (runnable LangGraph integration, not just
      a config shape).
- [ ] Instrumented agent trace format.
- [ ] Policy-conformance harness: does observed agent behavior match the
      policy (confirmation under high stress, option count, verbosity)?
      Scored with an LLM-as-judge over traces.

## v0.5 — End-to-end behavioral evaluation

Test the core claim with controlled comparisons.

- [ ] Provider LLM analyzers.
- [ ] Paired scenario suite (same task, different emotional framing).
- [ ] A/B harness: affect-aware policy vs. fixed-neutral control, N runs,
      effect sizes + significance.
- [ ] Simulated-user agent for multi-turn trajectories.
- [ ] Multi-turn trajectory fixtures validating state de-escalation
      (panic → calm relaxes the policy envelope).

## v1.0 — Stable interface & reproducible experiments

- [ ] Versioned, frozen `RuntimePolicy` schema.
- [ ] Public benchmark report with ablations (rule vs. transformer analyzer,
      with/without state smoothing, neutral control).
- [ ] Paper-ready experiment package.
- [ ] Stable framework adapter APIs.

## Non-goals (unchanged)

Clinical emotion diagnosis, mental-health advice, anthropomorphic claims,
provider-LLM integrations inside core, training pipelines.
