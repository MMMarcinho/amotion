import { useEffect, useMemo, useState } from "react";
import {
  TransformerEmotionAnalyzer,
  mapAffectToPolicy,
  updateAffectiveState,
  type AffectiveState,
  type EmotionSignal
} from "amotion";
import { policyToSystemHint } from "@amotion/adapters";

const analyzer = new TransformerEmotionAnalyzer();

const defaultMessage = "我现在真的有点崩溃，不知道该怎么办";

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

function createState(signal: EmotionSignal, overrides: Pick<AffectiveState, "stress" | "uncertainty" | "engagement" | "trust">) {
  const baseState = updateAffectiveState(undefined, signal);
  const state: AffectiveState = {
    ...baseState,
    ...overrides,
    updatedAt: baseState.updatedAt
  };
  const policy = mapAffectToPolicy(state);

  return {
    signal,
    state,
    policy,
    hint: policyToSystemHint(policy)
  };
}

function Meter(props: { label: string; value: number; max?: number }) {
  const max = props.max ?? 1;
  const width = `${Math.round((props.value / max) * 100)}%`;

  return (
    <div className="meter">
      <div className="meter__label">
        <span>{props.label}</span>
        <strong>{props.value.toFixed(2)}</strong>
      </div>
      <div className="meter__track">
        <div className="meter__fill" style={{ width }} />
      </div>
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider">
      <span>
        {props.label}
        <strong>{props.value.toFixed(2)}</strong>
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function App() {
  const [message, setMessage] = useState(defaultMessage);
  const [signal, setSignal] = useState<EmotionSignal | null>(null);
  const [status, setStatus] = useState("Loading local transformer analyzer");
  const [overrides, setOverrides] = useState({
    stress: 0.82,
    uncertainty: 0.78,
    engagement: 0.44,
    trust: 0.38
  });

  useEffect(() => {
    let cancelled = false;
    setStatus("Running Transformers.js text classification");

    analyzer
      .analyze({ message })
      .then((nextSignal) => {
        if (cancelled) return;
        setSignal(nextSignal);
        setStatus(
          nextSignal.source === "local_transformer"
            ? "Local transformer analyzer"
            : "Transformer unavailable; fallback signal shown"
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [message]);

  const result = useMemo(() => (signal ? createState(signal, overrides) : null), [signal, overrides]);

  const setOverride = (key: keyof typeof overrides, value: number) => {
    setOverrides((current) => ({ ...current, [key]: value }));
  };

  return (
    <main className="app">
      <section className="workspace">
        <div className="inputPane">
          <header className="brand">
            <span>amotion</span>
            <strong>emotion {"->"} runtime policy</strong>
          </header>
          <div className="status">{status}</div>

          <label className="editorLabel" htmlFor="message">
            User Input
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            spellCheck={false}
          />

          <div className="controls">
            <Slider label="Stress" value={overrides.stress} onChange={(value) => setOverride("stress", value)} />
            <Slider label="Uncertainty" value={overrides.uncertainty} onChange={(value) => setOverride("uncertainty", value)} />
            <Slider label="Engagement" value={overrides.engagement} onChange={(value) => setOverride("engagement", value)} />
            <Slider label="Trust" value={overrides.trust} onChange={(value) => setOverride("trust", value)} />
          </div>

          <section className="policyView" aria-label="Policy visualization">
            <Meter label="Reasoning verification" value={result?.policy.reasoning.verification ?? 0} />
            <Meter label="Planning initiative" value={result?.policy.planning.initiative ?? 0} />
            <Meter label="Tool search bias" value={result?.policy.tools.externalSearchBias ?? 0} />
            <Meter label="Action threshold" value={result?.policy.risk.actionThreshold ?? 0} />
          </section>
        </div>

        <div className="outputPane">
          <section>
            <h2>Emotion Signal</h2>
            <pre>{result ? formatJson(result.signal) : status}</pre>
          </section>
          <section>
            <h2>Affective State</h2>
            <pre>{result ? formatJson(result.state) : status}</pre>
          </section>
          <section>
            <h2>Runtime Policy</h2>
            <pre>{result ? formatJson(result.policy) : status}</pre>
          </section>
          <section>
            <h2>Generated System Hint</h2>
            <pre>{result ? result.hint : status}</pre>
          </section>
        </div>
      </section>
    </main>
  );
}
