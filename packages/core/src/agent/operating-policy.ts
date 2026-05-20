import { DEFAULT_OPERATING_CONFIG, type OperatingConfig } from "./operating-config";
import type { OperatingState } from "./operating-state";
import type { ExternalAffectSignal } from "./signals";

/**
 * What the runtime tells the agent's control loop to do next. These are
 * mechanical decisions — they gate the loop, they are not prompt wording.
 */
export type ControlDecision = "proceed" | "verify" | "replan" | "escalate" | "abort";

export type OperatingPolicy = {
  control: ControlDecision;
  reason: string;
  /** True only for `abort`: the loop must terminate. */
  stop: boolean;
  /** Remaining sane retries given current friction. */
  retryBudget: number;
  /** Insert a verification step before committing the next action. */
  requireVerification: boolean;
  /** Ask a human before the next irreversible action. */
  requireConfirmation: boolean;
  planning: { horizon: "short" | "medium" | "long"; maxSteps: number };
  /** Min confidence required to fire a tool, in [0, 1]. */
  toolUsageThreshold: number;
  /** How much latitude to act without checking in, in [0, 1]. */
  autonomy: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function mapStateToOperatingPolicy(
  state: OperatingState,
  options: { config?: OperatingConfig; affect?: ExternalAffectSignal } = {}
): OperatingPolicy {
  const config = options.config ?? DEFAULT_OPERATING_CONFIG;
  const t = config.thresholds;

  // Optional external affect modulates risk tolerance only. It can make the
  // agent more cautious; it can never by itself stop the run. Internal
  // telemetry remains the authority.
  const pressure = options.affect ? clamp01(options.affect.pressure) : 0;
  const distrust = options.affect ? 1 - clamp01(options.affect.trust) : 0;
  const caution = clamp01(pressure * 0.5 + distrust * 0.5);

  const stuck = state.momentum < t.lowMomentum;
  const retryBudget = Math.max(0, Math.round(config.retryBudget.base - state.friction * config.retryBudget.frictionPenalty));
  const autonomy = clamp01(state.confidence * (1 - state.friction) - caution * 0.3);
  const toolUsageThreshold = clamp01(0.35 + state.uncertainty * 0.4 + caution * 0.15);

  const base = {
    retryBudget,
    requireVerification: false,
    requireConfirmation: caution > 0.6,
    planning: { horizon: "medium" as const, maxSteps: 4 },
    toolUsageThreshold,
    autonomy
  };

  // Priority ladder: hardest, most protective decision wins.
  if (state.budgetUsed >= 1 || state.consecutiveFailures >= t.maxConsecutiveFailures) {
    return {
      ...base,
      control: "abort",
      stop: true,
      requireConfirmation: true,
      autonomy: 0,
      planning: { horizon: "short", maxSteps: 1 },
      reason:
        state.budgetUsed >= 1
          ? "episode budget exhausted"
          : `${state.consecutiveFailures} consecutive failures hit the circuit-breaker`
    };
  }

  if (state.friction >= t.frictionEscalate && stuck) {
    return {
      ...base,
      control: "escalate",
      stop: false,
      requireConfirmation: true,
      autonomy: clamp01(autonomy * 0.4),
      planning: { horizon: "short", maxSteps: 2 },
      reason: "high friction with no momentum: ask for help instead of grinding"
    };
  }

  if (state.uncertainty >= t.uncertaintyReplan && stuck) {
    return {
      ...base,
      control: "replan",
      stop: false,
      requireVerification: true,
      planning: { horizon: "short", maxSteps: 3 },
      reason: "high uncertainty while stuck: current approach is not converging"
    };
  }

  if (state.uncertainty >= t.uncertaintyVerify || state.confidence < t.confidenceVerify) {
    return {
      ...base,
      control: "verify",
      stop: false,
      requireVerification: true,
      planning: { horizon: "medium", maxSteps: 4 },
      reason: "uncertainty/low confidence: verify before committing"
    };
  }

  return {
    ...base,
    control: "proceed",
    stop: false,
    planning: {
      horizon: state.confidence > 0.7 && state.momentum > 0.6 ? "long" : "medium",
      maxSteps: state.confidence > 0.7 && state.momentum > 0.6 ? 6 : 4
    },
    reason: "healthy operating state: proceed"
  };
}
