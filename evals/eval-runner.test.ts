import { describe, expect, it } from "vitest";
import { sampleOperatingEvalCases } from "./eval-fixtures.sample";
import { evaluateOperatingRuntime, replayOperatingCase } from "./eval-runner";

describe("operating runtime trace replay", () => {
  it("passes all sample operating fixtures", () => {
    const scores = evaluateOperatingRuntime(sampleOperatingEvalCases);

    expect(scores).toHaveLength(sampleOperatingEvalCases.length);
    expect(scores.every((score) => score.policyPassRate === 1)).toBe(true);
    expect(scores.flatMap((score) => score.failures)).toEqual([]);
  });

  it("records state and policy at every step", () => {
    const replay = replayOperatingCase(sampleOperatingEvalCases[0]!);

    expect(replay.steps).toHaveLength(sampleOperatingEvalCases[0]!.signals.length);
    expect(replay.steps[0]!.step).toBe(1);
    expect(replay.steps[0]!.state.stepCount).toBe(1);
    expect(replay.steps.at(-1)!.policy).toBe(replay.finalPolicy);
    expect(replay.finalState.stepCount).toBe(sampleOperatingEvalCases[0]!.signals.length);
  });

  it("reports structured failures for mismatched expectations", () => {
    const replay = replayOperatingCase({
      id: "intentional-mismatch",
      domain: "tool-use",
      signals: [{ type: "tool_success" }],
      expectedFinal: { control: "abort", stop: true },
      tags: ["mismatch"]
    });

    expect(replay.score.policyPassRate).toBeLessThan(1);
    expect(replay.score.failures).toEqual([
      "operatingPolicy.control expected abort, got proceed",
      "operatingPolicy.stop expected true, got false"
    ]);
  });
});
