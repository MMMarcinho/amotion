import { describe, expect, it } from "vitest";
import { mapAffectToPolicy } from "../src/policy/policy-mapper";
import { DEFAULT_POLICY_CONFIG, type PolicyConfig } from "../src/policy/policy-config";
import type { AffectiveState, RuntimePolicy } from "../src/types";

const state = (overrides: Partial<AffectiveState> = {}): AffectiveState => ({
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

const steps = (count: number) => Array.from({ length: count }, (_, i) => i / (count - 1));

const dimsInRange = (policy: RuntimePolicy) => {
  const unit = [
    policy.reasoning.verification,
    policy.reasoning.selfReflection,
    policy.planning.initiative,
    policy.memory.writePriority,
    policy.memory.recencyBias,
    policy.memory.negativeBias,
    policy.tools.usageThreshold,
    policy.tools.externalSearchBias,
    policy.interaction.clarificationBias,
    policy.risk.actionThreshold,
    policy.attention.taskFocus,
    policy.attention.socialFocus,
    policy.attention.emotionalSalience,
    policy.execution.autonomy,
    policy.execution.retryTolerance,
    policy.execution.persistence
  ];
  return unit.every((v) => v >= 0 && v <= 1);
};

describe("policy-mapper invariants", () => {
  it("keeps every numeric dimension in range across a dense state grid", () => {
    for (const stress of steps(5)) {
      for (const uncertainty of steps(5)) {
        for (const engagement of steps(5)) {
          for (const trust of steps(5)) {
            for (const valence of [-1, 0, 1]) {
              const policy = mapAffectToPolicy(
                state({ stress, uncertainty, engagement, trust, valence, arousal: stress })
              );
              expect(dimsInRange(policy), JSON.stringify({ stress, uncertainty, engagement, trust, valence })).toBe(true);
              expect(policy.planning.maxSteps).toBeGreaterThanOrEqual(2);
            }
          }
        }
      }
    }
  });

  it("never decreases risk.actionThreshold as stress rises (other dims fixed)", () => {
    let previous = -Infinity;
    for (const stress of steps(11)) {
      const { risk } = mapAffectToPolicy(state({ stress, arousal: stress }));
      expect(risk.actionThreshold).toBeGreaterThanOrEqual(previous);
      previous = risk.actionThreshold;
    }
  });

  it("never increases execution.autonomy as stress rises (other dims fixed)", () => {
    let previous = Infinity;
    for (const stress of steps(11)) {
      const { execution } = mapAffectToPolicy(state({ stress, arousal: stress }));
      expect(execution.autonomy).toBeLessThanOrEqual(previous);
      previous = execution.autonomy;
    }
  });

  it("never decreases planning.maxSteps as engagement rises (stress held low)", () => {
    let previous = -Infinity;
    for (const engagement of steps(11)) {
      const { planning } = mapAffectToPolicy(state({ engagement, stress: 0.1, valence: 0 }));
      expect(planning.maxSteps).toBeGreaterThanOrEqual(previous);
      previous = planning.maxSteps;
    }
  });

  it("never decreases reasoning.verification as uncertainty rises (stress held low)", () => {
    let previous = -Infinity;
    for (const uncertainty of steps(11)) {
      const { reasoning } = mapAffectToPolicy(state({ uncertainty, stress: 0.1 }));
      expect(reasoning.verification).toBeGreaterThanOrEqual(previous);
      previous = reasoning.verification;
    }
  });
});

describe("policy-mapper config", () => {
  it("returns the configured baseline when all rules are disabled", () => {
    const disabled: PolicyConfig = {
      ...DEFAULT_POLICY_CONFIG,
      thresholds: {
        positiveEngagement: { valence: 2, engagement: 2 },
        highEngagement: 2,
        highUncertainty: 2,
        highStress: 2,
        lowTrust: -1
      }
    };
    const policy = mapAffectToPolicy(state({ stress: 1, uncertainty: 1, engagement: 1, trust: 0 }), disabled);

    expect(policy.reasoning).toEqual(DEFAULT_POLICY_CONFIG.baseline.reasoning);
    expect(policy.planning).toEqual(DEFAULT_POLICY_CONFIG.baseline.planning);
    expect(policy.tools.requireConfirmation).toBe(false);
  });

  it("honors a custom baseline", () => {
    const custom: PolicyConfig = {
      ...DEFAULT_POLICY_CONFIG,
      baseline: {
        ...DEFAULT_POLICY_CONFIG.baseline,
        reasoning: { ...DEFAULT_POLICY_CONFIG.baseline.reasoning, depth: "high" }
      }
    };
    expect(mapAffectToPolicy(state(), custom).reasoning.depth).toBe("high");
  });

  it("respects a lowered stress threshold", () => {
    const sensitive: PolicyConfig = {
      ...DEFAULT_POLICY_CONFIG,
      thresholds: { ...DEFAULT_POLICY_CONFIG.thresholds, highStress: 0.3 }
    };
    const policy = mapAffectToPolicy(state({ stress: 0.4 }), sensitive);
    expect(policy.reasoning.depth).toBe("low");
    expect(policy.tools.requireConfirmation).toBe(true);
  });

  it("does not mutate the shared default config baseline", () => {
    mapAffectToPolicy(state({ engagement: 0.9 }));
    mapAffectToPolicy(state({ stress: 0.9 }));
    expect(DEFAULT_POLICY_CONFIG.baseline.planning.maxSteps).toBe(4);
    expect(DEFAULT_POLICY_CONFIG.baseline.reasoning.depth).toBe("medium");
  });
});

describe("policy-mapper golden archetypes", () => {
  const archetypes: Record<string, AffectiveState> = {
    neutral: state(),
    highStress: state({ stress: 0.85, arousal: 0.8, valence: -0.6 }),
    highEngagement: state({ engagement: 0.88, valence: 0.4 }),
    highUncertainty: state({ uncertainty: 0.82, stress: 0.3 }),
    lowTrust: state({ trust: 0.2 })
  };

  for (const [name, archetype] of Object.entries(archetypes)) {
    it(`maps ${name} to a stable policy`, () => {
      expect(mapAffectToPolicy(archetype)).toMatchSnapshot();
    });
  }
});
