import { describe, expect, it } from "vitest";
import { AgentRuntime, mapStateToOperatingPolicy, type OperatingPolicy, type OperatingState } from "amotion";
import { applyOperatingPolicyToLoop, runGovernedLoop, type OperatingLoopAction } from "../src";

const state = (overrides: Partial<OperatingState> = {}): OperatingState => ({
  uncertainty: 0.2,
  friction: 0,
  confidence: 0.5,
  momentum: 0.5,
  load: 0,
  consecutiveFailures: 0,
  stepCount: 0,
  budgetUsed: 0,
  updatedAt: 0,
  ...overrides
});

const policy = (overrides: Partial<OperatingPolicy> = {}): OperatingPolicy => ({
  control: "proceed",
  reason: "test",
  stop: false,
  retryBudget: 4,
  requireVerification: false,
  requireConfirmation: false,
  planning: { horizon: "medium", maxSteps: 4 },
  toolUsageThreshold: 0.5,
  autonomy: 0.5,
  ...overrides
});

describe("applyOperatingPolicyToLoop", () => {
  it("stops immediately when the policy says stop", async () => {
    const calls: OperatingLoopAction[] = [];
    const result = await applyOperatingPolicyToLoop(policy({ stop: true, control: "abort" }), {
      stop: () => { calls.push("stop"); },
      verify: () => { calls.push("verify"); }
    });

    expect(result).toEqual({ shouldStop: true, actions: ["stop"] });
    expect(calls).toEqual(["stop"]);
  });

  it("calls confirmation only for irreversible next actions", async () => {
    const calls: OperatingLoopAction[] = [];
    const cautious = policy({ requireConfirmation: true });

    const reversible = await applyOperatingPolicyToLoop(cautious, {
      confirm: () => { calls.push("confirm"); }
    });
    const irreversible = await applyOperatingPolicyToLoop(cautious, {
      confirm: () => { calls.push("confirm"); }
    }, { irreversible: true });

    expect(reversible.actions).toEqual([]);
    expect(irreversible.actions).toEqual(["confirm"]);
    expect(calls).toEqual(["confirm"]);
  });

  it("maps verify, replan, and escalate to hooks", async () => {
    const calls: OperatingLoopAction[] = [];
    const replanPolicy = policy({
      control: "replan",
      requireVerification: true
    });
    const escalatePolicy = policy({
      control: "escalate",
      requireConfirmation: true
    });

    const replan = await applyOperatingPolicyToLoop(replanPolicy, {
      verify: () => { calls.push("verify"); },
      replan: () => { calls.push("replan"); }
    });
    const escalate = await applyOperatingPolicyToLoop(escalatePolicy, {
      escalate: () => { calls.push("escalate"); }
    });

    expect(replan.actions).toEqual(["verify", "replan"]);
    expect(escalate.actions).toEqual(["escalate"]);
    expect(calls).toEqual(["verify", "replan", "escalate"]);
  });
});

describe("runGovernedLoop", () => {
  it("terminates a doomed loop through the operating runtime", async () => {
    const calls: OperatingLoopAction[] = [];
    const result = await runGovernedLoop({
      maxSteps: 20,
      hooks: {
        escalate: () => { calls.push("escalate"); },
        stop: () => { calls.push("stop"); }
      },
      step: () => ({ signal: { type: "tool_error" } })
    });

    expect(result.outcome).toBe("stopped");
    expect(result.steps).toBe(5);
    expect(result.finalPolicy.control).toBe("abort");
    expect(calls).toEqual(["escalate", "escalate", "stop"]);
  });

  it("confirms before irreversible steps when the current policy requires it", async () => {
    const calls: OperatingLoopAction[] = [];
    const runtime = new AgentRuntime({
      initialState: state({ confidence: 0.85, momentum: 0.85, uncertainty: 0.1, friction: 0.05 })
    });
    runtime.setExternalAffect({ pressure: 1, trust: 0 });

    const result = await runGovernedLoop({
      runtime,
      maxSteps: 1,
      shouldConfirmBeforeStep: () => true,
      hooks: {
        confirm: () => { calls.push("confirm"); }
      },
      step: () => ({ signal: { type: "tool_success" }, done: true, value: "ok" })
    });

    expect(result.outcome).toBe("done");
    expect(result.value).toBe("ok");
    expect(result.actions).toEqual(["confirm"]);
    expect(calls).toEqual(["confirm"]);
  });

  it("can finish a healthy loop without unnecessary control hooks", async () => {
    const result = await runGovernedLoop({
      maxSteps: 5,
      step: ({ step }) => ({
        signal: step === 1 ? { type: "tool_success" } : { type: "progress" },
        done: step === 3,
        value: step
      })
    });

    expect(result.outcome).toBe("done");
    expect(result.value).toBe(3);
    expect(result.actions).toEqual([]);
    expect(result.finalPolicy.stop).toBe(false);
  });

  it("surfaces replan hooks from uncertain stuck state before the next step", async () => {
    const calls: OperatingLoopAction[] = [];
    const initialState = state({ uncertainty: 0.8, momentum: 0.2, friction: 0.3 });
    const runtime = new AgentRuntime({ initialState });
    expect(mapStateToOperatingPolicy(initialState).control).toBe("replan");

    await runGovernedLoop({
      runtime,
      maxSteps: 1,
      hooks: {
        verify: () => { calls.push("verify"); },
        replan: () => { calls.push("replan"); }
      },
      step: () => ({ signal: { type: "progress" }, done: true })
    });

    expect(calls).toEqual(["verify", "replan"]);
  });
});
