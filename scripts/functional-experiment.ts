import {
  AgentRuntime,
  Amotion,
  RuleAnalyzer,
  policyToSystemHint,
  type AgentSignal,
  type RuntimePolicy
} from "../packages/core/src/index.ts";
import {
  bestEffortRetrySignal,
  compareFakeGraphScenario,
  observeToolCall,
  signalFromRetrieval,
  signalFromValidation
} from "../packages/adapters-langgraph/src/index.ts";
import {
  BENCH_TASKS,
  buildReport,
  formatReport,
  runBattery
} from "../bench/index.ts";

type Provider = "openai" | "openai-compatible" | "anthropic";

/**
 * Fill these fields, then run:
 *
 *   corepack pnpm experiment:functional
 *
 * You can also override them with environment variables:
 *
 *   AMOTION_EXPERIMENT_PROVIDER=openai-compatible \
 *   AMOTION_EXPERIMENT_API_KEY=... \
 *   AMOTION_EXPERIMENT_MODEL=... \
 *   AMOTION_EXPERIMENT_BASE_URL=https://api.openai.com/v1 \
 *   corepack pnpm experiment:functional
 *
 * For a local-only smoke test with no provider call:
 *
 *   corepack pnpm experiment:functional -- --self-test
 */
const CONFIG = {
  provider: "openai-compatible" as Provider,
  apiKey: "PASTE_API_KEY_HERE",
  model: "PASTE_MODEL_HERE",
  baseUrl: "https://api.openai.com/v1",
  temperature: 0.2,
  maxTokens: 500,
  anthropicVersion: "2023-06-01"
};

const EXPERIMENT_USER_MESSAGE =
  "我现在很紧张，线上发布一直失败，老板还在等结果。请你帮我判断下一步该怎么做，但不要冒险改生产配置。";

type EffectiveConfig = typeof CONFIG;

type ChatInput = {
  system: string;
  user: string;
};

const selfTest = process.argv.includes("--self-test");

function withEnvOverrides(): EffectiveConfig {
  return {
    provider: (process.env.AMOTION_EXPERIMENT_PROVIDER as Provider | undefined) ?? CONFIG.provider,
    apiKey: process.env.AMOTION_EXPERIMENT_API_KEY ?? CONFIG.apiKey,
    model: process.env.AMOTION_EXPERIMENT_MODEL ?? CONFIG.model,
    baseUrl: process.env.AMOTION_EXPERIMENT_BASE_URL ?? CONFIG.baseUrl,
    temperature: Number(process.env.AMOTION_EXPERIMENT_TEMPERATURE ?? CONFIG.temperature),
    maxTokens: Number(process.env.AMOTION_EXPERIMENT_MAX_TOKENS ?? CONFIG.maxTokens),
    anthropicVersion: process.env.AMOTION_EXPERIMENT_ANTHROPIC_VERSION ?? CONFIG.anthropicVersion
  };
}

