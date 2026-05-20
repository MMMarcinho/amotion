# API Contract & Stability

What callers may depend on, and how it will change before v1. Two surfaces are
kept deliberately separate:

- **Core operating API** — the agent operating runtime (primary).
- **Optional user-affect API** — the emotion analyzer path (secondary).

Do not collapse them. A consumer may use the operating runtime with no
dependency on the affect path, local models, or Hugging Face downloads.

## Stability tiers

- **Stable candidate** — intended to be frozen at v1. Changes are additive or
  follow the compatibility rules below.
- **Experimental** — shape or values may change pre-v1 without a major bump.
  Pin behavior via the eval suite, not via these symbols directly.

## Core operating API

| Symbol | Tier | Notes |
|---|---|---|
| `ControlDecision` union | **Stable candidate** | Adding a member is breaking for exhaustive switches; treat additions as major. |
| `OperatingPolicy.control` / `.stop` | **Stable candidate** | The decision and the hard-stop flag are the contract surface. |
| `OperatingPolicy.requireVerification` / `.requireConfirmation` | **Stable candidate** | Gating semantics (see OPERATING_RUNTIME.md). |
| `AgentRuntime` methods (`observe`, `decide`, `tick`, `reset`, `state`) | **Stable candidate** | Method surface frozen; return *values* may gain fields additively. |
| `AgentSignalType` union | **Stable candidate** | New signal types are additive/minor; removal/rename is major. |
| `AgentSignal` shape (`type`, `weight`, `confidence`, `note`) | **Stable candidate** | New optional fields are additive. |
| `OperatingEvalCase` / `ExpectedStep` / `ExpectedFinal` / `OperatingEvalReport` | **Stable candidate** | The eval contract; B builds the runner against this. |
| `OperatingPolicy` advisory fields (`retryBudget`, `autonomy`, `toolUsageThreshold`, `planning.*`) | **Experimental** | Hints; scales and formulas may be recalibrated. |
| `OperatingState` numeric dimensions & scales | **Experimental** | Smoothed values may be recalibrated; assert ranges, not points. |
| `OperatingState` counters (`consecutiveFailures`, `stepCount`, `budgetUsed`) | **Stable candidate** | Exact semantics are contractual. |
| `OperatingConfig` (decay, rest, effects, thresholds, retryBudget) | **Experimental** | Tunable; calibrated by eval. `maxConsecutiveFailures` is a near-stable safety bound. |
| `ExternalAffectSignal` shape | **Experimental** | The affect→caution mapping may change; the *boundary* (affect cannot hard-stop) is **Stable**. |

## Optional user-affect API

| Symbol | Tier | Notes |
|---|---|---|
| `Amotion`, `process()` | **Experimental** | Convenience wrapper for the affect path. |
| `EmotionSignal` / `AffectiveState` / `RuntimePolicy` | **Experimental** | Predate the pivot; subject to revision as affect becomes a caution signal. |
| `TransformerEmotionAnalyzer`, `RuleAnalyzer`, `HybridAnalyzer` | **Experimental** | Analyzer implementations; local-model details may change. |
| `PolicyConfig` / `DEFAULT_POLICY_CONFIG` | **Experimental** | Affect→policy mapping knobs. |
| `policyToSystemHint` | **Experimental** | Prompt-hint helper. |

## Compatibility rules (pre-v1)

1. **Additive is minor.** New signal types, new optional signal/policy fields,
   new config keys with safe defaults.
2. **Removing or renaming** a `ControlDecision`, `AgentSignalType`, or a
   stable-candidate field is **major**.
3. **Changing the *meaning*** of a stable decision (e.g. what `abort`
   guarantees) is **major**, even if the type is unchanged.
4. **Recalibrating experimental values** (effect deltas, thresholds, dimension
   scales) is **not** a breaking change. Suites must assert direction and
   bounds, never tuned constants.
5. The **affect boundary** (external affect cannot produce a hard stop or an
   `abort`/`escalate`) is invariant across all versions.

## Toward v1

v1 freezes the **Stable candidate** rows above once the eval track (v0.3–v0.5)
has exercised them on real traces and at least one executable adapter. The
experimental numeric layer stays free to move until that evidence exists.
