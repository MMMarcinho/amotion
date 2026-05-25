import type { AgentSignal, OperatingPolicy } from "amotion";

export type IrreversibleActionAnnotation = {
  irreversible?: boolean;
  actionName?: string;
  reason?: string;
};

export type ConfirmationInterruptPayload = {
  type: "amotion.confirmation_required";
  actionName?: string;
  reason: string;
  policy: Pick<OperatingPolicy, "control" | "reason" | "requireConfirmation" | "autonomy" | "toolUsageThreshold">;
};

export function shouldInterruptForConfirmation(
  policy: OperatingPolicy,
  action: IrreversibleActionAnnotation = {}
): boolean {
  return policy.requireConfirmation && action.irreversible === true;
}

export function createConfirmationInterruptPayload(
  policy: OperatingPolicy,
  action: IrreversibleActionAnnotation = {}
): ConfirmationInterruptPayload {
  return {
    type: "amotion.confirmation_required",
    actionName: action.actionName,
    reason: action.reason ?? policy.reason,
    policy: {
      control: policy.control,
      reason: policy.reason,
      requireConfirmation: policy.requireConfirmation,
      autonomy: policy.autonomy,
      toolUsageThreshold: policy.toolUsageThreshold
    }
  };
}

export type EscalationInterruptPayload = {
  type: "amotion.escalation_required";
  reason: string;
  policy: Pick<
    OperatingPolicy,
    "control" | "reason" | "requireConfirmation" | "autonomy" | "toolUsageThreshold" | "retryBudget"
  >;
  recentSignals?: AgentSignal[];
};

export function shouldInterruptForEscalation(policy: OperatingPolicy): boolean {
  return policy.control === "escalate";
}

export function createEscalationInterruptPayload(
  policy: OperatingPolicy,
  options: { recentSignals?: AgentSignal[]; reason?: string } = {}
): EscalationInterruptPayload {
  return {
    type: "amotion.escalation_required",
    reason: options.reason ?? policy.reason,
    policy: {
      control: policy.control,
      reason: policy.reason,
      requireConfirmation: policy.requireConfirmation,
      autonomy: policy.autonomy,
      toolUsageThreshold: policy.toolUsageThreshold,
      retryBudget: policy.retryBudget
    },
    recentSignals: options.recentSignals
  };
}
