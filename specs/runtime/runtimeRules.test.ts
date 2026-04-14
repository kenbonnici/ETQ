import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runModel } from "../../src/model";
import { createEmptyFieldState } from "../../src/model/inputSchema";
import { normalizeInputs } from "../../src/model/normalization";
import {
  createSampleDataFieldState,
  createSampleDataUiState,
  SAMPLE_DATA_EARLY_RETIREMENT_AGE
} from "../../src/model/sampleData";
import { FieldState } from "../../src/model/types";
import { INPUT_DEFINITIONS } from "../../src/ui/inputDefinitions";
import {
  buildPropertyLiquidationAssignments,
  buildPropertyLiquidationBuckets,
  buildPropertyLiquidationOrder,
  buildTimelineMilestones,
  deriveRuntimeVisibilityState,
  fieldVisible,
  FIELD_STEPPER_STEPS,
  hasExplicitPropertyLiquidationPreferences,
  hasRetireCheckEssentialErrors,
  isOutOfRangeLiquidationRank,
  isDuplicateLiquidationRank,
  RuntimeVisibilityState,
  shouldRerenderOnInput,
  syncManualPropertyOrderForNewProperties
} from "../../src/ui/runtimeRules";
import {
  ASSET_OF_VALUE_RUNTIME_GROUPS,
  DEPENDENT_RUNTIME_GROUPS,
  DOWNSIZING_FIELDS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  INCOME_EVENT_RUNTIME_GROUPS,
  LIQUIDATION_ASSET_RUNTIME_GROUPS,
  OTHER_LOAN_FIELDS,
  OTHER_WORK_FIELDS,
  PARTNER_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS,
  STOCK_MARKET_CRASH_RUNTIME_GROUPS
} from "../../src/ui/runtimeFields";

const SAMPLE_FIELDS = createSampleDataFieldState();
const SAMPLE_UI_STATE = createSampleDataUiState();
const DEFAULT_VISIBILITY: RuntimeVisibilityState = {
  visibleDependents: 1,
  visibleProperties: 1,
  visibleAssetsOfValue: 1,
  visibleIncomeEvents: 1,
  visibleExpenseEvents: 1,
  visibleStockMarketCrashes: 1
};
const LEGACY_AWARE_RETIREMENT_AGE = SAMPLE_DATA_EARLY_RETIREMENT_AGE;

function cloneFields(fields: FieldState): FieldState {
  return { ...fields };
}

test("input definitions preserve row order and semantic field ids", () => {
  const rows = INPUT_DEFINITIONS.map((def) => def.row);
  assert.deepEqual(rows, [...rows].sort((a, b) => a - b));
  assert.equal(new Set(rows).size, rows.length);
});

test("currency number fields do not fall back to a 1-unit stepper increment", () => {
  const oneUnitCurrencySteps = INPUT_DEFINITIONS
    .filter((def) => def.type === "number")
    .map((def) => ({ fieldId: def.fieldId, label: def.label, step: FIELD_STEPPER_STEPS[def.fieldId] ?? 1 }))
    .filter((row) => row.step === 1);

  assert.deepEqual(oneUnitCurrencySteps.map((row) => row.fieldId), [RUNTIME_FIELDS.stockContributionMonthly]);
});

