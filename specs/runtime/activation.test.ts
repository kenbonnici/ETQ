import assert from "node:assert/strict";
import test from "node:test";

import { pruneInactiveFieldState } from "../../src/model/activation";
import { createEmptyFieldState } from "../../src/model/inputSchema";
import { DOWNSIZING_FIELDS, HOME_FIELDS, RUNTIME_FIELDS } from "../../src/ui/runtimeFields";

test("invalid downsizing years prune dependent downsizing inputs before calculation", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() - 1;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "Buy";
  fields[DOWNSIZING_FIELDS.newHomePurchaseCost] = 250_000;

  const pruned = pruneInactiveFieldState(fields);
  assert.equal(pruned[DOWNSIZING_FIELDS.year], new Date().getFullYear() - 1);
  assert.equal(pruned[DOWNSIZING_FIELDS.newHomeMode], null);
  assert.equal(pruned[DOWNSIZING_FIELDS.newHomePurchaseCost], null);
  assert.equal(pruned[DOWNSIZING_FIELDS.newRentAnnual], null);
});

test("valid downsizing years keep the active downsizing inputs", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 2;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "Buy";
  fields[DOWNSIZING_FIELDS.newHomePurchaseCost] = 250_000;

  const pruned = pruneInactiveFieldState(fields);
  assert.equal(pruned[DOWNSIZING_FIELDS.newHomeMode], "Buy");
  assert.equal(pruned[DOWNSIZING_FIELDS.newHomePurchaseCost], 250_000);
});
