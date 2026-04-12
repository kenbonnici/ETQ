// TEMPORARY scratch file for ETQ professional review.
// Probes specific behaviors. Delete when done.
import test from "node:test";
import assert from "node:assert/strict";

import { runModel } from "../../src/model";
import { createEmptyFieldState } from "../../src/model/inputSchema";
import { FieldState, ModelUiState } from "../../src/model/types";
import { HOME_FIELDS, PROPERTY_RUNTIME_GROUPS, ASSET_OF_VALUE_RUNTIME_GROUPS, RUNTIME_FIELDS, STOCK_MARKET_CRASH_RUNTIME_GROUPS } from "../../src/ui/runtimeFields";
import { withFixedNow } from "./golden/shared";

function ui(early: number, month = 1, manual = false): ModelUiState {
  return {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: early,
    manualPropertyLiquidationOrder: manual,
    projectionMonthOverride: month,
    debugMode: "test"
  };
}

function dump(label: string, vals: number[]): void {
  console.log(label.padEnd(40), vals.map((v) => v.toFixed(2).padStart(12)).join(" "));
}

function excelInputs(): { fields: FieldState; uiState: ModelUiState } {
  const fields = createEmptyFieldState();

  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 80_000;
  fields[RUNTIME_FIELDS.cashBalance] = 50_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 30_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 0;

  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[HOME_FIELDS.mortgageBalance] = 50_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.03;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 300;

  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 16_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 50_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 50_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 1_000_000;

  fields[RUNTIME_FIELDS.generalInflation] = 0.025;
  fields[RUNTIME_FIELDS.propertyAnnualAppreciation] = 0.03;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0.025;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.08;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0.03;
  fields[RUNTIME_FIELDS.rentalIncomeAnnualIncrease] = 0.03;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 300;
  fields[RUNTIME_FIELDS.stockSellingCostRate] = 0.05;
  fields[RUNTIME_FIELDS.propertyDisposalCostRate] = 0.15;
  fields[RUNTIME_FIELDS.otherAssetDisposalCostRate] = 0.02;

  fields["dependents.01.displayName" as any] = "John";
  fields["dependents.01.annualCost" as any] = 2000;
  fields["dependents.01.supportYearsRemaining" as any] = 3;
  fields["dependents.02.displayName" as any] = "Jack";
  fields["dependents.02.annualCost" as any] = 1000;
  fields["dependents.02.supportYearsRemaining" as any] = 5;
  fields["dependents.03.displayName" as any] = "Bill";
  fields["dependents.03.annualCost" as any] = 4000;
  fields["dependents.03.supportYearsRemaining" as any] = 2;
  fields["dependents.04.displayName" as any] = "Stephen";
  fields["dependents.04.annualCost" as any] = 2500;
  fields["dependents.04.supportYearsRemaining" as any] = 3;
  fields["dependents.05.displayName" as any] = "Jane";
  fields["dependents.05.annualCost" as any] = 2860;
  fields["dependents.05.supportYearsRemaining" as any] = 6;

  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Sliema";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].annualCostsField] = 5000;
  fields[PROPERTY_RUNTIME_GROUPS[0].rentalIncomeField] = 12_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 6;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "Gzira";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].annualCostsField] = 2000;
  fields[PROPERTY_RUNTIME_GROUPS[1].rentalIncomeField] = 10_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 4;
  fields[PROPERTY_RUNTIME_GROUPS[2].nameField] = "Qormi";
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 220_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].annualCostsField] = 1200;
  fields[PROPERTY_RUNTIME_GROUPS[2].rentalIncomeField] = 8_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].liquidationRankField] = 5;

  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Jewelry";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].valueField] = 50_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField] = 0.02;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].liquidationRankField] = 3;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[1].nameField] = "Car";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[1].valueField] = 40_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[1].appreciationRateField] = -0.05;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[1].liquidationRankField] = 2;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[2].nameField] = "Painting";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[2].valueField] = 20_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[2].appreciationRateField] = 0.03;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[2].liquidationRankField] = 1;

  fields["debts.other.balance" as any] = 4000;
  fields["debts.other.interestRateAnnual" as any] = 0.06;
  fields["debts.other.monthlyRepayment" as any] = 50;

  fields["debts.creditCards.balance" as any] = 1000;

  fields["cashflowEvents.income.01.name" as any] = "Inheritance";
  fields["cashflowEvents.income.01.amount" as any] = 50_000;
  fields["cashflowEvents.income.01.year" as any] = 2035;
  fields["cashflowEvents.income.02.name" as any] = "Sell Painting";
  fields["cashflowEvents.income.02.amount" as any] = 10_000;
  fields["cashflowEvents.income.02.year" as any] = 2029;
  fields["cashflowEvents.income.03.name" as any] = "Sell Jewels";
  fields["cashflowEvents.income.03.amount" as any] = 5_000;
  fields["cashflowEvents.income.03.year" as any] = 2032;

  fields["cashflowEvents.expense.01.name" as any] = "Wedding";
  fields["cashflowEvents.expense.01.amount" as any] = 40_000;
  fields["cashflowEvents.expense.01.year" as any] = 2036;
  fields["cashflowEvents.expense.02.name" as any] = "New Car";
  fields["cashflowEvents.expense.02.amount" as any] = 35_000;
  fields["cashflowEvents.expense.02.year" as any] = 2029;
  fields["cashflowEvents.expense.03.name" as any] = "New AC";
  fields["cashflowEvents.expense.03.amount" as any] = 15_000;
  fields["cashflowEvents.expense.03.year" as any] = 2034;

  fields[RUNTIME_FIELDS.spendingAdjustmentFirstBracket] = 0;
  fields[RUNTIME_FIELDS.spendingAdjustmentSecondBracket] = -0.1;
  fields[RUNTIME_FIELDS.spendingAdjustmentFinalBracket] = -0.2;

  const uiState: ModelUiState = {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: 53,
    manualPropertyLiquidationOrder: true,
    projectionMonthOverride: 4,
    debugMode: "test"
  };

  return { fields, uiState };
}