test("blank legacy normalizes to zero and sample data keeps the expected liquidation ordering", () => {
  const blankFields = createEmptyFieldState();
  const normalizedBlank = normalizeInputs(blankFields);

  assert.equal(blankFields[RUNTIME_FIELDS.spendingAdjustmentAge1], 65);
  assert.equal(blankFields[RUNTIME_FIELDS.spendingAdjustmentAge2], 75);
  assert.equal(blankFields[RUNTIME_FIELDS.spendingAdjustmentFirstBracket], 0.05);
  assert.equal(blankFields[RUNTIME_FIELDS.spendingAdjustmentSecondBracket], -0.1);
  assert.equal(blankFields[RUNTIME_FIELDS.spendingAdjustmentFinalBracket], -0.2);
  assert.equal(normalizedBlank.partnerIncluded, false);
  assert.equal(normalizedBlank.partnerRetiresEarly, false);
  assert.equal(normalizedBlank.partnerAgeNow, null);
  assert.equal(normalizedBlank.legacyAmount, 0);
  assert.equal(SAMPLE_FIELDS[RUNTIME_FIELDS.legacyAmount], 1_000_000);
  assert.equal(SAMPLE_FIELDS[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField], 10);
  assert.equal(SAMPLE_FIELDS[PROPERTY_RUNTIME_GROUPS[4].liquidationRankField], 6);
  assert.equal(SAMPLE_FIELDS[ASSET_OF_VALUE_RUNTIME_GROUPS[0].liquidationRankField], 3);
  assert.equal(SAMPLE_FIELDS[ASSET_OF_VALUE_RUNTIME_GROUPS[4].liquidationRankField], 5);
});

test("spending adjustment boundaries switch at the next age after each edited end age", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 45;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 90;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 1_000;
  fields[RUNTIME_FIELDS.spendingAdjustmentAge1] = 55;
  fields[RUNTIME_FIELDS.spendingAdjustmentAge2] = 80;
  fields[RUNTIME_FIELDS.spendingAdjustmentFirstBracket] = 0;
  fields[RUNTIME_FIELDS.spendingAdjustmentSecondBracket] = -0.1;
  fields[RUNTIME_FIELDS.spendingAdjustmentFinalBracket] = -0.2;
  fields["assumptions.generalInflationRateAnnual"] = 0;

  const normalized = normalizeInputs(fields);
  assert.equal(normalized.spendingAdjustmentAge1, 55);
  assert.equal(normalized.spendingAdjustmentAge2, 80);

  const result = runModel(fields, {
    majorFutureEventsOpen: false,
    advancedAssumptionsOpen: false,
    earlyRetirementAge: 65,
    manualPropertyLiquidationOrder: false,
    projectionMonthOverride: 12
  });

  const age55Idx = result.outputs.ages.findIndex((age) => age === 55);
  const age56Idx = result.outputs.ages.findIndex((age) => age === 56);
  const age80Idx = result.outputs.ages.findIndex((age) => age === 80);
  const age81Idx = result.outputs.ages.findIndex((age) => age === 81);

  assert.notEqual(age55Idx, -1);
  assert.notEqual(age56Idx, -1);
  assert.notEqual(age80Idx, -1);
  assert.notEqual(age81Idx, -1);
  assert.equal(result.outputs.scenarioNorm.cashFlow.livingExpenses[age55Idx], 1_000);
  assert.equal(result.outputs.scenarioNorm.cashFlow.livingExpenses[age56Idx], 900);
  assert.equal(result.outputs.scenarioNorm.cashFlow.livingExpenses[age80Idx], 900);
  assert.equal(result.outputs.scenarioNorm.cashFlow.livingExpenses[age81Idx], 800);
});

test("retirement success requires both the cash buffer and the end-age legacy target", () => {
  const sampleDataAge = runModel(SAMPLE_FIELDS, SAMPLE_UI_STATE);
  assert.equal(sampleDataAge.outputs.scenarioEarly.retirementSuccessful, true);

  const legacyAwareSuccess = runModel(SAMPLE_FIELDS, {
    ...SAMPLE_UI_STATE,
    earlyRetirementAge: LEGACY_AWARE_RETIREMENT_AGE
  });
  assert.equal(legacyAwareSuccess.outputs.scenarioEarly.retirementSuccessful, true);

  const higherCashBufferFields = cloneFields(SAMPLE_FIELDS);
  higherCashBufferFields[RUNTIME_FIELDS.minimumCashBuffer] = 500_000;

  const cashShortfall = runModel(higherCashBufferFields, {
    ...SAMPLE_UI_STATE,
    earlyRetirementAge: LEGACY_AWARE_RETIREMENT_AGE
  });
  assert.equal(cashShortfall.outputs.scenarioEarly.retirementSuccessful, false);

  const higherLegacyFields = cloneFields(SAMPLE_FIELDS);
  const finalNetWorth = legacyAwareSuccess.outputs.scenarioEarly.netWorthSeries[
    legacyAwareSuccess.outputs.scenarioEarly.netWorthSeries.length - 1
  ] ?? 0;
  higherLegacyFields[RUNTIME_FIELDS.legacyAmount] = finalNetWorth + 1;

  const legacyShortfall = runModel(higherLegacyFields, {
    ...SAMPLE_UI_STATE,
    earlyRetirementAge: LEGACY_AWARE_RETIREMENT_AGE
  });
  assert.equal(legacyShortfall.outputs.scenarioEarly.retirementSuccessful, false);
});

