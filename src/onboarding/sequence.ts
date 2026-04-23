import { FieldId } from "../model/fieldRegistry";
import { FieldState, RawInputValue } from "../model/types";

export type QuestionKind =
  | "integer"
  | "currency"
  | "percent"
  | "yesNo"
  | "ownerRenter"
  | "spendingTaper"
  | "appreciationChoice"
  | "text";

export interface QuestionDef {
  id: string;
  chapter: string;
  chapterTitle: string;
  kind: QuestionKind;
  prompt: string;
  helper?: string;
  fieldId?: FieldId;
  gateId?: string;
  skippable?: boolean;
  assumption?: boolean;
  defaultAssumptionLabel?: string;
  activeWhen?: (ctx: ActivationCtx) => boolean;
}

export interface ActivationCtx {
  fields: FieldState;
  gates: Record<string, "YES" | "NO" | null>;
}

const CHAPTERS = {
  about:     { id: "about",     title: "About you" },
  income:    { id: "income",    title: "Money coming in" },
  spending:  { id: "spending",  title: "Money going out" },
  housing:   { id: "housing",   title: "Where you live" },
  savings:   { id: "savings",   title: "What you've set aside" },
  property:  { id: "property",  title: "Investment properties" },
  valuables: { id: "valuables", title: "Other things of value" },
  people:    { id: "people",    title: "People you support" },
  pension:   { id: "pension",   title: "The pension that kicks in later" },
  debts:     { id: "debts",     title: "Any debts we haven't mentioned" },
  handoff:   { id: "handoff",   title: "" }
} as const;

function isYes(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "YES";
}

function isNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function gateYes(ctx: ActivationCtx, id: string): boolean {
  return ctx.gates[id] === "YES";
}

function partnerIncluded(ctx: ActivationCtx): boolean {
  return isYes(ctx.fields["partner.include"]);
}

function isOwner(ctx: ActivationCtx): boolean {
  const status = String(ctx.fields["housing.status"] ?? "").trim().toUpperCase();
  if (status === "OWNER") return true;
  if (status === "RENTER") return false;
  return ctx.gates["housingStatus"] === "YES";
}

function isRenter(ctx: ActivationCtx): boolean {
  const status = String(ctx.fields["housing.status"] ?? "").trim().toUpperCase();
  if (status === "RENTER") return true;
  if (status === "OWNER") return false;
  return ctx.gates["housingStatus"] === "NO";
}

function hasMortgage(ctx: ActivationCtx): boolean {
  return ctx.gates["hasMortgage"] === "YES";
}

export function makeAboutSequence(): QuestionDef[] {
  return [
    {
      id: "age",
      chapter: CHAPTERS.about.id,
      chapterTitle: CHAPTERS.about.title,
      kind: "integer",
      fieldId: "profile.currentAge",
      prompt: "Let's start simple — how old are you?"
    },
    {
      id: "partnerInclude",
      chapter: CHAPTERS.about.id,
      chapterTitle: CHAPTERS.about.title,
      kind: "yesNo",
      fieldId: "partner.include",
      prompt: "Is there a partner sharing this plan with you?"
    },
    {
      id: "partnerAge",
      chapter: CHAPTERS.about.id,
      chapterTitle: CHAPTERS.about.title,
      kind: "integer",
      fieldId: "partner.profile.currentAge",
      prompt: "And how old is your partner?",
      activeWhen: partnerIncluded
    },
    {
      id: "partnerRetiresEarly",
      chapter: CHAPTERS.about.id,
      chapterTitle: CHAPTERS.about.title,
      kind: "yesNo",
      fieldId: "partner.retirement.alsoRetiresEarly",
      prompt: "Would you and your partner like to retire early together?",
      helper: "Your statutory retirement ages are set later on — this is about retiring earlier if you can.",
      activeWhen: partnerIncluded
    }
  ];
}

export function makeIncomeSequence(): QuestionDef[] {
  return [
    {
      id: "userIncome",
      chapter: CHAPTERS.income.id,
      chapterTitle: CHAPTERS.income.title,
      kind: "currency",
      fieldId: "income.employment.netAnnual",
      prompt: "What's your annual take-home income from your main occupation?",
      helper: "After tax, after pension contributions. Just you — we'll ask about your partner next.",
      skippable: true
    },
    {
      id: "partnerIncome",
      chapter: CHAPTERS.income.id,
      chapterTitle: CHAPTERS.income.title,
      kind: "currency",
      fieldId: "partner.income.employment.netAnnual",
      prompt: "And your partner's take-home from their main job?",
      skippable: true,
      activeWhen: partnerIncluded
    }
  ];
}

