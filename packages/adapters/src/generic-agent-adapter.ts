import type { RuntimePolicy } from "amotion";

export function applyPolicyToAgentConfig(policy: RuntimePolicy) {
  return {
    maxPlanningSteps: policy.planning.maxSteps,
    toolUseThreshold: policy.tools.usageThreshold,
    requireConfirmation: policy.tools.requireConfirmation,
    responseOptionsLimit: policy.interaction.optionCount,
    verbosity: policy.interaction.verbosity
  };
}
