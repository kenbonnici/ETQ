import {
  ASSET_OF_VALUE_GROUPS_BY_CELL,
  DEPENDENT_GROUPS_BY_CELL,
  PROPERTY_GROUPS_BY_CELL,
  STOCK_MARKET_CRASH_GROUPS_BY_CELL
} from "./inputSchema";
import { ResolvedPlannedSaleYears } from "./plannedSales";
import { EffectiveInputs, InputCell, RawInputValue, RawInputs } from "./types";

const LIQUIDATION_VALUE_CELLS = [
  ...PROPERTY_GROUPS_BY_CELL.map((group) => group.valueCell),
  ...ASSET_OF_VALUE_GROUPS_BY_CELL.map((group) => group.valueCell)
] as readonly InputCell[];
const PROPERTY_LIQUIDATION_CELLS = [
  ...PROPERTY_GROUPS_BY_CELL.map((group) => group.liquidationRankCell),
  ...ASSET_OF_VALUE_GROUPS_BY_CELL.map((group) => group.liquidationRankCell)
] as readonly InputCell[];

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

export function deriveDefaultLiquidationPriority(raw: RawInputs, plannedSaleYears?: ResolvedPlannedSaleYears): number[] {
  const values = LIQUIDATION_VALUE_CELLS.map((cell) => toNumber(raw[cell]));
  const scheduled = new Set<number>([
    ...(plannedSaleYears?.properties ?? []).map((year, idx) => (year === null ? -1 : idx)),
    ...(plannedSaleYears?.assetsOfValue ?? []).map((year, idx) => (year === null ? -1 : PROPERTY_GROUPS_BY_CELL.length + idx))
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

export function resolveLiquidationPriority(raw: RawInputs, options: LiquidationPriorityOptions = {}): number[] {
  if (!options.manualOverrideActive) {
    return deriveDefaultLiquidationPriority(raw, options.plannedSaleYears);
  }

  return PROPERTY_LIQUIDATION_CELLS.map((cell, idx) => {
    const propertyCount = PROPERTY_GROUPS_BY_CELL.length;
    const isScheduled = idx < propertyCount
      ? (options.plannedSaleYears?.properties[idx] ?? null) !== null
      : (options.plannedSaleYears?.assetsOfValue[idx - propertyCount] ?? null) !== null;
    return isScheduled ? 0 : (toNullableNumber(raw[cell]) ?? 0);
  });
}

export function materializeLiquidationPriorityInputs(
  raw: RawInputs,
  options: LiquidationPriorityOptions = {}
): RawInputs {
  const priority = resolveLiquidationPriority(raw, options);
  const next: RawInputs = { ...raw };
  PROPERTY_LIQUIDATION_CELLS.forEach((cell, idx) => {
    next[cell] = priority[idx] ?? 0;
  });
  return next;
}

export function normalizeInputs(raw: RawInputs, options: LiquidationPriorityOptions = {}): EffectiveInputs {
  const ageNow = toNumber(raw.B4);
  const statutoryRetirementAge = toBoundedNumber(raw.B20, 50, 70);
  const liveUntilMinimum = ageNow > 0 ? ageNow : 19;
  const liveUntilAge = toBoundedNumber(raw.B255, liveUntilMinimum, 120);
  const spendingAdjustmentAges = resolveSpendingAdjustmentAges(raw.B256, raw.B257, ageNow, liveUntilAge);

  return {
    ageNow,
    netIncomeAnnual: toNumber(raw.B6),
    cashBalance: toNumber(raw.B8),
    stocksBalance: toNumber(raw.B10),
    stocksContributionMonthly: toNumber(raw.B11),
    homeValue: toNumber(raw.B13),
    homeLoanBalance: toNumber(raw.B16),
    homeLoanRate: toNumber(raw.B17),
    homeLoanRepaymentMonthly: toNumber(raw.B18),
    statutoryRetirementAge,
    pensionAnnual: toNumber(raw.B22),
    housingRentAnnual: toNumber(raw.B24) * 12,
    downsizingYear: toNumber(raw.B218),
    downsizingNewHomeMode: toTrimmedString(raw.B220),
    downsizingNewHomePurchaseCost: toNumber(raw.B222),
    downsizingNewRentAnnual: toNumber(raw.B224) * 12,
    livingExpensesAnnual: toNumber(raw.B26),

    dependents: DEPENDENT_GROUPS_BY_CELL.map((group) => ({
      name: toTrimmedString(raw[group.nameCell]),
      annualCost: toNumber(raw[group.annualCostCell]),
      yearsToSupport: toNumber(raw[group.yearsCell])
    })),

    properties: PROPERTY_GROUPS_BY_CELL.map((group) => ({
      name: toTrimmedString(raw[group.nameCell]),
      value: toNumber(raw[group.valueCell]),
      annualCosts: toNumber(raw[group.annualCostsCell]),
      rentalIncome: toNumber(raw[group.rentalIncomeCell]),
      loanBalance: toNumber(raw[group.loanBalanceCell]),
      loanRate: toNumber(raw[group.loanRateCell]),
      loanRepaymentMonthly: toNumber(raw[group.loanRepaymentCell]),
      plannedSellYear: options.plannedSaleYears?.properties[PROPERTY_GROUPS_BY_CELL.indexOf(group)] ?? null
    })),

    assetsOfValue: ASSET_OF_VALUE_GROUPS_BY_CELL.map((group) => ({
      name: toTrimmedString(raw[group.nameCell]),
      value: toNumber(raw[group.valueCell]),
      appreciationRate: toNumber(raw[group.appreciationRateCell]),
      loanBalance: toNumber(raw[group.loanBalanceCell]),
      loanRate: toNumber(raw[group.loanRateCell]),
      loanRepaymentMonthly: toNumber(raw[group.loanRepaymentCell]),
      plannedSellYear: options.plannedSaleYears?.assetsOfValue[ASSET_OF_VALUE_GROUPS_BY_CELL.indexOf(group)] ?? null
    })),

    otherWorkIncomeAnnual: toNumber(raw.B120),
    otherWorkUntilAge: toNumber(raw.B121),
    creditCardBalance: toNumber(raw.B125),
    otherLoanBalance: toNumber(raw.B178),
    otherLoanRate: toNumber(raw.B179),
    otherLoanRepaymentMonthly: toNumber(raw.B180),

    incomeEvents: [
      { name: toTrimmedString(raw.B185), amount: toNumber(raw.B186), year: toNumber(raw.B187) },
      { name: toTrimmedString(raw.B190), amount: toNumber(raw.B191), year: toNumber(raw.B192) },
      { name: toTrimmedString(raw.B195), amount: toNumber(raw.B196), year: toNumber(raw.B197) }
    ],
    expenseEvents: [
      { name: toTrimmedString(raw.B202), amount: toNumber(raw.B203), year: toNumber(raw.B204) },
      { name: toTrimmedString(raw.B207), amount: toNumber(raw.B208), year: toNumber(raw.B209) },
      { name: toTrimmedString(raw.B212), amount: toNumber(raw.B213), year: toNumber(raw.B214) }
    ],
    stockMarketCrashes: STOCK_MARKET_CRASH_GROUPS_BY_CELL.map((group) => ({
      year: toNumber(raw[group.yearCell]),
      dropPercentage: toNumber(raw[group.dropCell]),
      recoveryYears: toNumber(raw[group.recoveryCell])
    })),

    liveUntilAge,
    spendingAdjustmentAge1: spendingAdjustmentAges.age1,
    spendingAdjustmentAge2: spendingAdjustmentAges.age2,
    spendAdjustFirstBracket: toNumber(raw.B258),
    spendAdjustSecondBracket: toNumber(raw.B259),
    spendAdjustFinalBracket: toNumber(raw.B260),
    postRetIncomeAnnual: toNumber(raw.B262),
    postRetIncomeFromAge: toNumber(raw.B263),
    postRetIncomeToAge: toNumber(raw.B264),

    inflation: toNumber(raw.B266),
    propertyAppreciation: toNumber(raw.B268),
    cashRate: toNumber(raw.B270),
    stockReturn: toNumber(raw.B272),
    salaryGrowth: toNumber(raw.B274),
    rentalIncomeGrowth: toNumber(raw.B276),

    pensionReductionPerYearEarly: toNumber(raw.B278),
    cashBuffer: toNumber(raw.B280),
    legacyAmount: toNumber(raw.B282),
    stockSellingCosts: toNumber(raw.B284),
    propertyDisposalCosts: toNumber(raw.B286),
    otherAssetDisposalCosts: toNumber(raw.B288),

    liquidationPriority: resolveLiquidationPriority(raw, options)
  };
}
