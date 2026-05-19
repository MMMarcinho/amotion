import type { EmotionAnalyzer } from "./base";
import type { EmotionIntent, EmotionSignal } from "../types";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const unique = (items: string[]) => [...new Set(items)];

const countMatches = (message: string, terms: string[]) =>
  terms.reduce((count, term) => count + (message.includes(term) ? 1 : 0), 0);

const stressTerms = ["崩溃", "焦虑", "压力", "受不了", "烦", "害怕", "panic", "stressed"];
const uncertaintyTerms = ["不知道", "怎么办", "是不是", "不确定", "maybe", "not sure", "确定吗", "确定么"];
const positiveTerms = ["开心", "期待", "喜欢", "不错", "可以", "太好了", "great", "good", "love", "excited"];
const negativeTerms = ["糟糕", "难受", "讨厌", "失败", "风险", "担心", "bad", "terrible", "hate", "worried"];
const helplessTerms = ["没办法", "无助", "撑不住", "救命", "不知道该怎么办", "helpless", "can't handle"];
const planTerms = ["计划", "规划", "roadmap", "project", "步骤", "怎么做", "方案"];
const decideTerms = ["决定", "选哪个", "要不要", "是否应该", "should i", "choose"];
const reflectTerms = ["复盘", "反思", "感觉", "为什么", "think through", "reflect"];
const ventTerms = ["崩溃", "受不了", "烦死", "吐槽", "vent"];
const engagementTerms = ["认真", "项目", "开源", "做成", "深入", "系统", "research", "build"];

function inferIntent(message: string): EmotionIntent {
  const lower = message.toLowerCase();
  if (countMatches(lower, ventTerms) > 0) return "vent";
  if (/[?？]/.test(message) || countMatches(lower, uncertaintyTerms) > 0) return "ask";
  if (countMatches(lower, planTerms) > 0) return "plan";
  if (countMatches(lower, decideTerms) > 0) return "decide";
  if (countMatches(lower, reflectTerms) > 0) return "reflect";
  return "unknown";
}

export class RuleAnalyzer implements EmotionAnalyzer {
  analyze(input: { message: string }): EmotionSignal {
    const message = input.message.trim();
    const lower = message.toLowerCase();
    const evidence: string[] = [];

    const stressHits = countMatches(lower, stressTerms);
    const uncertaintyHits = countMatches(lower, uncertaintyTerms);
    const positiveHits = countMatches(lower, positiveTerms);
    const negativeHits = countMatches(lower, negativeTerms);
    const helplessHits = countMatches(lower, helplessTerms);
    const planningHits = countMatches(lower, planTerms);
    const engagementHits = countMatches(lower, engagementTerms);
    const questionCount = (message.match(/[?？]/g) ?? []).length;
    const exclamationCount = (message.match(/[!！]/g) ?? []).length;
    const repeatedPunctuation = (message.match(/([!?！？。])\1+/g) ?? []).length;
    const strongIntensifiers = countMatches(lower, ["真的", "非常", "特别", "太", "完全", "really", "very", "extremely"]);
    const lengthScore = clamp(message.length / 180);
    const questionDensity = clamp(questionCount / 3);

    if (stressHits > 0) evidence.push("stress_terms");
    if (uncertaintyHits > 0 || questionCount > 0) evidence.push("uncertainty_or_questions");
    if (positiveHits > 0) evidence.push("positive_terms");
    if (negativeHits > 0) evidence.push("negative_terms");
    if (helplessHits > 0) evidence.push("helplessness_terms");
    if (exclamationCount > 0 || repeatedPunctuation > 0) evidence.push("punctuation_arousal");
    if (planningHits > 0 || engagementHits > 0) evidence.push("engagement_terms");

    const stress = clamp(0.16 + stressHits * 0.34 + negativeHits * 0.08 + helplessHits * 0.2 + strongIntensifiers * 0.06);
    const uncertainty = clamp(0.14 + uncertaintyHits * 0.28 + questionDensity * 0.2 + (lower.includes("风险") ? 0.16 : 0));
    const engagement = clamp(
      0.22 + lengthScore * 0.5 + questionDensity * 0.22 + strongIntensifiers * 0.05 + planningHits * 0.28 + engagementHits * 0.08
    );
    const arousal = clamp(0.18 + exclamationCount * 0.12 + repeatedPunctuation * 0.14 + stress * 0.26 + strongIntensifiers * 0.08);
    const valence = clamp((positiveHits - negativeHits - stressHits * 0.4 - helplessHits * 0.5) / 4, -1, 1);
    const dominance = clamp(0.62 - helplessHits * 0.28 - uncertaintyHits * 0.08 - stressHits * 0.08 + countMatches(lower, ["我要", "我想", "let's", "规划"]) * 0.08);
    const trust = clamp(0.58 - uncertainty * 0.18 - stress * 0.12 + positiveHits * 0.04);
    const confidence = clamp(0.45 + Math.min(evidence.length, 4) * 0.05, 0.45, 0.65);

    return {
      valence,
      arousal,
      dominance,
      stress,
      uncertainty,
      engagement,
      trust,
      intent: inferIntent(lower),
      confidence,
      source: "rule",
      evidence: unique(evidence)
    };
  }
}
