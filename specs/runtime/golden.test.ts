import test from "node:test";
import assert from "node:assert/strict";

import { runModel } from "../../src/model";
import { createEmptyFieldState } from "../../src/model/inputSchema";
import { FieldState, ModelUiState, ScenarioMilestoneHint } from "../../src/model/types";
import {
  ASSET_OF_VALUE_RUNTIME_GROUPS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS
} from "../../src/ui/runtimeFields";
import { GOLDEN_PERSONAS } from "./golden/fixtures";
import { GOLDEN_SNAPSHOTS } from "./golden/goldenSnapshots";
import {
  cloneUiState,
  createGoldenPersonaSnapshot,
  GoldenMilestoneSnapshot,
  GoldenPersonaSnapshot,
  withFixedNow
} from "./golden/shared";

const EPSILON = 1e-6;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function diffSeries(
  personaName: string,
  scenarioName: keyof GoldenPersonaSnapshot,
  seriesName: "cashSeries" | "netWorthSeries",
  expected: number[],
  actual: number[],
  years: number[],
  ages: number[]
): void {
  assert.equal(
    actual.length,
    expected.length,
    `${personaName}/${scenarioName}/${seriesName} length drifted: expected ${expected.length}, got ${actual.length}`
  );

  const differences: string[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i] === actual[i]) continue;
    differences.push(
      `year ${years[i]} age ${ages[i]}: expected ${expected[i].toFixed(2)}, got ${actual[i].toFixed(2)}`
    );
    if (differences.length === 10) break;
  }

  if (differences.length > 0) {
    assert.fail(
      `${personaName}/${scenarioName}/${seriesName} drifted at ${differences.length} point(s):\n${differences.join("\n")}`
    );
  }
}

function formatMilestone(hint: GoldenMilestoneSnapshot | ScenarioMilestoneHint): string {
  const amount = hint.amount === undefined ? "" : ` amount=${roundMoney(hint.amount).toFixed(2)}`;
  return `year=${hint.year} age=${hint.age} label="${hint.label}"${amount}`;
}

function diffMilestones(
  personaName: string,
  scenarioName: keyof GoldenPersonaSnapshot,
  expected: GoldenMilestoneSnapshot[],
  actual: GoldenMilestoneSnapshot[]
): void {
  if (expected.length !== actual.length) {
    assert.fail(
      `${personaName}/${scenarioName}/milestoneHints length drifted: expected ${expected.length}, got ${actual.length}\n` +
      `expected: ${expected.map(formatMilestone).join(" | ")}\n` +
      `actual: ${actual.map(formatMilestone).join(" | ")}`
    );
  }

  const differences: string[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    const expectedHint = expected[i];
    const actualHint = actual[i];
    if (
      expectedHint.year === actualHint.year
      && expectedHint.age === actualHint.age
      && expectedHint.label === actualHint.label
      && (expectedHint.amount ?? null) === (actualHint.amount ?? null)
    ) {
      continue;
    }
    differences.push(
      `index ${i}: expected ${formatMilestone(expectedHint)}, got ${formatMilestone(actualHint)}`
    );
  }

  if (differences.length > 0) {
    assert.fail(`${personaName}/${scenarioName}/milestoneHints drifted:\n${differences.join("\n")}`);
  }
}

for (const persona of GOLDEN_PERSONAS) {
  test(`golden snapshot: ${persona.name}`, () => {
    const result = withFixedNow(() => runModel(persona.fields, persona.uiState));
    const actual = createGoldenPersonaSnapshot(persona);
    const expected = GOLDEN_SNAPSHOTS[persona.name];
    assert.ok(expected, `Missing golden snapshot for ${persona.name}`);

    for (const scenarioName of ["scenarioNorm", "scenarioEarly"] as const) {
      assert.equal(
        actual[scenarioName].retirementSuccessful,
        expected[scenarioName].retirementSuccessful,
        `${persona.name}/${scenarioName}/retirementSuccessful drifted`
      );
      diffSeries(
        persona.name,
        scenarioName,
        "cashSeries",
        expected[scenarioName].cashSeries,
        actual[scenarioName].cashSeries,
        result.outputs.years,
        result.outputs.ages
      );
      diffSeries(
        persona.name,
        scenarioName,
        "netWorthSeries",
        expected[scenarioName].netWorthSeries,
        actual[scenarioName].netWorthSeries,
        result.outputs.years,
        result.outputs.ages
      );
      diffMilestones(
        persona.name,
        scenarioName,
        expected[scenarioName].milestoneHints,
        actual[scenarioName].milestoneHints
      );
    }
  });
}

