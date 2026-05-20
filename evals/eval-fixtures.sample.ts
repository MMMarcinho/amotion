import type { AffectEvalCase, OperatingEvalCase } from "./eval-types";

export const sampleOperatingEvalCases: OperatingEvalCase[] = [
  {
    id: "operating-doomed-tool-loop-001",
    domain: "tool-use",
    signals: [
      { type: "tool_error", note: "API timeout" },
      { type: "tool_error", note: "API timeout" },
      { type: "tool_error", note: "API timeout" },
      { type: "tool_error", note: "API timeout" },
      { type: "tool_error", note: "API timeout" }
    ],
    expectedTimeline: [
      { step: 4, control: "escalate", stop: false, requireConfirmation: true },
      { step: 5, control: "abort", stop: true, requireConfirmation: true, autonomy: [0, 0] }
    ],
    expectedFinal: {
      control: "abort",
      stop: true,
      autonomy: [0, 0],
      maxSteps: [1, 1]
    },
    tags: ["operating", "tool-error", "circuit-breaker"]
  },
  {
    id: "operating-transient-failure-recovers-001",
    domain: "tool-use",
    signals: [
      { type: "tool_error" },
      { type: "tool_error" },
      { type: "tool_success" },
      { type: "progress" },
      { type: "validation_pass" }
    ],
    expectedTimeline: [
      { step: 2, stop: false },
      { step: 5, stop: false }
    ],
    expectedFinal: {
      stop: false,
      retryBudget: [3, 4]
    },
    tags: ["operating", "recovery"]
  },
  {
    id: "operating-retrieval-miss-verify-001",
    domain: "research",
    signals: [
      { type: "retrieval_miss" },
      { type: "retrieval_miss" },
      { type: "self_report", confidence: 0.25 }
    ],
    expectedTimeline: [
      { step: 3, control: "verify", stop: false, requireVerification: true }
    ],
    expectedFinal: {
      control: "verify",
      stop: false,
      requireVerification: true
    },
    tags: ["operating", "uncertainty", "verification"]
  },
  {
    id: "operating-validation-fail-aborts-001",
    domain: "coding",
    signals: [
      { type: "validation_fail", note: "unit test failed" },
      { type: "validation_fail", note: "unit test failed again" },
      { type: "validation_fail", note: "same assertion" },
      { type: "validation_fail", note: "same assertion" },
      { type: "validation_fail", note: "same assertion" }
    ],
    expectedTimeline: [
      { step: 3, control: "replan", stop: false, requireVerification: true },
      { step: 5, control: "abort", stop: true }
    ],
    expectedFinal: {
      control: "abort",
      stop: true
    },
    tags: ["operating", "validation", "circuit-breaker"]
  },
  {
    id: "operating-stall-escalates-001",
    domain: "planning",
    signals: [
      { type: "retry" },
      { type: "stall" },
      { type: "retry" },
      { type: "stall" },
      { type: "retry" }
    ],
    expectedFinal: {
      control: "escalate",
      stop: false,
      requireConfirmation: true,
      maxSteps: [2, 2]
    },
    tags: ["operating", "stall", "escalation"]
  },
  {
    id: "operating-healthy-run-does-not-over-abort-001",
    domain: "tool-use",
    signals: [
      { type: "tool_success" },
      { type: "validation_pass" },
      { type: "progress" },
      { type: "retrieval_hit" },
      { type: "progress" }
    ],
    expectedFinal: {
      control: "proceed",
      stop: false,
      requireVerification: false
    },
    tags: ["operating", "healthy", "over-abort"]
  },
  {
    id: "operating-rough-patch-recovers-001",
    domain: "tool-use",
    signals: [
      { type: "tool_error" },
      { type: "validation_fail" },
      { type: "tool_success" },
      { type: "progress" },
      { type: "tool_success" },
      { type: "validation_pass" },
      { type: "progress" }
    ],
    expectedFinal: {
      stop: false,
      retryBudget: [3, 4]
    },
    tags: ["operating", "rough-patch", "recovery"]
  }
];

export const sampleAffectEvalCases: AffectEvalCase[] = [
  {
    id: "zh-high-stress-helpless-001",
    locale: "zh-CN",
    domain: "support",
    message: "我现在真的有点崩溃，不知道该怎么办",
    expectedSignal: {
      intent: "vent",
      ranges: {
        stress: [0.7, 1],
        engagement: [0, 0.65],
        dominance: [0, 0.45]
      },
      valence: [-1, -0.2]
    },
    expectedPolicy: {
      reasoningDepth: "low",
      planningHorizon: "short",
      retrievalMode: "supportive",
      verbosity: "low",
      riskPosture: "conservative",
      requireConfirmation: true,
      optionCount: [1, 2]
    },
    tags: ["stress", "helplessness", "zh"]
  },
  {
    id: "zh-uncertainty-risk-001",
    locale: "zh-CN",
    domain: "decision",
    message: "你确定吗？我感觉这个方案风险很大",
    expectedSignal: {
      intent: "ask",
      ranges: {
        uncertainty: [0.55, 1],
        stress: [0.15, 0.75]
      },
      valence: [-1, 0.2]
    },
    expectedPolicy: {
      riskPosture: "conservative"
    },
    tags: ["uncertainty", "risk", "zh"]
  },
  {
    id: "en-high-engagement-build-001",
    locale: "en-US",
    domain: "coding",
    message: "I want to seriously plan this open-source project and explore the architecture tradeoffs.",
    expectedSignal: {
      intent: "plan",
      ranges: {
        engagement: [0.55, 1],
        stress: [0, 0.4],
        trust: [0.35, 1]
      },
      valence: [-0.2, 1]
    },
    expectedPolicy: {
      planningHorizon: "long",
      maxSteps: [5, 8],
      optionCount: [3, 4]
    },
    tags: ["engagement", "planning", "en"]
  }
];

export const sampleEvalCases = sampleAffectEvalCases;
