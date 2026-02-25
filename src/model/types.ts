export type Numeric = number | null;

export type InputCell =
  | "B4" | "B6" | "B8" | "B10" | "B12"
  | "B15" | "B16" | "B17" | "B19" | "B21" | "B23" | "B25"
  | "B33" | "B34" | "B35" | "B38" | "B39" | "B40" | "B43" | "B44" | "B45"
  | "B50" | "B51" | "B52" | "B55" | "B56" | "B57" | "B60" | "B61" | "B62"
  | "B66" | "B67" | "B68" | "B70" | "B71"
  | "B75" | "B78" | "B79" | "B80" | "B83" | "B84" | "B85" | "B88" | "B89" | "B90" | "B93" | "B94" | "B95"
  | "B100" | "B101" | "B102" | "B105" | "B106" | "B107" | "B110" | "B111" | "B112"
  | "B117" | "B118" | "B119" | "B122" | "B123" | "B124" | "B127" | "B128" | "B129"
  | "B134" | "B137" | "B138" | "B139" | "B141" | "B142" | "B143" | "B145" | "B147"
  | "B149" | "B151" | "B153" | "B155" | "B157" | "B159" | "B161" | "B163" | "B166" | "B167" | "B168";

export type RawInputValue = number | string | null | undefined;
export type RawInputs = Partial<Record<InputCell, RawInputValue>>;

export interface ModelUiState {
  deeperDiveOpen: boolean;
  finerDetailsOpen: boolean;
  earlyRetirementAge: number;
}

export interface EffectiveInputs {
  ageNow: number;
  netIncomeAnnual: number;
  cashBalance: number;
  stocksBalance: number;
  homeValue: number;
  homeLoanBalance: number;
  homeLoanRate: number;
  homeLoanRepaymentMonthly: number;
  statutoryRetirementAge: number;
  pensionAnnual: number;
  housingRentAnnual: number;
  livingExpensesAnnual: number;

  dependents: Array<{ name: string; annualCost: number; yearsToSupport: number }>;

  properties: Array<{
    name: string;
    value: number;
    annualCosts: number;
    rentalIncome: number;
    loanBalance: number;
    loanRate: number;
    loanRepaymentMonthly: number;
  }>;

  otherWorkIncomeAnnual: number;
  otherWorkUntilAge: number;
  creditCardBalance: number;
  otherLoanBalance: number;
  otherLoanRate: number;
  otherLoanRepaymentMonthly: number;

  incomeEvents: Array<{ name: string; amount: number; year: number }>;
  expenseEvents: Array<{ name: string; amount: number; year: number }>;

  liveUntilAge: number;
  spendAdjustTo65: number;
  spendAdjust66To75: number;
  spendAdjustFrom76: number;
  postRetIncomeAnnual: number;
  postRetIncomeFromAge: number;
  postRetIncomeToAge: number;

  inflation: number;
  propertyAppreciation: number;
  cashRate: number;
  stockReturn: number;
  salaryGrowth: number;
  rentalIncomeGrowth: number;

  pensionReductionPerYearEarly: number;
  cashBuffer: number;
  stockSellingCosts: number;
  propertyDisposalCosts: number;

  liquidationPriority: Array<number>; // 0 means never sell.
}

export interface ProjectionPoint {
  yearIndex: number;
  year: number;
  age: number;
  cash: number;
  netWorth: number;
}

export interface ScenarioOutputs {
  points: ProjectionPoint[];
  cashSeries: number[];
  netWorthSeries: number[];
}

export interface ModelOutputs {
  ages: number[];
  years: number[];
  cashSeriesEarly: number[];
  cashSeriesNorm: number[];
  netWorthSeriesEarly: number[];
  netWorthSeriesNorm: number[];
  scenarioEarly: ScenarioOutputs;
  scenarioNorm: ScenarioOutputs;
}
