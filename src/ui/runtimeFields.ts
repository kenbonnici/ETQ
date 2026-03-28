import { FieldId } from "../model/fieldRegistry";
import {
  DEPENDENT_GROUPS,
  EXPENSE_EVENT_GROUPS,
  HOME_LOAN_GROUP,
  INCOME_EVENT_GROUPS,
  INPUT_DEFINITION_BY_CELL,
  OTHER_LOAN_GROUP,
  OTHER_WORK_GROUP,
  POST_RETIREMENT_INCOME_GROUP,
  PROPERTY_GROUPS
} from "../model/inputSchema";

export const RUNTIME_FIELDS = {
  currentAge: INPUT_DEFINITION_BY_CELL.B4.fieldId,
  currentNetIncomeAnnual: INPUT_DEFINITION_BY_CELL.B6.fieldId,
  cashBalance: INPUT_DEFINITION_BY_CELL.B8.fieldId,
  stockMarketInvestments: INPUT_DEFINITION_BY_CELL.B10.fieldId,
  statutoryRetirementAge: INPUT_DEFINITION_BY_CELL.B19.fieldId,
  annualPensionAtRetirement: INPUT_DEFINITION_BY_CELL.B21.fieldId,
  annualLivingExpenses: INPUT_DEFINITION_BY_CELL.B25.fieldId,
  lifeExpectancyAge: INPUT_DEFINITION_BY_CELL.B166.fieldId,
  spendingAdjustmentPre65: INPUT_DEFINITION_BY_CELL.B169.fieldId,
  spendingAdjustment66To75: INPUT_DEFINITION_BY_CELL.B170.fieldId,
  spendingAdjustment76Plus: INPUT_DEFINITION_BY_CELL.B171.fieldId,
  generalInflation: INPUT_DEFINITION_BY_CELL.B177.fieldId,
  propertyAnnualAppreciation: INPUT_DEFINITION_BY_CELL.B179.fieldId,
  cashInterestRate: INPUT_DEFINITION_BY_CELL.B181.fieldId,
  stockMarketReturn: INPUT_DEFINITION_BY_CELL.B183.fieldId,
  salaryAnnualGrowthRate: INPUT_DEFINITION_BY_CELL.B185.fieldId,
  rentalIncomeAnnualIncrease: INPUT_DEFINITION_BY_CELL.B187.fieldId,
  pensionReductionPerYearEarly: INPUT_DEFINITION_BY_CELL.B189.fieldId,
  minimumCashBuffer: INPUT_DEFINITION_BY_CELL.B191.fieldId,
  legacyAmount: INPUT_DEFINITION_BY_CELL.B193.fieldId,
  stockSellingCostRate: INPUT_DEFINITION_BY_CELL.B195.fieldId,
  propertyDisposalCostRate: INPUT_DEFINITION_BY_CELL.B197.fieldId
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
  nameField: group.nameField,
  valueField: group.valueField,
  annualCostsField: group.annualCostsField,
  rentalIncomeField: group.rentalIncomeField,
  loanBalanceField: group.loanBalanceField,
  loanRateField: group.loanRateField,
  loanRepaymentField: group.loanRepaymentField,
  liquidationRankField: group.liquidationRankField,
  coreFields: [group.nameField, group.valueField, group.annualCostsField] as const,
  loanFields: [group.loanBalanceField, group.loanRateField, group.loanRepaymentField] as const,
  allFields: [
    group.nameField,
    group.valueField,
    group.annualCostsField,
    group.rentalIncomeField,
    group.loanBalanceField,
    group.loanRateField,
    group.loanRepaymentField,
    group.liquidationRankField
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
  coreFields: readonly [FieldId, FieldId, FieldId];
  loanFields: readonly [FieldId, FieldId, FieldId];
  allFields: readonly [FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId, FieldId];
}>;

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