export function makeSpendingSequence(): QuestionDef[] {
  return [
    {
      id: "livingExpenses",
      chapter: CHAPTERS.spending.id,
      chapterTitle: CHAPTERS.spending.title,
      kind: "currency",
      fieldId: "spending.livingExpenses.annual",
      prompt: "And roughly how much do you spend in a typical year?",
      helper: "An honest guess is better than a precise one."
    },
    {
      id: "spendingTaper",
      chapter: CHAPTERS.spending.id,
      chapterTitle: CHAPTERS.spending.title,
      kind: "spendingTaper",
      assumption: true,
      defaultAssumptionLabel: "gently tapering with age",
      prompt: "Most people spend a bit less as they age — less commuting, less going out. Should we taper gently, or hold steady?"
    }
  ];
}

export function makeHousingSequence(): QuestionDef[] {
  return [
    {
      id: "housingStatus",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "ownerRenter",
      fieldId: "housing.status",
      prompt: "Do you own your home, or rent?"
    },
    {
      id: "homeValue",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "currency",
      fieldId: "housing.01Residence.marketValue",
      prompt: "What's your home worth today, roughly?",
      activeWhen: isOwner
    },
    {
      id: "propertyGrowth",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "percent",
      fieldId: "assumptions.propertyAppreciationRateAnnual",
      assumption: true,
      defaultAssumptionLabel: "property values drifting up ~3% a year",
      prompt: "And we'll let property values drift up about 3% a year — that rate covers your home and any investment properties. Sound right?",
      activeWhen: isOwner
    },
    {
      id: "hasMortgage",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "yesNo",
      gateId: "hasMortgage",
      prompt: "Is there a mortgage still on it?",
      activeWhen: isOwner
    },
    {
      id: "mortgageBalance",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "currency",
      fieldId: "housing.01Residence.mortgage.balance",
      prompt: "How much is still owed?",
      activeWhen: (ctx) => isOwner(ctx) && hasMortgage(ctx)
    },
    {
      id: "mortgageRate",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "percent",
      fieldId: "housing.01Residence.mortgage.interestRateAnnual",
      prompt: "At what interest rate?",
      activeWhen: (ctx) => isOwner(ctx) && hasMortgage(ctx)
    },
    {
      id: "mortgageRepayment",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "currency",
      fieldId: "housing.01Residence.mortgage.monthlyRepayment",
      prompt: "And the monthly repayment?",
      activeWhen: (ctx) => isOwner(ctx) && hasMortgage(ctx)
    },
    {
      id: "rent",
      chapter: CHAPTERS.housing.id,
      chapterTitle: CHAPTERS.housing.title,
      kind: "currency",
      fieldId: "housing.rentAnnual",
      prompt: "What's the annual rent?",
      helper: "Yearly total is easier to think about than monthly for long-term planning.",
      activeWhen: isRenter
    }
  ];
}

export function makeSavingsSequence(): QuestionDef[] {
  return [
    {
      id: "cash",
      chapter: CHAPTERS.savings.id,
      chapterTitle: CHAPTERS.savings.title,
      kind: "currency",
      fieldId: "assets.cash.totalBalance",
      prompt: "How much do you have in liquid savings — current accounts, savings, bonds, term deposits?",
      helper: "Everything you could reach within a month or two. Stocks come next."
    },
    {
      id: "equities",
      chapter: CHAPTERS.savings.id,
      chapterTitle: CHAPTERS.savings.title,
      kind: "currency",
      fieldId: "assets.equities.marketValue",
      prompt: "And invested in the stock market — ETFs, funds, pensions?",
      helper: "Rough total across everything is fine."
    },
    {
      id: "equityReturn",
      chapter: CHAPTERS.savings.id,
      chapterTitle: CHAPTERS.savings.title,
      kind: "percent",
      fieldId: "assumptions.equityReturnRateAnnual",
      assumption: true,
      defaultAssumptionLabel: "stocks returning ~8% a year",
      prompt: "We're assuming those grow around 8% a year. Change that, or leave it?"
    },
    {
      id: "equityContrib",
      chapter: CHAPTERS.savings.id,
      chapterTitle: CHAPTERS.savings.title,
      kind: "currency",
      fieldId: "assets.equities.monthlyContribution",
      prompt: "Are you adding to that each month?",
      skippable: true
    }
  ];
}

