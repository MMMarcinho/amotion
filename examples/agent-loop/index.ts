import { AgentRuntime, type AgentSignal } from "amotion";

/**
 * Demonstrates the agent-internal-state runtime governing a real control loop.
 *
 * The task: call a tool that we pretend keeps failing. We run the SAME loop
 * twice — once naively (blind retry up to a hard cap) and once governed by
 * AgentRuntime — and compare what each one does. This is the miniature version
 * of the end-to-end A/B in EVALUATION.md.
 */

const HARD_CAP = 40;

// A flaky tool. `failuresBeforeSuccess = Infinity` means permanently broken.
function makeTool(failuresBeforeSuccess: number) {
  let calls = 0;
  return (): { ok: boolean } => {
    calls += 1;
    return { ok: calls > failuresBeforeSuccess };
  };
}

function runNaive(tool: () => { ok: boolean }) {
  let steps = 0;
  for (let i = 0; i < HARD_CAP; i += 1) {
    steps += 1;
    if (tool().ok) return { outcome: "done", steps, escalated: false };
  }
  return { outcome: "exhausted-cap", steps, escalated: false };
}

function runGoverned(tool: () => { ok: boolean }) {
  const rt = new AgentRuntime();
  let steps = 0;
  let escalated = false;

  for (let i = 0; i < HARD_CAP; i += 1) {
    steps += 1;
    const ok = tool().ok;
    const signal: AgentSignal = ok ? { type: "tool_success" } : { type: "tool_error" };
    const policy = rt.tick(signal);

    if (ok) return { outcome: "done", steps, escalated };

    if (policy.control === "escalate") escalated = true;
    if (policy.stop) {
      return { outcome: `abort (${policy.reason})`, steps, escalated };
    }
  }
  return { outcome: "exhausted-cap", steps, escalated };
}

function report(title: string, failuresBeforeSuccess: number) {
  console.log(`\n=== ${title} ===`);
  console.log("naive    :", runNaive(makeTool(failuresBeforeSuccess)));
  console.log("governed :", runGoverned(makeTool(failuresBeforeSuccess)));
}

// Permanently broken dependency: the naive loop burns the whole cap; the
// governed loop escalates to a human and aborts after a few failures.
report("permanently broken tool", Number.POSITIVE_INFINITY);

// Transient failure: both finish, and the governed loop does not over-react.
report("transient failure (recovers after 2)", 2);
