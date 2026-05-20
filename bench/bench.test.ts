import { describe, expect, it } from "vitest";
import { BENCH_TASKS, buildReport, runBattery, type RunPair } from "./index";

const pairs = runBattery(BENCH_TASKS);
const byId = new Map<string, RunPair>(pairs.map((p) => [p.task.id, p]));
const pair = (id: string) => {
  const found = byId.get(id);
  if (!found) throw new Error(`missing task ${id}`);
  return found;
};

describe("bench — governance interrupts doomed runs", () => {
  it("interrupts a permanently broken tool well before the step cap", () => {
    const { naive, governed } = pair("doomed-tool");
    expect(naive.outcome).toBe("exhausted");
    expect(naive.toolCalls).toBe(40);
    expect(["aborted", "escalated"]).toContain(governed.outcome);
    expect(governed.steps).toBeLessThan(naive.steps);
    expect(governed.abortLatency).toBeLessThan(naive.toolCalls);
  });

  it("interrupts a never-passing validation loop", () => {
    const { naive, governed } = pair("doomed-validation");
    expect(naive.outcome).toBe("exhausted");
    expect(["aborted", "escalated"]).toContain(governed.outcome);
  });
});

describe("bench — governance does not over-react on solvable runs", () => {
  it.each(["healthy-first-try", "transient-2-failures", "retrieval-2-misses", "validation-2-fails"])(
    "solves %s under governance without interruption",
    (id) => {
      const { naive, governed } = pair(id);
      expect(naive.outcome).toBe("solved");
      expect(governed.outcome).toBe("solved");
      expect(governed.steps).toBe(naive.steps);
    }
  );
});

describe("bench — aggregate report (held-out report set)", () => {
  const report = buildReport(pairs, "report");

  it("matches naive success with zero regression and zero over-abort", () => {
    expect(report.governed.solvedRate).toBe(report.naive.solvedRate);
    expect(report.comparison.successRegressionRate).toBe(0);
    expect(report.comparison.overAbortRate).toBe(0);
  });

  it("saves tool calls and reduces step exhaustion overall", () => {
    expect(report.comparison.avoidedToolCallsAvg).toBeGreaterThan(0);
    expect(report.governed.exhaustedRate).toBeLessThan(report.naive.exhaustedRate);
    expect(report.comparison.avgInterruptLatencyDoomed).toBeGreaterThan(0);
    expect(report.comparison.avgInterruptLatencyDoomed).toBeLessThan(40);
  });
});
