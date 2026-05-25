import type { AgentSignal } from "amotion";

export type ToolObservation =
  | { ok: true; note?: string; weight?: number }
  | { ok: false; error?: unknown; note?: string; weight?: number };

export function signalFromToolObservation(observation: ToolObservation): AgentSignal {
  if (observation.ok) {
    return {
      type: "tool_success",
      note: observation.note,
      weight: observation.weight
    };
  }

  return {
    type: "tool_error",
    note: observation.note ?? (observation.error instanceof Error ? observation.error.message : undefined),
    weight: observation.weight
  };
}

export async function observeToolCall<T>(
  call: () => Promise<T> | T,
  options: { successNote?: string; errorNote?: (error: unknown) => string } = {}
): Promise<{ ok: true; value: T; signal: AgentSignal } | { ok: false; error: unknown; signal: AgentSignal }> {
  try {
    const value = await call();
    return {
      ok: true,
      value,
      signal: signalFromToolObservation({ ok: true, note: options.successNote })
    };
  } catch (error) {
    return {
      ok: false,
      error,
      signal: signalFromToolObservation({
        ok: false,
        error,
        note: options.errorNote?.(error)
      })
    };
  }
}

export function signalFromValidation(
  result: { passed: boolean; note?: string; weight?: number }
): AgentSignal {
  return {
    type: result.passed ? "validation_pass" : "validation_fail",
    note: result.note,
    weight: result.weight
  };
}

export function signalFromRetrieval(
  result: { hits: number; note?: string; weight?: number }
): AgentSignal {
  return {
    type: result.hits > 0 ? "retrieval_hit" : "retrieval_miss",
    note: result.note,
    weight: result.weight
  };
}

export function userSuppliedSignal(signal: AgentSignal): AgentSignal {
  return signal;
}

export function bestEffortRetrySignal(
  previousActionKey: string | undefined,
  nextActionKey: string | undefined
): AgentSignal | undefined {
  if (!previousActionKey || !nextActionKey) return undefined;
  if (previousActionKey !== nextActionKey) return undefined;
  return { type: "retry", note: `best-effort retry detected for ${nextActionKey}` };
}