test("validation and retire-check gating still key off semantic core fields", () => {
  const fields = cloneFields(SAMPLE_FIELDS);
  fields[RUNTIME_FIELDS.currentAge] = null;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = null;

  const result = runModel(fields, SAMPLE_UI_STATE);

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

  assert.equal(fieldVisible(fields, PARTNER_FIELDS.include, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.retiresEarly, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.age, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.pensionReductionPerYearEarly, DEFAULT_VISIBILITY), false);
  fields[PARTNER_FIELDS.include] = "Yes";
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.retiresEarly, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.age, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.pensionReductionPerYearEarly, DEFAULT_VISIBILITY), false);
  fields[PARTNER_FIELDS.retiresEarly] = "Yes";
  assert.equal(fieldVisible(fields, PARTNER_FIELDS.pensionReductionPerYearEarly, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, DEPENDENT_RUNTIME_GROUPS[0].annualCostField, DEFAULT_VISIBILITY), false);
  fields[DEPENDENT_RUNTIME_GROUPS[0].nameField] = "Chris";
  assert.equal(fieldVisible(fields, DEPENDENT_RUNTIME_GROUPS[0].annualCostField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanBalanceField, DEFAULT_VISIBILITY), false);
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Harbour Flat";
  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanBalanceField, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), false);
  fields[PROPERTY_RUNTIME_GROUPS[0].loanBalanceField] = 100_000;
  assert.equal(fieldVisible(fields, PROPERTY_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField, DEFAULT_VISIBILITY), false);
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Jewelry";
  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), false);
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField] = 2_500;
  assert.equal(fieldVisible(fields, ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, OTHER_LOAN_FIELDS.interestRateAnnual, DEFAULT_VISIBILITY), false);
  fields[OTHER_LOAN_FIELDS.balance] = 2_000;
  assert.equal(fieldVisible(fields, OTHER_LOAN_FIELDS.interestRateAnnual, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, POST_RETIREMENT_INCOME_FIELDS.fromAge, DEFAULT_VISIBILITY), false);
  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 12_000;
  assert.equal(fieldVisible(fields, POST_RETIREMENT_INCOME_FIELDS.fromAge, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, RUNTIME_FIELDS.stockMarketReturn, DEFAULT_VISIBILITY), false);
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 100_000;
  assert.equal(fieldVisible(fields, RUNTIME_FIELDS.stockMarketReturn, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField, DEFAULT_VISIBILITY), true);
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear() + 1;
  assert.equal(fieldVisible(fields, STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField, DEFAULT_VISIBILITY), true);

  assert.equal(fieldVisible(fields, HOME_FIELDS.housingStatus, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, HOME_FIELDS.homeValue, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, HOME_FIELDS.housingRentAnnual, DEFAULT_VISIBILITY), false);
  fields[HOME_FIELDS.housingStatus] = "Renter";
  assert.equal(fieldVisible(fields, HOME_FIELDS.housingRentAnnual, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, HOME_FIELDS.homeValue, DEFAULT_VISIBILITY), false);
  fields[HOME_FIELDS.housingStatus] = "Owner";
  assert.equal(fieldVisible(fields, HOME_FIELDS.homeValue, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, HOME_FIELDS.housingRentAnnual, DEFAULT_VISIBILITY), false);
  fields[HOME_FIELDS.housingStatus] = null;
  fields[HOME_FIELDS.homeValue] = 500_000;
  assert.equal(fieldVisible(fields, HOME_FIELDS.homeValue, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, HOME_FIELDS.housingRentAnnual, DEFAULT_VISIBILITY), false);

  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newHomeMode, DEFAULT_VISIBILITY), false);
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newHomeMode, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newHomePurchaseCost, DEFAULT_VISIBILITY), false);
  fields[DOWNSIZING_FIELDS.newHomeMode] = "Buy";
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newHomePurchaseCost, DEFAULT_VISIBILITY), true);
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newRentAnnual, DEFAULT_VISIBILITY), false);
  fields[DOWNSIZING_FIELDS.newHomeMode] = "Rent";
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newRentAnnual, DEFAULT_VISIBILITY), true);

  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() - 1;
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newHomeMode, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newHomePurchaseCost, DEFAULT_VISIBILITY), false);
  assert.equal(fieldVisible(fields, DOWNSIZING_FIELDS.newRentAnnual, DEFAULT_VISIBILITY), false);
});