function propertySequence(idx: 1 | 2 | 3 | 4 | 5): QuestionDef[] {
  const pad = String(idx).padStart(2, "0");
  const nameField  = `properties.${pad}.displayName` as FieldId;
  const valueField = `properties.${pad}.marketValue` as FieldId;
  const balanceField   = `properties.${pad}.loan.balance` as FieldId;
  const rentField  = `properties.${pad}.rentalIncomeNetAnnual` as FieldId;
  const opCostField = `properties.${pad}.annualOperatingCost` as FieldId;
  const prevNameField = idx === 1 ? null : `properties.${String(idx - 1).padStart(2, "0")}.displayName` as FieldId;
  const gate = `property${idx}Gate`;
  const active = (ctx: ActivationCtx): boolean => {
    if (idx === 1) return gateYes(ctx, "propertiesGate");
    if (!prevNameField) return false;
    const prev = String(ctx.fields[prevNameField] ?? "").trim();
    if (!prev) return false;
    return gateYes(ctx, gate);
  };
  const addGate: QuestionDef | null = idx === 1
    ? null
    : {
        id: `property${idx}Gate`,
        chapter: CHAPTERS.property.id,
        chapterTitle: CHAPTERS.property.title,
        kind: "yesNo",
        gateId: gate,
        prompt: "Add another investment property?",
        activeWhen: (ctx) => {
          if (!prevNameField) return false;
          const prev = String(ctx.fields[prevNameField] ?? "").trim();
          return prev.length > 0;
        }
      };
  return [
    ...(addGate ? [addGate] : []),
    {
      id: `property${idx}Name`,
      chapter: CHAPTERS.property.id,
      chapterTitle: CHAPTERS.property.title,
      kind: "text",
      fieldId: nameField,
      prompt: idx === 1 ? "Let's add the first one. What should we call it?" : "What should we call this one?",
      helper: 'A friendly name — "London flat", "the cottage".',
      activeWhen: active
    },
    {
      id: `property${idx}Value`,
      chapter: CHAPTERS.property.id,
      chapterTitle: CHAPTERS.property.title,
      kind: "currency",
      fieldId: valueField,
      prompt: "What's it worth today?",
      activeWhen: active
    },
    {
      id: `property${idx}Loan`,
      chapter: CHAPTERS.property.id,
      chapterTitle: CHAPTERS.property.title,
      kind: "currency",
      fieldId: balanceField,
      prompt: "Any mortgage or debt against it?",
      helper: "Just the balance — leave blank if none.",
      skippable: true,
      activeWhen: active
    },
    {
      id: `property${idx}Rent`,
      chapter: CHAPTERS.property.id,
      chapterTitle: CHAPTERS.property.title,
      kind: "currency",
      fieldId: rentField,
      prompt: "Roughly what does it bring in each year in rent?",
      helper: "Leave blank if it's not tenanted yet.",
      skippable: true,
      activeWhen: active
    },
    {
      id: `property${idx}Cost`,
      chapter: CHAPTERS.property.id,
      chapterTitle: CHAPTERS.property.title,
      kind: "currency",
      fieldId: opCostField,
      prompt: "And what does it cost to run each year — maintenance, management?",
      skippable: true,
      activeWhen: active
    }
  ];
}

