import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runModel } from "../../src/model";
import { createEmptyFieldState, fieldStateToRawInputs, rawInputsToFieldState } from "../../src/model/excelAdapter";
import { FIELD_ID_TO_CELL } from "../../src/model/fieldRegistry";
import { normalizeInputs } from "../../src/model/normalization";
import { EXCEL_BASELINE_SPECIMEN } from "../../src/model/parity/excelBaselineSpecimen";
import { runSpecimenParity } from "../../src/model/parity/runSpecimenParity";
import { FieldState } from "../../src/model/types";
import { INPUT_DEFINITIONS } from "../../src/ui/inputDefinitions";
import {
  buildPropertyLiquidationAssignments,
  buildPropertyLiquidationBuckets,
  buildPropertyLiquidationOrder,
  buildTimelineMilestones,
  deriveRuntimeVisibilityState,
  fieldVisible,
  hasExplicitPropertyLiquidationPreferences,
  hasRetireCheckEssentialErrors,
  isOutOfRangeLiquidationRank,
  isDuplicateLiquidationRank,
  RuntimeVisibilityState,
  shouldRerenderOnInput,
  syncManualPropertyOrderForNewProperties
} from "../../src/ui/runtimeRules";
import {
  ASSET_OF_VALUE_RUNTIME_GROUPS,
  DEPENDENT_RUNTIME_GROUPS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  INCOME_EVENT_RUNTIME_GROUPS,
  LIQUIDATION_ASSET_RUNTIME_GROUPS,
  OTHER_LOAN_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS,
  STOCK_MARKET_CRASH_RUNTIME_GROUPS
} from "../../src/ui/runtimeFields";

const SPECIMEN_FIELDS = rawInputsToFieldState(EXCEL_BASELINE_SPECIMEN.raw_inputs);
const SPECIMEN_UI_STATE = {
  deeperDiveOpen: true,
  finerDetailsOpen: true,
  earlyRetirementAge: EXCEL_BASELINE_SPECIMEN.early_retirement_age,
  manualPropertyLiquidationOrder: false,
  projectionMonthOverride: EXCEL_BASELINE_SPECIMEN.projection_month_override ?? null
};
const DEFAULT_VISIBILITY: RuntimeVisibilityState = {
  visibleDependents: 1,
  visibleProperties: 1,
  visibleAssetsOfValue: 1,
  visibleIncomeEvents: 1,
  visibleExpenseEvents: 1,
  visibleStockMarketCrashes: 1
};
const LEGACY_AWARE_RETIREMENT_AGE = 51;

function cloneFields(fields: FieldState): FieldState {
  return { ...fields };
}

test("Excel adapter round-trips and specimen parity still passes", () => {
  assert.deepEqual(fieldStateToRawInputs(SPECIMEN_FIELDS), EXCEL_BASELINE_SPECIMEN.raw_inputs);
  assert.equal(SPECIMEN_FIELDS["dependents.04.displayName"], "Stephen");
  assert.equal(SPECIMEN_FIELDS["dependents.05.displayName"], "Jane");
  assert.equal(runSpecimenParity().overallPass, true);
});

test("specimen early parity depends on the workbook early-retirement age, not statutory age", () => {
  const expectedEarly = EXCEL_BASELINE_SPECIMEN.excel_outputs.cashSeriesEarly as unknown as number[];
  const correct = runModel(SPECIMEN_FIELDS, SPECIMEN_UI_STATE);
  const forcedStatutory = runModel(SPECIMEN_FIELDS, {
    ...SPECIMEN_UI_STATE,
    earlyRetirementAge: Number(SPECIMEN_FIELDS[RUNTIME_FIELDS.statutoryRetirementAge])
  });

  const maxAbsEarlyDeltaWhenForcedToStatutory = Math.max(...forcedStatutory.outputs.cashSeriesEarly.map(
    (value, idx) => Math.abs(value - expectedEarly[idx])
  ));

  assert.equal(correct.outputs.cashSeriesNorm.length, forcedStatutory.outputs.cashSeriesNorm.length);
  assert.deepEqual(forcedStatutory.outputs.cashSeriesNorm, correct.outputs.cashSeriesNorm);
  assert.equal(maxAbsEarlyDeltaWhenForcedToStatutory > 1_000, true);
});

