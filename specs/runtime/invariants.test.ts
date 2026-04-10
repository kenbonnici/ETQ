import test from "node:test";
import assert from "node:assert/strict";

import { runModel } from "../../src/model";
import { NamedProjectionSeries, ScenarioOutputs } from "../../src/model/types";
import { INVARIANT_FIXTURES } from "./fixtures/invariantFixtures";

const EPSILON = 1e-6;

function approxEqual(actual: number, expected: number, message: string): void {
  const delta = Math.abs(actual - expected);
  assert.ok(
    delta <= EPSILON,
    `${message}: expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}, delta ${delta.toFixed(6)}`
  );
}

function sumSeriesRows(rows: Array<number[] | NamedProjectionSeries>, yearIdx: number): number {
  return rows.reduce((sum, row) => {
    if (Array.isArray(row)) return sum + row[yearIdx];
    return sum + row.values[yearIdx];
  }, 0);
}

function findFirstDisposalIndex(series: number[]): number {
  return series.findIndex((value) => Math.abs(value) > EPSILON);
}

function assertScenarioInvariants(fixtureName: string, scenarioName: string, scenario: ScenarioOutputs): void {
  assert.ok(scenario.debug, `${fixtureName}/${scenarioName} should expose debug output`);

  const inflowRows: Array<number[] | NamedProjectionSeries> = [
    scenario.cashFlow.employmentIncome,
    scenario.cashFlow.otherWorkIncome,
    ...scenario.cashFlow.rentalIncomeByProperty,
    scenario.cashFlow.statutoryPension,
    scenario.cashFlow.otherPostRetirementIncome,
    ...scenario.cashFlow.incomeEvents,
    scenario.cashFlow.liquidationsStocks,
    ...scenario.cashFlow.liquidationsByProperty,
    scenario.cashFlow.downsizingHomeSale
  ];

  const outflowRows: Array<number[] | NamedProjectionSeries> = [
    scenario.cashFlow.creditCardsCleared,
    scenario.cashFlow.homeLoanRepayment,
    ...scenario.cashFlow.propertyLoanRepayments,
    scenario.cashFlow.otherLoanRepayment,
    ...scenario.cashFlow.dependentsCost,
    scenario.cashFlow.housingRent,
    scenario.cashFlow.downsizingHomePurchase,
    ...scenario.cashFlow.propertyCosts,
    scenario.cashFlow.stockInvestmentContributions,
    scenario.cashFlow.livingExpenses,
    ...scenario.cashFlow.expenseEvents
  ];

  for (let i = 0; i < scenario.points.length; i += 1) {
    const inflows = sumSeriesRows(inflowRows, i);
    const outflows = sumSeriesRows(outflowRows, i);
    const openingCash = scenario.cashFlow.openingCash[i];
    const netCashFlow = scenario.cashFlow.netCashFlow[i];
    const closingCash = scenario.cashFlow.closingCash[i];

    approxEqual(inflows, scenario.cashFlow.totalInflows[i], `${fixtureName}/${scenarioName} total inflows year ${i}`);
    approxEqual(outflows, scenario.cashFlow.totalOutflows[i], `${fixtureName}/${scenarioName} total outflows year ${i}`);
    approxEqual(
      scenario.cashFlow.totalInflows[i] - scenario.cashFlow.totalOutflows[i],
      netCashFlow,
      `${fixtureName}/${scenarioName} net cash flow year ${i}`
    );
    approxEqual(closingCash, scenario.cashSeries[i], `${fixtureName}/${scenarioName} cash series year ${i}`);
    approxEqual(closingCash, scenario.points[i].cash, `${fixtureName}/${scenarioName} point cash year ${i}`);
    approxEqual(closingCash, scenario.netWorth.cash[i], `${fixtureName}/${scenarioName} net worth cash row year ${i}`);

    const netWorth =
      scenario.netWorth.cash[i] +
      scenario.netWorth.stockMarketEquity[i] +
      sumSeriesRows(scenario.netWorth.properties, i) -
      sumSeriesRows(scenario.netWorth.loans, i);
    approxEqual(netWorth, scenario.netWorthSeries[i], `${fixtureName}/${scenarioName} net worth reconciliation year ${i}`);
    approxEqual(netWorth, scenario.points[i].netWorth, `${fixtureName}/${scenarioName} point net worth year ${i}`);

    if (i < scenario.points.length - 1) {
      approxEqual(
        closingCash,
        scenario.cashFlow.openingCash[i + 1],
        `${fixtureName}/${scenarioName} opening cash roll-forward year ${i}`
      );
    }
  }
}

function assertForcedLiquidationLoanBehavior(fixtureName: string, scenarioName: string, scenario: ScenarioOutputs): void {
  const debug = scenario.debug;
  assert.ok(debug, `${fixtureName}/${scenarioName} missing debug payload`);

  for (const stage of debug.liquidationStages) {
    const saleIdx = findFirstDisposalIndex(stage.disposal);
    if (saleIdx < 0) continue;

    const row = scenario.cashFlow.propertyLoanRepayments.find((series) => series.label === stage.assetLabel);
    assert.ok(row, `${fixtureName}/${scenarioName} missing loan repayment row for ${stage.assetLabel}`);
    assert.ok(
      row.values[saleIdx] + EPSILON >= Math.max(-stage.loanRepayment[saleIdx], 0),
      `${fixtureName}/${scenarioName} sale-year loan repayment row should include the payoff for ${stage.assetLabel}`
    );
    for (let i = saleIdx + 1; i < row.values.length; i += 1) {
      approxEqual(row.values[i], 0, `${fixtureName}/${scenarioName} post-sale loan repayments for ${stage.assetLabel} year ${i}`);
    }
  }
}

test("standalone invariant fixtures satisfy year-by-year cash flow and net worth invariants", () => {
  for (const fixture of INVARIANT_FIXTURES) {
    const result = runModel(fixture.fields, fixture.uiState);

    assert.equal(
      result.validationMessages.filter((message) => message.blocksProjection).length,
      0,
      `${fixture.name} should not have blocking validation errors`
    );

    assertScenarioInvariants(fixture.name, "scenarioNorm", result.outputs.scenarioNorm);
    assertScenarioInvariants(fixture.name, "scenarioEarly", result.outputs.scenarioEarly);
  }
});

test("forced and planned liquidation fixtures suppress post-sale loan repayments", () => {
  for (const fixtureName of ["forcedPropertyFirst", "forcedAssetFirst", "plannedSalesWithLoans"]) {
    const fixture = INVARIANT_FIXTURES.find((candidate) => candidate.name === fixtureName);
    assert.ok(fixture, `Missing fixture ${fixtureName}`);

    const result = runModel(fixture.fields, fixture.uiState);
    assertForcedLiquidationLoanBehavior(fixtureName, "scenarioNorm", result.outputs.scenarioNorm);
    assertForcedLiquidationLoanBehavior(fixtureName, "scenarioEarly", result.outputs.scenarioEarly);
  }
});

test("manual liquidation order respects the configured sale sequence", () => {
  const fixture = INVARIANT_FIXTURES.find((candidate) => candidate.name === "manualLiquidationOrder");
  assert.ok(fixture, "Missing manualLiquidationOrder fixture");

  const result = runModel(fixture.fields, fixture.uiState);
  const normStages = result.outputs.scenarioNorm.debug?.liquidationStages ?? [];
  const labels = normStages
    .filter((stage) => findFirstDisposalIndex(stage.disposal) >= 0)
    .map((stage) => stage.assetLabel);
  assert.deepEqual(labels.slice(0, 3), ["Beta", "Alpha", "Car"]);
});
