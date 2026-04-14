import {
  ASSET_OF_VALUE_GROUPS,
  DEPENDENT_GROUPS,
  PARTNER_GROUP,
  PROPERTY_GROUPS,
  STOCK_MARKET_CRASH_GROUPS
} from "./inputSchema";
import { ResolvedPlannedSaleYears } from "./plannedSales";
import { EffectiveInputs, FieldId, FieldState, RawInputValue } from "./types";

const LIQUIDATION_VALUE_FIELDS = [
  ...PROPERTY_GROUPS.map((group) => group.valueField),
  ...ASSET_OF_VALUE_GROUPS.map((group) => group.valueField)
] as readonly FieldId[];
const LIQUIDATION_PRIORITY_FIELDS = [
  ...PROPERTY_GROUPS.map((group) => group.liquidationRankField),
  ...ASSET_OF_VALUE_GROUPS.map((group) => group.liquidationRankField)
] as readonly FieldId[];

export interface LiquidationPriorityOptions {
  manualOverrideActive?: boolean;
  plannedSaleYears?: ResolvedPlannedSaleYears;
}

const DEFAULT_SPENDING_ADJUSTMENT_AGE_1 = 65;
const DEFAULT_SPENDING_ADJUSTMENT_AGE_2 = 75;

function toTrimmedString(v: RawInputValue): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v: RawInputValue): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(v: RawInputValue): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBoundedNumber(v: RawInputValue, min: number, max: number): number {
  const n = toNumber(v);
  if (n === 0) return 0;
  return Math.min(max, Math.max(min, n));
}

function isYes(v: RawInputValue): boolean {
  return String(v ?? "").trim().toUpperCase() === "YES";
}

function resolveSpendingAdjustmentAges(
  rawAge1: RawInputValue,
  rawAge2: RawInputValue,
  ageNow: number,
  liveUntilAge: number
): { age1: number; age2: number } {
  const minAge1 = ageNow > 0 ? Math.round(ageNow) : DEFAULT_SPENDING_ADJUSTMENT_AGE_1;
  const maxAge = liveUntilAge > 0 ? Math.round(liveUntilAge) : DEFAULT_SPENDING_ADJUSTMENT_AGE_2;
  let age1 = Math.round(toNullableNumber(rawAge1) ?? DEFAULT_SPENDING_ADJUSTMENT_AGE_1);
  let age2 = Math.round(toNullableNumber(rawAge2) ?? DEFAULT_SPENDING_ADJUSTMENT_AGE_2);

  age1 = Math.max(minAge1, age1);
  if (maxAge > minAge1) {
    age1 = Math.min(age1, maxAge - 1);
  }
  age2 = Math.max(age1 + 1, age2);
  age2 = Math.min(Math.max(maxAge, age1 + 1), age2);

  return { age1, age2 };
}

export function deriveDefaultLiquidationPriority(fields: FieldState, plannedSaleYears?: ResolvedPlannedSaleYears): number[] {
  const values = LIQUIDATION_VALUE_FIELDS.map((fieldId) => toNumber(fields[fieldId]));
  const scheduled = new Set<number>([
    ...(plannedSaleYears?.properties ?? []).map((year, idx) => (year === null ? -1 : idx)),
    ...(plannedSaleYears?.assetsOfValue ?? []).map((year, idx) => (year === null ? -1 : PROPERTY_GROUPS.length + idx))
  ]);
  const indexed = values
    .map((v, i) => ({ v, i }))
    .filter((entry) => entry.v > 0 && !scheduled.has(entry.i));
  indexed.sort((a, b) => a.v - b.v);
  const rank = values.map(() => 0);
  indexed.forEach((x, idx) => {
    rank[x.i] = idx + 1;
  });
  return rank;
}

export function resolveLiquidationPriority(fields: FieldState, options: LiquidationPriorityOptions = {}): number[] {
  if (!options.manualOverrideActive) {
    return deriveDefaultLiquidationPriority(fields, options.plannedSaleYears);
  }

  return LIQUIDATION_PRIORITY_FIELDS.map((fieldId, idx) => {
    const propertyCount = PROPERTY_GROUPS.length;
    const isScheduled = idx < propertyCount
      ? (options.plannedSaleYears?.properties[idx] ?? null) !== null
      : (options.plannedSaleYears?.assetsOfValue[idx - propertyCount] ?? null) !== null;
    return isScheduled ? 0 : (toNullableNumber(fields[fieldId]) ?? 0);
  });
}

