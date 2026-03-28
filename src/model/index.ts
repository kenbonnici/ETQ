import { applySectionActivation } from "./activation";
import { fieldStateToRawInputs } from "./excelAdapter";
import { runScenarioEarly } from "./engines/runScenarioEarly";
import { runScenarioNorm } from "./engines/runScenarioNorm";
import { INPUT_DEFINITION_BY_CELL, ValidationMessage } from "./inputSchema";
import { materializeLiquidationPriorityInputs, normalizeInputs } from "./normalization";
import { ModelOutputs, ModelUiState, FieldState } from "./types";
import { clamp } from "./components/finance";
import { resolveProjectionTiming } from "./projectionTiming";
import { validateRawInputs } from "./validate";

export interface RunModelResult {
  outputs: ModelOutputs;
  validationMessages: ValidationMessage[];
  canCollapseDeeperDive: boolean;
  canCollapseFinerDetails: boolean;
}

export function runModel(fields: FieldState, uiState: ModelUiState): RunModelResult {
  const earlyRetirementAge = clamp(Math.round(uiState.earlyRetirementAge), 18, 100);
  const rawInputs = fieldStateToRawInputs(fields);

  const activation = applySectionActivation(rawInputs, {
    ...uiState,
    earlyRetirementAge
  });
  const effectiveRawInputs = materializeLiquidationPriorityInputs(activation.activatedInputs, {
    manualOverrideActive: uiState.manualPropertyLiquidationOrder
  });
  const validationMessages: ValidationMessage[] = validateRawInputs(effectiveRawInputs).map((message) => ({
    fieldId: INPUT_DEFINITION_BY_CELL[message.cell].fieldId,
    severity: message.severity,
    message: message.message,
    blocksProjection: message.blocksProjection
  }));

  const normalized = normalizeInputs(activation.activatedInputs, {
    manualOverrideActive: uiState.manualPropertyLiquidationOrder
  });
  const projectionTiming = resolveProjectionTiming(new Date(), uiState.projectionMonthOverride ?? null);

  const scenarioNorm = runScenarioNorm(normalized, projectionTiming);
  const scenarioEarly = runScenarioEarly(normalized, earlyRetirementAge, projectionTiming);

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
    validationMessages,
    canCollapseDeeperDive: activation.canCollapseDeeperDive,
    canCollapseFinerDetails: activation.canCollapseFinerDetails
  };
}
