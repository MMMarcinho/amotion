import { describe, expect, it } from "vitest";
import {
  AgentRuntime,
  applyAgentSignal,
  createOperatingState,
  mapStateToOperatingPolicy,
  DEFAULT_OPERATING_CONFIG,
  type OperatingState
} from "../src";

const state = (overrides: Partial<OperatingState> = {}): OperatingState => ({
  uncertainty: 0.2,
  friction: 0.0,
  confidence: 0.5,
  momentum: 0.5,
  load: 0,
  consecutiveFailures: 0,
  stepCount: 0,
  budgetUsed: 0,
  updatedAt: 0,
  ...overrides
});

const steps = (count: number) => Array.from({ length: count }, (_, i) => i / (count - 1));

describe("operating policy ladder", () => {
  it("aborts on the consecutive-failure circuit-breaker", () => {
    const policy = mapStateToOperatingPolicy(state({ consecutiveFailures: 5 }));
    expect(policy.control).toBe("abort");
    expect(policy.stop).toBe(true);
    expect(policy.autonomy).toBe(0);
  });

  it("aborts when the episode budget is exhausted", () => {
    const policy = mapStateToOperatingPolicy(state({ budgetUsed: 1 }));
    expect(policy.control).toBe("abort");
    expect(policy.stop).toBe(true);
  });

  it("escalates on high friction with no momentum and cuts retry budget", () => {
    const policy = mapStateToOperatingPolicy(state({ friction: 0.8, momentum: 0.1 }));
    expect(policy.control).toBe("escalate");
    expect(policy.stop).toBe(false);
    expect(policy.requireConfirmation).toBe(true);
    expect(policy.retryBudget).toBeLessThan(DEFAULT_OPERATING_CONFIG.retryBudget.base);
  });

  it("replans on high uncertainty while stuck", () => {
    const policy = mapStateToOperatingPolicy(state({ uncertainty: 0.8, momentum: 0.2, friction: 0.3 }));
    expect(policy.control).toBe("replan");
    expect(policy.requireVerification).toBe(true);
  });

  it("verifies on moderate uncertainty or low confidence", () => {
    expect(mapStateToOperatingPolicy(state({ uncertainty: 0.6, momentum: 0.6, confidence: 0.6 })).control).toBe("verify");
    expect(mapStateToOperatingPolicy(state({ confidence: 0.2, uncertainty: 0.3 })).control).toBe("verify");
  });

  it("proceeds with long horizon when the run is healthy", () => {
    const policy = mapStateToOperatingPolicy(state({ confidence: 0.85, momentum: 0.85, uncertainty: 0.1, friction: 0.05 }));
    expect(policy.control).toBe("proceed");
    expect(policy.planning.horizon).toBe("long");
    expect(policy.autonomy).toBeGreaterThan(0.7);
  });

  it("prefers the most protective decision when several thresholds trip", () => {
    const policy = mapStateToOperatingPolicy(state({ friction: 0.8, uncertainty: 0.8, momentum: 0.1 }));
    expect(policy.control).toBe("escalate");
  });

  it("never increases retry budget as friction rises", () => {
    let previous = Infinity;
    for (const friction of steps(11)) {
      const budget = mapStateToOperatingPolicy(state({ friction })).retryBudget;
      expect(budget).toBeLessThanOrEqual(previous);
      expect(budget).toBeGreaterThanOrEqual(0);
      previous = budget;
    }
  });

  it("keeps autonomy and tool threshold in range across a state grid", () => {
    for (const confidence of steps(5)) {
      for (const friction of steps(5)) {
        for (const uncertainty of steps(5)) {
          const policy = mapStateToOperatingPolicy(state({ confidence, friction, uncertainty }));
          expect(policy.autonomy).toBeGreaterThanOrEqual(0);
          expect(policy.autonomy).toBeLessThanOrEqual(1);
          expect(policy.toolUsageThreshold).toBeGreaterThanOrEqual(0);
          expect(policy.toolUsageThreshold).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("external affect modulation", () => {
  it("raises caution but cannot stop the run on its own", () => {
    const healthy = state({ confidence: 0.85, momentum: 0.85, uncertainty: 0.1, friction: 0.05 });
    const without = mapStateToOperatingPolicy(healthy);
    const withAffect = mapStateToOperatingPolicy(healthy, { affect: { pressure: 1, trust: 0 } });

    expect(withAffect.stop).toBe(false);
    expect(withAffect.control).toBe("proceed");
    expect(withAffect.requireConfirmation).toBe(true);
    expect(withAffect.autonomy).toBeLessThan(without.autonomy);
  });
});

describe("operating state reducer", () => {
  it("starts at the configured resting values", () => {
    const initial = createOperatingState();
    expect(initial.confidence).toBe(DEFAULT_OPERATING_CONFIG.rest.confidence);
    expect(initial.consecutiveFailures).toBe(0);
  });

  it("applies decay before signal effects", () => {
    const current = applyAgentSignal(
      state({ uncertainty: 1, friction: 1, confidence: 0, momentum: 0 }),
      { type: "progress" }
    );

    expect(current.uncertainty).toBeCloseTo(0.88);
    expect(current.friction).toBeCloseTo(0.67);
    expect(current.confidence).toBeCloseTo(0.235);
    expect(current.momentum).toBeCloseTo(0.395);
  });

  it("converges toward rest when a zero-weight neutral signal advances time", () => {
    let current = state({ uncertainty: 1, friction: 1, confidence: 0, momentum: 0 });

    for (let i = 0; i < 80; i += 1) {
      current = applyAgentSignal(current, { type: "progress", weight: 0 });
    }

    expect(current.uncertainty).toBeCloseTo(DEFAULT_OPERATING_CONFIG.rest.uncertainty, 5);
    expect(current.friction).toBeCloseTo(DEFAULT_OPERATING_CONFIG.rest.friction, 5);
    expect(current.confidence).toBeCloseTo(DEFAULT_OPERATING_CONFIG.rest.confidence, 5);
    expect(current.momentum).toBeCloseTo(DEFAULT_OPERATING_CONFIG.rest.momentum, 5);
  });

  it("keeps every dimension in range under a long noisy run", () => {
    const types = ["tool_success", "tool_error", "retry", "validation_fail", "retrieval_miss", "stall", "progress"] as const;
    let current = createOperatingState();
    for (let i = 0; i < 200; i += 1) {
      current = applyAgentSignal(current, { type: types[i % types.length]! });
      for (const dim of [current.uncertainty, current.friction, current.confidence, current.momentum, current.load]) {
        expect(dim).toBeGreaterThanOrEqual(0);
        expect(dim).toBeLessThanOrEqual(1);
      }
    }
    expect(current.stepCount).toBe(200);
  });

  it("tracks budget, load, and step count exactly", () => {
    let current = createOperatingState();
    for (let i = 1; i <= 6; i += 1) {
      current = applyAgentSignal(current, { type: "progress", weight: 0 });
      expect(current.stepCount).toBe(i);
      expect(current.budgetUsed).toBeCloseTo(DEFAULT_OPERATING_CONFIG.stepCost * i);
      expect(current.load).toBeCloseTo(DEFAULT_OPERATING_CONFIG.stepCost * i);
    }
  });

  it("caps load while preserving exact budget used past one episode", () => {
    let current = createOperatingState();
    for (let i = 0; i < 30; i += 1) {
      current = applyAgentSignal(current, { type: "progress", weight: 0 });
    }

    expect(current.budgetUsed).toBeGreaterThan(1);
    expect(current.load).toBe(1);
  });

  it("counts consecutive failures and resets them on recovery", () => {
    let current = createOperatingState();
    current = applyAgentSignal(current, { type: "tool_error" });
    current = applyAgentSignal(current, { type: "tool_error" });
    expect(current.consecutiveFailures).toBe(2);
    current = applyAgentSignal(current, { type: "tool_success" });
    expect(current.consecutiveFailures).toBe(0);
  });

  it("does not reset consecutive failures for neutral retry or retrieval events", () => {
    let current = createOperatingState();
    current = applyAgentSignal(current, { type: "validation_fail" });
    current = applyAgentSignal(current, { type: "retry" });
    current = applyAgentSignal(current, { type: "retrieval_miss" });
    expect(current.consecutiveFailures).toBe(1);
  });

  it("recovers confidence and momentum after a rough patch resolves", () => {
    let current = createOperatingState();
    current = applyAgentSignal(current, { type: "tool_error" });
    current = applyAgentSignal(current, { type: "validation_fail" });
    const rough = current;

    for (let i = 0; i < 6; i += 1) {
      current = applyAgentSignal(current, { type: "tool_success" });
      current = applyAgentSignal(current, { type: "progress" });
    }

    expect(current.confidence).toBeGreaterThan(rough.confidence);
    expect(current.momentum).toBeGreaterThan(rough.momentum);
    expect(current.friction).toBeLessThan(rough.friction);
    expect(current.consecutiveFailures).toBe(0);
  });

  it("moves confidence toward a self-reported value", () => {
    let current = createOperatingState();
    const before = current.confidence;
    current = applyAgentSignal(current, { type: "self_report", confidence: 0.95 });
    expect(current.confidence).toBeGreaterThan(before);
  });
});

describe("agent runtime control loop", () => {
  it("terminates a blind retry loop instead of grinding forever", () => {
    const rt = new AgentRuntime();
    let stopped = false;
    let ticks = 0;
    for (let i = 0; i < 50; i += 1) {
      ticks += 1;
      const policy = rt.tick({ type: "tool_error", note: "flaky API" });
      if (policy.stop) {
        stopped = true;
        break;
      }
    }
    expect(stopped).toBe(true);
    expect(ticks).toBeLessThanOrEqual(DEFAULT_OPERATING_CONFIG.thresholds.maxConsecutiveFailures);
  });

  it("asks for help before the circuit-breaker when friction builds without failures", () => {
    const rt = new AgentRuntime();
    let escalated = false;
    for (let i = 0; i < 6; i += 1) {
      const policy = rt.tick({ type: "retry" });
      if (policy.control === "escalate") escalated = true;
      expect(policy.stop).toBe(false);
    }
    expect(escalated).toBe(true);
  });

  it("recovers to proceed after a rough patch resolves", () => {
    const rt = new AgentRuntime();
    rt.tick({ type: "tool_error" });
    rt.tick({ type: "tool_error" });
    for (let i = 0; i < 4; i += 1) rt.tick({ type: "tool_success" });
    rt.observe({ type: "progress" });
    const policy = rt.decide();
    expect(policy.stop).toBe(false);
    expect(["proceed", "verify"]).toContain(policy.control);
  });

  it("resets cleanly", () => {
    const rt = new AgentRuntime();
    rt.tick({ type: "tool_error" });
    rt.reset();
    expect(rt.state.stepCount).toBe(0);
    expect(rt.state.consecutiveFailures).toBe(0);
  });

  it("clears external affect on reset so caution does not leak across episodes", () => {
    const rt = new AgentRuntime({
      initialState: state({ confidence: 0.85, momentum: 0.85, uncertainty: 0.1, friction: 0.05 })
    });
    rt.setExternalAffect({ pressure: 1, trust: 0 });
    expect(rt.decide().requireConfirmation).toBe(true);

    rt.reset();
    expect(rt.decide().requireConfirmation).toBe(false);
  });

  it("does not over-abort a healthy run", () => {
    const rt = new AgentRuntime();
    const controls = [
      rt.tick({ type: "tool_success" }).control,
      rt.tick({ type: "validation_pass" }).control,
      rt.tick({ type: "progress" }).control,
      rt.tick({ type: "retrieval_hit" }).control,
      rt.tick({ type: "progress" }).control
    ];

    expect(rt.decide().stop).toBe(false);
    expect(controls).not.toContain("abort");
    expect(controls).not.toContain("escalate");
  });
});
