import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { runModel } from "../../src/model";
import { NamedProjectionSeries, ScenarioOutputs } from "../../src/model/types";
import { INTEGRITY_FIXTURES } from "./fixtures/integrityFixtures";
import { INTEGRITY_SNAPSHOTS, ScenarioSnapshot } from "./fixtures/integritySnapshots";

const EPSILON = 1e-6;

function approxEqual(actual: number, expected: number, message: string): void {
  const delta = Math.abs(actual - expected);
  assert.ok(
    delta <= EPSILON,
    `${message}: expected ${expected.toFixed(6)}, got ${actual.toFixed(6)}, delta ${delta.toFixed(6)}`
  );
}

function roundValue(value: number): number {
  return Math.abs(value) <= EPSILON ? 0 : Number(value.toFixed(6));
}

function seriesFingerprint(values: number[]): string {
  const rounded = values.map(roundValue);
  const hash = createHash("sha256").update(JSON.stringify(rounded)).digest("hex").slice(0, 16);
  const sum = rounded.reduce((acc, value) => acc + value, 0);
  const min = rounded.reduce((acc, value) => Math.min(acc, value), Number.POSITIVE_INFINITY);
  const max = rounded.reduce((acc, value) => Math.max(acc, value), Number.NEGATIVE_INFINITY);
  return `${hash}|sum=${sum.toFixed(2)}|min=${min.toFixed(2)}|max=${max.toFixed(2)}`;
}

function milestoneFingerprint(scenario: ScenarioOutputs): string[] {
  return scenario.milestoneHints.map((hint) => {
    const amount = hint.amount === undefined ? "" : `|${roundValue(hint.amount).toFixed(2)}`;
    return `${hint.year}|${hint.age}|${hint.label}${amount}`;
  });
}

function addNamedRows(target: Record<string, string>, prefix: string, rows: NamedProjectionSeries[]): void {
  for (const row of rows) {
    if (!row.values.some((value) => Math.abs(value) > EPSILON)) continue;
    target[`${prefix}/${row.label}`] = seriesFingerprint(row.values);
  }
}

function snapshotScenario(scenario: ScenarioOutputs): ScenarioSnapshot {
  const cashFlowRows: Record<string, string> = {
    openingCash: seriesFingerprint(scenario.cashFlow.openingCash),
    employmentIncome: seriesFingerprint(scenario.cashFlow.employmentIncome),
    otherWorkIncome: seriesFingerprint(scenario.cashFlow.otherWorkIncome),
    statutoryPension: seriesFingerprint(scenario.cashFlow.statutoryPension),
    otherPostRetirementIncome: seriesFingerprint(scenario.cashFlow.otherPostRetirementIncome),
    liquidationsStocks: seriesFingerprint(scenario.cashFlow.liquidationsStocks),
    interestOnCash: seriesFingerprint(scenario.cashFlow.interestOnCash),
    downsizingHomeSale: seriesFingerprint(scenario.cashFlow.downsizingHomeSale),
    creditCardsCleared: seriesFingerprint(scenario.cashFlow.creditCardsCleared),
    homeLoanRepayment: seriesFingerprint(scenario.cashFlow.homeLoanRepayment),
    otherLoanRepayment: seriesFingerprint(scenario.cashFlow.otherLoanRepayment),
    housingRent: seriesFingerprint(scenario.cashFlow.housingRent),
    downsizingHomePurchase: seriesFingerprint(scenario.cashFlow.downsizingHomePurchase),
    stockInvestmentContributions: seriesFingerprint(scenario.cashFlow.stockInvestmentContributions),
    livingExpenses: seriesFingerprint(scenario.cashFlow.livingExpenses),
    totalInflows: seriesFingerprint(scenario.cashFlow.totalInflows),
    totalOutflows: seriesFingerprint(scenario.cashFlow.totalOutflows),
    netCashFlow: seriesFingerprint(scenario.cashFlow.netCashFlow),
    closingCash: seriesFingerprint(scenario.cashFlow.closingCash)
  };
  addNamedRows(cashFlowRows, "rentalIncomeByProperty", scenario.cashFlow.rentalIncomeByProperty);
  addNamedRows(cashFlowRows, "incomeEvents", scenario.cashFlow.incomeEvents);
  addNamedRows(cashFlowRows, "liquidationsByProperty", scenario.cashFlow.liquidationsByProperty);
  addNamedRows(cashFlowRows, "propertyLoanRepayments", scenario.cashFlow.propertyLoanRepayments);
  addNamedRows(cashFlowRows, "dependentsCost", scenario.cashFlow.dependentsCost);
  addNamedRows(cashFlowRows, "propertyCosts", scenario.cashFlow.propertyCosts);
  addNamedRows(cashFlowRows, "expenseEvents", scenario.cashFlow.expenseEvents);

  const netWorthRows: Record<string, string> = {
    cash: seriesFingerprint(scenario.netWorth.cash),
    stockMarketEquity: seriesFingerprint(scenario.netWorth.stockMarketEquity)
  };
  addNamedRows(netWorthRows, "properties", scenario.netWorth.properties);
  addNamedRows(netWorthRows, "loans", scenario.netWorth.loans);

  return {
    cashSeries: seriesFingerprint(scenario.cashSeries),
    netWorthSeries: seriesFingerprint(scenario.netWorthSeries),
    cashFlowRows,
    netWorthRows,
    milestones: milestoneFingerprint(scenario)
  };
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
    const interest = scenario.cashFlow.interestOnCash[i];
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
    approxEqual(
      openingCash + netCashFlow + interest,
      closingCash,
      `${fixtureName}/${scenarioName} closing cash reconciliation year ${i}`
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

test("standalone integrity fixtures satisfy year-by-year cash flow and net worth invariants", () => {
  for (const fixture of INTEGRITY_FIXTURES) {
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
    const fixture = INTEGRITY_FIXTURES.find((candidate) => candidate.name === fixtureName);
    assert.ok(fixture, `Missing fixture ${fixtureName}`);

    const result = runModel(fixture.fields, fixture.uiState);
    assertForcedLiquidationLoanBehavior(fixtureName, "scenarioNorm", result.outputs.scenarioNorm);
    assertForcedLiquidationLoanBehavior(fixtureName, "scenarioEarly", result.outputs.scenarioEarly);
  }
});

test("manual liquidation order respects the configured sale sequence", () => {
  const fixture = INTEGRITY_FIXTURES.find((candidate) => candidate.name === "manualLiquidationOrder");
  assert.ok(fixture, "Missing manualLiquidationOrder fixture");

  const result = runModel(fixture.fields, fixture.uiState);
  const normStages = result.outputs.scenarioNorm.debug?.liquidationStages ?? [];
  const labels = normStages
    .filter((stage) => findFirstDisposalIndex(stage.disposal) >= 0)
    .map((stage) => stage.assetLabel);
  assert.deepEqual(labels.slice(0, 3), ["Beta", "Alpha", "Car"]);
});

test("canonical row-level snapshots stay stable across integrity fixtures", () => {
  const actualSnapshots = Object.fromEntries(
    INTEGRITY_FIXTURES.map((fixture) => {
      const result = runModel(fixture.fields, fixture.uiState);
      return [
        fixture.name,
        {
          scenarioNorm: snapshotScenario(result.outputs.scenarioNorm),
          scenarioEarly: snapshotScenario(result.outputs.scenarioEarly)
        }
      ];
    })
  );

  assert.deepEqual(actualSnapshots, INTEGRITY_SNAPSHOTS);
});
