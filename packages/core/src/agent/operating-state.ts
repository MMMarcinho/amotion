import { DEFAULT_OPERATING_CONFIG, type OperatingConfig } from "./operating-config";
import { signalWeight, type AgentSignal } from "./signals";

/**
 * The agent's operating state. Every field is derived from observed execution
 * telemetry, not inferred feeling:
 *
 * - `uncertainty`  how unsure the run is (misses, failures, low self-report)
 * - `friction`     how much is going wrong (errors, retries, stalls)
 * - `confidence`   reinforced by successes and passing verification
 * - `momentum`     progress vs. being stuck
 * - `load`         fraction of the episode budget consumed
 *
 * Counters (`consecutiveFailures`, `stepCount`) are exact, not smoothed, so
 * the circuit-breaker is deterministic and auditable.
 */
export type OperatingState = {
  uncertainty: number;
  friction: number;
  confidence: number;
  momentum: number;
  load: number;
  consecutiveFailures: number;
  stepCount: number;
  budgetUsed: number;
  updatedAt: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const FAILURE_TYPES = new Set<AgentSignal["type"]>(["tool_error", "validation_fail"]);
const RECOVERY_TYPES = new Set<AgentSignal["type"]>(["tool_success", "validation_pass", "progress"]);

export function createOperatingState(config: OperatingConfig = DEFAULT_OPERATING_CONFIG): OperatingState {
  return {
    uncertainty: config.rest.uncertainty,
    friction: config.rest.friction,
    confidence: config.rest.confidence,
    momentum: config.rest.momentum,
    load: 0,
    consecutiveFailures: 0,
    stepCount: 0,
    budgetUsed: 0,
    updatedAt: 0
  };
}

export function applyAgentSignal(
  previous: OperatingState,
  signal: AgentSignal,
  config: OperatingConfig = DEFAULT_OPERATING_CONFIG
): OperatingState {
  const weight = signalWeight(signal);
  const { decay, rest } = config;

  // 1. Time passes: pull each dimension toward its resting value.
  let uncertainty = rest.uncertainty + (previous.uncertainty - rest.uncertainty) * decay;
  let friction = rest.friction + (previous.friction - rest.friction) * decay;
  let confidence = rest.confidence + (previous.confidence - rest.confidence) * decay;
  let momentum = rest.momentum + (previous.momentum - rest.momentum) * decay;

  // 2. Apply the event's effect.
  if (signal.type === "self_report" && typeof signal.confidence === "number") {
    const reported = clamp01(signal.confidence);
    confidence += (reported - confidence) * 0.5 * weight;
    uncertainty += ((1 - reported) - uncertainty) * 0.4 * weight;
  } else {
    const effect = config.effects[signal.type];
    uncertainty += (effect.uncertainty ?? 0) * weight;
    friction += (effect.friction ?? 0) * weight;
    confidence += (effect.confidence ?? 0) * weight;
    momentum += (effect.momentum ?? 0) * weight;
  }

  // 3. Exact counters for the circuit-breaker.
  let consecutiveFailures = previous.consecutiveFailures;
  if (FAILURE_TYPES.has(signal.type)) consecutiveFailures += 1;
  else if (RECOVERY_TYPES.has(signal.type)) consecutiveFailures = 0;

  const budgetUsed = previous.budgetUsed + config.stepCost;

  return {
    uncertainty: clamp01(uncertainty),
    friction: clamp01(friction),
    confidence: clamp01(confidence),
    momentum: clamp01(momentum),
    load: clamp01(budgetUsed),
    consecutiveFailures,
    stepCount: previous.stepCount + 1,
    budgetUsed,
    updatedAt: Date.now()
  };
}