test("retirementSuccessful matches the cash-buffer and legacy thresholds across golden personas", () => {
  for (const persona of GOLDEN_PERSONAS) {
    const result = withFixedNow(() => runModel(persona.fields, persona.uiState));
    const cashBuffer = Number(persona.fields[RUNTIME_FIELDS.minimumCashBuffer] ?? 0);
    const legacyAmount = Number(persona.fields[RUNTIME_FIELDS.legacyAmount] ?? 0);

    for (const [scenarioName, scenario] of [
      ["scenarioNorm", result.outputs.scenarioNorm],
      ["scenarioEarly", result.outputs.scenarioEarly]
    ] as const) {
      const expectedSuccessful = scenario.cashSeries.every((cash) => cash + EPSILON >= cashBuffer)
        && ((scenario.netWorthSeries[scenario.netWorthSeries.length - 1] ?? Number.NEGATIVE_INFINITY) + EPSILON >= legacyAmount);

      assert.equal(
        scenario.retirementSuccessful,
        expectedSuccessful,
        `${persona.name}/${scenarioName} retirementSuccessful should match cash-buffer and legacy thresholds`
      );
    }
  }
});

test("earliest-retirement viability scan is monotone across golden personas", () => {
  for (const persona of GOLDEN_PERSONAS) {
    const currentAge = Math.round(Number(persona.fields[RUNTIME_FIELDS.currentAge]));
    const statutoryAge = Math.round(Number(persona.fields[RUNTIME_FIELDS.statutoryRetirementAge]));
    let seenViableAge: number | null = null;

    for (let age = currentAge; age <= statutoryAge; age += 1) {
      const uiState = cloneUiState(persona.uiState);
      uiState.earlyRetirementAge = age;
      const result = withFixedNow(() => runModel(persona.fields, uiState));
      const viable = result.outputs.scenarioEarly.retirementSuccessful;

      if (viable && seenViableAge === null) {
        seenViableAge = age;
      } else if (!viable && seenViableAge !== null) {
        assert.fail(
          `${persona.name} violates monotone viability: age ${seenViableAge} is viable but later age ${age} is not`
        );
      }
    }
  }
});

test("adding starting cash never lowers net-worth series for the young saver persona", () => {
  const basePersona = GOLDEN_PERSONAS.find((persona) => persona.name === "youngSaverProrated");
  assert.ok(basePersona, "Missing youngSaverProrated persona");

  const richerFields: FieldState = { ...basePersona.fields };
  richerFields[RUNTIME_FIELDS.cashBalance] = Number(basePersona.fields[RUNTIME_FIELDS.cashBalance] ?? 0) + 50_000;

  const richerUiState: ModelUiState = { ...basePersona.uiState };
  const baseline = withFixedNow(() => runModel(basePersona.fields, basePersona.uiState));
  const richer = withFixedNow(() => runModel(richerFields, richerUiState));

  for (const [scenarioName, baseSeries, richerSeries] of [
    ["scenarioNorm", baseline.outputs.scenarioNorm.netWorthSeries, richer.outputs.scenarioNorm.netWorthSeries],
    ["scenarioEarly", baseline.outputs.scenarioEarly.netWorthSeries, richer.outputs.scenarioEarly.netWorthSeries]
  ] as const) {
    for (let i = 0; i < baseSeries.length; i += 1) {
      assert.ok(
        richerSeries[i] + EPSILON >= baseSeries[i],
        `youngSaverProrated/${scenarioName} net worth dropped at year ${baseline.outputs.years[i]}`
      );
    }
  }
});

test("liquidation rank 0 assets are excluded from staged liquidation", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 52;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 0;
  fields[RUNTIME_FIELDS.cashBalance] = 0;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 0;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 0;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 0;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 25_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 55;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 0;
  fields[RUNTIME_FIELDS.legacyAmount] = 0;
  fields[RUNTIME_FIELDS.generalInflation] = 0;
  fields[RUNTIME_FIELDS.propertyAnnualAppreciation] = 0;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0;
  fields[RUNTIME_FIELDS.rentalIncomeAnnualIncrease] = 0;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 0;
  fields[RUNTIME_FIELDS.stockSellingCostRate] = 0;
  fields[RUNTIME_FIELDS.propertyDisposalCostRate] = 0.08;
  fields[RUNTIME_FIELDS.otherAssetDisposalCostRate] = 0.04;

  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Sell Me";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 150_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].annualCostsField] = 0;
  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 1;

  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Keep Me";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].valueField] = 90_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField] = 0;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].liquidationRankField] = 0;

  const result = withFixedNow(() => runModel(fields, baseManualUiState(52)));
  const debugStages = result.outputs.scenarioNorm.debug?.liquidationStages ?? [];
  const keepMeStage = debugStages.find((stage) => stage.assetLabel === "Keep Me");
  assert.equal(keepMeStage, undefined, "Rank 0 asset should not appear in staged liquidation debug output");

  const keepMeCashFlowRow = result.outputs.scenarioNorm.cashFlow.liquidationsByProperty.find((row) => row.label === "Keep Me");
  assert.ok(keepMeCashFlowRow, "Expected Keep Me liquidation row to exist");
  assert.ok(
    keepMeCashFlowRow.values.every((value) => Math.abs(value) <= EPSILON),
    "Rank 0 asset should never record staged liquidation proceeds"
  );
});

function baseManualUiState(earlyRetirementAge: number): ModelUiState {
  return {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge,
    manualPropertyLiquidationOrder: true,
    projectionMonthOverride: 1,
    debugMode: "test"
  };
}