test("input definitions preserve row order and derive cells from semantic field ids", () => {
  assert.deepEqual(
    INPUT_DEFINITIONS.map((def) => def.row),
    [
      4, 6, 8, 10, 12, 15, 16, 17, 19, 21, 23, 25, 33, 34, 35, 38, 39, 40, 43, 44, 45, 48, 49, 50, 53, 54,
      55, 60, 61, 62, 65, 66, 67, 70, 71, 72, 75, 76, 77, 80, 81, 82, 87, 88, 89, 92, 93, 94, 97, 98, 99,
      102, 103, 104, 107, 108, 109, 113, 114, 115, 116, 117, 119, 120, 124, 127, 128, 129, 132, 133, 134,
      137, 138, 139, 142, 143, 144, 147, 148, 149, 152, 153, 154, 157, 158, 159, 162, 163, 164, 167, 168,
      169, 172, 173, 174, 177, 178, 179, 184, 185, 186, 189, 190, 191, 194, 195, 196, 201, 202, 203, 206,
      207, 208, 211, 212, 213, 218, 219, 220, 223, 224, 225, 228, 229, 230, 233, 234, 235, 238, 239, 240,
      244, 247, 248, 249, 251, 252, 253, 255, 257, 259, 261, 263, 265, 267, 269, 271, 273, 275, 277, 280,
      281, 282, 283, 284, 285, 286, 287, 288, 289
    ]
  );

  for (const def of INPUT_DEFINITIONS) {
    assert.equal(def.cell, FIELD_ID_TO_CELL[def.fieldId]);
  }
});

test("blank legacy normalizes to zero and specimen parity captures the shifted workbook cells", () => {
  const blankFields = createEmptyFieldState();

  assert.equal(normalizeInputs(fieldStateToRawInputs(blankFields)).legacyAmount, 0);
  assert.equal(SPECIMEN_FIELDS[RUNTIME_FIELDS.legacyAmount], 1_000_000);
  assert.equal(SPECIMEN_FIELDS[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField], 10);
  assert.equal(SPECIMEN_FIELDS[PROPERTY_RUNTIME_GROUPS[4].liquidationRankField], 6);
  assert.equal(SPECIMEN_FIELDS[ASSET_OF_VALUE_RUNTIME_GROUPS[0].liquidationRankField], 3);
  assert.equal(SPECIMEN_FIELDS[ASSET_OF_VALUE_RUNTIME_GROUPS[4].liquidationRankField], 5);
});

test("retirement success requires both the cash buffer and the end-age legacy target", () => {
  const workbookCachedAge = runModel(SPECIMEN_FIELDS, SPECIMEN_UI_STATE);
  assert.equal(workbookCachedAge.outputs.scenarioEarly.retirementSuccessful, false);

  const legacyAwareSuccess = runModel(SPECIMEN_FIELDS, {
    ...SPECIMEN_UI_STATE,
    earlyRetirementAge: LEGACY_AWARE_RETIREMENT_AGE
  });
  assert.equal(legacyAwareSuccess.outputs.scenarioEarly.retirementSuccessful, true);

  const oneYearEarlier = runModel(SPECIMEN_FIELDS, {
    ...SPECIMEN_UI_STATE,
    earlyRetirementAge: LEGACY_AWARE_RETIREMENT_AGE - 1
  });
  assert.equal(oneYearEarlier.outputs.scenarioEarly.retirementSuccessful, false);

  const higherLegacyFields = cloneFields(SPECIMEN_FIELDS);
  const finalNetWorth = legacyAwareSuccess.outputs.scenarioEarly.netWorthSeries[
    legacyAwareSuccess.outputs.scenarioEarly.netWorthSeries.length - 1
  ] ?? 0;
  higherLegacyFields[RUNTIME_FIELDS.legacyAmount] = finalNetWorth + 1;

  const legacyShortfall = runModel(higherLegacyFields, {
    ...SPECIMEN_UI_STATE,
    earlyRetirementAge: LEGACY_AWARE_RETIREMENT_AGE
  });
  assert.equal(legacyShortfall.outputs.scenarioEarly.retirementSuccessful, false);
});

