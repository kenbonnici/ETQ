import test from "node:test";
import assert from "node:assert/strict";

import { fv } from "../../src/model/components/finance";
import { rawInputsToFieldState } from "../../src/model/excelAdapter";
import { runModel } from "../../src/model/index";
import { EXCEL_BASELINE_SPECIMEN } from "../../src/model/parity/excelBaselineSpecimen";

const SPECIMEN_FIELDS = rawInputsToFieldState(EXCEL_BASELINE_SPECIMEN.raw_inputs);
const BASE_UI_STATE = {
  deeperDiveOpen: true,
  finerDetailsOpen: true,
  earlyRetirementAge: EXCEL_BASELINE_SPECIMEN.early_retirement_age,
  manualPropertyLiquidationOrder: false
} as const;

function runWithMonth(month: number) {
  return runModel(SPECIMEN_FIELDS, {
    ...BASE_UI_STATE,
    projectionMonthOverride: month
  }).outputs;
}

function assertClose(actual: number, expected: number, tolerance = 0.01): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("projection timeline now starts from the current year and current age", () => {
  const january = runWithMonth(1);

  assert.equal(january.ages[0], Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B4));
  assert.equal(january.years[0], new Date().getFullYear());
});

test("mid-year overrides pro-rate first-year flows and first-year loan repayments only", () => {
  const january = runWithMonth(1);
  const july = runWithMonth(7);

  assertClose(january.scenarioNorm.cashFlow.employmentIncome[0], Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B6));
  assertClose(july.scenarioNorm.cashFlow.employmentIncome[0], january.scenarioNorm.cashFlow.employmentIncome[0] * 0.5);

  assertClose(january.scenarioNorm.cashFlow.homeLoanRepayment[0], Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B17) * 12);
  assertClose(july.scenarioNorm.cashFlow.homeLoanRepayment[0], Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B17) * 6);
  assertClose(july.scenarioNorm.cashFlow.homeLoanRepayment[1], january.scenarioNorm.cashFlow.homeLoanRepayment[1]);
});

test("mid-year overrides use partial-year growth and month-offset loan balances", () => {
  const january = runWithMonth(1);
  const july = runWithMonth(7);

  const homeValue = Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B12);
  const propertyGrowth = Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B179);
  assertClose(
    january.scenarioNorm.netWorth.properties[0].values[0],
    homeValue * Math.pow(1 + propertyGrowth, 1)
  );
  assertClose(
    july.scenarioNorm.netWorth.properties[0].values[0],
    homeValue * Math.pow(1 + propertyGrowth, 0.5)
  );

  const homeLoanBalance = Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B15);
  const homeLoanRate = Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B16);
  const homeLoanRepayment = Number(EXCEL_BASELINE_SPECIMEN.raw_inputs.B17);
  assertClose(
    january.scenarioNorm.netWorth.loans[0].values[0],
    Math.max(fv(homeLoanRate / 12, 12, homeLoanRepayment, -homeLoanBalance), 0)
  );
  assertClose(
    july.scenarioNorm.netWorth.loans[0].values[0],
    Math.max(fv(homeLoanRate / 12, 6, homeLoanRepayment, -homeLoanBalance), 0)
  );
});