export function makePropertySequence(): QuestionDef[] {
  const gate: QuestionDef = {
    id: "propertiesGate",
    chapter: CHAPTERS.property.id,
    chapterTitle: CHAPTERS.property.title,
    kind: "yesNo",
    gateId: "propertiesGate",
    prompt: "Do you own any investment properties — somewhere you rent out, or plan to?"
  };
  const anyRental = (ctx: ActivationCtx): boolean => {
    for (let i = 1; i <= 5; i += 1) {
      const pad = String(i).padStart(2, "0");
      if (isNum(ctx.fields[`properties.${pad}.rentalIncomeNetAnnual` as FieldId]) > 0) return true;
    }
    return false;
  };
  const rentalGrowth: QuestionDef = {
    id: "rentalGrowth",
    chapter: CHAPTERS.property.id,
    chapterTitle: CHAPTERS.property.title,
    kind: "percent",
    fieldId: "assumptions.rentalIncomeGrowthRateAnnual",
    assumption: true,
    defaultAssumptionLabel: "rents rising ~2% a year",
    prompt: "And we'll assume the rent rises each year with inflation. OK, or would you like a different rate?",
    activeWhen: (ctx) => gateYes(ctx, "propertiesGate") && anyRental(ctx)
  };
  const renterPropertyGrowth: QuestionDef = {
    id: "propertyGrowthRenter",
    chapter: CHAPTERS.property.id,
    chapterTitle: CHAPTERS.property.title,
    kind: "percent",
    fieldId: "assumptions.propertyAppreciationRateAnnual",
    assumption: true,
    defaultAssumptionLabel: "property values drifting up ~3% a year",
    prompt: "One last thing: we'll let property values drift up about 3% a year. Sound right?",
    activeWhen: (ctx) => gateYes(ctx, "propertiesGate") && isRenter(ctx)
  };
  const items: QuestionDef[] = [];
  for (let i = 1 as 1 | 2 | 3 | 4 | 5; i <= 5; i = (i + 1) as 1 | 2 | 3 | 4 | 5) items.push(...propertySequence(i));
  return [gate, ...items, rentalGrowth, renterPropertyGrowth];
}

function assetSequence(idx: 1 | 2 | 3 | 4 | 5): QuestionDef[] {
  const pad = String(idx).padStart(2, "0");
  const nameField  = `assetsOfValue.${pad}.displayName` as FieldId;
  const valueField = `assetsOfValue.${pad}.marketValue` as FieldId;
  const appField   = `assetsOfValue.${pad}.appreciationRateAnnual` as FieldId;
  const balanceField  = `assetsOfValue.${pad}.loan.balance` as FieldId;
  const opCostField = `assetsOfValue.${pad}.annualCosts` as FieldId;
  const prevNameField = idx === 1 ? null : `assetsOfValue.${String(idx - 1).padStart(2, "0")}.displayName` as FieldId;
  const gate = `asset${idx}Gate`;
  const active = (ctx: ActivationCtx): boolean => {
    if (idx === 1) return gateYes(ctx, "assetsGate");
    if (!prevNameField) return false;
    const prev = String(ctx.fields[prevNameField] ?? "").trim();
    if (!prev) return false;
    return gateYes(ctx, gate);
  };
  const addGate: QuestionDef | null = idx === 1
    ? null
    : {
        id: `asset${idx}Gate`,
        chapter: CHAPTERS.valuables.id,
        chapterTitle: CHAPTERS.valuables.title,
        kind: "yesNo",
        gateId: gate,
        prompt: "Add another?",
        activeWhen: (ctx) => {
          if (!prevNameField) return false;
          const prev = String(ctx.fields[prevNameField] ?? "").trim();
          return prev.length > 0;
        }
      };
  return [
    ...(addGate ? [addGate] : []),
    {
      id: `asset${idx}Name`,
      chapter: CHAPTERS.valuables.id,
      chapterTitle: CHAPTERS.valuables.title,
      kind: "text",
      fieldId: nameField,
      prompt: idx === 1 ? "What's it called?" : "What's this one called?",
      activeWhen: active
    },
    {
      id: `asset${idx}Value`,
      chapter: CHAPTERS.valuables.id,
      chapterTitle: CHAPTERS.valuables.title,
      kind: "currency",
      fieldId: valueField,
      prompt: "What's it worth today?",
      activeWhen: active
    },
    {
      id: `asset${idx}Growth`,
      chapter: CHAPTERS.valuables.id,
      chapterTitle: CHAPTERS.valuables.title,
      kind: "appreciationChoice",
      fieldId: appField,
      prompt: "Is it holding its value, growing, or slowly losing value?",
      activeWhen: active
    },
    {
      id: `asset${idx}Loan`,
      chapter: CHAPTERS.valuables.id,
      chapterTitle: CHAPTERS.valuables.title,
      kind: "currency",
      fieldId: balanceField,
      prompt: "Any debt against it?",
      skippable: true,
      activeWhen: active
    },
    {
      id: `asset${idx}Cost`,
      chapter: CHAPTERS.valuables.id,
      chapterTitle: CHAPTERS.valuables.title,
      kind: "currency",
      fieldId: opCostField,
      prompt: "And anything it costs you each year to keep — insurance, storage, upkeep?",
      skippable: true,
      activeWhen: active
    }
  ];
}

