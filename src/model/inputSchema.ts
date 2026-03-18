import { InputDefinition, INPUT_DEFINITIONS } from "../ui/inputDefinitions";
import { FIELD_ID_TO_CELL, FieldId, InputCell } from "./fieldRegistry";

export type { InputDefinition };
export { INPUT_DEFINITIONS };

export type ValidationSeverity = "error" | "warning";

export interface ValidationMessage {
  fieldId: FieldId;
  severity: ValidationSeverity;
  message: string;
  blocksProjection: boolean;
}

export interface RawValidationMessage {
  cell: InputCell;
  severity: ValidationSeverity;
  message: string;
  blocksProjection: boolean;
}

export interface NumericConstraint {
  min?: number;
  max?: number;
}

export interface FieldValidationRule {
  required?: boolean;
  nonNegative?: boolean;
  positive?: boolean;
  integer?: boolean;
  allowNegative?: boolean;
  clampBounds?: NumericConstraint;
  warningBounds?: NumericConstraint;
}

type DependentGroup = {
  nameField: FieldId;
  annualCostField: FieldId;
  yearsField: FieldId;
};

type DependentGroupByCell = {
  nameCell: InputCell;
  annualCostCell: InputCell;
  yearsCell: InputCell;
};

type PropertyGroup = {
  nameField: FieldId;
  valueField: FieldId;
  annualCostsField: FieldId;
  rentalIncomeField: FieldId;
  loanBalanceField: FieldId;
  loanRateField: FieldId;
  loanRepaymentField: FieldId;
  liquidationRankField: FieldId;
};

type PropertyGroupByCell = {
  nameCell: InputCell;
  valueCell: InputCell;
  annualCostsCell: InputCell;
  rentalIncomeCell: InputCell;
  loanBalanceCell: InputCell;
  loanRateCell: InputCell;
  loanRepaymentCell: InputCell;
  liquidationRankCell: InputCell;
};

type EventGroup = {
  nameField: FieldId;
  amountField: FieldId;
  yearField: FieldId;
};

type EventGroupByCell = {
  nameCell: InputCell;
  amountCell: InputCell;
  yearCell: InputCell;
};

type HomeLoanGroup = {
  homeValueField: FieldId;
  rentField: FieldId;
  balanceField: FieldId;
  rateField: FieldId;
  repaymentField: FieldId;
};

type HomeLoanGroupByCell = {
  homeValueCell: InputCell;
  rentCell: InputCell;
  balanceCell: InputCell;
  rateCell: InputCell;
  repaymentCell: InputCell;
};

type OtherWorkGroup = {
  incomeField: FieldId;
  untilAgeField: FieldId;
};

type OtherWorkGroupByCell = {
  incomeCell: InputCell;
  untilAgeCell: InputCell;
};

type OtherLoanGroup = {
  balanceField: FieldId;
  rateField: FieldId;
  repaymentField: FieldId;
};

type OtherLoanGroupByCell = {
  balanceCell: InputCell;
  rateCell: InputCell;
  repaymentCell: InputCell;
};

type PostRetirementIncomeGroup = {
  amountField: FieldId;
  fromAgeField: FieldId;
  toAgeField: FieldId;
};

type PostRetirementIncomeGroupByCell = {
  amountCell: InputCell;
  fromAgeCell: InputCell;
  toAgeCell: InputCell;
};

function mapFieldRecordToCells<T>(record: Partial<Record<FieldId, T>>): Partial<Record<InputCell, T>> {
  return Object.fromEntries(
    Object.entries(record).map(([fieldId, value]) => [FIELD_ID_TO_CELL[fieldId as FieldId], value])
  ) as Partial<Record<InputCell, T>>;
}

function mapFieldListToCells<const T extends readonly FieldId[]>(fields: T): { readonly [K in keyof T]: InputCell } {
  return fields.map((fieldId) => FIELD_ID_TO_CELL[fieldId]) as { readonly [K in keyof T]: InputCell };
}

