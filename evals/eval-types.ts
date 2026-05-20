import type { AgentSignal, EmotionIntent, OperatingPolicy, RuntimePolicy } from "../packages/core/src";

export type OperatingEvalDomain = "coding" | "research" | "tool-use" | "planning" | "general";
export type EvalLocale = "zh-CN" | "en-US" | "mixed";
export type EvalDomain = "coding" | "planning" | "decision" | "support" | "general";
export type SignalDimension =
  | "stress"
  | "uncertainty"
  | "engagement"
  | "trust"
  | "arousal"
  | "dominance";

export type Range = [min: number, max: number];

export type OperatingEvalCase = {
  id: string;
  domain: OperatingEvalDomain;
  signals: AgentSignal[];
  expectedTimeline?: Array<{
    step: number;
    control?: OperatingPolicy["control"];
    stop?: boolean;
    requireVerification?: boolean;
    requireConfirmation?: boolean;
    retryBudget?: Range;
    autonomy?: Range;
  }>;
  expectedFinal?: {
    control?: OperatingPolicy["control"];
    stop?: boolean;
    maxSteps?: Range;
  };
  tags: string[];
  notes?: string;
};

export type AffectEvalCase = {
  id: string;
  locale: EvalLocale;
  domain: EvalDomain;
  message: string;
  history?: string[];
  expectedSignal: {
    intent?: EmotionIntent;
    ranges: Partial<Record<SignalDimension, Range>>;
    valence?: Range;
  };
  expectedPolicy: {
    reasoningDepth?: RuntimePolicy["reasoning"]["depth"];
    planningHorizon?: RuntimePolicy["planning"]["horizon"];
    retrievalMode?: RuntimePolicy["memory"]["retrievalMode"];
    tone?: RuntimePolicy["interaction"]["tone"];
    verbosity?: RuntimePolicy["interaction"]["verbosity"];
    riskPosture?: RuntimePolicy["risk"]["posture"];
    requireConfirmation?: boolean;
    maxSteps?: Range;
    optionCount?: Range;
  };
  tags: string[];
  notes?: string;
};

export type EvalCase = AffectEvalCase;

export type OperatingEvalScore = {
  id: string;
  policyPassRate: number;
  failures: string[];
};

export type EvalScore = {
  id: string;
  signalRangePassRate: number;
  policyPassRate: number;
  intentPassed?: boolean;
  failures: string[];
};
