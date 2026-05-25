import {
  appendOperatingSignal,
  createAmotionLangGraphState,
  createAmotionPolicyNode,
  routeByOperatingPolicy
} from "./index";

export type FakeBenchScenario = {
  id: string;
  failuresBeforeSuccess: number;
  maxSteps: number;
};

export type FakeBenchArmResult = {
  outcome: "done" | "aborted" | "step_exhausted";
  toolCalls: number;
  wastedToolCalls: number;
  abortLatency?: number;
  escalations: number;
};

export type FakeBenchComparison = {
  id: string;
  naive: FakeBenchArmResult;
  governed: FakeBenchArmResult;
  delta: {
    avoidedToolCalls: number;
    avoidedStepExhaustion: boolean;
    successRegressed: boolean;
  };
};

function makeTool(failuresBeforeSuccess: number) {
  let calls = 0;
  return () => {
    calls += 1;
    return calls > failuresBeforeSuccess;
  };
}

export function runNaiveFakeGraph(scenario: FakeBenchScenario): FakeBenchArmResult {
  const tool = makeTool(scenario.failuresBeforeSuccess);
  let toolCalls = 0;

  for (let step = 0; step < scenario.maxSteps; step += 1) {
    toolCalls += 1;
    if (tool()) {
      return {
        outcome: "done",
        toolCalls,
        wastedToolCalls: toolCalls - 1,
        escalations: 0
      };
    }
  }

  return {
    outcome: "step_exhausted",
    toolCalls,
    wastedToolCalls: toolCalls,
    escalations: 0
  };
}

export async function runGovernedFakeGraph(scenario: FakeBenchScenario): Promise<FakeBenchArmResult> {
  const tool = makeTool(scenario.failuresBeforeSuccess);
  const policyNode = createAmotionPolicyNode({ now: () => 1 });
  let state = createAmotionLangGraphState({ episodeId: scenario.id });
  let toolCalls = 0;
  let escalations = 0;

  for (let step = 0; step < scenario.maxSteps; step += 1) {
    toolCalls += 1;
    const ok = tool();
    state = appendOperatingSignal(state, ok ? { type: "tool_success" } : { type: "tool_error" });
    state = { ...state, ...(await policyNode(state)) };

    if (state.policy?.control === "escalate") escalations += 1;

    const route = state.policy ? routeByOperatingPolicy(state.policy) : "proceed";
    if (route === "__end__") {
      return {
        outcome: "aborted",
        toolCalls,
        wastedToolCalls: toolCalls,
        abortLatency: toolCalls,
        escalations
      };
    }

    if (ok) {
      return {
        outcome: "done",
        toolCalls,
        wastedToolCalls: toolCalls - 1,
        escalations
      };
    }
  }

  return {
    outcome: "step_exhausted",
    toolCalls,
    wastedToolCalls: toolCalls,
    escalations
  };
}

export async function compareFakeGraphScenario(scenario: FakeBenchScenario): Promise<FakeBenchComparison> {
  const naive = runNaiveFakeGraph(scenario);
  const governed = await runGovernedFakeGraph(scenario);

  return {
    id: scenario.id,
    naive,
    governed,
    delta: {
      avoidedToolCalls: naive.toolCalls - governed.toolCalls,
      avoidedStepExhaustion: naive.outcome === "step_exhausted" && governed.outcome !== "step_exhausted",
      successRegressed: naive.outcome === "done" && governed.outcome !== "done"
    }
  };
}
