import { InputDefinition, INPUT_DEFINITIONS } from "../ui/inputDefinitions";
import { FieldId, InputCell } from "./fieldRegistry";

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

function mapRecordKeys<T>(record: Partial<Record<InputCell, T>>): Partial<Record<FieldId, T>> {
  return Object.fromEntries(
    Object.entries(record).map(([cell, value]) => {
      const def = INPUT_DEFINITION_BY_CELL[cell as InputCell];
      return [def.fieldId, value];
    })
  ) as Partial<Record<FieldId, T>>;
}

function mapCellList(cells: readonly InputCell[]): FieldId[] {
  return cells.map((cell) => INPUT_DEFINITION_BY_CELL[cell].fieldId);
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

export const FINER_DETAILS_COL_C_DEFAULTS_BY_CELL: Partial<Record<InputCell, number | null>> = {
  B134: 85,
  B137: 0,
  B138: -0.1,
  B139: -0.2,
  B141: null,
  B142: null,
  B143: null,
  B145: 0.025,
  B147: 0.03,
  B149: 0.025,
  B151: 0.08,
  B153: 0.03,
  B155: 0.03,
  B157: 300,
  B159: 20000,
  B161: 0.05,
  B163: 0.15,
  B166: null,
  B167: null,
  B168: null
};

export const FINER_DETAILS_COL_C_DEFAULTS = mapRecordKeys(FINER_DETAILS_COL_C_DEFAULTS_BY_CELL);

export const FIELD_VALIDATION_RULES_BY_CELL: Partial<Record<InputCell, FieldValidationRule>> = {
  B4: { required: true, integer: true, nonNegative: true, clampBounds: { min: 18, max: 100 } },
  B6: { nonNegative: true },
  B8: { nonNegative: true },
  B10: { nonNegative: true },
  B12: { nonNegative: true },
  B15: { nonNegative: true },
  B16: { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  B17: { nonNegative: true },
  B19: { required: true, integer: true, nonNegative: true, clampBounds: { min: 50, max: 70 } },
  B21: { nonNegative: true },
  B23: { nonNegative: true },
  B25: { required: true, positive: true },
  B34: { nonNegative: true },
  B35: { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  B39: { nonNegative: true },
  B40: { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  B44: { nonNegative: true },
  B45: { integer: true, positive: true, clampBounds: { min: 1, max: 99 } },
  B51: { nonNegative: true },
  B52: { nonNegative: true },
  B56: { nonNegative: true },
  B57: { nonNegative: true },
  B61: { nonNegative: true },
  B62: { nonNegative: true },
  B66: { nonNegative: true },
  B67: { nonNegative: true },
  B68: { nonNegative: true },
  B70: { nonNegative: true },
  B71: { integer: true, nonNegative: true },
  B75: { nonNegative: true },
  B78: { nonNegative: true },
  B79: { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  B80: { nonNegative: true },
  B83: { nonNegative: true },
  B84: { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  B85: { nonNegative: true },
  B88: { nonNegative: true },
  B89: { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  B90: { nonNegative: true },
  B93: { nonNegative: true },
  B94: { allowNegative: true, warningBounds: { min: 0, max: 0.15 } },
  B95: { nonNegative: true },
  B101: { nonNegative: true },
  B102: { integer: true },
  B106: { nonNegative: true },
  B107: { integer: true },
  B111: { nonNegative: true },
  B112: { integer: true },
  B118: { nonNegative: true },
  B119: { integer: true },
  B123: { nonNegative: true },
  B124: { integer: true },
  B128: { nonNegative: true },
  B129: { integer: true },
  B134: { required: true, integer: true, nonNegative: true, clampBounds: { min: 19, max: 120 }, warningBounds: { max: 100 } },
  B137: { allowNegative: true, warningBounds: { min: -0.5, max: 1 } },
  B138: { allowNegative: true, warningBounds: { min: -0.5, max: 1 } },
  B139: { allowNegative: true, warningBounds: { min: -0.5, max: 1 } },
  B141: { nonNegative: true },
  B142: { integer: true, nonNegative: true },
  B143: { integer: true, nonNegative: true },
  B145: { allowNegative: true, warningBounds: { min: 0, max: 0.06 } },
  B147: { allowNegative: true, warningBounds: { min: 0, max: 0.08 } },
  B149: { nonNegative: true, warningBounds: { min: 0, max: 0.06 } },
  B151: { allowNegative: true, warningBounds: { min: 0, max: 0.12 } },
  B153: { allowNegative: true, warningBounds: { min: 0, max: 0.08 } },
  B155: { allowNegative: true, warningBounds: { min: 0, max: 0.08 } },
  B157: { nonNegative: true },
  B159: { nonNegative: true },
  B161: { nonNegative: true, warningBounds: { max: 0.25 } },
  B163: { nonNegative: true, warningBounds: { max: 0.3 } },
  B166: { integer: true, nonNegative: true, clampBounds: { min: 0, max: 3 } },
  B167: { integer: true, nonNegative: true, clampBounds: { min: 0, max: 3 } },
  B168: { integer: true, nonNegative: true, clampBounds: { min: 0, max: 3 } }
};

export const FIELD_VALIDATION_RULES = mapRecordKeys(FIELD_VALIDATION_RULES_BY_CELL);

export const COERCED_NUMERIC_BOUNDS_BY_CELL: Partial<Record<InputCell, NumericConstraint>> = Object.fromEntries(
  Object.entries(FIELD_VALIDATION_RULES_BY_CELL)
    .filter(([, rule]) => rule?.clampBounds)
    .map(([cell, rule]) => [cell, rule?.clampBounds])
) as Partial<Record<InputCell, NumericConstraint>>;

export const COERCED_NUMERIC_BOUNDS = mapRecordKeys(COERCED_NUMERIC_BOUNDS_BY_CELL);

export const ALLOW_NEGATIVE_INPUT_CELLS = new Set<InputCell>(
  (Object.entries(FIELD_VALIDATION_RULES_BY_CELL) as Array<[InputCell, FieldValidationRule]>)
    .filter(([, rule]) => rule.allowNegative)
    .map(([cell]) => cell)
);

export const ALLOW_NEGATIVE_FIELDS = new Set<FieldId>(
  mapCellList([...ALLOW_NEGATIVE_INPUT_CELLS])
);

export const REQUIRED_CORE_CELLS = ["B4", "B19", "B25", "B134"] as const satisfies readonly InputCell[];
export const REQUIRED_CORE_FIELDS = mapCellList(REQUIRED_CORE_CELLS);
export const PROJECTION_GATE_CELLS = ["B4", "B19", "B134"] as const satisfies readonly InputCell[];
export const PROJECTION_GATE_FIELDS = mapCellList(PROJECTION_GATE_CELLS);
export const SKIP_REVEAL_CRITICAL_CELLS = PROJECTION_GATE_CELLS;
export const SKIP_REVEAL_CRITICAL_FIELDS = PROJECTION_GATE_FIELDS;
export const LIQUIDATION_RANK_CELLS = ["B166", "B167", "B168"] as const satisfies readonly InputCell[];
export const LIQUIDATION_RANK_FIELDS = mapCellList(LIQUIDATION_RANK_CELLS);

export const DEPENDENT_GROUPS_BY_CELL = [
  { nameCell: "B33", annualCostCell: "B34", yearsCell: "B35" },
  { nameCell: "B38", annualCostCell: "B39", yearsCell: "B40" },
  { nameCell: "B43", annualCostCell: "B44", yearsCell: "B45" }
] as const;

export const DEPENDENT_GROUPS = DEPENDENT_GROUPS_BY_CELL.map((group) => ({
  nameField: INPUT_DEFINITION_BY_CELL[group.nameCell].fieldId,
  annualCostField: INPUT_DEFINITION_BY_CELL[group.annualCostCell].fieldId,
  yearsField: INPUT_DEFINITION_BY_CELL[group.yearsCell].fieldId
})) as Array<{
  nameField: FieldId;
  annualCostField: FieldId;
  yearsField: FieldId;
}>;

export const PROPERTY_GROUPS_BY_CELL = [
  {
    nameCell: "B50",
    valueCell: "B51",
    annualCostsCell: "B52",
    rentalIncomeCell: "B66",
    loanBalanceCell: "B78",
    loanRateCell: "B79",
    loanRepaymentCell: "B80",
    liquidationRankCell: "B166"
  },
  {
    nameCell: "B55",
    valueCell: "B56",
    annualCostsCell: "B57",
    rentalIncomeCell: "B67",
    loanBalanceCell: "B83",
    loanRateCell: "B84",
    loanRepaymentCell: "B85",
    liquidationRankCell: "B167"
  },
  {
    nameCell: "B60",
    valueCell: "B61",
    annualCostsCell: "B62",
    rentalIncomeCell: "B68",
    loanBalanceCell: "B88",
    loanRateCell: "B89",
    loanRepaymentCell: "B90",
    liquidationRankCell: "B168"
  }
] as const;

export const PROPERTY_GROUPS = PROPERTY_GROUPS_BY_CELL.map((group) => ({
  nameField: INPUT_DEFINITION_BY_CELL[group.nameCell].fieldId,
  valueField: INPUT_DEFINITION_BY_CELL[group.valueCell].fieldId,
  annualCostsField: INPUT_DEFINITION_BY_CELL[group.annualCostsCell].fieldId,
  rentalIncomeField: INPUT_DEFINITION_BY_CELL[group.rentalIncomeCell].fieldId,
  loanBalanceField: INPUT_DEFINITION_BY_CELL[group.loanBalanceCell].fieldId,
  loanRateField: INPUT_DEFINITION_BY_CELL[group.loanRateCell].fieldId,
  loanRepaymentField: INPUT_DEFINITION_BY_CELL[group.loanRepaymentCell].fieldId,
  liquidationRankField: INPUT_DEFINITION_BY_CELL[group.liquidationRankCell].fieldId
})) as Array<{
  nameField: FieldId;
  valueField: FieldId;
  annualCostsField: FieldId;
  rentalIncomeField: FieldId;
  loanBalanceField: FieldId;
  loanRateField: FieldId;
  loanRepaymentField: FieldId;
  liquidationRankField: FieldId;
}>;

export const INCOME_EVENT_GROUPS_BY_CELL = [
  { nameCell: "B100", amountCell: "B101", yearCell: "B102" },
  { nameCell: "B105", amountCell: "B106", yearCell: "B107" },
  { nameCell: "B110", amountCell: "B111", yearCell: "B112" }
] as const;

export const INCOME_EVENT_GROUPS = INCOME_EVENT_GROUPS_BY_CELL.map((group) => ({
  nameField: INPUT_DEFINITION_BY_CELL[group.nameCell].fieldId,
  amountField: INPUT_DEFINITION_BY_CELL[group.amountCell].fieldId,
  yearField: INPUT_DEFINITION_BY_CELL[group.yearCell].fieldId
})) as Array<{ nameField: FieldId; amountField: FieldId; yearField: FieldId }>;

export const EXPENSE_EVENT_GROUPS_BY_CELL = [
  { nameCell: "B117", amountCell: "B118", yearCell: "B119" },
  { nameCell: "B122", amountCell: "B123", yearCell: "B124" },
  { nameCell: "B127", amountCell: "B128", yearCell: "B129" }
] as const;

export const EXPENSE_EVENT_GROUPS = EXPENSE_EVENT_GROUPS_BY_CELL.map((group) => ({
  nameField: INPUT_DEFINITION_BY_CELL[group.nameCell].fieldId,
  amountField: INPUT_DEFINITION_BY_CELL[group.amountCell].fieldId,
  yearField: INPUT_DEFINITION_BY_CELL[group.yearCell].fieldId
})) as Array<{ nameField: FieldId; amountField: FieldId; yearField: FieldId }>;

export const HOME_LOAN_GROUP_BY_CELL = {
  homeValueCell: "B12",
  rentCell: "B23",
  balanceCell: "B15",
  rateCell: "B16",
  repaymentCell: "B17"
} as const;

export const HOME_LOAN_GROUP = {
  homeValueField: INPUT_DEFINITION_BY_CELL[HOME_LOAN_GROUP_BY_CELL.homeValueCell].fieldId,
  rentField: INPUT_DEFINITION_BY_CELL[HOME_LOAN_GROUP_BY_CELL.rentCell].fieldId,
  balanceField: INPUT_DEFINITION_BY_CELL[HOME_LOAN_GROUP_BY_CELL.balanceCell].fieldId,
  rateField: INPUT_DEFINITION_BY_CELL[HOME_LOAN_GROUP_BY_CELL.rateCell].fieldId,
  repaymentField: INPUT_DEFINITION_BY_CELL[HOME_LOAN_GROUP_BY_CELL.repaymentCell].fieldId
} as const;

export const OTHER_WORK_GROUP_BY_CELL = {
  incomeCell: "B70",
  untilAgeCell: "B71"
} as const;

export const OTHER_WORK_GROUP = {
  incomeField: INPUT_DEFINITION_BY_CELL[OTHER_WORK_GROUP_BY_CELL.incomeCell].fieldId,
  untilAgeField: INPUT_DEFINITION_BY_CELL[OTHER_WORK_GROUP_BY_CELL.untilAgeCell].fieldId
} as const;

export const OTHER_LOAN_GROUP_BY_CELL = {
  balanceCell: "B93",
  rateCell: "B94",
  repaymentCell: "B95"
} as const;

export const OTHER_LOAN_GROUP = {
  balanceField: INPUT_DEFINITION_BY_CELL[OTHER_LOAN_GROUP_BY_CELL.balanceCell].fieldId,
  rateField: INPUT_DEFINITION_BY_CELL[OTHER_LOAN_GROUP_BY_CELL.rateCell].fieldId,
  repaymentField: INPUT_DEFINITION_BY_CELL[OTHER_LOAN_GROUP_BY_CELL.repaymentCell].fieldId
} as const;

export const POST_RETIREMENT_INCOME_GROUP_BY_CELL = {
  amountCell: "B141",
  fromAgeCell: "B142",
  toAgeCell: "B143"
} as const;

export const POST_RETIREMENT_INCOME_GROUP = {
  amountField: INPUT_DEFINITION_BY_CELL[POST_RETIREMENT_INCOME_GROUP_BY_CELL.amountCell].fieldId,
  fromAgeField: INPUT_DEFINITION_BY_CELL[POST_RETIREMENT_INCOME_GROUP_BY_CELL.fromAgeCell].fieldId,
  toAgeField: INPUT_DEFINITION_BY_CELL[POST_RETIREMENT_INCOME_GROUP_BY_CELL.toAgeCell].fieldId
} as const;
