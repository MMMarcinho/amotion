import type { EmotionAnalyzer } from "../analyzer/base";
import { TransformerEmotionAnalyzer } from "../analyzer/transformer-analyzer";
import { RuleAnalyzer } from "../analyzer/rule-analyzer";
import { mapAffectToPolicy } from "../policy/policy-mapper";
import { updateAffectiveState } from "../state/state-manager";
import type { AffectiveState, AmotionResult } from "../types";

export class Amotion {
  private readonly analyzer: EmotionAnalyzer;
  private state?: AffectiveState;

  constructor(options?: {
    analyzer?: EmotionAnalyzer;
    initialState?: AffectiveState;
  }) {
    this.analyzer = options?.analyzer ?? new TransformerEmotionAnalyzer({ fallbackAnalyzer: new RuleAnalyzer() });
    this.state = options?.initialState;
  }

  async process(input: {
    message: string;
    previousState?: AffectiveState;
    history?: string[];
  }): Promise<AmotionResult> {
    const previousState = input.previousState ?? this.state;
    const signal = await this.analyzer.analyze({
      message: input.message,
      previousState,
      history: input.history
    });
    const state = updateAffectiveState(previousState, signal);
    const policy = mapAffectToPolicy(state);

    this.state = state;

    return {
      signal,
      state,
      policy
    };
  }
}
