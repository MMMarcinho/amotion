import type {
  AgentSignal,
  EmotionIntent,
  OperatingPolicy,
  OperatingState,
  Range,
  RuntimePolicy
} from "amotion";

// The operating eval-case contract is canonical in `amotion` (Person A
// boundary). Re-export it here so fixtures and the runner have one definition.
export type {
  ExpectedOperatingFinal,
  ExpectedOperatingStep,
  OperatingEvalCase,
  OperatingEvalDomain,
  Range
} from "amotion";

export type EvalLocale = "zh-CN" | "en-US" | "mixed";
export type EvalDomain = "coding" | "planning" | "decision" | "support" | "general";
export type SignalDimension =
  | "stress"
  | "uncertainty"
  | "engagement"
  | "trust"
  | "arousal"
  | "dominance";

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
  steps: number;
  finalControl: OperatingPolicy["control"];
  finalStop: boolean;
  policyPassRate: number;
  failures: string[];
};

export type OperatingReplayStep = {
  step: number;
  signal: AgentSignal;
  state: OperatingState;
  policy: OperatingPolicy;
};

export type OperatingReplayResult = {
  id: string;
  steps: OperatingReplayStep[];
  finalState: OperatingState;
  finalPolicy: OperatingPolicy;
  score: OperatingEvalScore;
};

export type EvalScore = {
  id: string;
  signalRangePassRate: number;
  policyPassRate: number;
  intentPassed?: boolean;
  failures: string[];
};