export function materializeLiquidationPriorityInputs(
  fields: FieldState,
  options: LiquidationPriorityOptions = {}
): FieldState {
  const priority = resolveLiquidationPriority(fields, options);
  const next: FieldState = { ...fields };
  LIQUIDATION_PRIORITY_FIELDS.forEach((fieldId, idx) => {
    next[fieldId] = priority[idx] ?? 0;
  });
  return next;
}

export function normalizeInputs(fields: FieldState, options: LiquidationPriorityOptions = {}): EffectiveInputs {
  const ageNow = toNumber(fields["profile.currentAge"]);
  const partnerIncluded = isYes(fields[PARTNER_GROUP.includeField]);
  const partnerRetiresEarly = partnerIncluded && isYes(fields[PARTNER_GROUP.retiresEarlyField]);
  const partnerAgeRaw = toNullableNumber(fields[PARTNER_GROUP.ageField]);
  const statutoryRetirementAge = toBoundedNumber(fields["retirement.statutoryAge"], 50, 70);
  const liveUntilMinimum = ageNow > 0 ? ageNow : 19;
  const liveUntilAge = toBoundedNumber(fields["planning.lifeExpectancyAge"], liveUntilMinimum, 120);
  const spendingAdjustmentAges = resolveSpendingAdjustmentAges(
    fields["spending.adjustments.firstBracket.endAge"],
    fields["spending.adjustments.secondBracket.endAge"],
    ageNow,
    liveUntilAge
  );

  return {
    ageNow,
    partnerIncluded,
    partnerRetiresEarly,
    partnerAgeNow: partnerIncluded ? Math.round(partnerAgeRaw ?? ageNow) : null,
    netIncomeAnnual: toNumber(fields["income.employment.netAnnual"]),
    partnerEmploymentIncomeAnnual: partnerIncluded ? toNumber(fields[PARTNER_GROUP.incomeField]) : 0,
    cashBalance: toNumber(fields["assets.cash.totalBalance"]),
    stocksBalance: toNumber(fields["assets.equities.marketValue"]),
    stocksContributionMonthly: toNumber(fields["assets.equities.monthlyContribution"]),
    homeValue: toNumber(fields["housing.01Residence.marketValue"]),
    homeLoanBalance: toNumber(fields["housing.01Residence.mortgage.balance"]),
    homeLoanRate: toNumber(fields["housing.01Residence.mortgage.interestRateAnnual"]),
    homeLoanRepaymentMonthly: toNumber(fields["housing.01Residence.mortgage.monthlyRepayment"]),
    statutoryRetirementAge,
    pensionAnnual: toNumber(fields["retirement.statePension.netAnnualAtStart"]),
    partnerPensionAnnual: partnerIncluded ? toNumber(fields[PARTNER_GROUP.pensionField]) : 0,
    housingRentAnnual: toNumber(fields["housing.rentAnnual"]) * 12,
    downsizingYear: toNumber(fields["housing.downsize.year"]),
    downsizingNewHomeMode: toTrimmedString(fields["housing.downsize.newHomeMode"]),
    downsizingNewHomePurchaseCost: toNumber(fields["housing.downsize.newHomePurchaseCost"]),
    downsizingNewRentAnnual: toNumber(fields["housing.downsize.newRentAnnual"]) * 12,
    livingExpensesAnnual: toNumber(fields["spending.livingExpenses.annual"]),

    dependents: DEPENDENT_GROUPS.map((group) => ({
      name: toTrimmedString(fields[group.nameField]),
      annualCost: toNumber(fields[group.annualCostField]),
      yearsToSupport: toNumber(fields[group.yearsField])
    })),

    properties: PROPERTY_GROUPS.map((group, idx) => ({
      name: toTrimmedString(fields[group.nameField]),
      value: toNumber(fields[group.valueField]),
      annualCosts: toNumber(fields[group.annualCostsField]),
      rentalIncome: toNumber(fields[group.rentalIncomeField]),
      loanBalance: toNumber(fields[group.loanBalanceField]),
      loanRate: toNumber(fields[group.loanRateField]),
      loanRepaymentMonthly: toNumber(fields[group.loanRepaymentField]),
      plannedSellYear: options.plannedSaleYears?.properties[idx] ?? null
    })),

    assetsOfValue: ASSET_OF_VALUE_GROUPS.map((group, idx) => ({
      name: toTrimmedString(fields[group.nameField]),
      value: toNumber(fields[group.valueField]),
      annualCosts: toNumber(fields[group.annualCostsField]),
      appreciationRate: toNumber(fields[group.appreciationRateField]),
      loanBalance: toNumber(fields[group.loanBalanceField]),
      loanRate: toNumber(fields[group.loanRateField]),
      loanRepaymentMonthly: toNumber(fields[group.loanRepaymentField]),
      plannedSellYear: options.plannedSaleYears?.assetsOfValue[idx] ?? null
    })),

    otherWorkIncomeAnnual: toNumber(fields["income.otherWork.netAnnual"]),
    otherWorkUntilAge: toNumber(fields["income.otherWork.endAge"]),
    creditCardBalance: toNumber(fields["debts.creditCards.balance"]),
    otherLoanBalance: toNumber(fields["debts.other.balance"]),
    otherLoanRate: toNumber(fields["debts.other.interestRateAnnual"]),
    otherLoanRepaymentMonthly: toNumber(fields["debts.other.monthlyRepayment"]),

    incomeEvents: [
      { name: toTrimmedString(fields["cashflowEvents.income.01.name"]), amount: toNumber(fields["cashflowEvents.income.01.amount"]), year: toNumber(fields["cashflowEvents.income.01.year"]) },
      { name: toTrimmedString(fields["cashflowEvents.income.02.name"]), amount: toNumber(fields["cashflowEvents.income.02.amount"]), year: toNumber(fields["cashflowEvents.income.02.year"]) },
      { name: toTrimmedString(fields["cashflowEvents.income.03.name"]), amount: toNumber(fields["cashflowEvents.income.03.amount"]), year: toNumber(fields["cashflowEvents.income.03.year"]) }
    ],
    expenseEvents: [
      { name: toTrimmedString(fields["cashflowEvents.expense.01.name"]), amount: toNumber(fields["cashflowEvents.expense.01.amount"]), year: toNumber(fields["cashflowEvents.expense.01.year"]) },
      { name: toTrimmedString(fields["cashflowEvents.expense.02.name"]), amount: toNumber(fields["cashflowEvents.expense.02.amount"]), year: toNumber(fields["cashflowEvents.expense.02.year"]) },
      { name: toTrimmedString(fields["cashflowEvents.expense.03.name"]), amount: toNumber(fields["cashflowEvents.expense.03.amount"]), year: toNumber(fields["cashflowEvents.expense.03.year"]) }
    ],
    stockMarketCrashes: STOCK_MARKET_CRASH_GROUPS.map((group) => ({
      year: toNumber(fields[group.yearField]),
      dropPercentage: toNumber(fields[group.dropField]),
      recoveryYears: toNumber(fields[group.recoveryField])
    })),

    liveUntilAge,
    spendingAdjustmentAge1: spendingAdjustmentAges.age1,
    spendingAdjustmentAge2: spendingAdjustmentAges.age2,
    spendAdjustFirstBracket: toNumber(fields["spending.adjustments.firstBracket.deltaRate"]),
    spendAdjustSecondBracket: toNumber(fields["spending.adjustments.secondBracket.deltaRate"]),
    spendAdjustFinalBracket: toNumber(fields["spending.adjustments.finalBracket.deltaRate"]),
    postRetIncomeAnnual: toNumber(fields["income.postRetirementSupplement.annual"]),
    postRetIncomeFromAge: toNumber(fields["income.postRetirementSupplement.startAge"]),
    postRetIncomeToAge: toNumber(fields["income.postRetirementSupplement.endAge"]),

    inflation: toNumber(fields["assumptions.generalInflationRateAnnual"]),
    propertyAppreciation: toNumber(fields["assumptions.propertyAppreciationRateAnnual"]),
    cashRate: toNumber(fields["assumptions.cashYieldRateAnnual"]),
    stockReturn: toNumber(fields["assumptions.equityReturnRateAnnual"]),
    salaryGrowth: toNumber(fields["assumptions.salaryGrowthRateAnnual"]),
    rentalIncomeGrowth: toNumber(fields["assumptions.rentalIncomeGrowthRateAnnual"]),

    pensionReductionPerYearEarly: toNumber(fields["retirement.earlyPensionReductionPerYear"]),
    partnerPensionReductionPerYearEarly: partnerRetiresEarly
      ? toNullableNumber(fields[PARTNER_GROUP.pensionReductionField]) ?? 0
      : null,
    cashBuffer: toNumber(fields["liquidity.minimumCashBuffer"]),
    legacyAmount: toNumber(fields["planning.legacyAmount"]),
    stockSellingCosts: toNumber(fields["liquidation.stockSellingCostRate"]),
    propertyDisposalCosts: toNumber(fields["liquidation.propertyDisposalCostRate"]),
    otherAssetDisposalCosts: toNumber(fields["liquidation.otherAssetDisposalCostRate"]),

    liquidationPriority: resolveLiquidationPriority(fields, options)
  };
}
