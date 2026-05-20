import type { OperatingPolicy } from "amotion";

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
