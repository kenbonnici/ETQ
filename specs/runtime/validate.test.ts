import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyFieldState } from "../../src/model/excelAdapter";
import { validateFieldState } from "../../src/model/validate";
import {
  DEPENDENT_RUNTIME_GROUPS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS
} from "../../src/ui/runtimeFields";

function messagesFor(fields: ReturnType<typeof createEmptyFieldState>) {
  return validateFieldState(fields);
}

test("validation requires a complete dependent entry once any dependent field is used", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[DEPENDENT_RUNTIME_GROUPS[0].annualCostField] = 2_500;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === DEPENDENT_RUNTIME_GROUPS[0].nameField && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === DEPENDENT_RUNTIME_GROUPS[0].yearsField && message.severity === "error"),
    true
  );
});

test("validation applies the same dependent rules to the fifth slot", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[DEPENDENT_RUNTIME_GROUPS[4].annualCostField] = 3_200;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === DEPENDENT_RUNTIME_GROUPS[4].nameField && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === DEPENDENT_RUNTIME_GROUPS[4].yearsField && message.severity === "error"),
    true
  );
});

test("validation enforces property-loan companion fields", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Harbour Flat";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanBalanceField] = 150_000;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === PROPERTY_RUNTIME_GROUPS[0].loanRateField && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === PROPERTY_RUNTIME_GROUPS[0].loanRepaymentField && message.severity === "error"),
    true
  );
});

test("validation applies the same property-loan rules to the fifth slot", () => {
  const fields = createEmptyFieldState();
  fields[PROPERTY_RUNTIME_GROUPS[4].nameField] = "Marsa";
  fields[PROPERTY_RUNTIME_GROUPS[4].valueField] = 120_000;
  fields[PROPERTY_RUNTIME_GROUPS[4].loanBalanceField] = 9_524;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === PROPERTY_RUNTIME_GROUPS[4].loanRateField && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === PROPERTY_RUNTIME_GROUPS[4].loanRepaymentField && message.severity === "error"),
    true
  );
});

test("validation rejects one-off events outside the active projection window", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].nameField] = "School fees";
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].amountField] = 10_000;
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear();

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === EXPENSE_EVENT_RUNTIME_GROUPS[0].yearField && message.severity === "error"),
    true
  );
});

test("validation enforces post-retirement and other-work age bounds", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[OTHER_WORK_FIELDS.income] = 10_000;
  fields[OTHER_WORK_FIELDS.untilAge] = 47;
  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 8_000;
  fields[POST_RETIREMENT_INCOME_FIELDS.fromAge] = 70;
  fields[POST_RETIREMENT_INCOME_FIELDS.toAge] = 69;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === OTHER_WORK_FIELDS.untilAge && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === POST_RETIREMENT_INCOME_FIELDS.toAge && message.severity === "error"),
    true
  );
});
