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
  DEPENDENT_RUNTIME_GROUPS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  INCOME_EVENT_RUNTIME_GROUPS,
  OTHER_LOAN_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS
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
  visibleIncomeEvents: 1,
  visibleExpenseEvents: 1
};
const LEGACY_AWARE_RETIREMENT_AGE = 54;

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
      55, 60, 61, 62, 65, 66, 67, 70, 71, 72, 75, 76, 77, 80, 81, 82, 86, 87, 88, 89, 90, 92, 93, 97, 100,
      101, 102, 105, 106, 107, 110, 111, 112, 115, 116, 117, 120, 121, 122, 125, 126, 127, 132, 133, 134,
      137, 138, 139, 142, 143, 144, 149, 150, 151, 154, 155, 156, 159, 160, 161, 166, 169, 170, 171, 173,
      174, 175, 177, 179, 181, 183, 185, 187, 189, 191, 193, 195, 197, 200, 201, 202, 203, 204
    ]
  );

  for (const def of INPUT_DEFINITIONS) {
    assert.equal(def.cell, FIELD_ID_TO_CELL[def.fieldId]);
  }
});

test("blank legacy normalizes to zero and specimen parity captures the shifted workbook cells", () => {
  const blankFields = createEmptyFieldState();

  assert.equal(normalizeInputs(fieldStateToRawInputs(blankFields)).legacyAmount, 0);
  assert.equal(SPECIMEN_FIELDS[RUNTIME_FIELDS.legacyAmount], 3_000_000);
  assert.equal(SPECIMEN_FIELDS[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField], 5);
  assert.equal(SPECIMEN_FIELDS[PROPERTY_RUNTIME_GROUPS[4].liquidationRankField], 2);
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

  assert.equal(fieldVisible(fields, OTHER_LOAN_FIELDS.interestRateAnnual, DEFAULT_VISIBILITY), false);
  fields[OTHER_LOAN_FIELDS.balance] = 2_000;
  assert.equal(fieldVisible(fields, OTHER_LOAN_FIELDS.interestRateAnnual, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, POST_RETIREMENT_INCOME_FIELDS.fromAge, DEFAULT_VISIBILITY), false);
  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 12_000;
  assert.equal(fieldVisible(fields, POST_RETIREMENT_INCOME_FIELDS.fromAge, DEFAULT_VISIBILITY), true);

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

  const active = PROPERTY_RUNTIME_GROUPS.slice(0, 2);
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
    true
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 5),
    false
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
  const manualOrder = buildPropertyLiquidationOrder(fields, PROPERTY_RUNTIME_GROUPS.slice(), true);
  assert.deepEqual(manualOrder.map((group) => group.idx), [1, 0, 2, 3, 4]);
  assert.equal(hasExplicitPropertyLiquidationPreferences(fields), true);

  const assignments = buildPropertyLiquidationAssignments(manualOrder, PROPERTY_RUNTIME_GROUPS.slice());
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
    [5, 3, 4, 1, 2]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 100_000;
  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [2, 4, 5, 1, 3]
  );

  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 50_000;
  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [3, 5, 1, 2, 4]
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
    [2, 1, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 50_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 400_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 100_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 200_000;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0, 0, 0]
  );
  assert.deepEqual(
    buildPropertyLiquidationOrder(fields, PROPERTY_RUNTIME_GROUPS.slice(), true).map((group) => group.idx),
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
  assert.equal(result.outputs.scenarioNorm.netWorth.properties.length, 6);
  assert.equal(result.outputs.scenarioNorm.netWorth.properties[4].label, "Gudja");
  assert.equal(result.outputs.scenarioNorm.netWorth.properties[5].label, "Marsa");
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
