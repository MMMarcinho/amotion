import type { AgentSignalType } from "./signals";

/**
 * Per-signal effect on each operating dimension. Values are additive deltas
 * applied (scaled by signal weight) before clamping. Positive raises the
 * dimension, negative lowers it.
 */
export type SignalEffect = Partial<{
  uncertainty: number;
  friction: number;
  confidence: number;
  momentum: number;
}>;

export type OperatingConfig = {
  /** Per-step multiplicative pull of each dimension toward its resting value. */
  decay: number;
  /** Resting values a dimension drifts toward when no signal reinforces it. */
  rest: {
    uncertainty: number;
    friction: number;
    confidence: number;
    momentum: number;
  };
  /** Budget consumed per recorded step, in [0, 1] of the episode budget. */
  stepCost: number;
  effects: Record<AgentSignalType, SignalEffect>;
  thresholds: {
    /** Hard abort after this many consecutive failures. */
    maxConsecutiveFailures: number;
    /** friction at/above this with low momentum -> escalate. */
    frictionEscalate: number;
    /** uncertainty at/above this with low momentum -> replan. */
    uncertaintyReplan: number;
    /** uncertainty at/above this -> verify before acting. */
    uncertaintyVerify: number;
    /** confidence below this -> verify before acting. */
    confidenceVerify: number;
    /** momentum below this counts as "stuck" for escalate/replan. */
    lowMomentum: number;
  };
  /** Retry budget = round(retryBudget.base - friction * retryBudget.frictionPenalty). */
  retryBudget: { base: number; frictionPenalty: number };
};

export const DEFAULT_OPERATING_CONFIG: OperatingConfig = {
  decay: 0.85,
  rest: { uncertainty: 0.2, friction: 0.0, confidence: 0.5, momentum: 0.5 },
  stepCost: 0.05,
  effects: {
    tool_success: { confidence: 0.22, friction: -0.3, momentum: 0.25, uncertainty: -0.12 },
    tool_error: { confidence: -0.22, friction: 0.34, momentum: -0.28, uncertainty: 0.2 },
    retry: { friction: 0.22, momentum: -0.12 },
    validation_pass: { confidence: 0.26, uncertainty: -0.24, momentum: 0.18 },
    validation_fail: { confidence: -0.2, uncertainty: 0.3, friction: 0.24, momentum: -0.2 },
    retrieval_hit: { confidence: 0.16, uncertainty: -0.22 },
    retrieval_miss: { uncertainty: 0.26, confidence: -0.1 },
    self_report: {},
    progress: { momentum: 0.32, confidence: 0.16, friction: -0.18 },
    stall: { momentum: -0.3, friction: 0.16, uncertainty: 0.1 }
  },
  thresholds: {
    maxConsecutiveFailures: 5,
    frictionEscalate: 0.7,
    uncertaintyReplan: 0.7,
    uncertaintyVerify: 0.5,
    confidenceVerify: 0.35,
    lowMomentum: 0.4
  },
  retryBudget: { base: 4, frictionPenalty: 4 }
};