function dependentGroupToCells(group: DependentGroup): DependentGroupByCell {
  return {
    nameCell: FIELD_ID_TO_CELL[group.nameField],
    annualCostCell: FIELD_ID_TO_CELL[group.annualCostField],
    yearsCell: FIELD_ID_TO_CELL[group.yearsField]
  };
}

function propertyGroupToCells(group: PropertyGroup): PropertyGroupByCell {
  return {
    nameCell: FIELD_ID_TO_CELL[group.nameField],
    valueCell: FIELD_ID_TO_CELL[group.valueField],
    annualCostsCell: FIELD_ID_TO_CELL[group.annualCostsField],
    rentalIncomeCell: FIELD_ID_TO_CELL[group.rentalIncomeField],
    loanBalanceCell: FIELD_ID_TO_CELL[group.loanBalanceField],
    loanRateCell: FIELD_ID_TO_CELL[group.loanRateField],
    loanRepaymentCell: FIELD_ID_TO_CELL[group.loanRepaymentField],
    liquidationRankCell: FIELD_ID_TO_CELL[group.liquidationRankField]
  };
}

function eventGroupToCells(group: EventGroup): EventGroupByCell {
  return {
    nameCell: FIELD_ID_TO_CELL[group.nameField],
    amountCell: FIELD_ID_TO_CELL[group.amountField],
    yearCell: FIELD_ID_TO_CELL[group.yearField]
  };
}

function homeLoanGroupToCells(group: HomeLoanGroup): HomeLoanGroupByCell {
  return {
    homeValueCell: FIELD_ID_TO_CELL[group.homeValueField],
    rentCell: FIELD_ID_TO_CELL[group.rentField],
    balanceCell: FIELD_ID_TO_CELL[group.balanceField],
    rateCell: FIELD_ID_TO_CELL[group.rateField],
    repaymentCell: FIELD_ID_TO_CELL[group.repaymentField]
  };
}

function otherWorkGroupToCells(group: OtherWorkGroup): OtherWorkGroupByCell {
  return {
    incomeCell: FIELD_ID_TO_CELL[group.incomeField],
    untilAgeCell: FIELD_ID_TO_CELL[group.untilAgeField]
  };
}

function otherLoanGroupToCells(group: OtherLoanGroup): OtherLoanGroupByCell {
  return {
    balanceCell: FIELD_ID_TO_CELL[group.balanceField],
    rateCell: FIELD_ID_TO_CELL[group.rateField],
    repaymentCell: FIELD_ID_TO_CELL[group.repaymentField]
  };
}

function postRetirementIncomeGroupToCells(group: PostRetirementIncomeGroup): PostRetirementIncomeGroupByCell {
  return {
    amountCell: FIELD_ID_TO_CELL[group.amountField],
    fromAgeCell: FIELD_ID_TO_CELL[group.fromAgeField],
    toAgeCell: FIELD_ID_TO_CELL[group.toAgeField]
  };
}

export const INPUT_DEFINITION_BY_CELL: Record<InputCell, InputDefinition> = Object.fromEntries(
  INPUT_DEFINITIONS.map((def) => [def.cell, def])
) as Record<InputCell, InputDefinition>;

export const INPUT_DEFINITION_BY_FIELD_ID: Record<FieldId, InputDefinition> = Object.fromEntries(
  INPUT_DEFINITIONS.map((def) => [def.fieldId, def])
) as Record<FieldId, InputDefinition>;

export function getFieldLabel(fieldId: FieldId): string {
  return INPUT_DEFINITION_BY_FIELD_ID[fieldId]?.label ?? fieldId;
}

export const ALL_INPUT_CELLS: InputCell[] = INPUT_DEFINITIONS.map((def) => def.cell);
export const ALL_FIELD_IDS: FieldId[] = INPUT_DEFINITIONS.map((def) => def.fieldId);

export const DEEPER_DIVE_CELLS: InputCell[] = INPUT_DEFINITIONS
  .filter((def) => def.section === "DEEPER DIVE")
  .map((def) => def.cell);

export const DEEPER_DIVE_FIELDS: FieldId[] = INPUT_DEFINITIONS
  .filter((def) => def.section === "DEEPER DIVE")
  .map((def) => def.fieldId);