test("validation and retire-check gating still key off semantic core fields", () => {
  const fields = cloneFields(SPECIMEN_FIELDS);
  fields[RUNTIME_FIELDS.currentAge] = null;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = null;

  const result = runModel(fields, SPECIMEN_UI_STATE);

  assert.equal(
    result.validationMessages.some((message) => message.fieldId === RUNTIME_FIELDS.currentAge && message.blocksProjection),
    true
  );
  assert.equal(
    result.validationMessages.some((message) => message.fieldId === RUNTIME_FIELDS.annualLivingExpenses && message.severity === "error"),
    true
  );
  assert.equal(hasRetireCheckEssentialErrors(result.validationMessages), true);
});

test("visibility rules stay semantic for dependents, properties, and loans", () => {
  const fields = createEmptyFieldState();

  assert.equal(fieldVisible(fields, DEPENDENT_RUNTIME_GROUPS[0].annualCostField, DEFAULT_VISIBILITY), false);
  fields[DEPENDENT_RUNTIME_GROUPS[0].nameField] = "Chris";
  assert.equal(fieldVisible(fields, DEPENDENT_RUNTIME_GROUPS[0].annualCostField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanBalanceField, DEFAULT_VISIBILITY), false);
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Harbour Flat";
  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanBalanceField, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), false);
  fields[PROPERTY_RUNTIME_GROUPS[0].loanBalanceField] = 100_000;
  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField, DEFAULT_VISIBILITY), false);
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Jewelry";
  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), false);
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField] = 2_500;
  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, OTHER_LOAN_FIELDS.interestRateAnnual, DEFAULT_VISIBILITY), false);
  fields[OTHER_LOAN_FIELDS.balance] = 2_000;
  assert.equal(fieldVisible(fields, OTHER_LOAN_FIELDS.interestRateAnnual, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, POST_RETIREMENT_INCOME_FIELDS.fromAge, DEFAULT_VISIBILITY), false);
  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 12_000;
  assert.equal(fieldVisible(fields, POST_RETIREMENT_INCOME_FIELDS.fromAge, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField, DEFAULT_VISIBILITY), false);
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 100_000;
  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField, DEFAULT_VISIBILITY), true);
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear() + 1;
  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, HOME_FIELDS.housingRentAnnual, DEFAULT_VISIBILITY), true);
  fields[HOME_FIELDS.homeValue] = 500_000;
  assert.equal(fieldVisible(fields, HOME_FIELDS.housingRentAnnual, DEFAULT_VISIBILITY), false);
});

