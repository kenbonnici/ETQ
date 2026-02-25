import { applySectionActivation } from "./activation";
import { runScenarioEarly } from "./engines/runScenarioEarly";
import { runScenarioNorm } from "./engines/runScenarioNorm";
import { normalizeInputs } from "./normalization";
import { ModelOutputs, ModelUiState, RawInputs } from "./types";
import { clamp } from "./components/finance";
import { validateRawInputs, ValidationIssue } from "./validate";

export interface RunModelResult {
  outputs: ModelOutputs;
  validationIssues: ValidationIssue[];
  canCollapseDeeperDive: boolean;
  canCollapseFinerDetails: boolean;
}

export function runModel(rawInputs: RawInputs, uiState: ModelUiState): RunModelResult {
  const validationIssues = validateRawInputs(rawInputs);

  const earlyRetirementAge = clamp(Math.round(uiState.earlyRetirementAge), 18, 100);

  const activation = applySectionActivation(rawInputs, {
    ...uiState,
    earlyRetirementAge
  });

  const normalized = normalizeInputs(activation.activatedInputs);

  const scenarioNorm = runScenarioNorm(normalized);
  const scenarioEarly = runScenarioEarly(normalized, earlyRetirementAge);

  const outputs: ModelOutputs = {
    ages: scenarioNorm.points.map((p) => p.age),
    years: scenarioNorm.points.map((p) => p.year),
    cashSeriesEarly: scenarioEarly.cashSeries,
    cashSeriesNorm: scenarioNorm.cashSeries,
    netWorthSeriesEarly: scenarioEarly.netWorthSeries,
    netWorthSeriesNorm: scenarioNorm.netWorthSeries,
    scenarioEarly,
    scenarioNorm
  };

  return {
    outputs,
    validationIssues,
    canCollapseDeeperDive: activation.canCollapseDeeperDive,
    canCollapseFinerDetails: activation.canCollapseFinerDetails
  };
}
