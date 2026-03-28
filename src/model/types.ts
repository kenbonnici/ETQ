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
  manualPropertyLiquidationOrder: boolean;
  projectionMonthOverride?: number | null;
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
  legacyAmount: number;
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

export interface NamedProjectionSeries {
  key: string;
  label: string;
  values: number[];
}

export interface ScenarioCashFlowRows {
  openingCash: number[];
  employmentIncome: number[];
  otherWorkIncome: number[];
  rentalIncomeByProperty: NamedProjectionSeries[];
  statutoryPension: number[];
  otherPostRetirementIncome: number[];
  incomeEvents: NamedProjectionSeries[];
  liquidationsStocks: number[];
  liquidationsByProperty: NamedProjectionSeries[];
  interestOnCash: number[];
  creditCardsCleared: number[];
  homeLoanRepayment: number[];
  propertyLoanRepayments: NamedProjectionSeries[];
  otherLoanRepayment: number[];
  dependentsCost: NamedProjectionSeries[];
  housingRent: number[];
  propertyCosts: NamedProjectionSeries[];
  livingExpenses: number[];
  expenseEvents: NamedProjectionSeries[];
  totalInflows: number[];
  totalOutflows: number[];
  netCashFlow: number[];
  closingCash: number[];
}

export interface ScenarioNetWorthRows {
  cash: number[];
  stockMarketEquity: number[];
  properties: NamedProjectionSeries[];
  loans: NamedProjectionSeries[];
}

export interface ScenarioOutputs {
  points: ProjectionPoint[];
  cashSeries: number[];
  netWorthSeries: number[];
  retirementSuccessful: boolean;
  milestoneHints: ScenarioMilestoneHint[];
  cashFlow: ScenarioCashFlowRows;
  netWorth: ScenarioNetWorthRows;
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
