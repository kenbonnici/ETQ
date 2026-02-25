import { EffectiveInputs, InputCell, RawInputValue, RawInputs } from "./types";

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

function liquidationPriority(raw: RawInputs): number[] {
  const p1 = toNullableNumber(raw.B166);
  const p2 = toNullableNumber(raw.B167);
  const p3 = toNullableNumber(raw.B168);

  // Any blanks are treated as zero (never sell), as clarified.
  const hasAny = p1 !== null || p2 !== null || p3 !== null;
  if (hasAny) {
    return [p1 ?? 0, p2 ?? 0, p3 ?? 0];
  }

  // No user values entered => default cheapest-first ranking.
  const values = [toNumber(raw.B51), toNumber(raw.B56), toNumber(raw.B61)];
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const rank = [0, 0, 0];
  indexed.forEach((x, idx) => {
    rank[x.i] = idx + 1;
  });
  return rank;
}

export function normalizeInputs(raw: RawInputs): EffectiveInputs {
  return {
    ageNow: toNumber(raw.B4),
    netIncomeAnnual: toNumber(raw.B6),
    cashBalance: toNumber(raw.B8),
    stocksBalance: toNumber(raw.B10),
    homeValue: toNumber(raw.B12),
    homeLoanBalance: toNumber(raw.B15),
    homeLoanRate: toNumber(raw.B16),
    homeLoanRepaymentMonthly: toNumber(raw.B17),
    statutoryRetirementAge: toNumber(raw.B19),
    pensionAnnual: toNumber(raw.B21),
    housingRentAnnual: toNumber(raw.B23),
    livingExpensesAnnual: toNumber(raw.B25),

    dependents: [
      { name: toTrimmedString(raw.B33), annualCost: toNumber(raw.B34), yearsToSupport: toNumber(raw.B35) },
      { name: toTrimmedString(raw.B38), annualCost: toNumber(raw.B39), yearsToSupport: toNumber(raw.B40) },
      { name: toTrimmedString(raw.B43), annualCost: toNumber(raw.B44), yearsToSupport: toNumber(raw.B45) }
    ],

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

    liveUntilAge: toNumber(raw.B134),
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

    liquidationPriority: liquidationPriority(raw)
  };
}