function assertProviderConfig(config: EffectiveConfig): void {
  if (typeof fetch !== "function") {
    throw new Error("This script needs a Node.js runtime with global fetch support.");
  }

  if (!["openai", "openai-compatible", "anthropic"].includes(config.provider)) {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  if (!config.apiKey || config.apiKey === "PASTE_API_KEY_HERE") {
    throw new Error("Set CONFIG.apiKey or AMOTION_EXPERIMENT_API_KEY before running provider experiments.");
  }

  if (!config.model || config.model === "PASTE_MODEL_HERE") {
    throw new Error("Set CONFIG.model or AMOTION_EXPERIMENT_MODEL before running provider experiments.");
  }

  if (!config.baseUrl) {
    throw new Error("Set CONFIG.baseUrl or AMOTION_EXPERIMENT_BASE_URL.");
  }
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status}: ${text}`);
  }

  return json;
}

async function callProvider(config: EffectiveConfig, input: ChatInput): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  if (config.provider === "anthropic") {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": config.anthropicVersion
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: input.system,
        messages: [{ role: "user", content: input.user }]
      })
    });

    const json = await readJson(response);
    const text = json.content
      ?.filter((part: { type?: string }) => part.type === "text")
      .map((part: { text?: string }) => part.text ?? "")
      .join("\n")
      .trim();

    if (!text) throw new Error(`Anthropic response did not include text: ${JSON.stringify(json)}`);
    return text;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user }
      ]
    })
  });

  const json = await readJson(response);
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`OpenAI-compatible response did not include text: ${JSON.stringify(json)}`);
  return text;
}

function printJson(label: string, value: unknown): void {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

function summarizePolicy(policy: RuntimePolicy) {
  return {
    reasoningDepth: policy.reasoning.depth,
    verification: policy.reasoning.verification,
    maxSteps: policy.planning.maxSteps,
    tone: policy.interaction.tone,
    verbosity: policy.interaction.verbosity,
    requireConfirmation: policy.tools.requireConfirmation,
    riskPosture: policy.risk.posture,
    autonomy: policy.execution.autonomy,
    retryTolerance: policy.execution.retryTolerance
  };
}

async function runUserAffectExperiment() {
  const amotion = new Amotion({ analyzer: new RuleAnalyzer() });
  const result = await amotion.process({ message: EXPERIMENT_USER_MESSAGE });

  printJson("User affect signal", result.signal);
  printJson("User affect policy summary", summarizePolicy(result.policy));

  return {
    message: EXPERIMENT_USER_MESSAGE,
    systemHint: policyToSystemHint(result.policy),
    result
  };
}

async function runOperatingRuntimeExperiment(): Promise<void> {
  const runtime = new AgentRuntime();
  const signals: AgentSignal[] = [
    signalFromRetrieval({ hits: 0, note: "search returned no useful candidates" }),
    signalFromRetrieval({ hits: 0, note: "second search also missed" }),
    { type: "tool_error", note: "deployment check API timed out" },
    { type: "tool_error", note: "deployment check API timed out again" },
    signalFromValidation({ passed: false, note: "candidate fix failed the safety check" }),
    { type: "self_report", confidence: 0.28, note: "model is not confident enough to proceed unaided" }
  ];

  const trace = signals.map((signal, index) => {
    const policy = runtime.tick(signal);
    return {
      step: index + 1,
      signal,
      state: runtime.state,
      decision: {
        control: policy.control,
        stop: policy.stop,
        retryBudget: policy.retryBudget,
        requireVerification: policy.requireVerification,
        requireConfirmation: policy.requireConfirmation
      }
    };
  });

  printJson("Operating runtime trace", trace);
}

async function runAdapterSignalExperiment(): Promise<void> {
  let previousAction: string | undefined;
  const actions = ["check-deploy-health", "check-deploy-health", "read-runbook"];
  const retrySignals = actions.flatMap((action) => {
    const signal = bestEffortRetrySignal(previousAction, action);
    previousAction = action;
    return signal ? [signal] : [];
  });

  const failingTool = await observeToolCall(
    () => {
      throw new Error("synthetic provider timeout");
    },
    { errorNote: (error) => error instanceof Error ? error.message : String(error) }
  );

  const successfulTool = await observeToolCall(() => ({ release: "safe-to-hold" }), {
    successNote: "tool returned a safe fallback recommendation"
  });

  printJson("Adapter signal extraction", {
    retrySignals,
    failingTool,
    successfulTool
  });
}

async function runLangGraphBenchExperiment(): Promise<void> {
  const scenarios = [
    { id: "doomed-tool", failuresBeforeSuccess: Number.POSITIVE_INFINITY, maxSteps: 40 },
    { id: "transient-tool", failuresBeforeSuccess: 2, maxSteps: 20 },
    { id: "healthy-tool", failuresBeforeSuccess: 0, maxSteps: 20 }
  ];

  const comparisons = [];
  for (const scenario of scenarios) {
    comparisons.push(await compareFakeGraphScenario(scenario));
  }

  printJson("LangGraph adapter fake-graph comparisons", comparisons);

  const pairs = runBattery(BENCH_TASKS);
  console.log("\n## Held-out bench report");
  console.log(formatReport(buildReport(pairs, "report")));
}

async function runProviderExperiment(config: EffectiveConfig, affect: Awaited<ReturnType<typeof runUserAffectExperiment>>): Promise<void> {
  const response = await callProvider(config, {
    system: [
      affect.systemHint,
      "",
      "You are testing whether the runtime policy changes the agent response.",
      "Reply in Chinese. Be concrete, calm, and do not suggest irreversible production changes without confirmation."
    ].join("\n"),
    user: affect.message
  });

  console.log("\n## Provider response under amotion policy");
  console.log(response);
}

async function main(): Promise<void> {
  console.log("amotion functional experiment");
  console.log(`mode: ${selfTest ? "self-test, provider call skipped" : "provider + local experiments"}`);

  const config = withEnvOverrides();
  const affect = await runUserAffectExperiment();
  await runOperatingRuntimeExperiment();
  await runAdapterSignalExperiment();
  await runLangGraphBenchExperiment();

  if (selfTest) {
    console.log("\nProvider call skipped. Fill CONFIG or env vars, then run without --self-test.");
    return;
  }

  assertProviderConfig(config);
  await runProviderExperiment(config, affect);
}

main().catch((error) => {
  console.error("\nExperiment failed:");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
