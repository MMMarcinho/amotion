export type EmotionIntent =
  | "vent"
  | "ask"
  | "plan"
  | "decide"
  | "reflect"
  | "unknown";

export type EmotionSignal = {
  valence: number;
  arousal: number;
  dominance: number;
  stress: number;
  uncertainty: number;
  engagement: number;
  trust: number;
  intent: EmotionIntent;
  confidence: number;
  source: "rule" | "local_transformer" | "local_llm" | "provider_llm" | "hybrid";
  evidence?: string[];
};

export type AffectiveState = {
  valence: number;
  arousal: number;
  dominance: number;
  stress: number;
  uncertainty: number;
  engagement: number;
  trust: number;
  updatedAt: number;
};

export type RuntimePolicy = {
  reasoning: {
    depth: "low" | "medium" | "high";
    verification: number;
    selfReflection: number;
  };
  planning: {
    horizon: "short" | "medium" | "long";
    maxSteps: number;
    initiative: number;
  };
  memory: {
    retrievalMode: "supportive" | "balanced" | "exploratory" | "risk_aware";
    writePriority: number;
    recencyBias: number;
    negativeBias: number;
  };
  tools: {
    usageThreshold: number;
    requireConfirmation: boolean;
    externalSearchBias: number;
  };
  interaction: {
    tone: "calm" | "direct" | "encouraging" | "analytical";
    verbosity: "low" | "medium" | "high";
    pacing: "slow" | "normal" | "fast";
    optionCount: number;
    clarificationBias: number;
  };
  risk: {
    posture: "conservative" | "balanced" | "exploratory";
    actionThreshold: number;
  };
  attention: {
    taskFocus: number;
    socialFocus: number;
    emotionalSalience: number;
  };
  execution: {
    autonomy: number;
    retryTolerance: number;
    persistence: number;
  };
};

export type AmotionResult = {
  signal: EmotionSignal;
  state: AffectiveState;
  policy: RuntimePolicy;
};
