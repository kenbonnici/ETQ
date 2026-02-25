import { ParityReport, SeriesDivergence, SeriesParityResult } from "./types";

export function compareSeries(
  seriesName: string,
  ages: number[],
  actual: number[],
  expected: number[],
  tolerance: number
): SeriesParityResult {
  const n = Math.min(actual.length, expected.length, ages.length);
  let maxAbsDelta = 0;
  let firstDivergence: SeriesDivergence | null = null;

  for (let i = 0; i < n; i += 1) {
    const delta = Math.abs(actual[i] - expected[i]);
    if (delta > maxAbsDelta) maxAbsDelta = delta;
    if (firstDivergence === null && delta > tolerance) {
      firstDivergence = {
        index: i,
        age: ages[i],
        actual: actual[i],
        expected: expected[i],
        delta
      };
    }
  }

  return {
    seriesName,
    maxAbsDelta,
    firstDivergence,
    comparedPoints: n,
    tolerance,
    pass: firstDivergence === null
  };
}

export function compileReport(scenarioName: string, seriesResults: SeriesParityResult[]): ParityReport {
  let globalMaxAbsDelta = 0;
  let firstOverall: (SeriesDivergence & { seriesName: string }) | null = null;

  for (const s of seriesResults) {
    if (s.maxAbsDelta > globalMaxAbsDelta) globalMaxAbsDelta = s.maxAbsDelta;
    if (!firstOverall && s.firstDivergence) {
      firstOverall = { seriesName: s.seriesName, ...s.firstDivergence };
    }
  }

  return {
    scenarioName,
    overallPass: seriesResults.every((s) => s.pass),
    globalMaxAbsDelta,
    firstDivergenceOverall: firstOverall,
    seriesResults
  };
}
