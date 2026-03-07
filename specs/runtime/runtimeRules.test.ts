import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runModel } from "../../src/model";
import { createEmptyFieldState, fieldStateToRawInputs, rawInputsToFieldState } from "../../src/model/excelAdapter";
import { FIELD_ID_TO_CELL } from "../../src/model/fieldRegistry";
import { EXCEL_BASELINE_SPECIMEN } from "../../src/model/parity/excelBaselineSpecimen";
import { runSpecimenParity } from "../../src/model/parity/runSpecimenParity";
import { FieldState } from "../../src/model/types";
import { INPUT_DEFINITIONS } from "../../src/ui/inputDefinitions";
import {
  buildPropertyLiquidationAssignments,
  buildPropertyLiquidationOrder,
  buildTimelineMilestones,
  fieldVisible,
  hasRetireCheckEssentialErrors,
  isDuplicateLiquidationRank,
  RuntimeVisibilityState,
  syncManualPropertyOrderForNewProperties
} from "../../src/ui/runtimeRules";
import {
  DEPENDENT_RUNTIME_GROUPS,
  HOME_FIELDS,
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
  earlyRetirementAge: EXCEL_BASELINE_SPECIMEN.early_retirement_age
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
      4, 6, 8, 10, 12, 15, 16, 17, 19, 21, 23, 25, 33, 34, 35, 38, 39, 40, 43, 44, 45, 50, 51, 52, 55,
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

test("property liquidation order preserves default, manual, and duplicate-rank behavior", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "P1";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "P2";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].nameField] = "P3";
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 220_000;

  const active = PROPERTY_RUNTIME_GROUPS.slice();
  const defaultOrder = buildPropertyLiquidationOrder(fields, active);
  assert.deepEqual(defaultOrder.map((group) => group.idx), [1, 2, 0]);

  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 2;

  assert.equal(
    isDuplicateLiquidationRank(fields, PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 2),
    true
  );

  const appended = syncManualPropertyOrderForNewProperties(fields);
  assert.deepEqual(appended, [{ fieldId: PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, value: 3 }]);

  for (const update of appended) {
    fields[update.fieldId] = update.value;
  }

  const manualOrder = buildPropertyLiquidationOrder(fields, active);
  assert.deepEqual(manualOrder.map((group) => group.idx), [1, 2, 0]);

  const assignments = buildPropertyLiquidationAssignments(manualOrder, active);
  assert.deepEqual(
    assignments.filter((assignment) => assignment.value !== null).map((assignment) => assignment.value),
    [1, 2, 3]
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
});
