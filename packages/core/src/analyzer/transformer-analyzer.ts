import type { EmotionAnalyzer } from "./base";
import { RuleAnalyzer } from "./rule-analyzer";
import type { AffectiveState, EmotionIntent, EmotionSignal } from "../types";

export type EmotionClassification = {
  label: string;
  score: number;
};

export type TextEmotionClassifier = (
  text: string,
  options?: { top_k?: number | null }
) => Promise<EmotionClassification[] | EmotionClassification>;

export type TransformerEmotionAnalyzerOptions = {
  model?: string;
  classifier?: TextEmotionClassifier;
  fallbackAnalyzer?: EmotionAnalyzer | false;
  topK?: number | null;
  pipelineOptions?: {
    cache_dir?: string;
    device?: string;
    dtype?: string;
    local_files_only?: boolean;
    revision?: string;
  };
  remoteHost?: string;
};

type Scores = Record<string, number>;

const DEFAULT_MODEL = "onnx-community/tanaos-emotion-detection-v1-ONNX";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const clampValence = (value: number) => clamp(value, -1, 1);

const normalizeLabel = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const sum = (scores: Scores, labels: string[]) =>
  clamp(labels.reduce((total, label) => total + (scores[label] ?? 0), 0));

const max = (scores: Scores, labels: string[]) =>
  clamp(labels.reduce((highest, label) => Math.max(highest, scores[label] ?? 0), 0));

const positiveLabels = [
  "admiration",
  "amusement",
  "approval",
  "caring",
  "desire",
  "excitement",
  "gratitude",
  "joy",
  "love",
  "optimism",
  "pride",
  "relief",
  "happy",
  "happiness"
];

const negativeLabels = [
  "anger",
  "annoyance",
  "disappointment",
  "disapproval",
  "disgust",
  "embarrassment",
  "fear",
  "grief",
  "nervousness",
  "remorse",
  "sadness",
  "sad"
];

const stressLabels = ["anger", "annoyance", "fear", "nervousness", "sadness", "grief", "disgust"];
const uncertaintyLabels = ["confusion", "curiosity", "realization", "surprise"];
const engagementLabels = ["curiosity", "desire", "excitement", "joy", "optimism", "surprise", "pride"];
const highDominanceLabels = ["anger", "approval", "pride", "optimism", "excitement"];
const lowDominanceLabels = ["fear", "nervousness", "sadness", "grief", "embarrassment", "remorse"];
const highTrustLabels = ["approval", "admiration", "caring", "gratitude", "love", "relief", "joy"];
const lowTrustLabels = ["anger", "annoyance", "disapproval", "disgust", "fear", "nervousness"];
const arousalLabels = ["anger", "fear", "nervousness", "excitement", "surprise", "amusement", "joy"];

const getProcessEnv = () =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

function inferIntent(message: string, scores: Scores): EmotionIntent {
  const lower = message.toLowerCase();

  if (max(scores, ["anger", "annoyance", "fear", "nervousness", "sadness", "grief"]) > 0.55) return "vent";
  if (/[?？]/.test(message) || max(scores, ["confusion", "curiosity"]) > 0.45) return "ask";
  if (/(计划|规划|方案|步骤|project|roadmap|plan)/i.test(lower)) return "plan";
  if (/(决定|选择|选哪个|要不要|should i|choose|decide)/i.test(lower)) return "decide";
  if (/(复盘|反思|为什么|reflect|think through)/i.test(lower)) return "reflect";

  return "unknown";
}

function normalizeOutput(output: EmotionClassification[] | EmotionClassification): EmotionClassification[] {
  return (Array.isArray(output) ? output : [output])
    .filter((item) => typeof item.label === "string" && Number.isFinite(item.score))
    .map((item) => ({
      label: normalizeLabel(item.label),
      score: clamp(item.score)
    }));
}