export const FINER_DETAILS_CELLS: InputCell[] = INPUT_DEFINITIONS
  .filter((def) => def.section === "FINER DETAILS")
  .map((def) => def.cell);

export const FINER_DETAILS_FIELDS: FieldId[] = INPUT_DEFINITIONS
  .filter((def) => def.section === "FINER DETAILS")
  .map((def) => def.fieldId);

export const FINER_DETAILS_COL_C_DEFAULTS: Partial<Record<FieldId, number | null>> = {
  "planning.lifeExpectancyAge": 85,
  "spending.adjustments.pre65.deltaRate": 0,
  "spending.adjustments.age66To75.deltaRate": -0.1,
  "spending.adjustments.age76Plus.deltaRate": -0.2,
  "income.postRetirementSupplement.annual": null,
  "income.postRetirementSupplement.startAge": null,
  "income.postRetirementSupplement.endAge": null,
  "assumptions.generalInflationRateAnnual": 0.025,
  "assumptions.propertyAppreciationRateAnnual": 0.03,
  "assumptions.cashYieldRateAnnual": 0.025,
  "assumptions.equityReturnRateAnnual": 0.08,
  "assumptions.salaryGrowthRateAnnual": 0.03,
  "assumptions.rentalIncomeGrowthRateAnnual": 0.03,
  "retirement.earlyPensionReductionPerYear": 300,
  "liquidity.minimumCashBuffer": 20000,
  "liquidation.stockSellingCostRate": 0.05,
  "liquidation.propertyDisposalCostRate": 0.15,
  "properties.01.liquidationPriority": null,
  "properties.02.liquidationPriority": null,
  "properties.03.liquidationPriority": null
};

export const FINER_DETAILS_COL_C_DEFAULTS_BY_CELL = mapFieldRecordToCells(FINER_DETAILS_COL_C_DEFAULTS);

