# Testing Guide

Exact, copy-paste commands to verify amotion yourself. Every command below was
run against this repo; expected output is shown so you can confirm a match.

All commands run from the repository root (`/.../amotion`) unless stated.

---

## 0. Prerequisites (one time)

- **Node.js 22** (CI uses 22; Node 18+ works locally).
- **pnpm via Corepack** — this repo pins `pnpm@9.15.0` in `package.json`, and
  the root scripts call `corepack pnpm`. Enable it once:

```sh
corepack enable
```

Install all workspace dependencies:

```sh
corepack pnpm install
```

> If you already have a global `pnpm`, you may drop the `corepack ` prefix from
> every command (e.g. `pnpm install`). Both work. The doc uses `corepack pnpm`
> because that is exactly what CI runs.

The operating-runtime tests need **no model downloads and no network** — they
are pure and deterministic. (Only the optional user-affect analyzer would pull
a Hugging Face model, and nothing in this guide triggers it.)

---

## 1. Full verification (what CI runs)

This is the single most important sequence. It mirrors `.github/workflows/ci.yml`
exactly: typecheck, then test, then build.

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

**Expected:** all three exit with code `0`. `test` runs every package; the
totals you should see are in the table below.

---

## 2. Run all tests

```sh
corepack pnpm test
```

**Expected per-package result (69 tests total):**

| Package | Directory | Test files | Tests |
|---|---|---:|---:|
| `amotion` | `packages/core` | 3 | 46 |
| `@amotion/adapters` | `packages/adapters` | 1 | 7 |
| `@amotion/adapters-langgraph` | `packages/adapters-langgraph` | 2 | 12 |
| `@amotion/eval` | `evals` | 1 | 4 |
| `@amotion/basic-node` | `examples/basic-node` | 0 | — (no test files) |
| `@amotion/agent-loop` | `examples/agent-loop` | 0 | — (no test files) |
| `@amotion/playground` | `examples/playground` | 0 | — (no test files) |

"No test files found, exiting with code 0" for the three examples is expected
and is **not** a failure.

---

## 3. Run one package's tests

Use `--filter <package-name>` (the npm name, not the folder):

```sh
corepack pnpm --filter amotion test                    # core: 46 tests
corepack pnpm --filter @amotion/adapters test          # 7 tests
corepack pnpm --filter @amotion/adapters-langgraph test # 12 tests
corepack pnpm --filter @amotion/eval test              # 4 tests   (folder is evals/)
```

---

## 4. Run a single file, a single test, or watch mode

`exec vitest` lets you pass arguments straight to the test runner.

Single file:

```sh
corepack pnpm --filter amotion exec vitest run test/agent-runtime.test.ts
```
**Expected:** `Test Files 1 passed (1)`, `Tests 26 passed (26)`.

Single test by name (substring match against the `it(...)` titles):

```sh
corepack pnpm --filter amotion exec vitest run -t "circuit-breaker"
```
**Expected:** `Tests 2 passed | 44 skipped (46)`.

Watch mode (re-runs on file change; press `q` to quit):

```sh
corepack pnpm --filter amotion exec vitest
```

---

## 5. See amotion working live (the demo)

This runs the same control loop twice — naive vs. runtime-governed — on a flaky
tool:

```sh
corepack pnpm --filter @amotion/agent-loop dev
```

**Expected output (exact):**

```text
=== permanently broken tool ===
naive    : { outcome: 'exhausted-cap', steps: 40, escalated: false }
governed : {
  outcome: 'abort (5 consecutive failures hit the circuit-breaker)',
  steps: 5,
  escalated: true
}

=== transient failure (recovers after 2) ===
naive    : { outcome: 'done', steps: 3, escalated: false }
governed : { outcome: 'done', steps: 3, escalated: false }
```

What it proves: on a doomed tool the naive loop burns all 40 steps; the governed
loop escalates and aborts at 5. On a recoverable failure both finish in 3 steps
— amotion does **not** over-react.

---

## 6. The A/B credibility test (numbers, not anecdotes)

