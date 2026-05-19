import { describe, expect, it } from "vitest";
import {
  Amotion,
  TransformerEmotionAnalyzer,
  mapClassificationsToEmotionSignal,
  mapAffectToPolicy,
  policyToSystemHint,
  updateAffectiveState,
  type AffectiveState,
  type EmotionSignal
} from "../src";

const state = (overrides: Partial<AffectiveState>): AffectiveState => ({
  valence: 0,
  arousal: 0.4,
  dominance: 0.5,
  stress: 0.2,
  uncertainty: 0.2,
  engagement: 0.4,
  trust: 0.6,
  updatedAt: 1,
  ...overrides
});

const signal = (overrides: Partial<EmotionSignal>): EmotionSignal => ({
  valence: 0,
  arousal: 0.4,
  dominance: 0.5,
  stress: 0.2,
  uncertainty: 0.2,
  engagement: 0.4,
  trust: 0.6,
  intent: "unknown",
  confidence: 0.5,
  source: "rule",
  ...overrides
});

describe("amotion", () => {
  it("creates conservative low-depth policy from transformer emotion output", async () => {
    const analyzer = new TransformerEmotionAnalyzer({
      classifier: async () => [
        { label: "fear", score: 0.91 },
        { label: "nervousness", score: 0.74 },
        { label: "sadness", score: 0.44 }
      ],
      fallbackAnalyzer: false
    });
    const result = await new Amotion({ analyzer }).process({
      message: "我现在真的崩溃了，压力太大，受不了了，不知道该怎么办！！！"
    });

    expect(result.state.stress).toBeGreaterThan(0.7);
    expect(result.signal.source).toBe("local_transformer");
    expect(result.policy.reasoning.depth).toBe("low");
    expect(result.policy.planning.horizon).toBe("short");
    expect(result.policy.planning.maxSteps).toBe(2);
    expect(result.policy.risk.posture).toBe("conservative");
    expect(result.policy.tools.requireConfirmation).toBe(true);
  });

  it("increases verification and clarification for high uncertainty", () => {
    const policy = mapAffectToPolicy(state({ uncertainty: 0.82, stress: 0.25 }));

    expect(policy.reasoning.verification).toBeGreaterThan(0.8);
    expect(policy.interaction.clarificationBias).toBeGreaterThan(0.8);
    expect(policy.tools.externalSearchBias).toBeGreaterThan(0.8);
    expect(policy.tools.usageThreshold).toBeLessThan(0.5);
  });

  it("increases planning depth and memory write priority for high engagement", () => {
    const policy = mapAffectToPolicy(state({ engagement: 0.88, valence: 0.35 }));

    expect(policy.reasoning.depth).toBe("high");
    expect(policy.planning.horizon).toBe("long");
    expect(policy.planning.maxSteps).toBeGreaterThanOrEqual(7);
    expect(policy.memory.writePriority).toBeGreaterThan(0.8);
    expect(policy.planning.initiative).toBeGreaterThan(0.7);
  });

  it("maps existing classifier labels into amotion runtime dimensions", () => {
    const signal = mapClassificationsToEmotionSignal({
      message: "I am confused and not sure what to do next?",
      classifications: [
        { label: "confusion", score: 0.86 },
        { label: "curiosity", score: 0.52 },
        { label: "neutral", score: 0.1 }
      ]
    });

    expect(signal.uncertainty).toBeGreaterThan(0.75);
    expect(signal.intent).toBe("ask");
    expect(signal.source).toBe("local_transformer");
    expect(signal.evidence?.[0]).toContain("transformers.js");
  });

  it("smooths state changes instead of instantly overwriting prior state", () => {
    const previous = state({ stress: 0.1, trust: 0.8 });
    const next = updateAffectiveState(previous, signal({ stress: 1, trust: 0.1 }));

    expect(next.stress).toBeGreaterThan(previous.stress);
    expect(next.stress).toBeLessThan(1);
    expect(next.trust).toBeGreaterThan(0.1);
  });

  it("generates a readable system hint", () => {
    const hint = policyToSystemHint(mapAffectToPolicy(state({ stress: 0.8 })));

    expect(hint).toContain("Runtime policy:");
    expect(hint).toContain("Reasoning depth: low");
    expect(hint).toContain("Risk posture: conservative");
  });
});
