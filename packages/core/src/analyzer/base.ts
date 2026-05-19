import type { AffectiveState, EmotionSignal } from "../types";

export interface EmotionAnalyzer {
  analyze(input: {
    message: string;
    previousState?: AffectiveState;
    history?: string[];
  }): Promise<EmotionSignal> | EmotionSignal;
}