The comparative bench is asserted in a test. Run just that file:

```sh
corepack pnpm --filter @amotion/adapters-langgraph exec vitest run test/fake-bench.test.ts
```

**Expected:** `Test Files 1 passed (1)`, `Tests 2 passed (2)`.

The assertions encode the headline result, so a pass means these hold exactly:

- Doomed tool, `maxSteps: 40` → naive `toolCalls: 40` / `step_exhausted`;
  governed `toolCalls: 5` / `aborted`; **35 avoided tool calls**, escalated.
- Transient failure (recovers after 2) → both `done` in 3 calls;
  `successRegressed: false`.

---

## 7. Trace-replay eval

The deterministic eval replays saved signal traces (`OperatingEvalCase`) through
`AgentRuntime` and asserts the policy timeline + final state:

```sh
corepack pnpm --filter @amotion/eval test
```
**Expected:** `Tests 4 passed (4)`.

---

## 8. Write your own quick check (no test framework)

The whole operating runtime is reachable from the public `amotion` package, so
you can poke it with a one-off script.

Create `examples/agent-loop/scratch.mjs`:

```js
import { AgentRuntime } from "amotion";

const rt = new AgentRuntime();
for (const type of ["tool_error", "tool_error", "tool_error", "tool_error", "tool_error"]) {
  const p = rt.tick({ type });
  console.log(type, "->", p.control, "stop=" + p.stop);
}
```

Run it (the `exec` runs from inside the package folder, so pass the bare
filename):

```sh
corepack pnpm --filter @amotion/agent-loop exec tsx scratch.mjs
```

**Expected output (exact):**

```text
tool_error -> verify stop=false
tool_error -> verify stop=false
tool_error -> escalate stop=false
tool_error -> escalate stop=false
tool_error -> abort stop=true
```

That is the control ladder firing live: verify → escalate → abort at the fifth
consecutive failure. Delete the file when done:

```sh
rm examples/agent-loop/scratch.mjs
```

To assert your own scenarios formally instead, add `it(...)` cases to
`packages/core/test/agent-runtime.test.ts` (state/policy units) or a new
`OperatingEvalCase` fixture for the eval replay; the shapes are documented in
`docs/OPERATING_RUNTIME.md`.

---

## 9. Typecheck and build individually

```sh
corepack pnpm typecheck                                 # all packages
corepack pnpm --filter amotion typecheck                # one package
corepack pnpm --filter amotion build                    # build core (tsup)
corepack pnpm --filter @amotion/adapters-langgraph build
```

**Expected:** exit code `0`, no `error TS...` lines.

---

## 9b. Full A/B bench harness (`@amotion/bench`)

A tau-bench-style task battery comparing a naive loop vs. an operating-runtime-
governed loop, with a held-out `report` split.

Deterministic assertions (CI-safe, no network):

```sh
corepack pnpm --filter @amotion/bench test
```
**Expected:** `Tests 8 passed (8)`.

Printed comparison tables (build core once so the script can resolve `amotion`):

```sh
corepack pnpm --filter amotion build
corepack pnpm --filter @amotion/bench dev
```

**Expected highlights on the held-out `report` set:** `success regression rate
0%`, `over-abort rate 0%`, `avoided tool calls (avg)` ~12, governed
`step-exhaustion rate 0%`. The `calibration` set deliberately shows a non-zero
over-abort rate — that is the set where thresholds would be tuned, kept
separate so the reported numbers stay honest.

## 10. Troubleshooting

- **`pnpm: command not found`** → run `corepack enable` (step 0), or install
  pnpm globally and use plain `pnpm`.
- **Lockfile error on install in CI mode** → use
  `corepack pnpm install --frozen-lockfile` only when the lockfile is committed
  and current; locally just `corepack pnpm install`.
- **A test "fails" only in an example package** → examples have no test files;
  "No test files found, exiting with code 0" is success, not failure.
- **Network/model errors** → nothing in this guide needs them. If you see a
  Hugging Face/ONNX download attempt, you are exercising the optional
  user-affect analyzer, which is outside the operating-runtime test path.
