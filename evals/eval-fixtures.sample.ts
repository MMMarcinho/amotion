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
    expectedFinal: {
      control: "abort",
      stop: true
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
    expectedFinal: {
      stop: false
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
    expectedFinal: {
      control: "verify",
      stop: false
    },
    tags: ["operating", "uncertainty", "verification"]
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
