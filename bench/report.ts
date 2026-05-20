import { BENCH_TASKS } from "./tasks";
import { buildReport, formatReport, runBattery } from "./metrics";

const pairs = runBattery(BENCH_TASKS);

for (const scope of ["all", "report", "calibration"] as const) {
  console.log(formatReport(buildReport(pairs, scope)));
  console.log();
}
