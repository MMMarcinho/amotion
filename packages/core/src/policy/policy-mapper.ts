import type { AffectiveState, RuntimePolicy } from "../types";
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from "./policy-config";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function mapAffectToPolicy(
  state: AffectiveState,
  config: PolicyConfig = DEFAULT_POLICY_CONFIG
): RuntimePolicy {
  const { thresholds, attention } = config;
  const policy: RuntimePolicy = structuredClone(config.baseline);

  policy.attention = {
    taskFocus: clamp01(attention.taskFocus.base + state.engagement * attention.taskFocus.engagement - state.stress * attention.taskFocus.stress),
    socialFocus: clamp01(attention.socialFocus.base + state.stress * attention.socialFocus.stress + (1 - state.trust) * attention.socialFocus.distrust),
    emotionalSalience: clamp01(attention.emotionalSalience.base + state.stress * attention.emotionalSalience.stress + state.arousal * attention.emotionalSalience.arousal)
  };

  if (
    state.valence > thresholds.positiveEngagement.valence &&
    state.engagement > thresholds.positiveEngagement.engagement
  ) {
    policy.interaction.tone = "encouraging";
    policy.risk.posture = "exploratory";
    policy.planning.horizon = "long";
    policy.planning.initiative = 0.68;
    policy.execution.autonomy = 0.58;
  }

  if (state.engagement > thresholds.highEngagement) {
    policy.reasoning.depth = "high";
    policy.reasoning.selfReflection = 0.65;
    policy.planning.horizon = "long";
    policy.planning.maxSteps = 7;
    policy.planning.initiative = 0.78;
    policy.memory.retrievalMode = "exploratory";
    policy.memory.writePriority = 0.82;
    policy.interaction.optionCount = 4;
    policy.interaction.verbosity = "high";
    policy.execution.autonomy = 0.68;
    policy.execution.persistence = 0.72;
  }

  if (state.uncertainty > thresholds.highUncertainty) {
    policy.reasoning.verification = 0.86;
    policy.reasoning.selfReflection = Math.max(policy.reasoning.selfReflection, 0.62);
    policy.tools.externalSearchBias = 0.82;
    policy.tools.usageThreshold = 0.36;
    policy.interaction.clarificationBias = 0.84;
    policy.interaction.tone = state.stress > 0.5 ? "calm" : "direct";
    policy.risk.posture = "conservative";
    policy.risk.actionThreshold = 0.75;
    policy.memory.retrievalMode = policy.memory.retrievalMode === "exploratory" ? "exploratory" : "risk_aware";
  }

  if (state.stress > thresholds.highStress) {
    policy.reasoning.depth = "low";
    policy.reasoning.verification = Math.max(policy.reasoning.verification, 0.62);
    policy.reasoning.selfReflection = 0.35;
    policy.planning.horizon = "short";
    policy.planning.maxSteps = 2;
    policy.planning.initiative = 0.28;
    policy.memory.retrievalMode = "supportive";
    policy.memory.writePriority = Math.min(policy.memory.writePriority, 0.4);
    policy.memory.recencyBias = 0.72;
    policy.memory.negativeBias = 0.18;
    policy.tools.requireConfirmation = true;
    policy.tools.usageThreshold = Math.min(policy.tools.usageThreshold, 0.42);
    policy.interaction.tone = "calm";
    policy.interaction.verbosity = "low";
    policy.interaction.pacing = "slow";
    policy.interaction.optionCount = 2;
    policy.risk.posture = "conservative";
    policy.risk.actionThreshold = 0.82;
    policy.execution.autonomy = 0.24;
    policy.execution.retryTolerance = 0.35;
    policy.execution.persistence = 0.38;
  }

  if (state.trust < thresholds.lowTrust) {
    policy.interaction.verbosity = policy.interaction.verbosity === "high" ? "medium" : policy.interaction.verbosity;
    policy.interaction.tone = policy.interaction.tone === "encouraging" ? "direct" : policy.interaction.tone;
    policy.tools.requireConfirmation = true;
    policy.memory.writePriority = Math.min(policy.memory.writePriority, 0.25);
    policy.risk.actionThreshold = Math.max(policy.risk.actionThreshold, 0.72);
    policy.execution.autonomy = Math.min(policy.execution.autonomy, 0.3);
  }

  return policy;
}
