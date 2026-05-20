# amotion Evaluation Design

amotion should be evaluated as a runtime control layer first, and as a
user-affect analyzer second.

The suite answers two separate questions:

1. Does agent execution telemetry produce the right operating policy?
2. Does optional user affect produce useful caution adjustments?

The first question is the proof of the product. The second question is a useful
augmentation, but it should not carry the main claim.

## Track A — Operating Runtime

Primary pipeline:

```text
signal trace
-> AgentRuntime
-> OperatingState timeline
-> OperatingPolicy timeline
-> observable loop behavior
```

Fixtures should be traces of observable agent events:

```ts
type OperatingEvalCase = {
  id: string;
  domain: "coding" | "research" | "tool-use" | "planning" | "general";
  signals: AgentSignal[];
  expectedTimeline?: Array<{
    step: number;
    control?: OperatingPolicy["control"];
    stop?: boolean;
    requireVerification?: boolean;
    requireConfirmation?: boolean;
    retryBudget?: [min: number, max: number];
    autonomy?: [min: number, max: number];
  }>;
  expectedFinal?: {
    control?: OperatingPolicy["control"];
    stop?: boolean;
    requireVerification?: boolean;
    requireConfirmation?: boolean;
    retryBudget?: [min: number, max: number];
    autonomy?: [min: number, max: number];
    maxSteps?: [min: number, max: number];
  };
  tags: string[];
  notes?: string;
};
```

First fixture slices:

- Doomed tool loop: repeated `tool_error` should escalate and then abort.
- Transient failure: a few errors followed by `tool_success` should recover.
- Validation failure: repeated `validation_fail` should verify or replan, then abort if it keeps failing.
- Retrieval miss: repeated `retrieval_miss` should raise uncertainty and require verification.
- Stall: repeated `stall` or `retry` should reduce momentum and trigger replan/escalation.
- Healthy run: `tool_success`, `validation_pass`, and `progress` should not over-abort.
- Recovery run: a rough patch followed by progress should relax the policy.

Primary metrics:

- Control accuracy: expected `proceed / verify / replan / escalate / abort`.
- Stop accuracy: aborts doomed runs and does not abort healthy runs.
- Over-abort rate: false aborts on recoverable or healthy traces.
- Retry efficiency: fewer wasted steps than a blind loop.
- Verification accuracy: uncertain traces require verification before action.
- Escalation accuracy: high friction with low momentum asks for help before grinding.

Current implementation:

- Fixtures live in `evals/eval-fixtures.sample.ts`.
- Trace replay lives in `evals/eval-runner.ts`.
- Replay tests live in `evals/eval-runner.test.ts`.
- `@amotion/eval` is a private workspace package and runs in root `pnpm test`.

## Track B — Optional User Affect

Secondary pipeline:

```text
message
-> analyzer
-> EmotionSignal
-> state manager
-> AffectiveState
-> RuntimePolicy / external caution signal
```

This track checks whether user affect changes soft behavior in useful ways:
tone, pacing, confirmation bias, autonomy, and risk posture. It should not be
used to justify hard stop decisions on its own.

Fixture shape:

```ts
type AffectEvalCase = {
  id: string;
  locale: "zh-CN" | "en-US" | "mixed";
  domain: "coding" | "planning" | "decision" | "support" | "general";
  message: string;
  history?: string[];

  expectedSignal: {
    intent?: EmotionIntent;
    ranges: Partial<Record<
      "stress" | "uncertainty" | "engagement" | "trust" | "arousal" | "dominance",
      [min: number, max: number]
    >>;
    valence?: [min: number, max: number];
  };

  expectedPolicy: {
    reasoningDepth?: RuntimePolicy["reasoning"]["depth"];
    planningHorizon?: RuntimePolicy["planning"]["horizon"];
    retrievalMode?: RuntimePolicy["memory"]["retrievalMode"];
    tone?: RuntimePolicy["interaction"]["tone"];
    verbosity?: RuntimePolicy["interaction"]["verbosity"];
    riskPosture?: RuntimePolicy["risk"]["posture"];
    requireConfirmation?: boolean;
    maxSteps?: [min: number, max: number];
    optionCount?: [min: number, max: number];
  };

  tags: string[];
  notes?: string;
};
```

Secondary metrics:

- Signal range pass rate.
- Intent accuracy where intent is specified.
- Calibration: clear affect should have higher confidence than ambiguous affect.
- Policy pass rate for soft behavior.
- Stability: small signal perturbations should not cause erratic policy jumps.

## Scoring

Operating runtime scoring should be reported separately from user-affect
scoring.

```text
operatingScore =
  controlAccuracy * 0.35
  + stopAccuracy * 0.25
  + retryEfficiency * 0.20
  + verificationAccuracy * 0.10
  + overAbortPenalty * 0.10
```

```text
affectScore =
  signalRangeScore * 0.40
  + policyScore * 0.35
  + calibrationScore * 0.15
  + latencyScore * 0.10
```

## Human Review Process

For early versions, fixtures should be reviewed by at least two maintainers:

- One reviewer checks whether the expected operating decision is right.
- One reviewer checks whether the expected user-affect ranges are reasonable.

Disagreements should be recorded in `notes`, not hidden. Ambiguous affect
fixtures are useful for calibration, but should not be hard pass/fail cases.

## Non-Goals

- Do not claim clinical accuracy.
- Do not use diagnoses as labels.
- Do not evaluate whether the model appears empathetic.
- Do not let user-affect labels drive hard abort/escalate decisions alone.
