/**
 * Agent operating signals.
 *
 * These are observable facts emitted by an agent's execution loop — not
 * inferred mental states. Every signal corresponds to something that
 * measurably happened: a tool returned an error, a verification step failed,
 * the model reported low confidence, a step produced no progress.
 *
 * This is the credible core of amotion: the runtime reacts to what the agent
 * actually did, so its decisions can be checked against the trace.
 */
export type AgentSignalType =
  | "tool_success"
  | "tool_error"
  | "retry"
  | "validation_pass"
  | "validation_fail"
  | "retrieval_hit"
  | "retrieval_miss"
  | "self_report"
  | "progress"
  | "stall";

export type AgentSignal = {
  type: AgentSignalType;
  /** Magnitude of the event in [0, 1]. Defaults to 1. */
  weight?: number;
  /** Model self-reported confidence in [0, 1]. Only used by `self_report`. */
  confidence?: number;
  /** Free-form context for traces and debugging. */
  note?: string;
};

/** External, optional affect signal (e.g. from the user-affect analyzer). */
export type ExternalAffectSignal = {
  /** Raised when the user appears stressed/uncertain, in [0, 1]. */
  pressure: number;
  /** Lowered when user trust appears low, in [0, 1]. */
  trust: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const signalWeight = (signal: AgentSignal): number => clamp01(signal.weight ?? 1);
