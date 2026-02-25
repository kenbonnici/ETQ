export interface SeriesDivergence {
  index: number;
  age: number;
  actual: number;
  expected: number;
  delta: number;
}

export interface SeriesParityResult {
  seriesName: string;
  maxAbsDelta: number;
  firstDivergence: SeriesDivergence | null;
  comparedPoints: number;
  tolerance: number;
  pass: boolean;
}

export interface ParityReport {
  scenarioName: string;
  overallPass: boolean;
  globalMaxAbsDelta: number;
  firstDivergenceOverall: (SeriesDivergence & { seriesName: string }) | null;
  seriesResults: SeriesParityResult[];
}