test("property liquidation order preserves duplicate-rank guardrails and only appends ranks for newly activated properties", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "P1";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "P2";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;

  const active = LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 2);
  const defaultOrder = buildPropertyLiquidationOrder(fields, active, false);
  assert.deepEqual(defaultOrder.map((group) => group.idx), [1, 0]);

  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 2;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;

  assert.equal(
    isDuplicateLiquidationRank(fields, PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 1),
    true
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 6),
    false
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 10),
    false
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 11),
    true
  );
  assert.equal(
    isOutOfRangeLiquidationRank(RUNTIME_FIELDS.statutoryRetirementAge, 65),
    false
  );
  assert.equal(
    isOutOfRangeLiquidationRank(RUNTIME_FIELDS.currentAge, 48),
    false
  );

  fields[PROPERTY_RUNTIME_GROUPS[2].nameField] = "P3";
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 220_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].nameField] = "P4";
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 80_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].nameField] = "P5";
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 120_000;
  const appended = syncManualPropertyOrderForNewProperties(fields, new Set([0, 1]), true);
  assert.deepEqual(appended, [
    { fieldId: PROPERTY_RUNTIME_GROUPS[2].liquidationRankField, value: 3 },
    { fieldId: PROPERTY_RUNTIME_GROUPS[3].liquidationRankField, value: 4 },
    { fieldId: PROPERTY_RUNTIME_GROUPS[4].liquidationRankField, value: 5 }
  ]);

  for (const update of appended) {
    fields[update.fieldId] = update.value;
  }

  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = null;
  assert.deepEqual(syncManualPropertyOrderForNewProperties(fields, new Set([0, 1, 2, 3, 4]), true), []);

  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 3;
  fields[PROPERTY_RUNTIME_GROUPS[3].liquidationRankField] = 4;
  fields[PROPERTY_RUNTIME_GROUPS[4].liquidationRankField] = 5;
  const manualOrder = buildPropertyLiquidationOrder(fields, LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 5), true);
  assert.deepEqual(manualOrder.map((group) => group.idx), [1, 0, 2, 3, 4]);
  assert.equal(hasExplicitPropertyLiquidationPreferences(fields), true);

  const assignments = buildPropertyLiquidationAssignments(manualOrder, LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 5));
  assert.deepEqual(
    assignments.map((assignment) => assignment.value),
    [0, 0, 0, 0, 0, 1, 2, 3, 4, 5]
  );
});

test("auto liquidation order re-sorts from current property values after repeated edits", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "P1";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "P2";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].nameField] = "P3";
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 220_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].nameField] = "P4";
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 80_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].nameField] = "P5";
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 120_000;

  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 5;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 3;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 4;
  fields[PROPERTY_RUNTIME_GROUPS[3].liquidationRankField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[4].liquidationRankField] = 2;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [5, 3, 4, 1, 2, 0, 0, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 100_000;
  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [2, 4, 5, 1, 3, 0, 0, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 50_000;
  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [3, 5, 1, 2, 4, 0, 0, 0, 0, 0]
  );
});

test("manual liquidation order stays fixed across value edits and blank entries still mean never sell", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "P1";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "P2";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].nameField] = "P3";
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 220_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].nameField] = "P4";
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 80_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].nameField] = "P5";
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 120_000;

  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 2;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = null;
  fields[PROPERTY_RUNTIME_GROUPS[3].liquidationRankField] = null;
  fields[PROPERTY_RUNTIME_GROUPS[4].liquidationRankField] = null;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 50_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 400_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 100_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 200_000;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  );
  assert.deepEqual(
    buildPropertyLiquidationOrder(fields, LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 5), true).map((group) => group.idx),
    [1, 0, 2, 3, 4]
  );
});

test("manual liquidation buckets separate sellable and never-sell properties", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "P1";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "P2";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].nameField] = "P3";
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 220_000;

  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 2;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 0;

  const buckets = buildPropertyLiquidationBuckets(fields, PROPERTY_RUNTIME_GROUPS.slice(0, 3), true);
  assert.deepEqual(buckets.sellable.map((group) => group.idx), [1, 0]);
  assert.deepEqual(buckets.excluded.map((group) => group.idx), [2]);
});

test("property value edits trigger inputs-panel rerenders so liquidation rows stay fresh", () => {
  assert.equal(
    shouldRerenderOnInput(PROPERTY_RUNTIME_GROUPS[1].valueField, 500_000, 100_000),
    true
  );
  assert.equal(
    shouldRerenderOnInput(PROPERTY_RUNTIME_GROUPS[1].valueField, 100_000, 100_000),
    false
  );
});

