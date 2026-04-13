import { FieldId } from "../model/fieldRegistry";
import {
  ASSET_OF_VALUE_GROUPS,
  DEPENDENT_GROUPS,
  DOWNSIZING_GROUP,
  EXPENSE_EVENT_GROUPS,
  HOME_LOAN_GROUP,
  INCOME_EVENT_GROUPS,
  OTHER_LOAN_GROUP,
  OTHER_WORK_GROUP,
  POST_RETIREMENT_INCOME_GROUP,
  PROPERTY_GROUPS,
  STOCK_MARKET_CRASH_GROUPS
} from "../model/inputSchema";
import {
  ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS,
  PROPERTY_PLANNED_SELL_YEAR_FIELDS,
  PlannedSellYearFieldId
} from "../model/plannedSales";

export const RUNTIME_FIELDS = {
  currentAge: "profile.currentAge",
  currentNetIncomeAnnual: "income.employment.netAnnual",
  cashBalance: "assets.cash.totalBalance",
  stockMarketInvestments: "assets.equities.marketValue",
  stockContributionMonthly: "assets.equities.monthlyContribution",
  statutoryRetirementAge: "retirement.statutoryAge",
  annualPensionAtRetirement: "retirement.statePension.netAnnualAtStart",
  annualLivingExpenses: "spending.livingExpenses.annual",
  lifeExpectancyAge: "planning.lifeExpectancyAge",
  spendingAdjustmentAge1: "spending.adjustments.firstBracket.endAge",
  spendingAdjustmentAge2: "spending.adjustments.secondBracket.endAge",
  spendingAdjustmentFirstBracket: "spending.adjustments.firstBracket.deltaRate",
  spendingAdjustmentSecondBracket: "spending.adjustments.secondBracket.deltaRate",
  spendingAdjustmentFinalBracket: "spending.adjustments.finalBracket.deltaRate",
  generalInflation: "assumptions.generalInflationRateAnnual",
  propertyAnnualAppreciation: "assumptions.propertyAppreciationRateAnnual",
  cashInterestRate: "assumptions.cashYieldRateAnnual",
  stockMarketReturn: "assumptions.equityReturnRateAnnual",
  salaryAnnualGrowthRate: "assumptions.salaryGrowthRateAnnual",
  rentalIncomeAnnualIncrease: "assumptions.rentalIncomeGrowthRateAnnual",
  pensionReductionPerYearEarly: "retirement.earlyPensionReductionPerYear",
  minimumCashBuffer: "liquidity.minimumCashBuffer",
  legacyAmount: "planning.legacyAmount",
  stockSellingCostRate: "liquidation.stockSellingCostRate",
  propertyDisposalCostRate: "liquidation.propertyDisposalCostRate",
  otherAssetDisposalCostRate: "liquidation.otherAssetDisposalCostRate"
} as const satisfies Record<string, FieldId>;

export const DOWNSIZING_FIELDS = {
  year: DOWNSIZING_GROUP.yearField,
  newHomeMode: DOWNSIZING_GROUP.modeField,
  newHomePurchaseCost: DOWNSIZING_GROUP.purchaseCostField,
  newRentAnnual: DOWNSIZING_GROUP.rentField
} as const satisfies Record<string, FieldId>;

export const HOME_FIELDS = {
  homeValue: HOME_LOAN_GROUP.homeValueField,
  housingRentAnnual: HOME_LOAN_GROUP.rentField,
  mortgageBalance: HOME_LOAN_GROUP.balanceField,
  mortgageInterestRateAnnual: HOME_LOAN_GROUP.rateField,
  mortgageMonthlyRepayment: HOME_LOAN_GROUP.repaymentField
} as const satisfies Record<string, FieldId>;

export const OTHER_WORK_FIELDS = {
  income: OTHER_WORK_GROUP.incomeField,
  untilAge: OTHER_WORK_GROUP.untilAgeField
} as const satisfies Record<string, FieldId>;

export const OTHER_LOAN_FIELDS = {
  balance: OTHER_LOAN_GROUP.balanceField,
  interestRateAnnual: OTHER_LOAN_GROUP.rateField,
  monthlyRepayment: OTHER_LOAN_GROUP.repaymentField
} as const satisfies Record<string, FieldId>;

export const POST_RETIREMENT_INCOME_FIELDS = {
  amount: POST_RETIREMENT_INCOME_GROUP.amountField,
  fromAge: POST_RETIREMENT_INCOME_GROUP.fromAgeField,
  toAge: POST_RETIREMENT_INCOME_GROUP.toAgeField
} as const satisfies Record<string, FieldId>;

export const DEPENDENT_RUNTIME_GROUPS = DEPENDENT_GROUPS.map((group, idx) => ({
  idx,
  label: `Dependent ${idx + 1}`,
  nameField: group.nameField,
  annualCostField: group.annualCostField,
  yearsField: group.yearsField,
  fields: [group.nameField, group.annualCostField, group.yearsField] as const
})) as ReadonlyArray<{
  idx: number;
  label: string;
  nameField: FieldId;
  annualCostField: FieldId;
  yearsField: FieldId;
  fields: readonly [FieldId, FieldId, FieldId];
}>;

