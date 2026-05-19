import type { AffectiveState, RuntimePolicy } from "../types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function mapAffectToPolicy(state: AffectiveState): RuntimePolicy {
  const policy: RuntimePolicy = {
    reasoning: {
      depth: "medium",
      verification: 0.45,
      selfReflection: 0.4
    },
    planning: {
      horizon: "medium",
      maxSteps: 4,
      initiative: 0.45
    },
    memory: {
      retrievalMode: "balanced",
      writePriority: 0.45,
      recencyBias: 0.5,
      negativeBias: 0.35
    },
    tools: {
      usageThreshold: 0.55,
      requireConfirmation: false,
      externalSearchBias: 0.4
    },
    interaction: {
      tone: "analytical",
      verbosity: "medium",
      pacing: "normal",
      optionCount: 3,
      clarificationBias: 0.45
    },
    risk: {
      posture: "balanced",
      actionThreshold: 0.55
    },
    attention: {
      taskFocus: clamp01(0.45 + state.engagement * 0.35 - state.stress * 0.15),
      socialFocus: clamp01(0.35 + state.stress * 0.25 + (1 - state.trust) * 0.15),
      emotionalSalience: clamp01(0.25 + state.stress * 0.45 + state.arousal * 0.25)
    },
    execution: {
      autonomy: 0.45,
      retryTolerance: 0.45,
      persistence: 0.5
    }
  };

  if (state.valence > 0.2 && state.engagement > 0.55) {
    policy.interaction.tone = "encouraging";
    policy.risk.posture = "exploratory";
    policy.planning.horizon = "long";
    policy.planning.initiative = 0.68;
    policy.execution.autonomy = 0.58;
  }

  if (state.engagement > 0.75) {
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

  if (state.uncertainty > 0.65) {
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

  if (state.stress > 0.7) {
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

  if (state.trust < 0.35) {
    policy.interaction.verbosity = policy.interaction.verbosity === "high" ? "medium" : policy.interaction.verbosity;
    policy.interaction.tone = policy.interaction.tone === "encouraging" ? "direct" : policy.interaction.tone;
    policy.tools.requireConfirmation = true;
    policy.memory.writePriority = Math.min(policy.memory.writePriority, 0.25);
    policy.risk.actionThreshold = Math.max(policy.risk.actionThreshold, 0.72);
    policy.execution.autonomy = Math.min(policy.execution.autonomy, 0.3);
  }

  return policy;
}