test("timeline milestone generation still uses semantic fields with specimen data", () => {
  const result = runModel(SPECIMEN_FIELDS, SPECIMEN_UI_STATE);
  const milestones = buildTimelineMilestones(
    SPECIMEN_FIELDS,
    result,
    Number(SPECIMEN_FIELDS[RUNTIME_FIELDS.statutoryRetirementAge]),
    1000,
    () => ""
  );

  const labels = milestones.map((milestone) => milestone.label);
  assert.equal(labels.some((label) => label.includes("State pension starts")), true);
  assert.equal(labels.some((label) => label.includes("Other income ends")), true);
  assert.equal(labels.some((label) => label.includes("Inheritance")), true);
});

test("other-work visibility remains hidden until semantic income field is populated", () => {
  const fields = createEmptyFieldState();
  assert.equal(fieldVisible(fields, OTHER_WORK_FIELDS.untilAge, DEFAULT_VISIBILITY), false);
  fields[OTHER_WORK_FIELDS.income] = 4_000;
  assert.equal(fieldVisible(fields, OTHER_WORK_FIELDS.untilAge, DEFAULT_VISIBILITY), true);
});

test("runtime visibility state stays collapsed until later slots actually contain data", () => {
  const fields = createEmptyFieldState();

  assert.deepEqual(deriveRuntimeVisibilityState(fields), DEFAULT_VISIBILITY);

  fields[DEPENDENT_RUNTIME_GROUPS[1].nameField] = "Jamie";
  assert.equal(deriveRuntimeVisibilityState(fields).visibleDependents, 2);
  fields[DEPENDENT_RUNTIME_GROUPS[2].nameField] = "Morgan";
  assert.equal(deriveRuntimeVisibilityState(fields).visibleDependents, 3);
  fields[DEPENDENT_RUNTIME_GROUPS[3].annualCostField] = 2_400;
  assert.equal(deriveRuntimeVisibilityState(fields).visibleDependents, 4);
  fields[DEPENDENT_RUNTIME_GROUPS[4].yearsField] = 6;
  assert.equal(deriveRuntimeVisibilityState(fields).visibleDependents, 5);

  const propertyFields = createEmptyFieldState();
  propertyFields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "Gzira";
  assert.equal(deriveRuntimeVisibilityState(propertyFields).visibleProperties, 2);
  propertyFields[PROPERTY_RUNTIME_GROUPS[2].annualCostsField] = 1_200;
  assert.equal(deriveRuntimeVisibilityState(propertyFields).visibleProperties, 3);
  propertyFields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 80_000;
  assert.equal(deriveRuntimeVisibilityState(propertyFields).visibleProperties, 4);
  propertyFields[PROPERTY_RUNTIME_GROUPS[4].nameField] = "Marsa";
  assert.equal(deriveRuntimeVisibilityState(propertyFields).visibleProperties, 5);

  const assetFields = createEmptyFieldState();
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[1].nameField] = "Car";
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 2);
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[2].appreciationRateField] = 0.03;
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 3);
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].valueField] = 180_000;
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 4);
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].nameField] = "Antiques";
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 5);

  const incomeEventFields = createEmptyFieldState();
  incomeEventFields[INCOME_EVENT_RUNTIME_GROUPS[1].yearField] = 2031;
  assert.equal(deriveRuntimeVisibilityState(incomeEventFields).visibleIncomeEvents, 2);
  incomeEventFields[INCOME_EVENT_RUNTIME_GROUPS[2].amountField] = 20_000;
  assert.equal(deriveRuntimeVisibilityState(incomeEventFields).visibleIncomeEvents, 3);

  const expenseEventFields = createEmptyFieldState();
  expenseEventFields[EXPENSE_EVENT_RUNTIME_GROUPS[1].nameField] = "School fees";
  assert.equal(deriveRuntimeVisibilityState(expenseEventFields).visibleExpenseEvents, 2);
  expenseEventFields[EXPENSE_EVENT_RUNTIME_GROUPS[2].yearField] = 2035;
  assert.equal(deriveRuntimeVisibilityState(expenseEventFields).visibleExpenseEvents, 3);

  const stockMarketCrashFields = createEmptyFieldState();
  stockMarketCrashFields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].dropField] = 0.2;
  assert.equal(deriveRuntimeVisibilityState(stockMarketCrashFields).visibleStockMarketCrashes, 1);
  stockMarketCrashFields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[3].yearField] = new Date().getFullYear() + 4;
  assert.equal(deriveRuntimeVisibilityState(stockMarketCrashFields).visibleStockMarketCrashes, 4);
});

