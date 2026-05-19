import type { AffectiveState, EmotionSignal } from "../types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clampValence = (value: number) => Math.min(1, Math.max(-1, value));

export function updateAffectiveState(
  previous: AffectiveState | undefined,
  signal: EmotionSignal,
  options?: {
    alpha?: number;
    decay?: number;
  }
): AffectiveState {
  const now = Date.now();

  if (!previous) {
    return {
      valence: clampValence(signal.valence),
      arousal: clamp01(signal.arousal),
      dominance: clamp01(signal.dominance),
      stress: clamp01(signal.stress),
      uncertainty: clamp01(signal.uncertainty),
      engagement: clamp01(signal.engagement),
      trust: clamp01(signal.trust),
      updatedAt: now
    };
  }

  const alpha = options?.alpha ?? 0.35;
  const decay = options?.decay ?? 0.98;
  const trustAlpha = 0.08;
  const smooth01 = (field: keyof Pick<AffectiveState, "arousal" | "dominance" | "stress" | "uncertainty" | "engagement">) =>
    clamp01(previous[field] * decay * (1 - alpha) + signal[field] * alpha);

  return {
    valence: clampValence(previous.valence * decay * (1 - alpha) + signal.valence * alpha),
    arousal: smooth01("arousal"),
    dominance: smooth01("dominance"),
    stress: smooth01("stress"),
    uncertainty: smooth01("uncertainty"),
    engagement: smooth01("engagement"),
    trust: clamp01(previous.trust * decay * (1 - trustAlpha) + signal.trust * trustAlpha),
    updatedAt: now
  };
}
