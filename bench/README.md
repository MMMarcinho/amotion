# @amotion/bench

A tau-bench-*style* A/B harness for the amotion operating runtime.

> Not literal τ-bench (an external Python project). This is an in-repo,
> deterministic tool-use harness that exercises the same question τ-bench-style
> benchmarks ask: does governing the agent loop help on a fixed task set?

## What it measures

Each task is a tool-use goal: optionally gather context (retrieval), use a
primary tool until it succeeds, then submit a result a checker validates. Two
arms run the **same** agent policy, tools, task, and step cap:

- **naive** — the loop runs uncoverned to success or the step cap.
- **governed** — an `AgentRuntime` consumes the signals the environment emits
  and may `escalate` or `abort` the loop.

Governance never feeds the agent hints — it only stops or escalates — so the
claim stays honest: the win is *fewer wasted steps and early escalation on
doomed runs, without interrupting solvable ones*, not an inflated success rate.

## Held-out split

Tasks are tagged `report` or `calibration`. Thresholds (`OperatingConfig`) may
be tuned against the `calibration` set; the headline success / over-abort
numbers are read from the held-out `report` set so the guardrail claim is not
self-fulfilling.

## Run it

```sh
corepack pnpm --filter @amotion/bench test     # deterministic assertions
corepack pnpm --filter amotion build           # once, so the report script can resolve `amotion`
corepack pnpm --filter @amotion/bench dev      # prints the comparison tables
```

## Key metrics

- `avoidedToolCallsAvg` — mean tool calls saved by governance.
- `successRegressionRate` — naive solved but governed did not (target 0).
- `overAbortRate` — solvable tasks the governed arm interrupted (target 0).
- `avgInterruptLatencyDoomed` — how fast governance stops a doomed run.

## Next step: the live-LLM arm

The harness is deterministic by design (CI-safe, no API key). The live arm is
the documented next increment: replace the fixed agent policy in
`TaskWorld.nextAction` with an `AgentModel.decide(...)` that calls a real model
(e.g. the Anthropic SDK behind `ANTHROPIC_API_KEY`), keeping the environment,
signal extraction, governance, and metrics identical. Only the action source
changes; the A/B comparison and report stay the same.
