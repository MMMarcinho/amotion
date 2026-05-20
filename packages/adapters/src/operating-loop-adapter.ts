import { AgentRuntime, type AgentSignal, type OperatingPolicy, type OperatingState } from "amotion";

type MaybePromise<T> = T | Promise<T>;

export type OperatingLoopAction = "confirm" | "verify" | "replan" | "escalate" | "stop";

export type OperatingPolicyHookContext = {
  policy: OperatingPolicy;
  state?: OperatingState;
};

export type OperatingPolicyHooks = {
  confirm?: (context: OperatingPolicyHookContext) => MaybePromise<void>;
  verify?: (context: OperatingPolicyHookContext) => MaybePromise<void>;
  replan?: (context: OperatingPolicyHookContext) => MaybePromise<void>;
  escalate?: (context: OperatingPolicyHookContext) => MaybePromise<void>;
  stop?: (context: OperatingPolicyHookContext) => MaybePromise<void>;
};

export type ApplyOperatingPolicyOptions = {
  /**
   * Set when the next action is irreversible enough that confirmation matters.
   * `requireConfirmation` is intentionally a gate, not a blanket pause.
   */
  irreversible?: boolean;
  state?: OperatingState;
};

export type OperatingPolicyApplication = {
  shouldStop: boolean;
  actions: OperatingLoopAction[];
};

export async function applyOperatingPolicyToLoop(
  policy: OperatingPolicy,
  hooks: OperatingPolicyHooks = {},
  options: ApplyOperatingPolicyOptions = {}
): Promise<OperatingPolicyApplication> {
  const context = { policy, state: options.state };
  const actions: OperatingLoopAction[] = [];

  if (policy.stop) {
    actions.push("stop");
    await hooks.stop?.(context);
    return { shouldStop: true, actions };
  }

  if (policy.requireConfirmation && options.irreversible) {
    actions.push("confirm");
    await hooks.confirm?.(context);
  }

  if (policy.requireVerification) {
    actions.push("verify");
    await hooks.verify?.(context);
  }

  if (policy.control === "replan") {
    actions.push("replan");
    await hooks.replan?.(context);
  }

  if (policy.control === "escalate") {
    actions.push("escalate");
    await hooks.escalate?.(context);
  }

  return { shouldStop: false, actions };
}

export type GovernedLoopStepContext = {
  policy: OperatingPolicy;
  state: OperatingState;
  step: number;
};

export type GovernedLoopStepResult<TValue = unknown> = {
  signal: AgentSignal;
  done?: boolean;
  value?: TValue;
};

export type GovernedLoopOptions<TValue = unknown> = {
  runtime?: AgentRuntime;
  maxSteps?: number;
  hooks?: OperatingPolicyHooks;
  shouldConfirmBeforeStep?: (context: GovernedLoopStepContext) => boolean;
  step: (context: GovernedLoopStepContext) => MaybePromise<GovernedLoopStepResult<TValue>>;
};

export type GovernedLoopResult<TValue = unknown> = {
  outcome: "done" | "stopped" | "max_steps";
  steps: number;
  value?: TValue;
  finalPolicy: OperatingPolicy;
  finalState: OperatingState;
  actions: OperatingLoopAction[];
};

export async function runGovernedLoop<TValue = unknown>(
  options: GovernedLoopOptions<TValue>
): Promise<GovernedLoopResult<TValue>> {
  const runtime = options.runtime ?? new AgentRuntime();
  const maxSteps = options.maxSteps ?? 100;
  const actions: OperatingLoopAction[] = [];
  let policy = runtime.decide();

  for (let i = 0; i < maxSteps; i += 1) {
    const context = { policy, state: runtime.state, step: i + 1 };
    const application = await applyOperatingPolicyToLoop(policy, options.hooks, {
      irreversible: options.shouldConfirmBeforeStep?.(context) ?? false,
      state: runtime.state
    });
    actions.push(...application.actions);

    if (application.shouldStop) {
      return {
        outcome: "stopped",
        steps: i,
        finalPolicy: policy,
        finalState: runtime.state,
        actions
      };
    }

    const result = await options.step(context);
    policy = runtime.tick(result.signal);

    if (result.done) {
      return {
        outcome: "done",
        steps: i + 1,
        value: result.value,
        finalPolicy: policy,
        finalState: runtime.state,
        actions
      };
    }
  }

  return {
    outcome: "max_steps",
    steps: maxSteps,
    finalPolicy: policy,
    finalState: runtime.state,
    actions
  };
}
