import test from "node:test";
import assert from "node:assert/strict";

import { resolveProjectionTiming } from "../../src/model/projectionTiming";
import { runScenarioNorm } from "../../src/model/engines/runScenarioNorm";
import { EffectiveInputs } from "../../src/model/types";

function buildInputs(): EffectiveInputs {
  return {
    ageNow: 40,
    netIncomeAnnual: 0,
    cashBalance: 0,
    stocksBalance: 0,
    stocksContributionMonthly: 0,
    homeValue: 0,
    homeLoanBalance: 0,
    homeLoanRate: 0,
    homeLoanRepaymentMonthly: 0,
    statutoryRetirementAge: 67,
    pensionAnnual: 0,
    housingRentAnnual: 0,
    downsizingYear: 0,
    downsizingNewHomeMode: "",
    downsizingNewHomePurchaseCost: 0,
    downsizingNewRentAnnual: 0,
    livingExpensesAnnual: 0,
    dependents: [],
    properties: [
      {
        name: "Rental Flat",
        value: 200_000,
        annualCosts: 0,
        rentalIncome: 0,
        loanBalance: 50_000,
        loanRate: 0,
        loanRepaymentMonthly: 2_000,
        plannedSellYear: 2026
      }
    ],
    assetsOfValue: [
      {
        name: "Classic Car",
        value: 100_000,
        appreciationRate: 0,
        loanBalance: 20_000,
        loanRate: 0,
        loanRepaymentMonthly: 1_000,
        plannedSellYear: 2026
      }
    ],
    otherWorkIncomeAnnual: 0,
    otherWorkUntilAge: 0,
    creditCardBalance: 0,
    otherLoanBalance: 0,
    otherLoanRate: 0,
    otherLoanRepaymentMonthly: 0,
    incomeEvents: [],
    expenseEvents: [],
    stockMarketCrashes: [],
    liveUntilAge: 41,
    spendingAdjustmentAge1: 55,
    spendingAdjustmentAge2: 80,
    spendAdjustFirstBracket: 0,
    spendAdjustSecondBracket: 0,
    spendAdjustFinalBracket: 0,
    postRetIncomeAnnual: 0,
    postRetIncomeFromAge: 0,
    postRetIncomeToAge: 0,
    inflation: 0,
    propertyAppreciation: 0,
    cashRate: 0,
    stockReturn: 0,
    salaryGrowth: 0,
    rentalIncomeGrowth: 0,
    pensionReductionPerYearEarly: 0,
    cashBuffer: 0,
    legacyAmount: 0,
    stockSellingCosts: 0,
    propertyDisposalCosts: 0.1,
    otherAssetDisposalCosts: 0.05,
    liquidationPriority: [0, 0]
  };
}

function buildForcedSaleInputs(liquidationPriority: number[]): EffectiveInputs {
  return {
    ...buildInputs(),
    livingExpensesAnnual: 10_000,
    properties: [
      {
        ...buildInputs().properties[0],
        name: "Forced Property",
        plannedSellYear: null,
        loanRepaymentMonthly: 0
      }
    ],
    assetsOfValue: [
      {
        ...buildInputs().assetsOfValue[0],
        name: "Forced Asset",
        plannedSellYear: null,
        loanRepaymentMonthly: 0
      }
    ],
    liveUntilAge: 42,
    liquidationPriority
  };
}

function buildForcedSaleInputsWithOngoingLoanRepayments(liquidationPriority: number[]): EffectiveInputs {
  return {
    ...buildInputs(),
    livingExpensesAnnual: 10_000,
    properties: [
      {
        ...buildInputs().properties[0],
        name: "Forced Property",
        plannedSellYear: null,
        loanRepaymentMonthly: 1_000
      }
    ],
    assetsOfValue: [
      {
        ...buildInputs().assetsOfValue[0],
        name: "Forced Asset",
        plannedSellYear: null,
        loanRepaymentMonthly: 500
      }
    ],
    liveUntilAge: 42,
    liquidationPriority
  };
}