const EXCEL_CASH_NORM = [
  76605.91, 115756.75, 161752.19, 188319.94, 244770.07,
  305803.64, 379716.92, 451888.27, 509848.16, 653899.79,
  689005.36, 779436.56, 874820.65, 975371.90, 1081312.87,
  1192874.72, 1310297.56, 1324600.30, 1349811.02, 1376605.88,
  1404163.17, 1432512.25, 1461683.71, 1491709.43, 1522622.62,
  1554457.89, 1587251.27, 1621040.32, 1665971.40, 1712483.36,
  1760637.60, 1810497.88, 1862130.48, 1915604.24, 1970990.68,
  2028364.10, 2087801.68
];

const EXCEL_CASH_EARLY = [
  76605.91, 115756.75, 161752.19, 188319.94, 244770.07,
  211902.44, 186749.95, 154477.34, 102393.58, 130572.22,
  50078.28, 78453.72, 148412.73, 109975.52, 298393.78,
  247550.98, 194955.20, 159639.70, 133846.05, 108084.42,
  81481.00, 465352.02, 428673.75, 390707.64, 351248.10,
  310262.88, 267719.06, 223583.07, 187927.90, 150988.82,
  112739.61, 826961.93, 775195.99, 721532.80, 665512.22,
  607075.31, 546161.67
];

const EXPECTED_FIRST_EARLY_DIVERGENCE_YEAR = 2037;

