import { runModel } from "../index";
import { rawInputsToFieldState } from "../excelAdapter";
import { compareSeries, compileReport } from "./compare";
import { EXCEL_BASELINE_SPECIMEN } from "./excelBaselineSpecimen";
import { ParityReport } from "./types";

export const CURRENCY_TOLERANCE = 0.01;

export function runSpecimenParity(): ParityReport {
  const fields = rawInputsToFieldState(EXCEL_BASELINE_SPECIMEN.raw_inputs);

  const result = runModel(fields, {
    deeperDiveOpen: true,
    finerDetailsOpen: true,
    earlyRetirementAge: EXCEL_BASELINE_SPECIMEN.early_retirement_age,
    manualPropertyLiquidationOrder: false
  });

  const ages = result.outputs.ages;
  const expected = EXCEL_BASELINE_SPECIMEN.excel_outputs;

  const seriesResults = [
    compareSeries("cashSeriesEarly", ages, result.outputs.cashSeriesEarly, expected.cashSeriesEarly as unknown as number[], CURRENCY_TOLERANCE),
    compareSeries("cashSeriesNorm", ages, result.outputs.cashSeriesNorm, expected.cashSeriesNorm as unknown as number[], CURRENCY_TOLERANCE),
    compareSeries("netWorthSeriesEarly", ages, result.outputs.netWorthSeriesEarly, expected.netWorthSeriesEarly as unknown as number[], CURRENCY_TOLERANCE),
    compareSeries("netWorthSeriesNorm", ages, result.outputs.netWorthSeriesNorm, expected.netWorthSeriesNorm as unknown as number[], CURRENCY_TOLERANCE)
  ];

  return compileReport(EXCEL_BASELINE_SPECIMEN.scenario_name, seriesResults);
}

export function formatParityReport(report: ParityReport): string {
  const lines: string[] = [];
  lines.push(`Scenario: ${report.scenarioName}`);
  lines.push(`Overall pass: ${report.overallPass}`);
  lines.push(`Global max abs delta: ${report.globalMaxAbsDelta}`);

  if (report.firstDivergenceOverall) {
    const d = report.firstDivergenceOverall;
    lines.push(
      `First divergence: ${d.seriesName} at index ${d.index} (age ${d.age}) actual=${d.actual} expected=${d.expected} delta=${d.delta}`
    );
  } else {
    lines.push("First divergence: none");
  }

  for (const s of report.seriesResults) {
    lines.push(
      `${s.seriesName}: pass=${s.pass} compared=${s.comparedPoints} maxAbsDelta=${s.maxAbsDelta}`
    );
    if (s.firstDivergence) {
      const d = s.firstDivergence;
      lines.push(
        `  first: idx=${d.index} age=${d.age} actual=${d.actual} expected=${d.expected} delta=${d.delta}`
      );
    }
  }

  return lines.join("\n");
}
