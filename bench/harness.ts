import { AgentRuntime, type AgentSignal, type OperatingConfig } from "amotion";

/**
 * A tau-bench-style tool-use harness, deterministic by default.
 *
 * A task is a single goal an agent pursues with tools: optionally gather
 * context (retrieval), use a primary tool until it succeeds, then submit a
 * result that a checker validates. The environment emits the observable
 * `AgentSignal`s a real adapter would extract from tool/checker results.
 *
 * The agent follows one fixed, realistic policy (retrieve if needed, retry the
 * primary tool until it works, then submit). The two arms share that policy,
 * the tools, the task, and the step cap — the ONLY difference is whether an
 * `AgentRuntime` governs the loop. So any measured difference is attributable
 * to governance, not to a smarter agent. Governance never feeds the agent
 * hints; it only stops or escalates. That keeps the comparison honest: the
 * win we can claim is "stops wasting steps / escalates doomed runs without
 * interrupting solvable ones", not an inflated success rate.
 */

export type TaskKind =
  | "doomed"
  | "transient"
  | "healthy"
  | "retrieval"
  | "validation"
  | "doomed_validation";

export type BenchTask = {
  id: string;
  kind: TaskKind;
  tag: "report" | "calibration";
  maxSteps: number;
  /** Retrieval misses before a hit. 0 means no retrieval step is needed. */
  missesBeforeHit: number;
  /** Primary-tool failures before it succeeds. Infinity = permanently broken. */
  primaryFailuresBeforeSuccess: number;
  /** Submit validations that fail before one passes. Infinity = never passes. */
  validationFailures: number;
};

type Action = "search" | "primary" | "submit";

class TaskWorld {
  private retrievalCount = 0;
  private primaryCount = 0;
  private submitCount = 0;
  private solvedFlag = false;

  constructor(private readonly task: BenchTask) {}

  private get needsRetrieval() {
    return this.task.missesBeforeHit > 0;
  }

  private get retrievalDone() {
    return this.retrievalCount > this.task.missesBeforeHit;
  }

  private get primaryDone() {
    return (
      this.primaryCount > this.task.primaryFailuresBeforeSuccess &&
      (!this.needsRetrieval || this.retrievalDone)
    );
  }

  get solved() {
    return this.solvedFlag;
  }

  /** The agent's fixed reactive policy. */
  nextAction(): Action {
    if (this.needsRetrieval && !this.retrievalDone) return "search";
    if (!this.primaryDone) return "primary";
    return "submit";
  }

  step(action: Action): { signals: AgentSignal[]; toolCall: boolean; productive: boolean; solved: boolean } {
    if (action === "search") {
      this.retrievalCount += 1;
      const hit = this.retrievalCount > this.task.missesBeforeHit;
      return { signals: [{ type: hit ? "retrieval_hit" : "retrieval_miss" }], toolCall: true, productive: hit, solved: false };
    }

    if (action === "primary") {
      this.primaryCount += 1;
      const ok =
        this.primaryCount > this.task.primaryFailuresBeforeSuccess &&
        (!this.needsRetrieval || this.retrievalDone);
      const signals: AgentSignal[] = [{ type: ok ? "tool_success" : "tool_error" }];
      if (ok) signals.push({ type: "progress" });
      return { signals, toolCall: true, productive: ok, solved: false };
    }

    this.submitCount += 1;
    const pass = this.primaryDone && this.submitCount > this.task.validationFailures;
    if (pass) {
      this.solvedFlag = true;
      return { signals: [{ type: "validation_pass" }, { type: "progress" }], toolCall: true, productive: true, solved: true };
    }
    return { signals: [{ type: "validation_fail" }], toolCall: true, productive: false, solved: false };
  }
}

export type ArmOutcome = "solved" | "aborted" | "escalated" | "exhausted";

export type ArmResult = {
  taskId: string;
  kind: TaskKind;
  tag: BenchTask["tag"];
  governed: boolean;
  outcome: ArmOutcome;
  steps: number;
  toolCalls: number;
  wastedToolCalls: number;
  escalations: number;
  abortLatency?: number;
};

export function runTask(task: BenchTask, options: { governed: boolean; config?: OperatingConfig }): ArmResult {
  const world = new TaskWorld(task);
  const runtime = options.governed ? new AgentRuntime({ config: options.config }) : undefined;

  let steps = 0;
  let toolCalls = 0;
  let productiveToolCalls = 0;
  let escalations = 0;

  const result = (outcome: ArmOutcome, abortLatency?: number): ArmResult => ({
    taskId: task.id,
    kind: task.kind,
    tag: task.tag,
    governed: options.governed,
    outcome,
    steps,
    toolCalls,
    wastedToolCalls: toolCalls - productiveToolCalls,
    escalations,
    abortLatency
  });

  for (let i = 0; i < task.maxSteps; i += 1) {
    steps += 1;
    const action = world.nextAction();
    const res = world.step(action);
    if (res.toolCall) toolCalls += 1;
    if (res.productive) productiveToolCalls += 1;

    if (res.solved) return result("solved");

    if (runtime) {
      let policy = runtime.decide();
      for (const signal of res.signals) policy = runtime.tick(signal);

      if (policy.control === "escalate") {
        escalations += 1;
        return result("escalated", toolCalls);
      }
      if (policy.stop) return result("aborted", toolCalls);
    }
  }

  return result("exhausted");
}
