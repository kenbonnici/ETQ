import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyFieldState } from "../../src/model/inputSchema";
import { FieldState } from "../../src/model/types";
import {
  ActivationCtx,
  buildFullSequence,
  findFirstUnanswered,
  isQuestionActive,
  pruneOrphanedAnswers
} from "../../src/onboarding/sequence";

function ctx(fields: FieldState, gates: Record<string, "YES" | "NO" | null> = {}): ActivationCtx {
  return { fields, gates };
}

test("initial sequence starts at profile.currentAge", () => {
  const sequence = buildFullSequence();
  const first = findFirstUnanswered(sequence, ctx(createEmptyFieldState()), new Set());
  assert.ok(first);
  assert.equal(first?.id, "age");
});

test("partner questions are skipped when partner.include is No", () => {
  const sequence = buildFullSequence();
  const fields = createEmptyFieldState();
  fields["profile.currentAge"] = 48;
  fields["partner.include"] = "No";
  const gates: Record<string, "YES" | "NO" | null> = {};
  const answered = new Set<string>(["age", "partnerInclude"]);
  const next = findFirstUnanswered(sequence, ctx(fields, gates), answered);
  assert.ok(next);
  assert.notEqual(next?.id, "partnerAge");
  assert.notEqual(next?.id, "partnerRetiresEarly");
  assert.equal(next?.id, "userIncome");
});

test("partner questions are active when partner.include is Yes", () => {
  const sequence = buildFullSequence();
  const fields = createEmptyFieldState();
  fields["profile.currentAge"] = 48;
  fields["partner.include"] = "Yes";
  const partnerAge = sequence.find((s) => s.id === "partnerAge");
  assert.ok(partnerAge);
  assert.equal(isQuestionActive(partnerAge!, ctx(fields)), true);
});

test("renter branch skips home value and mortgage questions", () => {
  const sequence = buildFullSequence();
  const fields = createEmptyFieldState();
  fields["profile.currentAge"] = 48;
  fields["housing.status"] = "Renter";
  const homeValue = sequence.find((s) => s.id === "homeValue");
  const hasMortgage = sequence.find((s) => s.id === "hasMortgage");
  const rent = sequence.find((s) => s.id === "rent");
  assert.equal(isQuestionActive(homeValue!, ctx(fields)), false);
  assert.equal(isQuestionActive(hasMortgage!, ctx(fields)), false);
  assert.equal(isQuestionActive(rent!, ctx(fields)), true);
});

test("owner without mortgage skips mortgage balance/rate/repayment", () => {
  const sequence = buildFullSequence();
  const fields = createEmptyFieldState();
  fields["profile.currentAge"] = 48;
  fields["housing.status"] = "Owner";
  fields["housing.01Residence.marketValue"] = 500_000;
  const gates = { hasMortgage: "NO" as const };
  const mortgageBalance = sequence.find((s) => s.id === "mortgageBalance");
  const mortgageRate    = sequence.find((s) => s.id === "mortgageRate");
  const mortgageRepay   = sequence.find((s) => s.id === "mortgageRepayment");
  assert.equal(isQuestionActive(mortgageBalance!, ctx(fields, gates)), false);
  assert.equal(isQuestionActive(mortgageRate!,    ctx(fields, gates)), false);
  assert.equal(isQuestionActive(mortgageRepay!,   ctx(fields, gates)), false);
});

test("rentalGrowth assumption only activates when at least one property has rental income", () => {
  const sequence = buildFullSequence();
  const rentalGrowth = sequence.find((s) => s.id === "rentalGrowth");
  assert.ok(rentalGrowth);
  const fields = createEmptyFieldState();
  fields["profile.currentAge"] = 48;
  const gates = { propertiesGate: "YES" as const };
  assert.equal(
    isQuestionActive(rentalGrowth!, ctx(fields, gates)),
    false,
    "no rental income yet"
  );
  fields["properties.01.rentalIncomeNetAnnual"] = 12_000;
  assert.equal(
    isQuestionActive(rentalGrowth!, ctx(fields, gates)),
    true,
    "becomes active after any rental income"
  );
});

test("switching Owner -> Renter prunes orphaned home answers", () => {
  const sequence = buildFullSequence();
  const answered = new Set<string>([
    "age", "partnerInclude", "userIncome", "livingExpenses", "spendingTaper",
    "housingStatus", "homeValue", "propertyGrowth", "hasMortgage"
  ]);
  const fields = createEmptyFieldState();
  fields["profile.currentAge"] = 48;
  fields["housing.status"] = "Renter";
  const pruned = pruneOrphanedAnswers(sequence, ctx(fields), answered);
  assert.equal(pruned.has("homeValue"), false);
  assert.equal(pruned.has("propertyGrowth"), false);
  assert.equal(pruned.has("hasMortgage"), false);
  assert.equal(pruned.has("housingStatus"), true);
  assert.equal(pruned.has("age"), true);
});
