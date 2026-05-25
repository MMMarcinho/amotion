import { describe, expect, it } from "vitest";
import type { OperatingPolicy } from "amotion";
import {
  appendOperatingSignal,
  bestEffortRetrySignal,
  createAmotionLangGraphState,
  createAmotionPolicyNode,
  createConfirmationInterruptPayload,
  createEscalationInterruptPayload,
  createSignalRecord,
  LANGGRAPH_END,
  mergeAmotionLangGraphState,
  observeToolCall,
  routeByOperatingPolicy,
  shouldInterruptForConfirmation,
  shouldInterruptForEscalation,
  signalFromRetrieval,
  signalFromToolObservation,
  signalFromValidation
} from "../src";

const policyOf = (overrides: Partial<OperatingPolicy> = {}): OperatingPolicy => ({
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

describe("amotion LangGraph state helpers", () => {
  it("rebuilds runtime from serialized state and consumes pending signals", async () => {
    const initial = createAmotionLangGraphState({ episodeId: "episode-a" });
    const withSignals = appendOperatingSignal(
      appendOperatingSignal(initial, { type: "tool_error" }, { id: "s1" }),
      { type: "tool_error" },
      { id: "s2" }
    );
    const policyNode = createAmotionPolicyNode({ now: () => 123 });
    const update = await policyNode(withSignals);

    expect(update.pendingSignals).toEqual([]);
    expect(update.signals?.map((record) => record.id)).toEqual(["s1", "s2"]);
    expect(update.operatingState?.stepCount).toBe(2);
    expect(update.operatingState?.consecutiveFailures).toBe(2);
    expect(update.policy?.stop).toBe(false);
    expect(update.updatedAt).toBe(123);
  });

  it("deduplicates signal records by id when branch patches merge", () => {
    const base = createAmotionLangGraphState();
    const duplicate = createSignalRecord({ type: "tool_error" }, { id: "same" });
    const merged = mergeAmotionLangGraphState(
      { ...base, pendingSignals: [duplicate] },
      { pendingSignals: [duplicate, createSignalRecord({ type: "progress" }, { id: "new" })] }
    );

    expect(merged.pendingSignals.map((record) => record.id)).toEqual(["same", "new"]);
  });
});

describe("routing and interrupt helpers", () => {
  it("routes stop policies to LangGraph END by default", () => {
    expect(routeByOperatingPolicy({
      control: "abort",
      reason: "test",
      stop: true,
      retryBudget: 0,
      requireVerification: false,
      requireConfirmation: true,
      planning: { horizon: "short", maxSteps: 1 },
      toolUsageThreshold: 1,
      autonomy: 0
    })).toBe(LANGGRAPH_END);
  });

  it("routes advisory controls through caller-provided node names", () => {
    expect(routeByOperatingPolicy({
      control: "replan",
      reason: "test",
      stop: false,
      retryBudget: 2,
      requireVerification: true,
      requireConfirmation: false,
      planning: { horizon: "short", maxSteps: 3 },
      toolUsageThreshold: 0.7,
      autonomy: 0.2
    }, { replan: "planner" })).toBe("planner");
  });

  it("routes a verification-gated proceed to the verify node", () => {
    expect(routeByOperatingPolicy(policyOf({ control: "proceed", requireVerification: true }), { verify: "checker" })).toBe(
      "checker"
    );
    // Without the gate, a plain proceed still routes to proceed.
    expect(routeByOperatingPolicy(policyOf({ control: "proceed" }))).toBe("proceed");
  });

  it("builds an escalation interrupt payload for escalate policies", () => {
    const policy = policyOf({ control: "escalate", reason: "stuck with high friction", requireConfirmation: true });
    expect(shouldInterruptForEscalation(policy)).toBe(true);
    expect(shouldInterruptForEscalation(policyOf({ control: "proceed" }))).toBe(false);

    const payload = createEscalationInterruptPayload(policy, {
      recentSignals: [{ type: "tool_error" }, { type: "retry" }]
    });
    expect(payload).toMatchObject({
      type: "amotion.escalation_required",
      reason: "stuck with high friction",
      policy: { control: "escalate", retryBudget: 4 }
    });
    expect(payload.recentSignals).toHaveLength(2);
  });

  it("requires explicit irreversible action annotation before confirmation interrupt", () => {
    const policy = {
      control: "proceed" as const,
      reason: "high caution",
      stop: false,
      retryBudget: 4,
      requireVerification: false,
      requireConfirmation: true,
      planning: { horizon: "medium" as const, maxSteps: 4 },
      toolUsageThreshold: 0.5,
      autonomy: 0.2
    };

    expect(shouldInterruptForConfirmation(policy)).toBe(false);
    expect(shouldInterruptForConfirmation(policy, { irreversible: true })).toBe(true);
    expect(createConfirmationInterruptPayload(policy, { actionName: "deleteFile" })).toMatchObject({
      type: "amotion.confirmation_required",
      actionName: "deleteFile",
      reason: "high caution"
    });
  });
});

describe("signal helpers", () => {
  it("extracts observable tool success and error signals", async () => {
    expect(signalFromToolObservation({ ok: true })).toMatchObject({ type: "tool_success" });
    expect(signalFromToolObservation({ ok: false, error: new Error("boom") })).toMatchObject({
      type: "tool_error",
      note: "boom"
    });

    await expect(observeToolCall(() => "ok")).resolves.toMatchObject({
      ok: true,
      value: "ok",
      signal: { type: "tool_success" }
    });
    await expect(observeToolCall(() => { throw new Error("bad"); })).resolves.toMatchObject({
      ok: false,
      signal: { type: "tool_error" }
    });
  });

  it("keeps retry detection explicit and best-effort", () => {
    expect(bestEffortRetrySignal("search:q", "search:q")).toMatchObject({ type: "retry" });
    expect(bestEffortRetrySignal("search:q", "read:file")).toBeUndefined();
  });

  it("maps validation and retrieval outcomes to observable signals", () => {
    expect(signalFromValidation({ passed: true })).toMatchObject({ type: "validation_pass" });
    expect(signalFromValidation({ passed: false, note: "2 tests failed" })).toMatchObject({
      type: "validation_fail",
      note: "2 tests failed"
    });
    expect(signalFromRetrieval({ hits: 3 })).toMatchObject({ type: "retrieval_hit" });
    expect(signalFromRetrieval({ hits: 0 })).toMatchObject({ type: "retrieval_miss" });
  });
});
