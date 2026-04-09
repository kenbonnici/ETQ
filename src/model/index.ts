import { applySectionActivation } from "./activation";
import { fieldStateToRawInputs } from "./excelAdapter";
import { runScenarioEarly } from "./engines/runScenarioEarly";
import { runScenarioNorm } from "./engines/runScenarioNorm";
import { INPUT_DEFINITION_BY_CELL, ValidationMessage } from "./inputSchema";
import { materializeLiquidationPriorityInputs, normalizeInputs } from "./normalization";
import {
  ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS,
  PROPERTY_PLANNED_SELL_YEAR_FIELDS,
  resolvePlannedSaleYears
} from "./plannedSales";
import { EffectiveInputs, ModelOutputs, ModelUiState, FieldState, RawInputValue, ScenarioOutputs } from "./types";
import { clamp } from "./components/finance";
import { resolveProjectionTiming } from "./projectionTiming";
import { validatePlannedSellYearFields, validateRawInputs } from "./validate";

export interface RunModelResult {
  outputs: ModelOutputs;
  validationMessages: ValidationMessage[];
  canCollapseMajorFutureEvents: boolean;
  canCollapseAdvancedAssumptions: boolean;
}

const RETIREMENT_SUCCESS_EPSILON = 1e-6;

function withRetirementSuccess(scenario: ScenarioOutputs, inputs: EffectiveInputs): ScenarioOutputs {
  const cashBufferSatisfied = scenario.cashSeries.every((cash) => cash + RETIREMENT_SUCCESS_EPSILON >= inputs.cashBuffer);
  const finalNetWorth = scenario.netWorthSeries[scenario.netWorthSeries.length - 1] ?? Number.NEGATIVE_INFINITY;
  const legacySatisfied = finalNetWorth + RETIREMENT_SUCCESS_EPSILON >= inputs.legacyAmount;

  return {
    ...scenario,
    retirementSuccessful: cashBufferSatisfied && legacySatisfied
  };
}

export function runModel(fields: FieldState, uiState: ModelUiState): RunModelResult {
  const earlyRetirementAge = clamp(Math.round(uiState.earlyRetirementAge), 18, 100);
  const rawInputs = fieldStateToRawInputs(fields);

  const activation = applySectionActivation(rawInputs, {
    ...uiState,
    earlyRetirementAge
  });
  const plannedSaleYears = resolvePlannedSaleYears(fields as Partial<Record<string, RawInputValue>>, activation.activatedInputs.B4, activation.activatedInputs.B255);
  const effectiveRawInputs = materializeLiquidationPriorityInputs(activation.activatedInputs, {
    manualOverrideActive: uiState.manualPropertyLiquidationOrder,
    plannedSaleYears
  });
  const validationMessages: ValidationMessage[] = [
    ...validateRawInputs(effectiveRawInputs, {
      properties: PROPERTY_PLANNED_SELL_YEAR_FIELDS.map((fieldId) => fields[fieldId as never]),
      assetsOfValue: ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS.map((fieldId) => fields[fieldId as never])
    }).map((message) => ({
      fieldId: INPUT_DEFINITION_BY_CELL[message.cell].fieldId,
      severity: message.severity,
      message: message.message,
      blocksProjection: message.blocksProjection
    })),
    ...validatePlannedSellYearFields(fields as Partial<Record<string, unknown>>, effectiveRawInputs)
  ];

  const normalized = normalizeInputs(activation.activatedInputs, {
    manualOverrideActive: uiState.manualPropertyLiquidationOrder,
    plannedSaleYears
  });
  const projectionTiming = resolveProjectionTiming(new Date(), uiState.projectionMonthOverride ?? null);

  const scenarioNorm = withRetirementSuccess(runScenarioNorm(normalized, projectionTiming), normalized);
  const scenarioEarly = withRetirementSuccess(runScenarioEarly(normalized, earlyRetirementAge, projectionTiming), normalized);

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
    canCollapseMajorFutureEvents: activation.canCollapseMajorFutureEvents,
    canCollapseAdvancedAssumptions: activation.canCollapseAdvancedAssumptions
  };
}
