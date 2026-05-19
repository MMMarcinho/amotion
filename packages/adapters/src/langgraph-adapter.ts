import type { RuntimePolicy } from "amotion";
import { applyPolicyToAgentConfig } from "./generic-agent-adapter";

export function applyPolicyToLangGraphConfig(policy: RuntimePolicy) {
  return {
    ...applyPolicyToAgentConfig(policy),
    recursionLimit: Math.max(2, policy.planning.maxSteps + 1),
    interruptBeforeTools: policy.tools.requireConfirmation,
    metadata: {
      amotion: {
        reasoningDepth: policy.reasoning.depth,
        riskPosture: policy.risk.posture,
        retrievalMode: policy.memory.retrievalMode
      }
    }
  };
}
