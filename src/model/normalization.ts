import { DEPENDENT_GROUPS_BY_CELL } from "./inputSchema";
import { EffectiveInputs, InputCell, RawInputValue, RawInputs } from "./types";

const PROPERTY_VALUE_CELLS = ["B51", "B56", "B61"] as const satisfies readonly InputCell[];
const PROPERTY_LIQUIDATION_CELLS = ["B166", "B167", "B168"] as const satisfies readonly InputCell[];

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
  const rank = [0, 0, 0];
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
  const liveUntilMinimum = ageNow > 0 ? ageNow + 1 : 19;
  const liveUntilAge = toBoundedNumber(raw.B134, liveUntilMinimum, 120);

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

    properties: [
      {
        name: toTrimmedString(raw.B50),
        value: toNumber(raw.B51),
        annualCosts: toNumber(raw.B52),
        rentalIncome: toNumber(raw.B66),
        loanBalance: toNumber(raw.B78),
        loanRate: toNumber(raw.B79),
        loanRepaymentMonthly: toNumber(raw.B80)
      },
      {
        name: toTrimmedString(raw.B55),
        value: toNumber(raw.B56),
        annualCosts: toNumber(raw.B57),
        rentalIncome: toNumber(raw.B67),
        loanBalance: toNumber(raw.B83),
        loanRate: toNumber(raw.B84),
        loanRepaymentMonthly: toNumber(raw.B85)
      },
      {
        name: toTrimmedString(raw.B60),
        value: toNumber(raw.B61),
        annualCosts: toNumber(raw.B62),
        rentalIncome: toNumber(raw.B68),
        loanBalance: toNumber(raw.B88),
        loanRate: toNumber(raw.B89),
        loanRepaymentMonthly: toNumber(raw.B90)
      }
    ],

    otherWorkIncomeAnnual: toNumber(raw.B70),
    otherWorkUntilAge: toNumber(raw.B71),
    creditCardBalance: toNumber(raw.B75),
    otherLoanBalance: toNumber(raw.B93),
    otherLoanRate: toNumber(raw.B94),
    otherLoanRepaymentMonthly: toNumber(raw.B95),

    incomeEvents: [
      { name: toTrimmedString(raw.B100), amount: toNumber(raw.B101), year: toNumber(raw.B102) },
      { name: toTrimmedString(raw.B105), amount: toNumber(raw.B106), year: toNumber(raw.B107) },
      { name: toTrimmedString(raw.B110), amount: toNumber(raw.B111), year: toNumber(raw.B112) }
    ],
    expenseEvents: [
      { name: toTrimmedString(raw.B117), amount: toNumber(raw.B118), year: toNumber(raw.B119) },
      { name: toTrimmedString(raw.B122), amount: toNumber(raw.B123), year: toNumber(raw.B124) },
      { name: toTrimmedString(raw.B127), amount: toNumber(raw.B128), year: toNumber(raw.B129) }
    ],

    liveUntilAge,
    spendAdjustTo65: toNumber(raw.B137),
    spendAdjust66To75: toNumber(raw.B138),
    spendAdjustFrom76: toNumber(raw.B139),
    postRetIncomeAnnual: toNumber(raw.B141),
    postRetIncomeFromAge: toNumber(raw.B142),
    postRetIncomeToAge: toNumber(raw.B143),

    inflation: toNumber(raw.B145),
    propertyAppreciation: toNumber(raw.B147),
    cashRate: toNumber(raw.B149),
    stockReturn: toNumber(raw.B151),
    salaryGrowth: toNumber(raw.B153),
    rentalIncomeGrowth: toNumber(raw.B155),

    pensionReductionPerYearEarly: toNumber(raw.B157),
    cashBuffer: toNumber(raw.B159),
    stockSellingCosts: toNumber(raw.B161),
    propertyDisposalCosts: toNumber(raw.B163),

    liquidationPriority: resolveLiquidationPriority(raw, options)
  };
}
