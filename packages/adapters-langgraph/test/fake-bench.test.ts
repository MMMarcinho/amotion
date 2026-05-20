import { describe, expect, it } from "vitest";
import { compareFakeGraphScenario } from "../src";

describe("fake graph comparative bench", () => {
  it("shows governed loop avoids step exhaustion on a doomed tool", async () => {
    const comparison = await compareFakeGraphScenario({
      id: "doomed-tool",
      failuresBeforeSuccess: Number.POSITIVE_INFINITY,
      maxSteps: 40
    });

    expect(comparison.naive).toMatchObject({
      outcome: "step_exhausted",
      toolCalls: 40,
      wastedToolCalls: 40
    });
    expect(comparison.governed).toMatchObject({
      outcome: "aborted",
      toolCalls: 5,
      wastedToolCalls: 5,
      abortLatency: 5
    });
    expect(comparison.governed.escalations).toBeGreaterThan(0);
    expect(comparison.delta).toEqual({
      avoidedToolCalls: 35,
      avoidedStepExhaustion: true,
      successRegressed: false
    });
  });

  it("does not regress a recoverable transient failure", async () => {
    const comparison = await compareFakeGraphScenario({
      id: "transient-tool",
      failuresBeforeSuccess: 2,
      maxSteps: 40
    });

    expect(comparison.naive.outcome).toBe("done");
    expect(comparison.governed.outcome).toBe("done");
    expect(comparison.naive.toolCalls).toBe(3);
    expect(comparison.governed.toolCalls).toBe(3);
    expect(comparison.delta.successRegressed).toBe(false);
  });
});
