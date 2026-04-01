import {
  ASSET_OF_VALUE_GROUPS_BY_CELL,
  DEPENDENT_GROUPS_BY_CELL,
  PROPERTY_GROUPS_BY_CELL,
  STOCK_MARKET_CRASH_GROUPS_BY_CELL
} from "./inputSchema";
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
}

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

export function deriveDefaultLiquidationPriority(raw: RawInputs): number[] {
  const values = LIQUIDATION_VALUE_CELLS.map((cell) => toNumber(raw[cell]));
  const indexed = values.map((v, i) => ({ v, i })).filter((entry) => entry.v > 0);
  indexed.sort((a, b) => a.v - b.v);
  const rank = values.map(() => 0);
  indexed.forEach((x, idx) => {
    rank[x.i] = idx + 1;
  });
  return rank;
}

export function resolveLiquidationPriority(raw: RawInputs, options: LiquidationPriorityOptions = {}): number[] {
  if (!options.manualOverrideActive) {
    return deriveDefaultLiquidationPriority(raw);
  }

  return PROPERTY_LIQUIDATION_CELLS.map((cell) => toNullableNumber(raw[cell]) ?? 0);
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
  const statutoryRetirementAge = toBoundedNumber(raw.B19, 50, 70);
  const liveUntilMinimum = ageNow > 0 ? ageNow : 19;
  const liveUntilAge = toBoundedNumber(raw.B244, liveUntilMinimum, 120);

  return {
    ageNow,
    netIncomeAnnual: toNumber(raw.B6),
    cashBalance: toNumber(raw.B8),
    stocksBalance: toNumber(raw.B10),
    homeValue: toNumber(raw.B12),
    homeLoanBalance: toNumber(raw.B15),
    homeLoanRate: toNumber(raw.B16),
    homeLoanRepaymentMonthly: toNumber(raw.B17),
    statutoryRetirementAge,
    pensionAnnual: toNumber(raw.B21),
    housingRentAnnual: toNumber(raw.B23) * 12,
    livingExpensesAnnual: toNumber(raw.B25),

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
      loanRepaymentMonthly: toNumber(raw[group.loanRepaymentCell])
    })),

    assetsOfValue: ASSET_OF_VALUE_GROUPS_BY_CELL.map((group) => ({
      name: toTrimmedString(raw[group.nameCell]),
      value: toNumber(raw[group.valueCell]),
      appreciationRate: toNumber(raw[group.appreciationRateCell]),
      loanBalance: toNumber(raw[group.loanBalanceCell]),
      loanRate: toNumber(raw[group.loanRateCell]),
      loanRepaymentMonthly: toNumber(raw[group.loanRepaymentCell])
    })),

    otherWorkIncomeAnnual: toNumber(raw.B119),
    otherWorkUntilAge: toNumber(raw.B120),
    creditCardBalance: toNumber(raw.B124),
    otherLoanBalance: toNumber(raw.B177),
    otherLoanRate: toNumber(raw.B178),
    otherLoanRepaymentMonthly: toNumber(raw.B179),

    incomeEvents: [
      { name: toTrimmedString(raw.B184), amount: toNumber(raw.B185), year: toNumber(raw.B186) },
      { name: toTrimmedString(raw.B189), amount: toNumber(raw.B190), year: toNumber(raw.B191) },
      { name: toTrimmedString(raw.B194), amount: toNumber(raw.B195), year: toNumber(raw.B196) }
    ],
    expenseEvents: [
      { name: toTrimmedString(raw.B201), amount: toNumber(raw.B202), year: toNumber(raw.B203) },
      { name: toTrimmedString(raw.B206), amount: toNumber(raw.B207), year: toNumber(raw.B208) },
      { name: toTrimmedString(raw.B211), amount: toNumber(raw.B212), year: toNumber(raw.B213) }
    ],
    stockMarketCrashes: STOCK_MARKET_CRASH_GROUPS_BY_CELL.map((group) => ({
      year: toNumber(raw[group.yearCell]),
      dropPercentage: toNumber(raw[group.dropCell]),
      recoveryYears: toNumber(raw[group.recoveryCell])
    })),

    liveUntilAge,
    spendAdjustTo65: toNumber(raw.B247),
    spendAdjust66To75: toNumber(raw.B248),
    spendAdjustFrom76: toNumber(raw.B249),
    postRetIncomeAnnual: toNumber(raw.B251),
    postRetIncomeFromAge: toNumber(raw.B252),
    postRetIncomeToAge: toNumber(raw.B253),

    inflation: toNumber(raw.B255),
    propertyAppreciation: toNumber(raw.B257),
    cashRate: toNumber(raw.B259),
    stockReturn: toNumber(raw.B261),
    salaryGrowth: toNumber(raw.B263),
    rentalIncomeGrowth: toNumber(raw.B265),

    pensionReductionPerYearEarly: toNumber(raw.B267),
    cashBuffer: toNumber(raw.B269),
    legacyAmount: toNumber(raw.B271),
    stockSellingCosts: toNumber(raw.B273),
    propertyDisposalCosts: toNumber(raw.B275),
    otherAssetDisposalCosts: toNumber(raw.B277),

    liquidationPriority: resolveLiquidationPriority(raw, options)
  };
}
