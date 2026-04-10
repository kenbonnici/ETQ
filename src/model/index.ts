import { applySectionActivation } from "./activation";
import { runScenarioEarly } from "./engines/runScenarioEarly";
import { runScenarioNorm } from "./engines/runScenarioNorm";
import { ValidationMessage } from "./inputSchema";
import { materializeLiquidationPriorityInputs, normalizeInputs } from "./normalization";
import {
  ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS,
  PROPERTY_PLANNED_SELL_YEAR_FIELDS,
  resolvePlannedSaleYears
} from "./plannedSales";
import { EffectiveInputs, FieldState, ModelOutputs, ModelUiState, RawInputValue, ScenarioOutputs } from "./types";
import { clamp } from "./components/finance";
import { resolveProjectionTiming } from "./projectionTiming";
import { validateFieldState, validatePlannedSellYearFields } from "./validate";

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

  const activation = applySectionActivation(fields, {
    ...uiState,
    earlyRetirementAge
  });
  const plannedSaleYears = resolvePlannedSaleYears(
    fields as Partial<Record<string, RawInputValue>>,
    activation.activatedFields["profile.currentAge"],
    activation.activatedFields["planning.lifeExpectancyAge"]
  );
  const effectiveFields = materializeLiquidationPriorityInputs(activation.activatedFields, {
    manualOverrideActive: uiState.manualPropertyLiquidationOrder,
    plannedSaleYears
  });
  const validationMessages: ValidationMessage[] = [
    ...validateFieldState(effectiveFields, {
      properties: PROPERTY_PLANNED_SELL_YEAR_FIELDS.map((fieldId) => fields[fieldId as never]),
      assetsOfValue: ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS.map((fieldId) => fields[fieldId as never])
    }),
    ...validatePlannedSellYearFields(fields as Partial<Record<string, unknown>>, effectiveFields)
  ];

  const normalized = normalizeInputs(effectiveFields, {
    manualOverrideActive: uiState.manualPropertyLiquidationOrder,
    plannedSaleYears
  });
  const projectionTiming = resolveProjectionTiming(new Date(), uiState.projectionMonthOverride ?? null);
  const includeDebug = uiState.debugMode === "test";

  const scenarioNorm = withRetirementSuccess(runScenarioNorm(normalized, projectionTiming, includeDebug), normalized);
  const scenarioEarly = withRetirementSuccess(
    runScenarioEarly(normalized, earlyRetirementAge, projectionTiming, includeDebug),
    normalized
  );

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
