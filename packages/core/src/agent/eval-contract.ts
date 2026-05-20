import type { OperatingConfig } from "./operating-config";
import type { ControlDecision } from "./operating-policy";
import type { AgentSignal, ExternalAffectSignal } from "./signals";

/**
 * Canonical evaluation contract for the agent operating runtime (Person A
 * boundary). This is the single source of truth for what an operating eval
 * case looks like and what may be asserted about it.
 *
 * TYPES ONLY. The trace-replay runner that consumes these and the fixtures
 * that populate them live in the eval track (`evals/`, Person B), which imports
 * these types from `amotion` rather than redefining them. The runner's own
 * output shapes (replay steps, scores) belong to that package.
 *
 * Semantics: a case is a deterministic signal trace fed into a fresh
 * `AgentRuntime`. The policy is sampled AFTER each signal is observed, and
 * `step` in `expectedTimeline` is 1-based — `step: 3` asserts the policy after
 * the third signal (signals 1..3 inclusive).
 */

/** Numeric, smoothed operating-state dimensions (counters are asserted exactly). */
export type OperatingStateDimension = "uncertainty" | "friction" | "confidence" | "momentum" | "load";

/** Inclusive `[min, max]` range. Smoothed values are floats, so ranges — not exact equality — are the credible assertion. */
export type Range = [min: number, max: number];

/** Coarse task domain for grouping and reporting eval cases. */
export type OperatingEvalDomain = "coding" | "research" | "tool-use" | "planning" | "general";

/** Expectation sampled after the signal at `step` (1-based). Only set the fields you mean to assert. */
export type ExpectedOperatingStep = {
  step: number;
  control?: ControlDecision;
  stop?: boolean;
  requireVerification?: boolean;
  requireConfirmation?: boolean;
  /** Advisory hint asserted as a range. */
  retryBudget?: Range;
  /** Advisory hint asserted as a range. */
  autonomy?: Range;
};

/** Expectation for the terminal policy and state after all signals are observed. */
export type ExpectedOperatingFinal = {
  control?: ControlDecision;
  stop?: boolean;
  requireVerification?: boolean;
  requireConfirmation?: boolean;
  retryBudget?: Range;
  autonomy?: Range;
  maxSteps?: Range;
  /** Inclusive ranges for smoothed dimensions, e.g. `{ friction: [0.6, 1] }`. */
  state?: Partial<Record<OperatingStateDimension, Range>>;
  /** Exact counter assertions. */
  consecutiveFailures?: number;
  stepCount?: number;
};

export type OperatingEvalCase = {
  id: string;
  domain?: OperatingEvalDomain;
  description?: string;
  /** Full config override. When omitted, `DEFAULT_OPERATING_CONFIG` is used. */
  config?: OperatingConfig;
  /** Optional external affect held constant for the trace (caution only — never causes a stop). */
  affect?: ExternalAffectSignal;
  signals: AgentSignal[];
  expectedTimeline?: ExpectedOperatingStep[];
  expectedFinal?: ExpectedOperatingFinal;
  tags?: string[];
  notes?: string;
};