test("planned sales keep gross liquidation inflows separate from property and other asset loan payoffs", () => {
  const scenario = runScenarioNorm(
    buildInputs(),
    resolveProjectionTiming(new Date("2026-01-01T00:00:00Z"), 1)
  );

  const propertyLiquidation = scenario.cashFlow.liquidationsByProperty.find((series) => series.label === "Rental Flat");
  const assetLiquidation = scenario.cashFlow.liquidationsByProperty.find((series) => series.label === "Classic Car");
  const propertyLoanRepayment = scenario.cashFlow.propertyLoanRepayments.find((series) => series.label === "Rental Flat");
  const assetLoanRepayment = scenario.cashFlow.propertyLoanRepayments.find((series) => series.label === "Classic Car");

  assert.ok(propertyLiquidation);
  assert.ok(assetLiquidation);
  assert.ok(propertyLoanRepayment);
  assert.ok(assetLoanRepayment);

  assert.equal(propertyLiquidation.values[0], 180_000);
  assert.equal(assetLiquidation.values[0], 95_000);
  assert.equal(propertyLoanRepayment.values[0], 50_000);
  assert.equal(assetLoanRepayment.values[0], 20_000);

  assert.equal(scenario.cashFlow.totalInflows[0], 275_000);
  assert.equal(scenario.cashFlow.totalOutflows[0], 70_000);
  assert.equal(scenario.cashFlow.netCashFlow[0], 205_000);
});

test("forced property sales show gross proceeds, settle the loan in the sale year, and stop future repayments", () => {
  const scenario = runScenarioNorm(
    buildForcedSaleInputs([1, 2]),
    resolveProjectionTiming(new Date("2026-01-01T00:00:00Z"), 1)
  );

  const propertyLiquidation = scenario.cashFlow.liquidationsByProperty.find((series) => series.label === "Forced Property");
  const propertyLoanRepayment = scenario.cashFlow.propertyLoanRepayments.find((series) => series.label === "Forced Property");

  assert.ok(propertyLiquidation);
  assert.ok(propertyLoanRepayment);

  assert.equal(propertyLiquidation.values[0], 180_000);
  assert.equal(propertyLoanRepayment.values[0], 50_000);
  assert.equal(propertyLoanRepayment.values[1], 0);

  assert.equal(scenario.cashFlow.totalInflows[0], 180_000);
  assert.equal(scenario.cashFlow.totalOutflows[0], 60_000);
  assert.equal(scenario.cashFlow.netCashFlow[0], 120_000);
});

test("forced other-asset sales show gross proceeds, settle the loan in the sale year, and stop future repayments", () => {
  const scenario = runScenarioNorm(
    buildForcedSaleInputs([2, 1]),
    resolveProjectionTiming(new Date("2026-01-01T00:00:00Z"), 1)
  );

  const assetLiquidation = scenario.cashFlow.liquidationsByProperty.find((series) => series.label === "Forced Asset");
  const assetLoanRepayment = scenario.cashFlow.propertyLoanRepayments.find((series) => series.label === "Forced Asset");

  assert.ok(assetLiquidation);
  assert.ok(assetLoanRepayment);

  assert.equal(assetLiquidation.values[0], 95_000);
  assert.equal(assetLoanRepayment.values[0], 20_000);
  assert.equal(assetLoanRepayment.values[1], 0);

  assert.equal(scenario.cashFlow.totalInflows[0], 95_000);
  assert.equal(scenario.cashFlow.totalOutflows[0], 30_000);
  assert.equal(scenario.cashFlow.netCashFlow[0], 65_000);
});

test("forced sales do not create future inflows from saved loan repayments after the asset is sold", () => {
  const scenario = runScenarioNorm(
    buildForcedSaleInputsWithOngoingLoanRepayments([1, 2]),
    resolveProjectionTiming(new Date("2026-01-01T00:00:00Z"), 1)
  );

  const propertyLiquidation = scenario.cashFlow.liquidationsByProperty.find((series) => series.label === "Forced Property");
  const propertyLoanRepayment = scenario.cashFlow.propertyLoanRepayments.find((series) => series.label === "Forced Property");

  assert.ok(propertyLiquidation);
  assert.ok(propertyLoanRepayment);

  assert.equal(propertyLiquidation.values[0], 180_000);
  assert.equal(propertyLiquidation.values[1], 0);
  assert.equal(propertyLoanRepayment.values[0], 50_000);
  assert.equal(propertyLoanRepayment.values[1], 0);
  assert.equal(scenario.cashFlow.totalInflows[1], 0);
});
