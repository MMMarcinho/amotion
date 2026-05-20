import { DEFAULT_OPERATING_CONFIG, type OperatingConfig } from "./operating-config";
import { applyAgentSignal, createOperatingState, type OperatingState } from "./operating-state";
import { mapStateToOperatingPolicy, type OperatingPolicy } from "./operating-policy";
import type { AgentSignal, ExternalAffectSignal } from "./signals";

/**
 * Stateful controller for an agent's execution loop.
 *
 * The agent reports what happened (`observe`) and asks what to do next
 * (`decide`), or does both at once (`tick`). The runtime accumulates operating
 * state across the episode and returns mechanical control decisions
 * (proceed / verify / replan / escalate / abort).
 *
 *   const rt = new AgentRuntime();
 *   while (true) {
 *     const policy = rt.tick(runOneStep());
 *     if (policy.stop) break;
 *     if (policy.control === "escalate") askHuman();
 *   }
 */
export class AgentRuntime {
  private readonly config: OperatingConfig;
  private currentState: OperatingState;
  private affect?: ExternalAffectSignal;

  constructor(options: { config?: OperatingConfig; initialState?: OperatingState } = {}) {
    this.config = options.config ?? DEFAULT_OPERATING_CONFIG;
    this.currentState = options.initialState ?? createOperatingState(this.config);
  }

  /** Record an execution event, updating operating state. */
  observe(signal: AgentSignal): OperatingState {
    this.currentState = applyAgentSignal(this.currentState, signal, this.config);
    return this.currentState;
  }

  /**
   * Set the optional external affect signal (e.g. from the user-affect
   * analyzer). It only modulates caution; it cannot trigger a stop.
   */
  setExternalAffect(affect: ExternalAffectSignal | undefined): void {
    this.affect = affect;
  }

  /** Compute the control policy for the current operating state. */
  decide(): OperatingPolicy {
    return mapStateToOperatingPolicy(this.currentState, { config: this.config, affect: this.affect });
  }

  /** Observe an event (if given) and return the resulting control policy. */
  tick(signal?: AgentSignal): OperatingPolicy {
    if (signal) this.observe(signal);
    return this.decide();
  }

  get state(): OperatingState {
    return this.currentState;
  }

  reset(): void {
    this.currentState = createOperatingState(this.config);
    this.affect = undefined;
  }
}
