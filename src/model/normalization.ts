import { DEPENDENT_GROUPS_BY_CELL } from "./inputSchema";
import { EffectiveInputs, InputCell, RawInputValue, RawInputs } from "./types";

const PROPERTY_VALUE_CELLS = ["B61", "B66", "B71"] as const satisfies readonly InputCell[];
const PROPERTY_LIQUIDATION_CELLS = ["B176", "B177", "B178"] as const satisfies readonly InputCell[];

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
  const liveUntilAge = toBoundedNumber(raw.B144, liveUntilMinimum, 120);

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
        name: toTrimmedString(raw.B60),
        value: toNumber(raw.B61),
        annualCosts: toNumber(raw.B62),
        rentalIncome: toNumber(raw.B76),
        loanBalance: toNumber(raw.B88),
        loanRate: toNumber(raw.B89),
        loanRepaymentMonthly: toNumber(raw.B90)
      },
      {
        name: toTrimmedString(raw.B65),
        value: toNumber(raw.B66),
        annualCosts: toNumber(raw.B67),
        rentalIncome: toNumber(raw.B77),
        loanBalance: toNumber(raw.B93),
        loanRate: toNumber(raw.B94),
        loanRepaymentMonthly: toNumber(raw.B95)
      },
      {
        name: toTrimmedString(raw.B70),
        value: toNumber(raw.B71),
        annualCosts: toNumber(raw.B72),
        rentalIncome: toNumber(raw.B78),
        loanBalance: toNumber(raw.B98),
        loanRate: toNumber(raw.B99),
        loanRepaymentMonthly: toNumber(raw.B100)
      }
    ],

    otherWorkIncomeAnnual: toNumber(raw.B80),
    otherWorkUntilAge: toNumber(raw.B81),
    creditCardBalance: toNumber(raw.B85),
    otherLoanBalance: toNumber(raw.B103),
    otherLoanRate: toNumber(raw.B104),
    otherLoanRepaymentMonthly: toNumber(raw.B105),

    incomeEvents: [
      { name: toTrimmedString(raw.B110), amount: toNumber(raw.B111), year: toNumber(raw.B112) },
      { name: toTrimmedString(raw.B115), amount: toNumber(raw.B116), year: toNumber(raw.B117) },
      { name: toTrimmedString(raw.B120), amount: toNumber(raw.B121), year: toNumber(raw.B122) }
    ],
    expenseEvents: [
      { name: toTrimmedString(raw.B127), amount: toNumber(raw.B128), year: toNumber(raw.B129) },
      { name: toTrimmedString(raw.B132), amount: toNumber(raw.B133), year: toNumber(raw.B134) },
      { name: toTrimmedString(raw.B137), amount: toNumber(raw.B138), year: toNumber(raw.B139) }
    ],

    liveUntilAge,
    spendAdjustTo65: toNumber(raw.B147),
    spendAdjust66To75: toNumber(raw.B148),
    spendAdjustFrom76: toNumber(raw.B149),
    postRetIncomeAnnual: toNumber(raw.B151),
    postRetIncomeFromAge: toNumber(raw.B152),
    postRetIncomeToAge: toNumber(raw.B153),

    inflation: toNumber(raw.B155),
    propertyAppreciation: toNumber(raw.B157),
    cashRate: toNumber(raw.B159),
    stockReturn: toNumber(raw.B161),
    salaryGrowth: toNumber(raw.B163),
    rentalIncomeGrowth: toNumber(raw.B165),

    pensionReductionPerYearEarly: toNumber(raw.B167),
    cashBuffer: toNumber(raw.B169),
    stockSellingCosts: toNumber(raw.B171),
    propertyDisposalCosts: toNumber(raw.B173),

    liquidationPriority: resolveLiquidationPriority(raw, options)
  };
}