export const PROPERTY_RUNTIME_GROUPS = PROPERTY_GROUPS.map((group, idx) => ({
  idx,
  fallbackName: `Property ${idx + 1}`,
  assetKind: "property" as const,
  nameField: group.nameField,
  valueField: group.valueField,
  annualCostsField: group.annualCostsField,
  rentalIncomeField: group.rentalIncomeField,
  loanBalanceField: group.loanBalanceField,
  loanRateField: group.loanRateField,
  loanRepaymentField: group.loanRepaymentField,
  liquidationRankField: group.liquidationRankField,
  plannedSellYearField: PROPERTY_PLANNED_SELL_YEAR_FIELDS[idx],
  coreFields: [group.nameField, group.valueField, group.annualCostsField] as const,
  visibilityFields: [group.nameField, group.valueField, group.annualCostsField, PROPERTY_PLANNED_SELL_YEAR_FIELDS[idx] as FieldId] as const,
  loanFields: [group.loanBalanceField, group.loanRateField, group.loanRepaymentField] as const,
  allFields: [
    group.nameField,
    group.valueField,
    group.annualCostsField,
    group.rentalIncomeField,
    group.loanBalanceField,
    group.loanRateField,
    group.loanRepaymentField,
    group.liquidationRankField,
    PROPERTY_PLANNED_SELL_YEAR_FIELDS[idx] as FieldId
  ] as const
})) as ReadonlyArray<{
  idx: number;
  fallbackName: string;
  nameField: FieldId;
  valueField: FieldId;
  annualCostsField: FieldId;
  rentalIncomeField: FieldId;
  loanBalanceField: FieldId;
  loanRateField: FieldId;
  loanRepaymentField: FieldId;
  liquidationRankField: FieldId;
  plannedSellYearField: PlannedSellYearFieldId;
  assetKind: "property";
  coreFields: readonly [FieldId, FieldId, FieldId];
  visibilityFields: readonly [FieldId, FieldId, FieldId, FieldId];
  loanFields: readonly [FieldId, FieldId, FieldId];
  allFields: readonly [FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId];
}>;

export const ASSET_OF_VALUE_RUNTIME_GROUPS = ASSET_OF_VALUE_GROUPS.map((group, idx) => ({
  idx,
  fallbackName: `Asset ${idx + 1}`,
  assetKind: "assetOfValue" as const,
  nameField: group.nameField,
  valueField: group.valueField,
  annualCostsField: group.annualCostsField,
  appreciationRateField: group.appreciationRateField,
  loanBalanceField: group.loanBalanceField,
  loanRateField: group.loanRateField,
  loanRepaymentField: group.loanRepaymentField,
  liquidationRankField: group.liquidationRankField,
  plannedSellYearField: ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS[idx],
  coreFields: [group.nameField, group.valueField, group.annualCostsField, group.appreciationRateField] as const,
  visibilityFields: [group.nameField, group.valueField, group.annualCostsField, group.appreciationRateField, ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS[idx] as FieldId] as const,
  loanFields: [group.loanBalanceField, group.loanRateField, group.loanRepaymentField] as const,
  allFields: [
    group.nameField,
    group.valueField,
    group.annualCostsField,
    group.appreciationRateField,
    group.loanBalanceField,
    group.loanRateField,
    group.loanRepaymentField,
    group.liquidationRankField,
    ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS[idx] as FieldId
  ] as const
})) as ReadonlyArray<{
  idx: number;
  fallbackName: string;
  assetKind: "assetOfValue";
  nameField: FieldId;
  valueField: FieldId;
  annualCostsField: FieldId;
  appreciationRateField: FieldId;
  loanBalanceField: FieldId;
  loanRateField: FieldId;
  loanRepaymentField: FieldId;
  liquidationRankField: FieldId;
  plannedSellYearField: PlannedSellYearFieldId;
  coreFields: readonly [FieldId, FieldId, FieldId, FieldId];
  visibilityFields: readonly [FieldId, FieldId, FieldId, FieldId, FieldId];
  loanFields: readonly [FieldId, FieldId, FieldId];
  allFields: readonly [FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId];
}>;

export const LIQUIDATION_ASSET_RUNTIME_GROUPS = [
  ...PROPERTY_RUNTIME_GROUPS.map((group) => ({
    ...group,
    liquidationIdx: group.idx
  })),
  ...ASSET_OF_VALUE_RUNTIME_GROUPS.map((group) => ({
    ...group,
    liquidationIdx: PROPERTY_RUNTIME_GROUPS.length + group.idx
  }))
] as const;

export const INCOME_EVENT_RUNTIME_GROUPS = INCOME_EVENT_GROUPS.map((group, idx) => ({
  idx,
  label: `Income Event ${idx + 1}`,
  nameField: group.nameField,
  amountField: group.amountField,
  yearField: group.yearField,
  fields: [group.nameField, group.amountField, group.yearField] as const
})) as ReadonlyArray<{
  idx: number;
  label: string;
  nameField: FieldId;
  amountField: FieldId;
  yearField: FieldId;
  fields: readonly [FieldId, FieldId, FieldId];
}>;

export const EXPENSE_EVENT_RUNTIME_GROUPS = EXPENSE_EVENT_GROUPS.map((group, idx) => ({
  idx,
  label: `Expense Event ${idx + 1}`,
  nameField: group.nameField,
  amountField: group.amountField,
  yearField: group.yearField,
  fields: [group.nameField, group.amountField, group.yearField] as const
})) as ReadonlyArray<{
  idx: number;
  label: string;
  nameField: FieldId;
  amountField: FieldId;
  yearField: FieldId;
  fields: readonly [FieldId, FieldId, FieldId];
}>;

export const STOCK_MARKET_CRASH_RUNTIME_GROUPS = STOCK_MARKET_CRASH_GROUPS.map((group, idx) => ({
  idx,
  label: `Crash ${idx + 1}`,
  yearField: group.yearField,
  dropField: group.dropField,
  recoveryField: group.recoveryField,
  fields: [group.yearField, group.dropField, group.recoveryField] as const,
  revealFields: [group.yearField] as const
})) as ReadonlyArray<{
  idx: number;
  label: string;
  yearField: FieldId;
  dropField: FieldId;
  recoveryField: FieldId;
  fields: readonly [FieldId, FieldId, FieldId];
  revealFields: readonly [FieldId];
}>;
