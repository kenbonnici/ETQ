import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyLivingExpenseCategoryValues,
  hasAnyLivingExpenseCategoryValue,
  seedLivingExpenseCategoryValuesFromTotal,
  sumLivingExpenseCategoryValues
} from "../../src/ui/livingExpenses";

test("living expense helper state starts blank and only aggregates entered categories", () => {
  const values = createEmptyLivingExpenseCategoryValues();

  assert.equal(hasAnyLivingExpenseCategoryValue(values), false);
  assert.equal(sumLivingExpenseCategoryValues(values), 0);

  values.groceries = 12_000;
  values.utilities = 3_600;
  values.travelAndHolidays = 4_400;

  assert.equal(hasAnyLivingExpenseCategoryValue(values), true);
  assert.equal(sumLivingExpenseCategoryValues(values), 20_000);
});

test("expanded living expenses can be seeded from an existing single total", () => {
  const seeded = seedLivingExpenseCategoryValuesFromTotal(48_000);

  assert.equal(seeded.miscellaneous, 48_000);
  assert.equal(sumLivingExpenseCategoryValues(seeded), 48_000);
});
