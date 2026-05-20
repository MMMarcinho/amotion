import {
  AgentRuntime,
  createOperatingState,
  type AgentSignal,
  type ExternalAffectSignal,
  type OperatingConfig,
  type OperatingPolicy,
  type OperatingState
} from "amotion";

export type AmotionSignalRecord = {
  id: string;
  signal: AgentSignal;
  source?: string;
  createdAt?: number;
};

export type AmotionLangGraphState = {
  episodeId: string;
  operatingState: OperatingState;
  policy?: OperatingPolicy;
  signals: AmotionSignalRecord[];
  pendingSignals: AmotionSignalRecord[];
  affect?: ExternalAffectSignal;
  updatedAt?: number;
};

export type CreateAmotionStateOptions = {
  episodeId?: string;
  config?: OperatingConfig;
  affect?: ExternalAffectSignal;
};

export type AmotionPolicyNodeOptions = {
  config?: OperatingConfig;
  now?: () => number;
};

let nextRecordId = 0;

const createSignalId = () => {
  nextRecordId += 1;
  return `signal-${nextRecordId}`;
};

export function createAmotionLangGraphState(options: CreateAmotionStateOptions = {}): AmotionLangGraphState {
  return {
    episodeId: options.episodeId ?? "episode",
    operatingState: createOperatingState(options.config),
    signals: [],
    pendingSignals: [],
    affect: options.affect
  };
}

export function createSignalRecord(
  signal: AgentSignal,
  options: { id?: string; source?: string; createdAt?: number } = {}
): AmotionSignalRecord {
  return {
    id: options.id ?? createSignalId(),
    signal,
    source: options.source,
    createdAt: options.createdAt
  };
}

export function appendOperatingSignal(
  state: AmotionLangGraphState,
  signal: AgentSignal,
  options: { id?: string; source?: string; createdAt?: number } = {}
): AmotionLangGraphState {
  return {
    ...state,
    pendingSignals: [...state.pendingSignals, createSignalRecord(signal, options)]
  };
}

export function mergeSignalRecords(records: AmotionSignalRecord[]): AmotionSignalRecord[] {
  const seen = new Set<string>();
  const merged: AmotionSignalRecord[] = [];

  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    merged.push(record);
  }

  return merged;
}

export function mergeAmotionLangGraphState(
  left: AmotionLangGraphState,
  right: Partial<AmotionLangGraphState>
): AmotionLangGraphState {
  return {
    ...left,
    ...right,
    signals: mergeSignalRecords([...(left.signals ?? []), ...(right.signals ?? [])]),
    pendingSignals: mergeSignalRecords([...(left.pendingSignals ?? []), ...(right.pendingSignals ?? [])])
  };
}

export function createAmotionPolicyNode(options: AmotionPolicyNodeOptions = {}) {
  const now = options.now ?? Date.now;

  return async function amotionPolicyNode(state: AmotionLangGraphState): Promise<Partial<AmotionLangGraphState>> {
    const runtime = new AgentRuntime({
      config: options.config,
      initialState: state.operatingState
    });

    if (state.affect) runtime.setExternalAffect(state.affect);

    let policy = runtime.decide();
    for (const record of state.pendingSignals) {
      policy = runtime.tick(record.signal);
    }

    return {
      operatingState: runtime.state,
      policy,
      signals: mergeSignalRecords([...state.signals, ...state.pendingSignals]),
      pendingSignals: [],
      updatedAt: now()
    };
  };
}