test("normalization and scenario outputs include stock market crash slots and apply crash recovery rates", () => {
  const currentYear = new Date().getFullYear();
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 0;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.1;
  fields["assets.equities.marketValue"] = 100;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = currentYear + 1;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 2;

  const normalized = normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false });
  assert.equal(normalized.stockMarketCrashes.length, 5);
  assert.deepEqual(normalized.stockMarketCrashes[0], {
    year: currentYear + 1,
    dropPercentage: 0.2,
    recoveryYears: 2
  });

  const result = runModel(fields, {
    deeperDiveOpen: true,
    finerDetailsOpen: true,
    earlyRetirementAge: 65,
    manualPropertyLiquidationOrder: false,
    projectionMonthOverride: 1
  });

  const stockSeries = result.outputs.scenarioNorm.netWorth.stockMarketEquity;
  const recoveryRate = Math.sqrt(1 / (1 - 0.2)) - 1;
  assert.ok(stockSeries[0] !== undefined);
  assert.ok(stockSeries[1] !== undefined);
  assert.ok(stockSeries[2] !== undefined);
  assert.ok(stockSeries[3] !== undefined);
  assert.equal(Math.abs((stockSeries[0] ?? 0) - 110) < 1e-9, true);
  assert.equal(Math.abs((stockSeries[1] ?? 0) - 88) < 1e-9, true);
  assert.equal(Math.abs((stockSeries[2] ?? 0) - (88 * (1 + recoveryRate))) < 1e-9, true);
  assert.equal(Math.abs((stockSeries[3] ?? 0) - 110) < 1e-9, true);
});

test("stock market investments trigger structural rerenders for crash visibility", () => {
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, "", ""), false);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, "", 0), false);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, "", 100), true);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, 100, 200), false);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, 100, 0), true);
});

test("normalization and scenario outputs include dependent slots four and five", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 50_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[DEPENDENT_RUNTIME_GROUPS[3].nameField] = "Jordan";
  fields[DEPENDENT_RUNTIME_GROUPS[3].annualCostField] = 2_400;
  fields[DEPENDENT_RUNTIME_GROUPS[3].yearsField] = 4;
  fields[DEPENDENT_RUNTIME_GROUPS[4].nameField] = "Taylor";
  fields[DEPENDENT_RUNTIME_GROUPS[4].annualCostField] = 3_200;
  fields[DEPENDENT_RUNTIME_GROUPS[4].yearsField] = 2;

  const normalized = normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false });
  assert.equal(normalized.dependents.length, 5);
  assert.deepEqual(normalized.dependents[3], { name: "Jordan", annualCost: 2_400, yearsToSupport: 4 });
  assert.deepEqual(normalized.dependents[4], { name: "Taylor", annualCost: 3_200, yearsToSupport: 2 });

  const result = runModel(fields, {
    deeperDiveOpen: true,
    finerDetailsOpen: true,
    earlyRetirementAge: 55,
    manualPropertyLiquidationOrder: false,
    projectionMonthOverride: 1
  });

  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost.length, 5);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[3].label, "Jordan");
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[3].values[0], 2_400);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[3].values[4], 0);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[4].label, "Taylor");
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[4].values[0], 3_200);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[4].values[2], 0);
});

