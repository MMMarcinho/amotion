import { AgentRuntime, Amotion, type EmotionAnalyzer, type OperatingPolicy, type RuntimePolicy } from "amotion";
import type {
  AffectEvalCase,
  EvalScore,
  OperatingEvalCase,
  OperatingEvalScore,
  OperatingReplayResult,
  OperatingReplayStep,
  Range
} from "./eval-types";

const inRange = (value: number, [min, max]: Range) => value >= min && value <= max;

const passRate = (passes: number, checks: number) => checks === 0 ? 1 : passes / checks;

function checkRange(name: string, value: number, range: Range, failures: string[]) {
  if (inRange(value, range)) return true;
  failures.push(`${name} expected ${range[0]}..${range[1]}, got ${value}`);
  return false;
}

function scoreOperatingPolicy(
  policy: OperatingPolicy,
  expected: NonNullable<OperatingEvalCase["expectedFinal"]>,
  prefix = "operatingPolicy"
) {
  const failures: string[] = [];
  let checks = 0;
  let passes = 0;

  const check = (name: string, passed: boolean, detail?: string) => {
    checks += 1;
    if (passed) {
      passes += 1;
    } else {
      failures.push(detail ?? `${prefix}.${name}`);
    }
  };

  if (expected.control) {
    check("control", policy.control === expected.control, `${prefix}.control expected ${expected.control}, got ${policy.control}`);
  }
  if (typeof expected.stop === "boolean") {
    check("stop", policy.stop === expected.stop, `${prefix}.stop expected ${expected.stop}, got ${policy.stop}`);
  }
  if (typeof expected.requireVerification === "boolean") {
    check(
      "requireVerification",
      policy.requireVerification === expected.requireVerification,
      `${prefix}.requireVerification expected ${expected.requireVerification}, got ${policy.requireVerification}`
    );
  }
  if (typeof expected.requireConfirmation === "boolean") {
    check(
      "requireConfirmation",
      policy.requireConfirmation === expected.requireConfirmation,
      `${prefix}.requireConfirmation expected ${expected.requireConfirmation}, got ${policy.requireConfirmation}`
    );
  }
  if (expected.retryBudget) {
    checks += 1;
    if (checkRange(`${prefix}.retryBudget`, policy.retryBudget, expected.retryBudget, failures)) passes += 1;
  }
  if (expected.autonomy) {
    checks += 1;
    if (checkRange(`${prefix}.autonomy`, policy.autonomy, expected.autonomy, failures)) passes += 1;
  }
  if (expected.maxSteps) {
    checks += 1;
    if (checkRange(`${prefix}.planning.maxSteps`, policy.planning.maxSteps, expected.maxSteps, failures)) passes += 1;
  }

  return {
    checks,
    passes,
    failures
  };
}

function scoreOperatingTimeline(testCase: OperatingEvalCase, steps: OperatingReplayStep[]) {
  let checks = 0;
  let passes = 0;
  const failures: string[] = [];

  for (const expectedStep of testCase.expectedTimeline ?? []) {
    const actual = steps.find((step) => step.step === expectedStep.step);
    if (!actual) {
      checks += 1;
      failures.push(`timeline.step ${expectedStep.step} missing`);
      continue;
    }

    const score = scoreOperatingPolicy(actual.policy, expectedStep, `timeline[${expectedStep.step}]`);
    checks += score.checks;
    passes += score.passes;
    failures.push(...score.failures);
  }

  return { checks, passes, failures };
}

export function replayOperatingCase(testCase: OperatingEvalCase): OperatingReplayResult {
  const runtime = new AgentRuntime();
  const steps: OperatingReplayStep[] = [];

  for (let i = 0; i < testCase.signals.length; i += 1) {
    const signal = testCase.signals[i]!;
    const policy = runtime.tick(signal);
    steps.push({
      step: i + 1,
      signal,
      state: runtime.state,
      policy
    });
  }

  const finalPolicy = steps.at(-1)?.policy ?? runtime.decide();
  const finalState = runtime.state;
  const timelineScore = scoreOperatingTimeline(testCase, steps);
  const finalScore = testCase.expectedFinal
    ? scoreOperatingPolicy(finalPolicy, testCase.expectedFinal)
    : { checks: 0, passes: 0, failures: [] };

  const checks = timelineScore.checks + finalScore.checks;
  const passes = timelineScore.passes + finalScore.passes;
  const failures = [...timelineScore.failures, ...finalScore.failures];

  const score: OperatingEvalScore = {
    id: testCase.id,
    steps: steps.length,
    finalControl: finalPolicy.control,
    finalStop: finalPolicy.stop,
    policyPassRate: passRate(passes, checks),
    failures
  };

  return {
    id: testCase.id,
    steps,
    finalState,
    finalPolicy,
    score
  };
}

export function evaluateOperatingRuntime(cases: OperatingEvalCase[]): OperatingEvalScore[] {
  return cases.map((testCase) => replayOperatingCase(testCase).score);
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
    passRate: passRate(passes, checks),
    failures
  };
}

export async function evaluateAffectAnalyzer(analyzer: EmotionAnalyzer, cases: AffectEvalCase[]): Promise<EvalScore[]> {
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
        signalRangePassRate: passRate(signalPasses, signalChecks),
        policyPassRate: policyScore.passRate,
        intentPassed,
        failures: [...failures, ...policyScore.failures]
      };
    })
  );
}

export const evaluateAnalyzer = evaluateAffectAnalyzer;
