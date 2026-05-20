import type { OperatingConfig } from "./operating-config";
import type { OperatingState } from "./operating-state";
import type { ControlDecision, OperatingPolicy } from "./operating-policy";
import type { AgentSignal, AgentSignalType, ExternalAffectSignal } from "./signals";

/**
 * Evaluation contract for the agent operating runtime (Person A boundary).
 *
 * These are TYPES ONLY. The trace-replay runner that consumes them
 * (`evaluateOperatingRuntime`) and the fixtures that populate them belong to
 * the eval track (`@amotion/eval`) and are implemented separately. This file
 * fixes the shape so fixtures, the runner, and the docs cannot drift.
 *
 * Semantics: a case is a deterministic signal trace fed into a fresh
 * `AgentRuntime`. The policy is sampled AFTER each signal is observed (so the
 * policy at index `i` reflects signals `0..i` inclusive). `expectedTimeline`
 * asserts decisions at chosen steps; `expectedFinal` asserts the terminal
 * policy and state.
 */

/** Numeric, smoothed operating-state dimensions (counters are asserted exactly). */
export type OperatingStateDimension = "uncertainty" | "friction" | "confidence" | "momentum" | "load";

/** Inclusive `[min, max]` range. Smoothed dimensions are floats, so ranges — not exact equality — are the credible assertion. */
export type Range = [min: number, max: number];

/** Expectation sampled after the signal at `at` is observed. Only set the fields you mean to assert. */
export type ExpectedStep = {
  /** 0-based index into `signals`. */
  at: number;
  control?: ControlDecision;
  stop?: boolean;
  requireVerification?: boolean;
  requireConfirmation?: boolean;
};

/** Expectation for the terminal policy and state after all signals are observed. */
export type ExpectedFinal = {
  control?: ControlDecision;
  stop?: boolean;
  requireVerification?: boolean;
  requireConfirmation?: boolean;
  /** Inclusive ranges for smoothed dimensions, e.g. `{ friction: [0.6, 1] }`. */
  state?: Partial<Record<OperatingStateDimension, Range>>;
  /** Exact counter assertions. */
  consecutiveFailures?: number;
  stepCount?: number;
};

export type OperatingEvalCase = {
  name: string;
  description?: string;
  /** Full config override. When omitted, `DEFAULT_OPERATING_CONFIG` is used. */
  config?: OperatingConfig;
  /** Optional external affect held constant for the whole trace (caution only — never causes a stop). */
  affect?: ExternalAffectSignal;
  signals: AgentSignal[];
  expectedTimeline?: ExpectedStep[];
  expectedFinal?: ExpectedFinal;
};

/** Per-step record the runner emits while replaying a case. */
export type OperatingEvalStepResult = {
  index: number;
  signal: AgentSignalType;
  state: OperatingState;
  policy: OperatingPolicy;
};

/** A single assertion that did not hold. `at` is the signal index, or `"final"` for terminal checks. */
export type OperatingEvalFailure = {
  at: number | "final";
  field: string;
  expected: unknown;
  actual: unknown;
};

/** Structured result for one case. `passed` is `failures.length === 0`. */
export type OperatingEvalReport = {
  name: string;
  passed: boolean;
  steps: OperatingEvalStepResult[];
  failures: OperatingEvalFailure[];
};
