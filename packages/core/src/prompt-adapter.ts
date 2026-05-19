import type { RuntimePolicy } from "./types";

export function policyToSystemHint(policy: RuntimePolicy): string {
  return [
    "Runtime policy:",
    `- Reasoning depth: ${policy.reasoning.depth}`,
    `- Planning horizon: ${policy.planning.horizon}`,
    `- Response verbosity: ${policy.interaction.verbosity}`,
    `- Option count: ${policy.interaction.optionCount}`,
    `- Tone: ${policy.interaction.tone}`,
    `- Risk posture: ${policy.risk.posture}`,
    "",
    "Follow this policy unless safety or factual accuracy requires otherwise."
  ].join("\n");
}
