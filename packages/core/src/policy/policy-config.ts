import type { RuntimePolicy } from "../types";

export type AttentionCoefficients = {
  taskFocus: { base: number; engagement: number; stress: number };
  socialFocus: { base: number; stress: number; distrust: number };
  emotionalSalience: { base: number; stress: number; arousal: number };
};

export type PolicyThresholds = {
  positiveEngagement: { valence: number; engagement: number };
  highEngagement: number;
  highUncertainty: number;
  highStress: number;
  lowTrust: number;
};

export type PolicyConfig = {
  baseline: RuntimePolicy;
  thresholds: PolicyThresholds;
  attention: AttentionCoefficients;
};

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  baseline: {
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
      taskFocus: 0,
      socialFocus: 0,
      emotionalSalience: 0
    },
    execution: {
      autonomy: 0.45,
      retryTolerance: 0.45,
      persistence: 0.5
    }
  },
  thresholds: {
    positiveEngagement: { valence: 0.2, engagement: 0.55 },
    highEngagement: 0.75,
    highUncertainty: 0.65,
    highStress: 0.7,
    lowTrust: 0.35
  },
  attention: {
    taskFocus: { base: 0.45, engagement: 0.35, stress: 0.15 },
    socialFocus: { base: 0.35, stress: 0.25, distrust: 0.15 },
    emotionalSalience: { base: 0.25, stress: 0.45, arousal: 0.25 }
  }
};
