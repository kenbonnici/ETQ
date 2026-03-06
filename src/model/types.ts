import { FieldId, InputCell } from "./fieldRegistry";
export type { FieldId, InputCell };

export type Numeric = number | null;

export type RawInputValue = number | string | null | undefined;
export type RawInputs = Partial<Record<InputCell, RawInputValue>>;
export type FieldState = Partial<Record<FieldId, RawInputValue>>;

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

export interface ScenarioMilestoneHint {
  year: number;
  age: number;
  label: string;
  amount?: number;
}

export interface ScenarioOutputs {
  points: ProjectionPoint[];
  cashSeries: number[];
  netWorthSeries: number[];
  milestoneHints: ScenarioMilestoneHint[];
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
