import {
  AgentRuntime,
  Amotion,
  type EmotionAnalyzer,
  type OperatingPolicy,
  type RuntimePolicy
} from "../packages/core/src";
import type { AffectEvalCase, EvalScore, OperatingEvalCase, OperatingEvalScore, Range } from "./eval-types";

const inRange = (value: number, [min, max]: Range) => value >= min && value <= max;

function scoreOperatingPolicy(
  policy: OperatingPolicy,
  expected: NonNullable<OperatingEvalCase["expectedFinal"]>
) {
  const failures: string[] = [];
  let checks = 0;
  let passes = 0;

  const check = (name: string, passed: boolean) => {
    checks += 1;
    if (passed) {
      passes += 1;
    } else {
      failures.push(`operatingPolicy.${name}`);
    }
  };

  if (expected.control) check("control", policy.control === expected.control);
  if (typeof expected.stop === "boolean") check("stop", policy.stop === expected.stop);
  if (expected.maxSteps) check("planning.maxSteps", inRange(policy.planning.maxSteps, expected.maxSteps));

  return {
    passRate: checks === 0 ? 1 : passes / checks,
    failures
  };
}

export function evaluateOperatingRuntime(cases: OperatingEvalCase[]): OperatingEvalScore[] {
  return cases.map((testCase) => {
    const runtime = new AgentRuntime();
    let policy = runtime.decide();

    for (const signal of testCase.signals) {
      policy = runtime.tick(signal);
    }

    const policyScore = testCase.expectedFinal
      ? scoreOperatingPolicy(policy, testCase.expectedFinal)
      : { passRate: 1, failures: [] };

    return {
      id: testCase.id,
      policyPassRate: policyScore.passRate,
      failures: policyScore.failures
    };
  });
}

function scoreAffectPolicy(policy: RuntimePolicy, expected: AffectEvalCase["expectedPolicy"]) {
  const failures: string[] = [];
  let checks = 0;
  let passes = 0;

  const check = (name: string, passed: boolean) => {
    checks += 1;
    if (passed) {
      passes += 1;
    } else {
      failures.push(`policy.${name}`);
    }
  };

  if (expected.reasoningDepth) check("reasoning.depth", policy.reasoning.depth === expected.reasoningDepth);
  if (expected.planningHorizon) check("planning.horizon", policy.planning.horizon === expected.planningHorizon);
  if (expected.retrievalMode) check("memory.retrievalMode", policy.memory.retrievalMode === expected.retrievalMode);
  if (expected.tone) check("interaction.tone", policy.interaction.tone === expected.tone);
  if (expected.verbosity) check("interaction.verbosity", policy.interaction.verbosity === expected.verbosity);
  if (expected.riskPosture) check("risk.posture", policy.risk.posture === expected.riskPosture);
  if (typeof expected.requireConfirmation === "boolean") {
    check("tools.requireConfirmation", policy.tools.requireConfirmation === expected.requireConfirmation);
  }
  if (expected.maxSteps) check("planning.maxSteps", inRange(policy.planning.maxSteps, expected.maxSteps));
  if (expected.optionCount) check("interaction.optionCount", inRange(policy.interaction.optionCount, expected.optionCount));

  return {
    passRate: checks === 0 ? 1 : passes / checks,
    failures
  };
}

export async function evaluateAnalyzer(analyzer: EmotionAnalyzer, cases: AffectEvalCase[]): Promise<EvalScore[]> {
  const runtime = new Amotion({ analyzer });

  return Promise.all(
    cases.map(async (testCase) => {
      const result = await runtime.process({
        message: testCase.message,
        history: testCase.history,
        previousState: undefined
      });
      const failures: string[] = [];
      let signalChecks = 0;
      let signalPasses = 0;

      for (const [dimension, range] of Object.entries(testCase.expectedSignal.ranges)) {
        signalChecks += 1;
        const value = result.signal[dimension as keyof typeof testCase.expectedSignal.ranges];
        if (typeof value === "number" && inRange(value, range)) {
          signalPasses += 1;
        } else {
          failures.push(`signal.${dimension}`);
        }
      }

      if (testCase.expectedSignal.valence) {
        signalChecks += 1;
        if (inRange(result.signal.valence, testCase.expectedSignal.valence)) {
          signalPasses += 1;
        } else {
          failures.push("signal.valence");
        }
      }

      const intentPassed = testCase.expectedSignal.intent
        ? result.signal.intent === testCase.expectedSignal.intent
        : undefined;

      if (intentPassed === false) failures.push("signal.intent");

      const policyScore = scoreAffectPolicy(result.policy, testCase.expectedPolicy);

      return {
        id: testCase.id,
        signalRangePassRate: signalChecks === 0 ? 1 : signalPasses / signalChecks,
        policyPassRate: policyScore.passRate,
        intentPassed,
        failures: [...failures, ...policyScore.failures]
      };
    })
  );
}

// Future CLI sketch:
//
// const analyzers = {
//   localTransformer: new TransformerEmotionAnalyzer({
//     model: process.env.AMOTION_MODEL,
//     pipelineOptions: { local_files_only: process.env.AMOTION_LOCAL_FILES_ONLY === "true" },
//   }),
//   localLLM: new LocalLLMAnalyzer({ provider: "ollama", model: "qwen2.5" }),
//   providerLLM: new ProviderLLMAnalyzer({ provider: "openai", model: "..." }),
// };
//
// for (const [name, analyzer] of Object.entries(analyzers)) {
//   const scores = await evaluateAnalyzer(analyzer, sampleAffectEvalCases);
//   console.table(summarizeScores(name, scores));
// }
