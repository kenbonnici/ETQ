import test from "node:test";
import assert from "node:assert/strict";

import { fv } from "../../src/model/components/finance";
import { runModel } from "../../src/model/index";
import {
  createSampleDataFieldState,
  SAMPLE_DATA_EARLY_RETIREMENT_AGE
} from "../../src/model/sampleData";
import { HOME_FIELDS, RUNTIME_FIELDS } from "../../src/ui/runtimeFields";

const SAMPLE_FIELDS = createSampleDataFieldState();
const BASE_UI_STATE = {
  majorFutureEventsOpen: true,
  advancedAssumptionsOpen: true,
  earlyRetirementAge: SAMPLE_DATA_EARLY_RETIREMENT_AGE,
  manualPropertyLiquidationOrder: false
} as const;

function runWithMonth(month: number) {
  return runModel(SAMPLE_FIELDS, {
    ...BASE_UI_STATE,
    projectionMonthOverride: month
  }).outputs;
}

function assertClose(actual: number, expected: number, tolerance = 0.01): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("projection timeline now starts from the current year and current age", () => {
  const january = runWithMonth(1);

  assert.equal(january.ages[0], Number(SAMPLE_FIELDS[RUNTIME_FIELDS.currentAge]));
  assert.equal(january.years[0], new Date().getFullYear());
});

test("mid-year overrides pro-rate first-year flows and first-year loan repayments only", () => {
  const january = runWithMonth(1);
  const july = runWithMonth(7);

  assertClose(january.scenarioNorm.cashFlow.employmentIncome[0], Number(SAMPLE_FIELDS[RUNTIME_FIELDS.currentNetIncomeAnnual]));
  assertClose(july.scenarioNorm.cashFlow.employmentIncome[0], january.scenarioNorm.cashFlow.employmentIncome[0] * 0.5);

  const homeLoanRepayment = Number(SAMPLE_FIELDS[HOME_FIELDS.mortgageMonthlyRepayment] ?? 0);
  assertClose(january.scenarioNorm.cashFlow.homeLoanRepayment[0], homeLoanRepayment * 12);
  assertClose(july.scenarioNorm.cashFlow.homeLoanRepayment[0], homeLoanRepayment * 6);
  assertClose(july.scenarioNorm.cashFlow.homeLoanRepayment[1], january.scenarioNorm.cashFlow.homeLoanRepayment[1]);
});

test("mid-year overrides use partial-year growth and month-offset loan balances", () => {
  const january = runWithMonth(1);
  const july = runWithMonth(7);

  const homeValue = Number(SAMPLE_FIELDS[HOME_FIELDS.homeValue] ?? 0);
  const propertyGrowth = Number(SAMPLE_FIELDS[RUNTIME_FIELDS.propertyAnnualAppreciation] ?? 0);
  assertClose(
    january.scenarioNorm.netWorth.properties[0].values[0],
    homeValue * Math.pow(1 + propertyGrowth, 1)
  );
  assertClose(
    july.scenarioNorm.netWorth.properties[0].values[0],
    homeValue * Math.pow(1 + propertyGrowth, 0.5)
  );

  const homeLoanBalance = Number(SAMPLE_FIELDS[HOME_FIELDS.mortgageBalance] ?? 0);
  const homeLoanRate = Number(SAMPLE_FIELDS[HOME_FIELDS.mortgageInterestRateAnnual] ?? 0);
  const homeLoanRepayment = Number(SAMPLE_FIELDS[HOME_FIELDS.mortgageMonthlyRepayment] ?? 0);
  assertClose(
    january.scenarioNorm.netWorth.loans[0].values[0],
    Math.max(fv(homeLoanRate / 12, 12, homeLoanRepayment, -homeLoanBalance), 0)
  );
  assertClose(
    july.scenarioNorm.netWorth.loans[0].values[0],
    Math.max(fv(homeLoanRate / 12, 6, homeLoanRepayment, -homeLoanBalance), 0)
  );
});