export function makeValuablesSequence(): QuestionDef[] {
  const gate: QuestionDef = {
    id: "assetsGate",
    chapter: CHAPTERS.valuables.id,
    chapterTitle: CHAPTERS.valuables.title,
    kind: "yesNo",
    gateId: "assetsGate",
    prompt: "Anything else you'd count — art, a second car, a boat, a collection?"
  };
  const items: QuestionDef[] = [];
  for (let i = 1 as 1 | 2 | 3 | 4 | 5; i <= 5; i = (i + 1) as 1 | 2 | 3 | 4 | 5) items.push(...assetSequence(i));
  return [gate, ...items];
}

function dependentSequence(idx: 1 | 2 | 3 | 4 | 5): QuestionDef[] {
  const pad = String(idx).padStart(2, "0");
  const nameField = `dependents.${pad}.displayName` as FieldId;
  const costField = `dependents.${pad}.annualCost` as FieldId;
  const yearsField = `dependents.${pad}.supportYearsRemaining` as FieldId;
  const prevNameField = idx === 1 ? null : `dependents.${String(idx - 1).padStart(2, "0")}.displayName` as FieldId;
  const gate = `dependent${idx}Gate`;
  const active = (ctx: ActivationCtx): boolean => {
    if (idx === 1) return gateYes(ctx, "dependentsGate");
    if (!prevNameField) return false;
    const prev = String(ctx.fields[prevNameField] ?? "").trim();
    if (!prev) return false;
    return gateYes(ctx, gate);
  };
  const addGate: QuestionDef | null = idx === 1
    ? null
    : {
        id: `dependent${idx}Gate`,
        chapter: CHAPTERS.people.id,
        chapterTitle: CHAPTERS.people.title,
        kind: "yesNo",
        gateId: gate,
        prompt: "Anyone else?",
        activeWhen: (ctx) => {
          if (!prevNameField) return false;
          const prev = String(ctx.fields[prevNameField] ?? "").trim();
          return prev.length > 0;
        }
      };
  return [
    ...(addGate ? [addGate] : []),
    {
      id: `dependent${idx}Name`,
      chapter: CHAPTERS.people.id,
      chapterTitle: CHAPTERS.people.title,
      kind: "text",
      fieldId: nameField,
      prompt: idx === 1 ? "Who?" : "Who else?",
      activeWhen: active
    },
    {
      id: `dependent${idx}Cost`,
      chapter: CHAPTERS.people.id,
      chapterTitle: CHAPTERS.people.title,
      kind: "currency",
      fieldId: costField,
      prompt: "Roughly how much does it cost a year?",
      activeWhen: active
    },
    {
      id: `dependent${idx}Years`,
      chapter: CHAPTERS.people.id,
      chapterTitle: CHAPTERS.people.title,
      kind: "integer",
      fieldId: yearsField,
      prompt: "For how many more years?",
      activeWhen: active
    }
  ];
}

export function makePeopleSequence(): QuestionDef[] {
  const gate: QuestionDef = {
    id: "dependentsGate",
    chapter: CHAPTERS.people.id,
    chapterTitle: CHAPTERS.people.title,
    kind: "yesNo",
    gateId: "dependentsGate",
    prompt: "Anyone you support financially — kids, parents, someone else?"
  };
  const items: QuestionDef[] = [];
  for (let i = 1 as 1 | 2 | 3 | 4 | 5; i <= 5; i = (i + 1) as 1 | 2 | 3 | 4 | 5) items.push(...dependentSequence(i));
  return [gate, ...items];
}

