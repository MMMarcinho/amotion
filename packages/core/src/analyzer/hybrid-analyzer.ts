import type { EmotionAnalyzer } from "./base";
import type { EmotionSignal } from "../types";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export class HybridAnalyzer implements EmotionAnalyzer {
  constructor(private readonly analyzers: EmotionAnalyzer[]) {
    if (analyzers.length === 0) {
      throw new Error("HybridAnalyzer requires at least one analyzer.");
    }
  }

  async analyze(input: Parameters<EmotionAnalyzer["analyze"]>[0]): Promise<EmotionSignal> {
    const signals = await Promise.all(this.analyzers.map((analyzer) => analyzer.analyze(input)));
    const totalWeight = signals.reduce((sum, signal) => sum + signal.confidence, 0) || signals.length;
    const weighted = (field: keyof Pick<EmotionSignal, "arousal" | "dominance" | "engagement" | "stress" | "trust" | "uncertainty">) =>
      clamp(signals.reduce((sum, signal) => sum + signal[field] * signal.confidence, 0) / totalWeight);
    const valence = Math.min(
      1,
      Math.max(-1, signals.reduce((sum, signal) => sum + signal.valence * signal.confidence, 0) / totalWeight)
    );
    const bestIntent = [...signals].sort((a, b) => b.confidence - a.confidence)[0]?.intent ?? "unknown";

    return {
      valence,
      arousal: weighted("arousal"),
      dominance: weighted("dominance"),
      stress: weighted("stress"),
      uncertainty: weighted("uncertainty"),
      engagement: weighted("engagement"),
      trust: weighted("trust"),
      intent: bestIntent,
      confidence: clamp(signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length, 0.45, 0.85),
      source: "hybrid",
      evidence: signals.flatMap((signal) => signal.evidence ?? [])
    };
  }
}
