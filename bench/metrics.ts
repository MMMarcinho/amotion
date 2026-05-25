import type { ArmResult, BenchTask } from "./harness";
import { runTask } from "./harness";
import type { OperatingConfig } from "amotion";

export type ArmSummary = {
  runs: number;
  solved: number;
  solvedRate: number;
  avgSteps: number;
  avgToolCalls: number;
  avgWastedToolCalls: number;
  exhaustedRate: number;
  abortedRate: number;
  escalatedRate: number;
};

export type BenchComparison = {
  /** Mean tool calls saved by the governed arm (naive - governed). */
  avoidedToolCallsAvg: number;
  /** Fraction of all tasks the naive arm solved but the governed arm did not. */
  successRegressionRate: number;
  /** Among solvable tasks (naive solved), fraction the governed arm interrupted. The key guardrail; target 0. */
  overAbortRate: number;
  /** Mean abort/escalate latency (tool calls) on doomed tasks. */
  avgInterruptLatencyDoomed: number;
};

export type BenchReport = {
  scope: "all" | "report" | "calibration";
  taskCount: number;
  naive: ArmSummary;
  governed: ArmSummary;
  comparison: BenchComparison;
};

const isDoomed = (r: ArmResult) => r.kind === "doomed" || r.kind === "doomed_validation";
const isInterrupted = (r: ArmResult) => r.outcome === "aborted" || r.outcome === "escalated";

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);
const rate = (count: number, total: number) => (total === 0 ? 0 : count / total);

function summarize(results: ArmResult[]): ArmSummary {
  const runs = results.length;
  const solved = results.filter((r) => r.outcome === "solved").length;
  return {
    runs,
    solved,
    solvedRate: rate(solved, runs),
    avgSteps: mean(results.map((r) => r.steps)),
    avgToolCalls: mean(results.map((r) => r.toolCalls)),
    avgWastedToolCalls: mean(results.map((r) => r.wastedToolCalls)),
    exhaustedRate: rate(results.filter((r) => r.outcome === "exhausted").length, runs),
    abortedRate: rate(results.filter((r) => r.outcome === "aborted").length, runs),
    escalatedRate: rate(results.filter((r) => r.outcome === "escalated").length, runs)
  };
}

export type RunPair = { task: BenchTask; naive: ArmResult; governed: ArmResult };

export function runBattery(tasks: BenchTask[], config?: OperatingConfig): RunPair[] {
  return tasks.map((task) => ({
    task,
    naive: runTask(task, { governed: false }),
    governed: runTask(task, { governed: true, config })
  }));
}

export function buildReport(pairs: RunPair[], scope: BenchReport["scope"]): BenchReport {
  const scoped = scope === "all" ? pairs : pairs.filter((p) => p.task.tag === scope);
  const naive = scoped.map((p) => p.naive);
  const governed = scoped.map((p) => p.governed);

  const solvable = scoped.filter((p) => p.naive.outcome === "solved");
  const regressed = scoped.filter((p) => p.naive.outcome === "solved" && p.governed.outcome !== "solved");
  const overAborted = solvable.filter((p) => isInterrupted(p.governed));
  const doomedGoverned = scoped.filter((p) => isDoomed(p.governed)).map((p) => p.governed);

  return {
    scope,
    taskCount: scoped.length,
    naive: summarize(naive),
    governed: summarize(governed),
    comparison: {
      avoidedToolCallsAvg: mean(scoped.map((p) => p.naive.toolCalls - p.governed.toolCalls)),
      successRegressionRate: rate(regressed.length, scoped.length),
      overAbortRate: rate(overAborted.length, solvable.length),
      avgInterruptLatencyDoomed: mean(doomedGoverned.map((r) => r.abortLatency ?? r.steps))
    }
  };
}

export function formatReport(report: BenchReport): string {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const num = (n: number) => n.toFixed(1);
  const row = (label: string, a: string | number, g: string | number) =>
    `  ${label.padEnd(26)} naive=${String(a).padStart(7)}  governed=${String(g).padStart(7)}`;

  return [
    `=== amotion bench [${report.scope}] (${report.taskCount} tasks) ===`,
    row("solved rate", pct(report.naive.solvedRate), pct(report.governed.solvedRate)),
    row("avg steps", num(report.naive.avgSteps), num(report.governed.avgSteps)),
    row("avg tool calls", num(report.naive.avgToolCalls), num(report.governed.avgToolCalls)),
    row("avg wasted tool calls", num(report.naive.avgWastedToolCalls), num(report.governed.avgWastedToolCalls)),
    row("step-exhaustion rate", pct(report.naive.exhaustedRate), pct(report.governed.exhaustedRate)),
    row("abort rate", pct(report.naive.abortedRate), pct(report.governed.abortedRate)),
    row("escalate rate", pct(report.naive.escalatedRate), pct(report.governed.escalatedRate)),
    `  ---`,
    `  avoided tool calls (avg):   ${num(report.comparison.avoidedToolCallsAvg)}`,
    `  success regression rate:    ${pct(report.comparison.successRegressionRate)}  (target 0%)`,
    `  over-abort rate (solvable): ${pct(report.comparison.overAbortRate)}  (target 0%)`,
    `  doomed interrupt latency:   ${num(report.comparison.avgInterruptLatencyDoomed)} tool calls`
  ].join("\n");
}
