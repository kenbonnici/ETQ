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
  buildPropertyLiquidationOrder,
  buildTimelineMilestones,
  deriveRuntimeVisibilityState,
  fieldVisible,
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
  manualPropertyLiquidationOrder: false
};
const DEFAULT_VISIBILITY: RuntimeVisibilityState = {
  visibleDependents: 1,
  visibleProperties: 1,
  visibleIncomeEvents: 1,
  visibleExpenseEvents: 1
};

function cloneFields(fields: FieldState): FieldState {
  return { ...fields };
}

test("Excel adapter round-trips and specimen parity still passes", () => {
  assert.deepEqual(fieldStateToRawInputs(SPECIMEN_FIELDS), EXCEL_BASELINE_SPECIMEN.raw_inputs);
  assert.equal(runSpecimenParity().overallPass, true);
});

test("input definitions preserve row order and derive cells from semantic field ids", () => {
  assert.deepEqual(
    INPUT_DEFINITIONS.map((def) => def.row),
    [
      4, 6, 8, 10, 12, 15, 16, 17, 19, 21, 23, 25, 33, 34, 35, 38, 39, 40, 43, 44, 45, 46, 47, 48, 49, 49,
      49, 50, 51, 52, 55,
      56, 57, 60, 61, 62, 66, 67, 68, 70, 71, 75, 78, 79, 80, 83, 84, 85, 88, 89, 90, 93, 94, 95, 100, 101,
      102, 105, 106, 107, 110, 111, 112, 117, 118, 119, 122, 123, 124, 127, 128, 129, 134, 137, 138, 139,
      141, 142, 143, 145, 147, 149, 151, 153, 155, 157, 159, 161, 163, 166, 167, 168
    ]
  );

  for (const def of INPUT_DEFINITIONS) {
    assert.equal(def.cell, FIELD_ID_TO_CELL[def.fieldId]);
  }
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
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 4),
    true
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 2),
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
  const appended = syncManualPropertyOrderForNewProperties(fields, new Set([0, 1]), true);
  assert.deepEqual(appended, [{ fieldId: PROPERTY_RUNTIME_GROUPS[2].liquidationRankField, value: 3 }]);

  for (const update of appended) {
    fields[update.fieldId] = update.value;
  }

  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = null;
  assert.deepEqual(syncManualPropertyOrderForNewProperties(fields, new Set([0, 1, 2]), true), []);

  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 3;
  const manualOrder = buildPropertyLiquidationOrder(fields, PROPERTY_RUNTIME_GROUPS.slice(), true);
  assert.deepEqual(manualOrder.map((group) => group.idx), [1, 0, 2]);

  const assignments = buildPropertyLiquidationAssignments(manualOrder, PROPERTY_RUNTIME_GROUPS.slice());
  assert.deepEqual(
    assignments.filter((assignment) => assignment.value !== null).map((assignment) => assignment.value),
    [1, 2, 3]
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

  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 3;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 2;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [3, 1, 2]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 100_000;
  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [1, 2, 3]
  );

  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 50_000;
  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: false }).liquidationPriority,
    [2, 3, 1]
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

  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 2;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = null;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 50_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 400_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 100_000;

  assert.deepEqual(
    normalizeInputs(fieldStateToRawInputs(fields), { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0]
  );
  assert.deepEqual(
    buildPropertyLiquidationOrder(fields, PROPERTY_RUNTIME_GROUPS.slice(), true).map((group) => group.idx),
    [1, 0, 2]
  );
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
    manualPropertyLiquidationOrder: false
  });

  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost.length, 5);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[3].label, "Jordan");
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[3].values[0], 2_400);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[3].values[4], 0);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[4].label, "Taylor");
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[4].values[0], 3_200);
  assert.equal(result.outputs.scenarioNorm.cashFlow.dependentsCost[4].values[2], 0);
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
