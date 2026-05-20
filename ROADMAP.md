# amotion Roadmap

amotion is a runtime control layer for LLM agents. The guiding principle stays
fixed across versions:

> Emotion is not expression. Emotion is runtime resource allocation.

**Direction (since v0.2):** the credible core is the **agent's own operating
state**, derived from execution telemetry (tool errors, retries, failed
verifications, stalls, low confidence), not inferred user feeling. The runtime
converts that state into mechanical control decisions (proceed / verify /
replan / escalate / abort) that gate the agent's loop. User affect is retained
as an **optional external caution signal**, not the driver.

This roadmap pulls **evaluation forward**. The central claim is empirical —
*an operating-state-aware agent behaves more safely and efficiently than a
blind one* — so measurement is a first-class deliverable from v0.3 on, not
deferred to v1.0. See [EVALUATION.md](./EVALUATION.md).

## Status

- **v0.1 (done):** Core schema, Transformers.js user-affect analyzer,
  RuleAnalyzer fallback, HybridAnalyzer, StateManager (EMA smoothing),
  PolicyMapper, PromptAdapter, generic + LangGraph config adapters, basic Node
  example, React playground.
- **v0.2 (in progress):** Agent operating-state runtime — `AgentRuntime`,
  signal vocabulary, operating-state reducer, control-decision ladder with a
  deterministic circuit-breaker, config-driven policy mapping, property +
  scenario tests, and a runnable naive-vs-governed demo (`examples/agent-loop`).
  User-affect repositioned as an optional external signal.

## v0.2 — Agent operating runtime + configurability

Establish the credible core and lock its behavior with deterministic tests.

- [x] Agent operating-state runtime: signal vocabulary, state reducer,
      control-decision ladder (proceed / verify / replan / escalate / abort),
      deterministic circuit-breaker, `AgentRuntime` controller.
- [x] Operating-runtime tests: state range invariants, retry-budget
      monotonicity, decision-ladder branches, and control-loop scenarios
      (terminates a doomed loop, escalates before the breaker, recovers).
- [x] Runnable naive-vs-governed demo (`examples/agent-loop`).
- [x] Externalize PolicyMapper baseline, firing thresholds, and attention
      coefficients into a `PolicyConfig` (`DEFAULT_POLICY_CONFIG` reproduces
      v0.1 behavior exactly).
- [x] Property tests for the user-affect mapper: range invariants, monotonic
      relationships, and golden archetype snapshots.
- [ ] Property tests for the operating-state reducer: convergence to rest,
      decay, recovery semantics under long runs.
- [ ] Executable adapter: map `OperatingPolicy` onto a real agent loop helper.
- [ ] Document the operating-state schema and each decision's rationale.

## v0.3 — Eval scaffold & signal fidelity

Stand up measurement for both tracks.

- [ ] `@amotion/eval` package scaffold (fixture loader, metrics, reporter).
- [ ] Trace replay harness: feed recorded agent traces (signal sequences)
      through `AgentRuntime` and assert the decision timeline.
- [ ] Versioned scenario fixtures for operating-state behavior.
- [ ] External signal: configurable model registry, labeled corpus, analyzer
      accuracy (per-label F1) and VAD-correlation vs. EmoBank, calibration.

## v0.4 — Real agent integration & policy conformance

Make the runtime drive a real loop, then measure whether the agent obeys it.

- [ ] Executable adapter / framework integration (runnable LangGraph loop that
      consumes `OperatingPolicy`), not just a config shape.
- [ ] Instrumented agent trace format emitting operating signals automatically.
- [ ] Conformance harness: when policy says escalate/abort/verify, did the
      agent actually do it? Scored over traces (deterministic + LLM-judge).

## v0.5 — End-to-end behavioral A/B

Test the core claim with controlled comparisons.

- [ ] Task suite where naive agents loop, stall, or burn budget.
- [ ] A/B harness: operating-runtime-governed agent vs. blind control, N runs,
      with effect sizes + significance on success, steps, wasted tool calls,
      and unsafe-action rate.
- [ ] Multi-turn trajectories validating recovery (rough patch → resolved
      relaxes the control posture) and that the runtime does not over-abort.
- [ ] Optional external-affect ablation: does user-affect caution help or hurt?

## v1.0 — Stable interface & reproducible experiments

- [ ] Versioned, frozen `RuntimePolicy` schema.
- [ ] Public benchmark report with ablations (rule vs. transformer analyzer,
      with/without state smoothing, neutral control).
- [ ] Paper-ready experiment package.
- [ ] Stable framework adapter APIs.

## Non-goals (unchanged)

Clinical emotion diagnosis, mental-health advice, anthropomorphic claims,
provider-LLM integrations inside core, training pipelines.
