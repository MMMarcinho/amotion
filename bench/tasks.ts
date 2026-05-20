import type { BenchTask } from "./harness";

const INF = Number.POSITIVE_INFINITY;

/**
 * The deterministic task battery.
 *
 * `report` tasks are the held-out set the headline numbers are read from.
 * `calibration` tasks are where thresholds may be tuned, so the success /
 * over-abort claims on `report` stay honest (no tuning on the reported set).
 *
 * Each kind targets a specific guardrail:
 * - doomed / doomed_validation: governance SHOULD interrupt early.
 * - healthy / transient / retrieval / validation: governance SHOULD NOT
 *   interrupt — these are solvable and test the over-abort rate.
 */
export const BENCH_TASKS: BenchTask[] = [
  // --- report set ---
  { id: "doomed-tool", kind: "doomed", tag: "report", maxSteps: 40, missesBeforeHit: 0, primaryFailuresBeforeSuccess: INF, validationFailures: 0 },
  { id: "doomed-validation", kind: "doomed_validation", tag: "report", maxSteps: 40, missesBeforeHit: 0, primaryFailuresBeforeSuccess: 0, validationFailures: INF },
  { id: "healthy-first-try", kind: "healthy", tag: "report", maxSteps: 20, missesBeforeHit: 0, primaryFailuresBeforeSuccess: 0, validationFailures: 0 },
  { id: "transient-2-failures", kind: "transient", tag: "report", maxSteps: 20, missesBeforeHit: 0, primaryFailuresBeforeSuccess: 2, validationFailures: 0 },
  { id: "retrieval-2-misses", kind: "retrieval", tag: "report", maxSteps: 20, missesBeforeHit: 2, primaryFailuresBeforeSuccess: 0, validationFailures: 0 },
  { id: "validation-2-fails", kind: "validation", tag: "report", maxSteps: 20, missesBeforeHit: 0, primaryFailuresBeforeSuccess: 0, validationFailures: 2 },

  // --- calibration set ---
  { id: "doomed-tool-cal", kind: "doomed", tag: "calibration", maxSteps: 30, missesBeforeHit: 0, primaryFailuresBeforeSuccess: INF, validationFailures: 0 },
  { id: "healthy-cal", kind: "healthy", tag: "calibration", maxSteps: 15, missesBeforeHit: 0, primaryFailuresBeforeSuccess: 0, validationFailures: 0 },
  { id: "transient-3-failures-cal", kind: "transient", tag: "calibration", maxSteps: 20, missesBeforeHit: 0, primaryFailuresBeforeSuccess: 3, validationFailures: 0 },
  { id: "retrieval-3-misses-cal", kind: "retrieval", tag: "calibration", maxSteps: 20, missesBeforeHit: 3, primaryFailuresBeforeSuccess: 0, validationFailures: 0 }
];
