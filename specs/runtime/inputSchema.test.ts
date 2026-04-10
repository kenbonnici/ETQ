import test from "node:test";
import assert from "node:assert/strict";

import { ALL_FIELD_IDS } from "../../src/model/fieldRegistry";
import {
  ASSET_OF_VALUE_GROUPS,
  ALLOW_NEGATIVE_FIELDS,
  COERCED_NUMERIC_BOUNDS,
  createEmptyFieldState,
  DEPENDENT_GROUPS,
  EXPENSE_EVENT_GROUPS,
  FIELD_VALIDATION_RULES,
  HOME_LOAN_GROUP,
  INCOME_EVENT_GROUPS,
  INPUT_DEFINITION_BY_FIELD_ID,
  INPUT_DEFINITIONS,
  LIQUIDATION_RANK_FIELDS,
  OTHER_LOAN_GROUP,
  OTHER_WORK_GROUP,
  POST_RETIREMENT_INCOME_GROUP,
  PROJECTION_GATE_FIELDS,
  PROPERTY_GROUPS,
  REQUIRED_CORE_FIELDS,
  SKIP_REVEAL_CRITICAL_FIELDS,
  STOCK_MARKET_CRASH_GROUPS
} from "../../src/model/inputSchema";

test("field registry and input definitions stay in exact semantic lockstep", () => {
  assert.deepEqual(INPUT_DEFINITIONS.map((def) => def.fieldId), ALL_FIELD_IDS);
  assert.equal(new Set(ALL_FIELD_IDS).size, ALL_FIELD_IDS.length);

  for (const def of INPUT_DEFINITIONS) {
    assert.equal(INPUT_DEFINITION_BY_FIELD_ID[def.fieldId], def);
  }
});

test("semantic schema exports preserve counts, ordering, and shared invariants", () => {
  assert.equal(DEPENDENT_GROUPS.length, 5);
  assert.equal(PROPERTY_GROUPS.length, 5);
  assert.equal(ASSET_OF_VALUE_GROUPS.length, 5);
  assert.equal(INCOME_EVENT_GROUPS.length, 3);
  assert.equal(EXPENSE_EVENT_GROUPS.length, 3);
  assert.equal(STOCK_MARKET_CRASH_GROUPS.length, 5);
  assert.equal(LIQUIDATION_RANK_FIELDS.length, 10);

  assert.deepEqual(REQUIRED_CORE_FIELDS, [
    "profile.currentAge",
    "retirement.statutoryAge",
    "spending.livingExpenses.annual",
    "planning.lifeExpectancyAge"
  ]);
  assert.deepEqual(PROJECTION_GATE_FIELDS, [
    "profile.currentAge",
    "retirement.statutoryAge",
    "planning.lifeExpectancyAge"
  ]);
  assert.deepEqual(SKIP_REVEAL_CRITICAL_FIELDS, PROJECTION_GATE_FIELDS);

  assert.equal(HOME_LOAN_GROUP.homeValueField, "housing.01Residence.marketValue");
  assert.equal(OTHER_WORK_GROUP.incomeField, "income.otherWork.netAnnual");
  assert.equal(OTHER_LOAN_GROUP.balanceField, "debts.other.balance");
  assert.equal(POST_RETIREMENT_INCOME_GROUP.amountField, "income.postRetirementSupplement.annual");
});

test("default field state and validation metadata stay semantic", () => {
  const blank = createEmptyFieldState();

  assert.equal(blank["spending.adjustments.firstBracket.endAge"], 65);
  assert.equal(blank["spending.adjustments.secondBracket.endAge"], 75);
  assert.equal(blank["spending.adjustments.firstBracket.deltaRate"], 0);
  assert.equal(blank["spending.adjustments.secondBracket.deltaRate"], -0.1);
  assert.equal(blank["spending.adjustments.finalBracket.deltaRate"], -0.2);

  assert.equal(ALLOW_NEGATIVE_FIELDS.has("assumptions.generalInflationRateAnnual"), true);
  assert.deepEqual(COERCED_NUMERIC_BOUNDS["planning.lifeExpectancyAge"], { min: 19, max: 120 });
  assert.deepEqual(FIELD_VALIDATION_RULES["liquidation.stockSellingCostRate"]?.warningBounds, { max: 0.25 });
});