export function makePensionSequence(): QuestionDef[] {
  return [
    {
      id: "statutoryAge",
      chapter: CHAPTERS.pension.id,
      chapterTitle: CHAPTERS.pension.title,
      kind: "integer",
      fieldId: "retirement.statutoryAge",
      prompt: "When does your state or statutory pension start?",
      helper: "In most places this is somewhere between 65 and 68."
    },
    {
      id: "statePension",
      chapter: CHAPTERS.pension.id,
      chapterTitle: CHAPTERS.pension.title,
      kind: "currency",
      fieldId: "retirement.statePension.netAnnualAtStart",
      prompt: "And roughly how much a year?",
      skippable: true
    },
    {
      id: "partnerPension",
      chapter: CHAPTERS.pension.id,
      chapterTitle: CHAPTERS.pension.title,
      kind: "currency",
      fieldId: "partner.retirement.statePension.netAnnualAtStart",
      prompt: "What about your partner's?",
      skippable: true,
      activeWhen: partnerIncluded
    }
  ];
}

export function makeDebtsSequence(): QuestionDef[] {
  return [
    {
      id: "debtsGate",
      chapter: CHAPTERS.debts.id,
      chapterTitle: CHAPTERS.debts.title,
      kind: "yesNo",
      gateId: "debtsGate",
      prompt: "Any debts we haven't mentioned — credit card, personal loan, anything else?"
    },
    {
      id: "debtBalance",
      chapter: CHAPTERS.debts.id,
      chapterTitle: CHAPTERS.debts.title,
      kind: "currency",
      fieldId: "debts.other.balance",
      prompt: "What's the outstanding balance?",
      activeWhen: (ctx) => gateYes(ctx, "debtsGate")
    },
    {
      id: "debtRate",
      chapter: CHAPTERS.debts.id,
      chapterTitle: CHAPTERS.debts.title,
      kind: "percent",
      fieldId: "debts.other.interestRateAnnual",
      prompt: "At what interest rate?",
      activeWhen: (ctx) => gateYes(ctx, "debtsGate")
    },
    {
      id: "debtRepayment",
      chapter: CHAPTERS.debts.id,
      chapterTitle: CHAPTERS.debts.title,
      kind: "currency",
      fieldId: "debts.other.monthlyRepayment",
      prompt: "And the monthly repayment?",
      activeWhen: (ctx) => gateYes(ctx, "debtsGate")
    }
  ];
}

export function makeHandoffSequence(): QuestionDef[] {
  return [
    {
      id: "handoff",
      chapter: CHAPTERS.handoff.id,
      chapterTitle: CHAPTERS.handoff.title,
      kind: "text",
      prompt: "That's the picture."
    }
  ];
}

export function buildFullSequence(): QuestionDef[] {
  return [
    ...makeAboutSequence(),
    ...makeIncomeSequence(),
    ...makeSpendingSequence(),
    ...makeHousingSequence(),
    ...makeSavingsSequence(),
    ...makePropertySequence(),
    ...makeValuablesSequence(),
    ...makePeopleSequence(),
    ...makePensionSequence(),
    ...makeDebtsSequence(),
    ...makeHandoffSequence()
  ];
}

export function isQuestionActive(q: QuestionDef, ctx: ActivationCtx): boolean {
  if (!q.activeWhen) return true;
  return q.activeWhen(ctx);
}

export function findFirstUnanswered(
  sequence: QuestionDef[],
  ctx: ActivationCtx,
  answered: Set<string>
): QuestionDef | null {
  for (const q of sequence) {
    if (!isQuestionActive(q, ctx)) continue;
    if (answered.has(q.id)) continue;
    return q;
  }
  return null;
}

export function collectActiveAnswered(
  sequence: QuestionDef[],
  ctx: ActivationCtx,
  answered: Set<string>,
  upTo?: QuestionDef
): QuestionDef[] {
  const out: QuestionDef[] = [];
  for (const q of sequence) {
    if (upTo && q.id === upTo.id) break;
    if (!isQuestionActive(q, ctx)) continue;
    if (!answered.has(q.id)) continue;
    out.push(q);
  }
  return out;
}

export function pruneOrphanedAnswers(
  sequence: QuestionDef[],
  ctx: ActivationCtx,
  answered: Set<string>
): Set<string> {
  const next = new Set<string>();
  for (const q of sequence) {
    if (answered.has(q.id) && isQuestionActive(q, ctx)) {
      next.add(q.id);
    }
  }
  return next;
}

export type AnyValue = RawInputValue;