export function mapClassificationsToEmotionSignal(input: {
  message: string;
  classifications: EmotionClassification[];
  source?: EmotionSignal["source"];
}): EmotionSignal {
  const normalized = normalizeOutput(input.classifications);
  const scores = normalized.reduce<Scores>((acc, item) => {
    acc[item.label] = Math.max(acc[item.label] ?? 0, item.score);
    return acc;
  }, {});

  const top = [...normalized].sort((a, b) => b.score - a.score)[0];
  const positive = sum(scores, positiveLabels);
  const negative = sum(scores, negativeLabels);
  const emotionSalience = clamp((top?.score ?? 0) * (scores.neutral ? 1 - scores.neutral * 0.4 : 1));
  const questionBoost = /[?？]/.test(input.message) ? 0.16 : 0;
  const lengthEngagement = clamp(input.message.trim().length / 260) * 0.22;

  const stress = clamp(max(scores, stressLabels) * 0.86 + negative * 0.24);
  const uncertainty = clamp(max(scores, uncertaintyLabels) * 0.78 + questionBoost);
  const engagement = clamp(max(scores, engagementLabels) * 0.72 + emotionSalience * 0.2 + lengthEngagement);
  const arousal = clamp(max(scores, arousalLabels) * 0.8 + emotionSalience * 0.18);
  const valence = clampValence(positive - negative);
  const dominance = clamp(0.5 + max(scores, highDominanceLabels) * 0.35 - max(scores, lowDominanceLabels) * 0.42);
  const trust = clamp(0.52 + max(scores, highTrustLabels) * 0.3 - max(scores, lowTrustLabels) * 0.42);
  const confidence = clamp(0.5 + (top?.score ?? 0) * 0.38 + Math.min(normalized.length, 4) * 0.02, 0.5, 0.92);

  return {
    valence,
    arousal,
    dominance,
    stress,
    uncertainty,
    engagement,
    trust,
    intent: inferIntent(input.message, scores),
    confidence,
    source: input.source ?? "local_transformer",
    evidence: [
      "algorithm:transformers.js:text-classification",
      ...normalized
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => `${item.label}:${item.score.toFixed(3)}`)
    ]
  };
}

export class TransformerEmotionAnalyzer implements EmotionAnalyzer {
  readonly model: string;
  private readonly classifier?: TextEmotionClassifier;
  private readonly fallbackAnalyzer?: EmotionAnalyzer;
  private readonly topK: number | null;
  private readonly pipelineOptions?: TransformerEmotionAnalyzerOptions["pipelineOptions"];
  private readonly remoteHost?: string;
  private classifierPromise?: Promise<TextEmotionClassifier>;

  constructor(options: TransformerEmotionAnalyzerOptions = {}) {
    const processEnv = getProcessEnv();
    this.model = options.model ?? processEnv?.AMOTION_MODEL ?? DEFAULT_MODEL;
    this.classifier = options.classifier;
    this.fallbackAnalyzer = options.fallbackAnalyzer === false ? undefined : options.fallbackAnalyzer ?? new RuleAnalyzer();
    this.topK = options.topK ?? null;
    this.pipelineOptions = {
      ...options.pipelineOptions,
      local_files_only:
        options.pipelineOptions?.local_files_only ?? processEnv?.AMOTION_LOCAL_FILES_ONLY === "true"
    };
    this.remoteHost = options.remoteHost ?? processEnv?.HF_ENDPOINT;
  }

  async analyze(input: {
    message: string;
    previousState?: AffectiveState;
    history?: string[];
  }): Promise<EmotionSignal> {
    try {
      const classifier = await this.getClassifier();
      const output = await classifier(input.message, { top_k: this.topK });

      return mapClassificationsToEmotionSignal({
        message: input.message,
        classifications: normalizeOutput(output),
        source: "local_transformer"
      });
    } catch (error) {
      if (!this.fallbackAnalyzer) throw error;

      const fallbackSignal = await this.fallbackAnalyzer.analyze(input);
      return {
        ...fallbackSignal,
        source: "hybrid",
        evidence: [
          "transformer_unavailable",
          error instanceof Error ? error.message : String(error),
          ...(fallbackSignal.evidence ?? [])
        ]
      };
    }
  }

  private async getClassifier(): Promise<TextEmotionClassifier> {
    if (this.classifier) return this.classifier;
    if (!this.classifierPromise) {
      this.classifierPromise = this.loadClassifier();
    }
    return this.classifierPromise;
  }

  private async loadClassifier(): Promise<TextEmotionClassifier> {
    const { env, pipeline } = await import("@huggingface/transformers");
    const remoteHost = this.remoteHost;

    if (remoteHost) {
      env.remoteHost = remoteHost.endsWith("/") ? remoteHost : `${remoteHost}/`;
    }

    return pipeline("text-classification", this.model, this.pipelineOptions as never) as Promise<TextEmotionClassifier>;
  }
}
