import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyFieldState } from "../../src/model/inputSchema";
import { validateFieldState } from "../../src/model/validate";
import {
  DEPENDENT_RUNTIME_GROUPS,
  DOWNSIZING_FIELDS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS,
  STOCK_MARKET_CRASH_RUNTIME_GROUPS
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
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear() - 1;

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

test("validation allows blank other-work end age when income is entered", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[OTHER_WORK_FIELDS.income] = 10_000;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === OTHER_WORK_FIELDS.untilAge && message.severity === "error"),
    false
  );
});

test("validation clamps open-ended age fields to realistic planning ages", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[OTHER_WORK_FIELDS.income] = 10_000;
  fields[OTHER_WORK_FIELDS.untilAge] = 121;
  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 8_000;
  fields[POST_RETIREMENT_INCOME_FIELDS.fromAge] = 70;
  fields[POST_RETIREMENT_INCOME_FIELDS.toAge] = 121;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === OTHER_WORK_FIELDS.untilAge && message.severity === "error" && message.message.includes("at most 120")),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === POST_RETIREMENT_INCOME_FIELDS.toAge && message.severity === "error" && message.message.includes("at most 120")),
    true
  );
});

test("validation rejects interest rates above 20 percent", () => {
  const fields = createEmptyFieldState();
  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[HOME_FIELDS.mortgageBalance] = 120_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.25;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 1_800;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === HOME_FIELDS.mortgageInterestRateAnnual && message.severity === "error" && message.message.includes("at most 20%")),
    true
  );
});

test("validation rejects pension start ages beyond the planning horizon", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 90;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === RUNTIME_FIELDS.statutoryRetirementAge && message.severity === "error" && message.message.includes("cannot exceed plan to live until age")),
    true
  );
});

test("validation enforces spending bracket ages against current age, ordering, and horizon", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 60;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[RUNTIME_FIELDS.spendingAdjustmentAge1] = 59;
  fields[RUNTIME_FIELDS.spendingAdjustmentAge2] = 59;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === RUNTIME_FIELDS.spendingAdjustmentAge1 && message.severity === "error" && message.message.includes("current age or later")),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === RUNTIME_FIELDS.spendingAdjustmentAge2 && message.severity === "error" && message.message.includes("greater than first bracket end age")),
    true
  );
});

test("validation warns on typo-like monetary amounts", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[RUNTIME_FIELDS.cashBalance] = 100_000_001;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === RUNTIME_FIELDS.cashBalance && message.severity === "warning" && message.message.includes("unusually high")),
    true
  );
});

test("validation requires a complete stock market crash entry once any crash field is used", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear() + 1;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField && message.severity === "error"),
    true
  );
});

test("validation rejects stock market crash years beyond the projection horizon", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 50;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear() + 5;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 2;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField && message.severity === "error"),
    true
  );
});

test("validation rejects duplicate stock market crash years", () => {
  const fields = createEmptyFieldState();
  const crashYear = new Date().getFullYear() + 2;
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = crashYear;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].yearField] = crashYear;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].dropField] = 0.15;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].recoveryField] = 1;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some((message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].yearField && message.message.includes("unique")),
    true
  );
});

test("validation rejects overlapping stock market crash recovery windows", () => {
  const fields = createEmptyFieldState();
  const crashYear = new Date().getFullYear() + 2;
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = crashYear;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 3;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].yearField] = crashYear + 3;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].dropField] = 0.15;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].recoveryField] = 1;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some(
      (message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].yearField
        && message.message.includes("fully recovered")
    ),
    true
  );
});

test("validation warns on unusually severe or slow stock market crash assumptions", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = new Date().getFullYear() + 2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.55;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 11;

  const messages = messagesFor(fields);

  assert.equal(
    messages.some(
      (message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField
        && message.severity === "warning"
        && message.message.includes("unusually severe")
    ),
    true
  );
  assert.equal(
    messages.some(
      (message) => message.fieldId === STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField
        && message.severity === "warning"
        && message.message.includes("unusually long")
    ),
    true
  );
});

test("validation requires a buy-or-rent choice and replacement home details for homeowner downsizing", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields["housing.01Residence.marketValue"] = 500_000;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;

  let messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newHomeMode && message.severity === "error"),
    true
  );

  fields[DOWNSIZING_FIELDS.newHomeMode] = "Buy";
  messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newHomePurchaseCost && message.severity === "error"),
    true
  );

  fields[DOWNSIZING_FIELDS.newHomeMode] = "Rent";
  messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newRentAnnual && message.severity === "error"),
    true
  );
});

test("validation requires replacement rent when downsizing from renting", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;

  const messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newRentAnnual && message.severity === "error"),
    true
  );
});

test("validation rejects downsizing years outside the active projection window", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 50;
  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() - 1;

  let messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.year && message.severity === "error"),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newHomeMode && message.severity === "error"),
    false
  );

  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 5;
  messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.year && message.severity === "error"),
    true
  );
});

test("validation warns when downsizing assumptions do not look cheaper or equity-releasing", () => {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[HOME_FIELDS.mortgageBalance] = 320_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.04;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 1_800;
  fields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "Buy";
  fields[DOWNSIZING_FIELDS.newHomePurchaseCost] = 500_000;

  let messages = messagesFor(fields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newHomePurchaseCost && message.severity === "warning" && message.message.includes("not lower")),
    true
  );
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newHomePurchaseCost && message.severity === "warning" && message.message.includes("cash purchase")),
    false
  );

  const rentingFields = createEmptyFieldState();
  rentingFields[RUNTIME_FIELDS.currentAge] = 48;
  rentingFields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  rentingFields[RUNTIME_FIELDS.lifeExpectancyAge] = 85;
  rentingFields[HOME_FIELDS.housingRentAnnual] = 5_000;
  rentingFields[DOWNSIZING_FIELDS.year] = new Date().getFullYear() + 4;
  rentingFields[DOWNSIZING_FIELDS.newRentAnnual] = 5_200;

  messages = messagesFor(rentingFields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newRentAnnual && message.severity === "warning" && message.message.includes("not lower")),
    true
  );

  rentingFields[DOWNSIZING_FIELDS.newRentAnnual] = 2_000;
  messages = messagesFor(rentingFields);
  assert.equal(
    messages.some((message) => message.fieldId === DOWNSIZING_FIELDS.newRentAnnual && message.severity === "warning" && message.message.includes("not lower")),
    false
  );
});