test("property liquidation order preserves duplicate-rank guardrails and only appends ranks for newly activated properties", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "P1";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "P2";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 150_000;

  const active = LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 2);
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
    false
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 10),
    false
  );
  assert.equal(
    isOutOfRangeLiquidationRank(PROPERTY_RUNTIME_GROUPS[0].liquidationRankField, 11),
    true
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
  const manualOrder = buildPropertyLiquidationOrder(fields, LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 5), true);
  assert.deepEqual(manualOrder.map((group) => group.idx), [1, 0, 2, 3, 4]);
  assert.equal(hasExplicitPropertyLiquidationPreferences(fields), true);

  const assignments = buildPropertyLiquidationAssignments(manualOrder, LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 5), fields);
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
    normalizeInputs(fields, { manualOverrideActive: false }).liquidationPriority,
    [5, 3, 4, 1, 2, 0, 0, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 100_000;
  assert.deepEqual(
    normalizeInputs(fields, { manualOverrideActive: false }).liquidationPriority,
    [2, 4, 5, 1, 3, 0, 0, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 50_000;
  assert.deepEqual(
    normalizeInputs(fields, { manualOverrideActive: false }).liquidationPriority,
    [3, 5, 1, 2, 4, 0, 0, 0, 0, 0]
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
    normalizeInputs(fields, { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  );

  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 50_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 400_000;
  fields[PROPERTY_RUNTIME_GROUPS[2].valueField] = 100_000;
  fields[PROPERTY_RUNTIME_GROUPS[3].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 200_000;

  assert.deepEqual(
    normalizeInputs(fields, { manualOverrideActive: true }).liquidationPriority,
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  );
  assert.deepEqual(
    buildPropertyLiquidationOrder(fields, LIQUIDATION_ASSET_RUNTIME_GROUPS.slice(0, 5), true).map((group) => group.idx),
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

test("timeline milestone generation still uses semantic fields with sample data", () => {
  const result = runModel(SAMPLE_FIELDS, SAMPLE_UI_STATE);
  const milestones = buildTimelineMilestones(
    SAMPLE_FIELDS,
    result,
    Number(SAMPLE_FIELDS[RUNTIME_FIELDS.statutoryRetirementAge]),
    1000,
    () => ""
  );

  const labels = milestones.map((milestone) => milestone.label);
  assert.equal(labels.some((label) => label.includes("State pension starts")), true);
  assert.equal(labels.some((label) => label.includes("Other income ends")), true);
  assert.equal(labels.some((label) => label.includes("Inheritance")), true);
});

test("timeline milestones include downsizing sale, purchase, and rent-start events", () => {
  const homeownerBuy = createEmptyFieldState();
  homeownerBuy[RUNTIME_FIELDS.currentAge] = 48;
  homeownerBuy[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  homeownerBuy[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  homeownerBuy[HOME_FIELDS.homeValue] = 500_000;
  homeownerBuy[HOME_FIELDS.mortgageBalance] = 120_000;
  homeownerBuy[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;
  homeownerBuy[DOWNSIZING_FIELDS.newHomeMode] = "Buy";
  homeownerBuy[DOWNSIZING_FIELDS.newHomePurchaseCost] = 250_000;

  const homeownerBuyResult = runModel(homeownerBuy, {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: 60
  });
  const homeownerBuyLabels = buildTimelineMilestones(
    homeownerBuy,
    homeownerBuyResult,
    Number(homeownerBuy[RUNTIME_FIELDS.statutoryRetirementAge]),
    1000,
    () => ""
  ).map((milestone) => milestone.label);

  assert.equal(homeownerBuyLabels.some((label) => label.includes("Sell home")), true);
  assert.equal(homeownerBuyLabels.some((label) => label.includes("Buy downsized home")), true);

  const homeownerRent = createEmptyFieldState();
  homeownerRent[RUNTIME_FIELDS.currentAge] = 48;
  homeownerRent[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  homeownerRent[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  homeownerRent[HOME_FIELDS.homeValue] = 500_000;
  homeownerRent[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;
  homeownerRent[DOWNSIZING_FIELDS.newHomeMode] = "Rent";
  homeownerRent[DOWNSIZING_FIELDS.newRentAnnual] = 2_000;

  const homeownerRentResult = runModel(homeownerRent, {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: 60
  });
  const homeownerRentLabels = buildTimelineMilestones(
    homeownerRent,
    homeownerRentResult,
    Number(homeownerRent[RUNTIME_FIELDS.statutoryRetirementAge]),
    1000,
    () => ""
  ).map((milestone) => milestone.label);

  assert.equal(homeownerRentLabels.some((label) => label.includes("Sell home")), true);
  assert.equal(homeownerRentLabels.some((label) => label.includes("New rent starts")), true);
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

  const assetFields = createEmptyFieldState();
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[1].nameField] = "Car";
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 2);
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[2].appreciationRateField] = 0.03;
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 3);
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].valueField] = 180_000;
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 4);
  assetFields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].nameField] = "Antiques";
  assert.equal(deriveRuntimeVisibilityState(assetFields).visibleAssetsOfValue, 5);

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

  const stockMarketCrashFields = createEmptyFieldState();
  stockMarketCrashFields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].dropField] = 0.2;
  assert.equal(deriveRuntimeVisibilityState(stockMarketCrashFields).visibleStockMarketCrashes, 1);
  stockMarketCrashFields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[3].yearField] = new Date().getFullYear() + 4;
  assert.equal(deriveRuntimeVisibilityState(stockMarketCrashFields).visibleStockMarketCrashes, 4);
});

test("normalization and scenario outputs include stock market crash slots and apply crash recovery rates", () => {
  const currentYear = new Date().getFullYear();
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 0;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.1;
  fields["assets.equities.marketValue"] = 100;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = currentYear + 1;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 2;

  const normalized = normalizeInputs(fields, { manualOverrideActive: false });
  assert.equal(normalized.stockMarketCrashes.length, 5);
  assert.deepEqual(normalized.stockMarketCrashes[0], {
    year: currentYear + 1,
    dropPercentage: 0.2,
    recoveryYears: 2
  });

  const result = runModel(fields, {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: 65,
    manualPropertyLiquidationOrder: false,
    projectionMonthOverride: 1
  });

  const stockSeries = result.outputs.scenarioNorm.netWorth.stockMarketEquity;
  const recoveryRate = Math.sqrt(1 / (1 - 0.2)) - 1;
  assert.ok(stockSeries[0] !== undefined);
  assert.ok(stockSeries[1] !== undefined);
  assert.ok(stockSeries[2] !== undefined);
  assert.ok(stockSeries[3] !== undefined);
  assert.equal(Math.abs((stockSeries[0] ?? 0) - 110) < 1e-9, true);
  assert.equal(Math.abs((stockSeries[1] ?? 0) - 88) < 1e-9, true);
  assert.equal(Math.abs((stockSeries[2] ?? 0) - (88 * (1 + recoveryRate))) < 1e-9, true);
  assert.equal(Math.abs((stockSeries[3] ?? 0) - 110) < 1e-9, true);
});

test("stock market investments trigger structural rerenders for crash visibility", () => {
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, "", ""), false);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, "", 0), false);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, "", 100), true);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, 100, 200), false);
  assert.equal(shouldRerenderOnInput(RUNTIME_FIELDS.stockMarketInvestments, 100, 0), true);
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

  const normalized = normalizeInputs(fields, { manualOverrideActive: false });
  assert.equal(normalized.dependents.length, 5);
  assert.deepEqual(normalized.dependents[3], { name: "Jordan", annualCost: 2_400, yearsToSupport: 4 });
  assert.deepEqual(normalized.dependents[4], { name: "Taylor", annualCost: 3_200, yearsToSupport: 2 });

  const result = runModel(fields, {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
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

  const normalized = normalizeInputs(fields, { manualOverrideActive: false });
  assert.equal(normalized.properties.length, 5);
  assert.deepEqual(normalized.properties[3], {
    name: "Gudja",
    value: 80_000,
    annualCosts: 1_000,
    rentalIncome: 5_000,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0,
    plannedSellYear: null
  });
  assert.deepEqual(normalized.properties[4], {
    name: "Marsa",
    value: 120_000,
    annualCosts: 800,
    rentalIncome: 6_500,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0,
    plannedSellYear: null
  });

  const result = runModel(fields, {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: 55,
    manualPropertyLiquidationOrder: false
  });

  assert.equal(result.outputs.scenarioNorm.cashFlow.rentalIncomeByProperty.length, 5);
  assert.equal(result.outputs.scenarioNorm.cashFlow.rentalIncomeByProperty[3].label, "Gudja");
  assert.equal(result.outputs.scenarioNorm.cashFlow.rentalIncomeByProperty[4].label, "Marsa");
  assert.equal(result.outputs.scenarioNorm.netWorth.properties.length, 11);
  assert.equal(result.outputs.scenarioNorm.netWorth.properties[4].label, "Gudja");
  assert.equal(result.outputs.scenarioNorm.netWorth.properties[5].label, "Marsa");
});

