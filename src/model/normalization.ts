import { DEPENDENT_GROUPS_BY_CELL, PROPERTY_GROUPS_BY_CELL } from "./inputSchema";
import { EffectiveInputs, InputCell, RawInputValue, RawInputs } from "./types";

const PROPERTY_VALUE_CELLS = PROPERTY_GROUPS_BY_CELL.map((group) => group.valueCell) as readonly InputCell[];
const PROPERTY_LIQUIDATION_CELLS = PROPERTY_GROUPS_BY_CELL.map((group) => group.liquidationRankCell) as readonly InputCell[];

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
  const values = PROPERTY_VALUE_CELLS.map((cell) => toNumber(raw[cell]));
  const indexed = values.map((v, i) => ({ v, i }));
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
  const liveUntilAge = toBoundedNumber(raw.B166, liveUntilMinimum, 120);

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
    housingRentAnnual: toNumber(raw.B23),
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

    otherWorkIncomeAnnual: toNumber(raw.B92),
    otherWorkUntilAge: toNumber(raw.B93),
    creditCardBalance: toNumber(raw.B97),
    otherLoanBalance: toNumber(raw.B125),
    otherLoanRate: toNumber(raw.B126),
    otherLoanRepaymentMonthly: toNumber(raw.B127),

    incomeEvents: [
      { name: toTrimmedString(raw.B132), amount: toNumber(raw.B133), year: toNumber(raw.B134) },
      { name: toTrimmedString(raw.B137), amount: toNumber(raw.B138), year: toNumber(raw.B139) },
      { name: toTrimmedString(raw.B142), amount: toNumber(raw.B143), year: toNumber(raw.B144) }
    ],
    expenseEvents: [
      { name: toTrimmedString(raw.B149), amount: toNumber(raw.B150), year: toNumber(raw.B151) },
      { name: toTrimmedString(raw.B154), amount: toNumber(raw.B155), year: toNumber(raw.B156) },
      { name: toTrimmedString(raw.B159), amount: toNumber(raw.B160), year: toNumber(raw.B161) }
    ],

    liveUntilAge,
    spendAdjustTo65: toNumber(raw.B169),
    spendAdjust66To75: toNumber(raw.B170),
    spendAdjustFrom76: toNumber(raw.B171),
    postRetIncomeAnnual: toNumber(raw.B173),
    postRetIncomeFromAge: toNumber(raw.B174),
    postRetIncomeToAge: toNumber(raw.B175),

    inflation: toNumber(raw.B177),
    propertyAppreciation: toNumber(raw.B179),
    cashRate: toNumber(raw.B181),
    stockReturn: toNumber(raw.B183),
    salaryGrowth: toNumber(raw.B185),
    rentalIncomeGrowth: toNumber(raw.B187),

    pensionReductionPerYearEarly: toNumber(raw.B189),
    cashBuffer: toNumber(raw.B191),
    stockSellingCosts: toNumber(raw.B193),
    propertyDisposalCosts: toNumber(raw.B195),

    liquidationPriority: resolveLiquidationPriority(raw, options)
  };
}