test("compare webapp cash with Excel row 385 after conservative asset-sale handling", () => {
  const { fields, uiState } = excelInputs();
  const result = withFixedNow(
    () => runModel(fields, uiState),
    "2026-04-01T00:00:00Z"
  );
  const normCash = result.outputs.scenarioNorm.cashSeries;
  const earlyCash = result.outputs.scenarioEarly.cashSeries;
  const years = result.outputs.years;
  const ages = result.outputs.ages;

  console.log("\n=== NORM: Webapp vs Excel ===");
  console.log("Year | Age | Webapp Cash    | Excel Cash     | Diff");
  console.log("-----|-----|----------------|----------------|--------");
  let firstDiffNorm = -1;
  for (let i = 0; i < Math.min(normCash.length, EXCEL_CASH_NORM.length); i++) {
    const diff = normCash[i] - EXCEL_CASH_NORM[i];
    const marker = Math.abs(diff) > 0.02 ? " ***" : "";
    if (Math.abs(diff) > 0.02 && firstDiffNorm < 0) firstDiffNorm = i;
    console.log(
      `${years[i]} | ${ages[i]}  | ${normCash[i].toFixed(2).padStart(14)} | ${EXCEL_CASH_NORM[i].toFixed(2).padStart(14)} | ${diff.toFixed(2).padStart(10)}${marker}`
    );
  }

  console.log("\n=== EARLY: Webapp vs Excel ===");
  console.log("Expected: early scenario diverges once conservative sale-year values begin affecting forced sales.");
  console.log("Year | Age | Webapp Cash    | Excel Cash     | Diff");
  console.log("-----|-----|----------------|----------------|--------");
  let firstDiffEarly = -1;
  for (let i = 0; i < Math.min(earlyCash.length, EXCEL_CASH_EARLY.length); i++) {
    const diff = earlyCash[i] - EXCEL_CASH_EARLY[i];
    const marker = Math.abs(diff) > 0.02 ? " ***" : "";
    if (Math.abs(diff) > 0.02 && firstDiffEarly < 0) firstDiffEarly = i;
    console.log(
      `${years[i]} | ${ages[i]}  | ${earlyCash[i].toFixed(2).padStart(14)} | ${EXCEL_CASH_EARLY[i].toFixed(2).padStart(14)} | ${diff.toFixed(2).padStart(10)}${marker}`
    );
  }

  assert.equal(firstDiffNorm, -1);
  assert.ok(firstDiffEarly >= 0);
  assert.equal(years[firstDiffEarly], EXPECTED_FIRST_EARLY_DIVERGENCE_YEAR);

  // Also dump the detailed cash flow for norm year-by-year
  // Dump first 3 years of detailed outflows for norm
  {
    const cf = result.outputs.scenarioNorm.cashFlow;
    for (let dIdx = 0; dIdx < 5; dIdx++) {
      console.log(`\n=== NORM year ${years[dIdx]} age ${ages[dIdx]} detailed ===`);
      console.log(`Opening cash:    ${cf.openingCash[dIdx].toFixed(2)}`);
      console.log(`Salary:          ${cf.employmentIncome[dIdx].toFixed(2)}`);
      for (const p of cf.rentalIncomeByProperty) console.log(`  Rental ${p.label}: ${p.values[dIdx].toFixed(2)}`);
      console.log(`Pension:         ${cf.statutoryPension[dIdx].toFixed(2)}`);
      for (const e of cf.incomeEvents) console.log(`  IncEvent ${e.label}: ${e.values[dIdx].toFixed(2)}`);
      console.log(`Home sale:       ${cf.downsizingHomeSale[dIdx].toFixed(2)}`);
      console.log(`Total inflows:   ${cf.totalInflows[dIdx].toFixed(2)}`);
      console.log(`--- Outflows ---`);
      console.log(`Credit card:     ${cf.creditCardsCleared[dIdx].toFixed(2)}`);
      console.log(`Home loan:       ${cf.homeLoanRepayment[dIdx].toFixed(2)}`);
      for (const p of cf.propertyLoanRepayments) console.log(`  PropLoan ${p.label}: ${p.values[dIdx].toFixed(2)}`);
      console.log(`Other loan:      ${cf.otherLoanRepayment[dIdx].toFixed(2)}`);
      for (const d of cf.dependentsCost) console.log(`  Dep ${d.label}: ${d.values[dIdx].toFixed(2)}`);
      console.log(`Housing rent:    ${cf.housingRent[dIdx].toFixed(2)}`);
      console.log(`Home purchase:   ${cf.downsizingHomePurchase[dIdx].toFixed(2)}`);
      for (const p of cf.propertyCosts) console.log(`  PropCost ${p.label}: ${p.values[dIdx].toFixed(2)}`);
      console.log(`Stock contrib:   ${cf.stockInvestmentContributions[dIdx].toFixed(2)}`);
      console.log(`Living expenses: ${cf.livingExpenses[dIdx].toFixed(2)}`);
      for (const e of cf.expenseEvents) console.log(`  ExpEvent ${e.label}: ${e.values[dIdx].toFixed(2)}`);
      console.log(`Total outflows:  ${cf.totalOutflows[dIdx].toFixed(2)}`);
      console.log(`Interest:        ${cf.interestOnCash[dIdx].toFixed(2)}`);
      console.log(`Stock liq:       ${cf.liquidationsStocks[dIdx].toFixed(2)}`);
      console.log(`Closing cash:    ${cf.closingCash[dIdx].toFixed(2)}`);
    }
  }

  if (firstDiffEarly >= 0) {
    const cf = result.outputs.scenarioEarly.cashFlow;
    const dIdx = firstDiffEarly;
    console.log(`\n=== EARLY year ${years[dIdx]} (first diff) detailed ===`);
    console.log(`Opening cash:    ${cf.openingCash[dIdx].toFixed(2)}`);
    console.log(`Salary:          ${cf.employmentIncome[dIdx].toFixed(2)}`);
    console.log(`Rental total:    ${cf.rentalIncomeByProperty.reduce((s, p) => s + p.values[dIdx], 0).toFixed(2)}`);
    console.log(`Pension:         ${cf.statutoryPension[dIdx].toFixed(2)}`);
    console.log(`Income events:   ${cf.incomeEvents.reduce((s, e) => s + e.values[dIdx], 0).toFixed(2)}`);
    console.log(`Total inflows:   ${cf.totalInflows[dIdx].toFixed(2)}`);
    console.log(`Total outflows:  ${cf.totalOutflows[dIdx].toFixed(2)}`);
    console.log(`Net cash flow:   ${cf.netCashFlow[dIdx].toFixed(2)}`);
    console.log(`Interest:        ${cf.interestOnCash[dIdx].toFixed(2)}`);
    console.log(`Stock liq:       ${cf.liquidationsStocks[dIdx].toFixed(2)}`);
    console.log(`Prop liq total:  ${cf.liquidationsByProperty.reduce((s, p) => s + p.values[dIdx], 0).toFixed(2)}`);
    console.log(`Closing cash:    ${cf.closingCash[dIdx].toFixed(2)}`);
  }
});
