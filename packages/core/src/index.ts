export type {
  AffectiveState,
  AmotionResult,
  EmotionIntent,
  EmotionSignal,
  RuntimePolicy
} from "./types";
export type { EmotionAnalyzer } from "./analyzer/base";
export { RuleAnalyzer } from "./analyzer/rule-analyzer";
export { HybridAnalyzer } from "./analyzer/hybrid-analyzer";
export {
  TransformerEmotionAnalyzer,
  mapClassificationsToEmotionSignal
} from "./analyzer/transformer-analyzer";
export type {
  EmotionClassification,
  TextEmotionClassifier,
  TransformerEmotionAnalyzerOptions
} from "./analyzer/transformer-analyzer";
export { updateAffectiveState } from "./state/state-manager";
export { mapAffectToPolicy } from "./policy/policy-mapper";
export { DEFAULT_POLICY_CONFIG } from "./policy/policy-config";
export type {
  AttentionCoefficients,
  PolicyConfig,
  PolicyThresholds
} from "./policy/policy-config";
export { Amotion } from "./runtime/amotion";
export { policyToSystemHint } from "./prompt-adapter";