export const FIELD_VALIDATION_RULES: Partial<Record<FieldId, FieldValidationRule>> = {
  "profile.currentAge": { required: true, integer: true, nonNegative: true, clampBounds: { min: 18, max: 100 } },
  "income.employment.netAnnual": { nonNegative: true },
  "assets.cash.totalBalance": { nonNegative: true },
  "assets.equities.marketValue": { nonNegative: true },
  "housing.01Residence.marketValue": { nonNegative: true },
  "housing.01Residence.mortgage.balance": { nonNegative: true },
  "housing.01Residence.mortgage.interestRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  "housing.01Residence.mortgage.monthlyRepayment": { nonNegative: true },
  "retirement.statutoryAge": { required: true, integer: true, nonNegative: true, clampBounds: { min: 50, max: 70 } },
  "retirement.statePension.netAnnualAtStart": { nonNegative: true },
  "housing.rentAnnual": { nonNegative: true },
  "spending.livingExpenses.annual": { required: true, positive: true },
  "dependents.01.annualCost": { nonNegative: true },
  "dependents.01.supportYearsRemaining": { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  "dependents.02.annualCost": { nonNegative: true },
  "dependents.02.supportYearsRemaining": { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  "dependents.03.annualCost": { nonNegative: true },
  "dependents.03.supportYearsRemaining": { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  "dependents.04.annualCost": { nonNegative: true },
  "dependents.04.supportYearsRemaining": { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  "dependents.05.annualCost": { nonNegative: true },
  "dependents.05.supportYearsRemaining": { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  "properties.01.marketValue": { nonNegative: true },
  "properties.01.annualOperatingCost": { nonNegative: true },
  "properties.02.marketValue": { nonNegative: true },
  "properties.02.annualOperatingCost": { nonNegative: true },
  "properties.03.marketValue": { nonNegative: true },
  "properties.03.annualOperatingCost": { nonNegative: true },
  "properties.01.rentalIncomeNetAnnual": { nonNegative: true },
  "properties.02.rentalIncomeNetAnnual": { nonNegative: true },
  "properties.03.rentalIncomeNetAnnual": { nonNegative: true },
  "income.otherWork.netAnnual": { nonNegative: true },
  "income.otherWork.endAge": { integer: true, nonNegative: true },
  "debts.creditCards.balance": { nonNegative: true },
  "properties.01.loan.balance": { nonNegative: true },
  "properties.01.loan.interestRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  "properties.01.loan.monthlyRepayment": { nonNegative: true },
  "properties.02.loan.balance": { nonNegative: true },
  "properties.02.loan.interestRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  "properties.02.loan.monthlyRepayment": { nonNegative: true },
  "properties.03.loan.balance": { nonNegative: true },
  "properties.03.loan.interestRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  "properties.03.loan.monthlyRepayment": { nonNegative: true },
  "debts.other.balance": { nonNegative: true },
  "debts.other.interestRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  "debts.other.monthlyRepayment": { nonNegative: true },
  "cashflowEvents.income.01.amount": { nonNegative: true },
  "cashflowEvents.income.01.year": { integer: true },
  "cashflowEvents.income.02.amount": { nonNegative: true },
  "cashflowEvents.income.02.year": { integer: true },
  "cashflowEvents.income.03.amount": { nonNegative: true },
  "cashflowEvents.income.03.year": { integer: true },
  "cashflowEvents.expense.01.amount": { nonNegative: true },
  "cashflowEvents.expense.01.year": { integer: true },
  "cashflowEvents.expense.02.amount": { nonNegative: true },
  "cashflowEvents.expense.02.year": { integer: true },
  "cashflowEvents.expense.03.amount": { nonNegative: true },
  "cashflowEvents.expense.03.year": { integer: true },
  "planning.lifeExpectancyAge": { required: true, integer: true, nonNegative: true, clampBounds: { min: 19, max: 120 }, warningBounds: { max: 100 } },
  "spending.adjustments.pre65.deltaRate": { allowNegative: true, warningBounds: { min: -0.5, max: 1 } },
  "spending.adjustments.age66To75.deltaRate": { allowNegative: true, warningBounds: { min: -0.5, max: 1 } },
  "spending.adjustments.age76Plus.deltaRate": { allowNegative: true, warningBounds: { min: -0.5, max: 1 } },
  "income.postRetirementSupplement.annual": { nonNegative: true },
  "income.postRetirementSupplement.startAge": { integer: true, nonNegative: true },
  "income.postRetirementSupplement.endAge": { integer: true, nonNegative: true },
  "assumptions.generalInflationRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.06 } },
  "assumptions.propertyAppreciationRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.08 } },
  "assumptions.cashYieldRateAnnual": { nonNegative: true, warningBounds: { min: 0, max: 0.06 } },
  "assumptions.equityReturnRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.12 } },
  "assumptions.salaryGrowthRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.08 } },
  "assumptions.rentalIncomeGrowthRateAnnual": { allowNegative: true, warningBounds: { min: 0, max: 0.08 } },
  "retirement.earlyPensionReductionPerYear": { nonNegative: true },
  "liquidity.minimumCashBuffer": { nonNegative: true },
  "liquidation.stockSellingCostRate": { nonNegative: true, warningBounds: { max: 0.25 } },
  "liquidation.propertyDisposalCostRate": { nonNegative: true, warningBounds: { max: 0.3 } },
  "properties.01.liquidationPriority": { integer: true, nonNegative: true, clampBounds: { min: 0, max: 3 } },
  "properties.02.liquidationPriority": { integer: true, nonNegative: true, clampBounds: { min: 0, max: 3 } },
  "properties.03.liquidationPriority": { integer: true, nonNegative: true, clampBounds: { min: 0, max: 3 } }
};

export const FIELD_VALIDATION_RULES_BY_CELL = mapFieldRecordToCells(FIELD_VALIDATION_RULES);

export const COERCED_NUMERIC_BOUNDS: Partial<Record<FieldId, NumericConstraint>> = Object.fromEntries(
  Object.entries(FIELD_VALIDATION_RULES)
    .filter(([, rule]) => rule?.clampBounds)
    .map(([fieldId, rule]) => [fieldId, rule?.clampBounds])
) as Partial<Record<FieldId, NumericConstraint>>;

export const COERCED_NUMERIC_BOUNDS_BY_CELL = mapFieldRecordToCells(COERCED_NUMERIC_BOUNDS);

export const ALLOW_NEGATIVE_FIELDS = new Set<FieldId>(
  (Object.entries(FIELD_VALIDATION_RULES) as Array<[FieldId, FieldValidationRule]>)
    .filter(([, rule]) => rule.allowNegative)
    .map(([fieldId]) => fieldId)
);

export const ALLOW_NEGATIVE_INPUT_CELLS = new Set<InputCell>(
  [...ALLOW_NEGATIVE_FIELDS].map((fieldId) => FIELD_ID_TO_CELL[fieldId])
);

export const REQUIRED_CORE_FIELDS = [
  "profile.currentAge",
  "retirement.statutoryAge",
  "spending.livingExpenses.annual",
  "planning.lifeExpectancyAge"
] as const satisfies readonly FieldId[];

export const REQUIRED_CORE_CELLS = mapFieldListToCells(REQUIRED_CORE_FIELDS);

export const PROJECTION_GATE_FIELDS = [
  "profile.currentAge",
  "retirement.statutoryAge",
  "planning.lifeExpectancyAge"
] as const satisfies readonly FieldId[];

export const PROJECTION_GATE_CELLS = mapFieldListToCells(PROJECTION_GATE_FIELDS);
export const SKIP_REVEAL_CRITICAL_FIELDS = PROJECTION_GATE_FIELDS;
export const SKIP_REVEAL_CRITICAL_CELLS = PROJECTION_GATE_CELLS;

export const LIQUIDATION_RANK_FIELDS = [
  "properties.01.liquidationPriority",
  "properties.02.liquidationPriority",
  "properties.03.liquidationPriority"
] as const satisfies readonly FieldId[];

export const LIQUIDATION_RANK_CELLS = mapFieldListToCells(LIQUIDATION_RANK_FIELDS);

export const DEPENDENT_GROUPS = [
  {
    nameField: "dependents.01.displayName",
    annualCostField: "dependents.01.annualCost",
    yearsField: "dependents.01.supportYearsRemaining"
  },
  {
    nameField: "dependents.02.displayName",
    annualCostField: "dependents.02.annualCost",
    yearsField: "dependents.02.supportYearsRemaining"
  },
  {
    nameField: "dependents.03.displayName",
    annualCostField: "dependents.03.annualCost",
    yearsField: "dependents.03.supportYearsRemaining"
  },
  {
    nameField: "dependents.04.displayName",
    annualCostField: "dependents.04.annualCost",
    yearsField: "dependents.04.supportYearsRemaining"
  },
  {
    nameField: "dependents.05.displayName",
    annualCostField: "dependents.05.annualCost",
    yearsField: "dependents.05.supportYearsRemaining"
  }
] as Array<DependentGroup>;

export const DEPENDENT_GROUPS_BY_CELL = DEPENDENT_GROUPS.map(dependentGroupToCells) as Array<DependentGroupByCell>;

export const PROPERTY_GROUPS = [
  {
    nameField: "properties.01.displayName",
    valueField: "properties.01.marketValue",
    annualCostsField: "properties.01.annualOperatingCost",
    rentalIncomeField: "properties.01.rentalIncomeNetAnnual",
    loanBalanceField: "properties.01.loan.balance",
    loanRateField: "properties.01.loan.interestRateAnnual",
    loanRepaymentField: "properties.01.loan.monthlyRepayment",
    liquidationRankField: "properties.01.liquidationPriority"
  },
  {
    nameField: "properties.02.displayName",
    valueField: "properties.02.marketValue",
    annualCostsField: "properties.02.annualOperatingCost",
    rentalIncomeField: "properties.02.rentalIncomeNetAnnual",
    loanBalanceField: "properties.02.loan.balance",
    loanRateField: "properties.02.loan.interestRateAnnual",
    loanRepaymentField: "properties.02.loan.monthlyRepayment",
    liquidationRankField: "properties.02.liquidationPriority"
  },
  {
    nameField: "properties.03.displayName",
    valueField: "properties.03.marketValue",
    annualCostsField: "properties.03.annualOperatingCost",
    rentalIncomeField: "properties.03.rentalIncomeNetAnnual",
    loanBalanceField: "properties.03.loan.balance",
    loanRateField: "properties.03.loan.interestRateAnnual",
    loanRepaymentField: "properties.03.loan.monthlyRepayment",
    liquidationRankField: "properties.03.liquidationPriority"
  }
] as Array<PropertyGroup>;

export const PROPERTY_GROUPS_BY_CELL = PROPERTY_GROUPS.map(propertyGroupToCells) as Array<PropertyGroupByCell>;

export const INCOME_EVENT_GROUPS = [
  {
    nameField: "cashflowEvents.income.01.name",
    amountField: "cashflowEvents.income.01.amount",
    yearField: "cashflowEvents.income.01.year"
  },
  {
    nameField: "cashflowEvents.income.02.name",
    amountField: "cashflowEvents.income.02.amount",
    yearField: "cashflowEvents.income.02.year"
  },
  {
    nameField: "cashflowEvents.income.03.name",
    amountField: "cashflowEvents.income.03.amount",
    yearField: "cashflowEvents.income.03.year"
  }
] as Array<EventGroup>;

export const INCOME_EVENT_GROUPS_BY_CELL = INCOME_EVENT_GROUPS.map(eventGroupToCells) as Array<EventGroupByCell>;

export const EXPENSE_EVENT_GROUPS = [
  {
    nameField: "cashflowEvents.expense.01.name",
    amountField: "cashflowEvents.expense.01.amount",
    yearField: "cashflowEvents.expense.01.year"
  },
  {
    nameField: "cashflowEvents.expense.02.name",
    amountField: "cashflowEvents.expense.02.amount",
    yearField: "cashflowEvents.expense.02.year"
  },
  {
    nameField: "cashflowEvents.expense.03.name",
    amountField: "cashflowEvents.expense.03.amount",
    yearField: "cashflowEvents.expense.03.year"
  }
] as Array<EventGroup>;

export const EXPENSE_EVENT_GROUPS_BY_CELL = EXPENSE_EVENT_GROUPS.map(eventGroupToCells) as Array<EventGroupByCell>;

export const HOME_LOAN_GROUP = {
  homeValueField: "housing.01Residence.marketValue",
  rentField: "housing.rentAnnual",
  balanceField: "housing.01Residence.mortgage.balance",
  rateField: "housing.01Residence.mortgage.interestRateAnnual",
  repaymentField: "housing.01Residence.mortgage.monthlyRepayment"
} as const satisfies HomeLoanGroup;

export const HOME_LOAN_GROUP_BY_CELL = homeLoanGroupToCells(HOME_LOAN_GROUP);

export const OTHER_WORK_GROUP = {
  incomeField: "income.otherWork.netAnnual",
  untilAgeField: "income.otherWork.endAge"
} as const satisfies OtherWorkGroup;

export const OTHER_WORK_GROUP_BY_CELL = otherWorkGroupToCells(OTHER_WORK_GROUP);

export const OTHER_LOAN_GROUP = {
  balanceField: "debts.other.balance",
  rateField: "debts.other.interestRateAnnual",
  repaymentField: "debts.other.monthlyRepayment"
} as const satisfies OtherLoanGroup;

export const OTHER_LOAN_GROUP_BY_CELL = otherLoanGroupToCells(OTHER_LOAN_GROUP);

export const POST_RETIREMENT_INCOME_GROUP = {
  amountField: "income.postRetirementSupplement.annual",
  fromAgeField: "income.postRetirementSupplement.startAge",
  toAgeField: "income.postRetirementSupplement.endAge"
} as const satisfies PostRetirementIncomeGroup;

export const POST_RETIREMENT_INCOME_GROUP_BY_CELL = postRetirementIncomeGroupToCells(POST_RETIREMENT_INCOME_GROUP);