test("normalization and scenario outputs include property slots four and five", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 50_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[PROPERTY_RUNTIME_GROUPS[3].nameField] = "Gudja";
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 80_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].annualCostsField] = 1_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].rentalIncomeField] = 5_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].nameField] = "Marsa";
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 120_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].annualCostsField] = 800;
  fields[PROPERTY_RUNTIME_GROUPS[4].rentalIncomeField] = 6_500;

  const normalized = normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false });
  assert.equal(normalized.properties.length, 5);
  assert.deepEqual(normalized.properties[3], {
    name: "Gudja",
    value: 80_000,
    annualCosts: 1_000,
    rentalIncome: 5_000,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0
  });
  assert.deepEqual(normalized.properties[4], {
    name: "Marsa",
    value: 120_000,
    annualCosts: 800,
    rentalIncome: 6_500,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0
  });

  const result = runModel(fields, {
    deeperDiveOpen: true,
    finerDetailsOpen: true,
    earlyRetirementAge: 55,
    manualPropertyLiquidationOrder: false
  });

  assert.equal(result.outputs.scenarioNorm.cashFlow.rentalIncomeByProperty.length, 5);
  assert.equal(result.outputs.scenarioNorm.cashFlow.rentalIncomeByProperty[3].label, "Gudja");
  assert.equal(result.outputs.scenarioNorm.cashFlow.rentalIncomeByProperty[4].label, "Marsa");
  assert.equal(result.outputs.scenarioNorm.netWorth.properties.length, 11);
  assert.equal(result.outputs.scenarioNorm.netWorth.properties[4].label, "Gudja");
  assert.equal(result.outputs.scenarioNorm.netWorth.properties[5].label, "Marsa");
});

test("normalization and output reporting include assets of value in the combined liquidation pool", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 50_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].nameField] = "Boat";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].valueField] = 180_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].appreciationRateField] = -0.05;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].nameField] = "Antiques";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].valueField] = 82_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].appreciationRateField] = 0.02;

  const normalized = normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false });
  assert.equal(normalized.assetsOfValue.length, 5);
  assert.deepEqual(normalized.assetsOfValue[3], {
    name: "Boat",
    value: 180_000,
    appreciationRate: -0.05,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0
  });
  assert.deepEqual(normalized.assetsOfValue[4], {
    name: "Antiques",
    value: 82_000,
    appreciationRate: 0.02,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0
  });

  const result = runModel(fields, {
    deeperDiveOpen: true,
    finerDetailsOpen: true,
    earlyRetirementAge: 55,
    manualPropertyLiquidationOrder: false
  });

  assert.equal(result.outputs.scenarioNorm.cashFlow.liquidationsByProperty.length, 10);
  assert.equal(result.outputs.scenarioNorm.cashFlow.liquidationsByProperty[8].label, "Boat");
  assert.equal(result.outputs.scenarioNorm.cashFlow.liquidationsByProperty[9].label, "Antiques");
  assert.equal(result.outputs.scenarioNorm.netWorth.loans[10].label, "Antiques loan");
});

test("main.ts runtime DOM wiring is field-id based", () => {
  const mainSource = readFileSync(join(process.cwd(), "src/main.ts"), "utf8");

  assert.equal(mainSource.includes('matches("input[data-cell]")'), false);
  assert.equal(mainSource.includes('querySelectorAll<HTMLInputElement>("input[data-cell]")'), false);
  assert.equal(mainSource.includes("dataset.cell"), false);
  assert.equal(mainSource.includes("activeCell"), false);
  assert.equal(mainSource.includes("const rawInputs = new Proxy"), false);
  assert.equal(mainSource.includes("resolveFieldId("), false);
  assert.equal(mainSource.includes('matches("input[data-field-id]")'), true);
  assert.equal(mainSource.includes('querySelectorAll<HTMLInputElement>("input[data-field-id]")'), true);
  assert.equal(mainSource.includes("deriveRuntimeVisibilityState(fieldState)"), true);
  assert.equal(mainSource.includes('isOutOfRangeLiquidationRank(fieldId,'), true);
  assert.equal(mainSource.includes("manualPropertyLiquidationOrder"), true);
});
