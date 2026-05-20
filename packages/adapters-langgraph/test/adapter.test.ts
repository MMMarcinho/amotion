import { describe, expect, it } from "vitest";
import {
  appendOperatingSignal,
  bestEffortRetrySignal,
  createAmotionLangGraphState,
  createAmotionPolicyNode,
  createConfirmationInterruptPayload,
  createSignalRecord,
  LANGGRAPH_END,
  mergeAmotionLangGraphState,
  observeToolCall,
  routeByOperatingPolicy,
  shouldInterruptForConfirmation,
  signalFromToolObservation
} from "../src";

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
});