test("normalization and output reporting include assets of value in the combined liquidation pool", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 50_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].nameField] = "Boat";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].valueField] = 180_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[3].appreciationRateField] = -0.05;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].nameField] = "Antiques";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].valueField] = 82_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[4].appreciationRateField] = 0.02;

  const normalized = normalizeInputs(fields, { manualOverrideActive: false });
  assert.equal(normalized.assetsOfValue.length, 5);
  assert.deepEqual(normalized.assetsOfValue[3], {
    name: "Boat",
    value: 180_000,
    annualCosts: 0,
    appreciationRate: -0.05,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0,
    plannedSellYear: null
  });
  assert.deepEqual(normalized.assetsOfValue[4], {
    name: "Antiques",
    value: 82_000,
    annualCosts: 0,
    appreciationRate: 0.02,
    loanBalance: 0,
    loanRate: 0,
    loanRepaymentMonthly: 0,
    plannedSellYear: null
  });

  const result = runModel(fields, {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge: 55,
    manualPropertyLiquidationOrder: false
  });

  assert.equal(result.outputs.scenarioNorm.cashFlow.liquidationsByProperty.length, 10);
  assert.equal(result.outputs.scenarioNorm.cashFlow.liquidationsByProperty[8].label, "Boat");
  assert.equal(result.outputs.scenarioNorm.cashFlow.liquidationsByProperty[9].label, "Antiques");
  assert.equal(result.outputs.scenarioNorm.netWorth.loans[10].label, "Antiques loan");
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
