import test from "node:test";
import assert from "node:assert/strict";

import { CELL_TO_FIELD_ID, FIELD_ID_TO_CELL, FieldId, InputCell } from "../../src/model/fieldRegistry";
import {
  ASSET_OF_VALUE_GROUPS,
  ASSET_OF_VALUE_GROUPS_BY_CELL,
  ALLOW_NEGATIVE_FIELDS,
  ALLOW_NEGATIVE_INPUT_CELLS,
  COERCED_NUMERIC_BOUNDS,
  COERCED_NUMERIC_BOUNDS_BY_CELL,
  DEPENDENT_GROUPS,
  DEPENDENT_GROUPS_BY_CELL,
  EXPENSE_EVENT_GROUPS,
  EXPENSE_EVENT_GROUPS_BY_CELL,
  FIELD_VALIDATION_RULES,
  FIELD_VALIDATION_RULES_BY_CELL,
  FINER_DETAILS_COL_C_DEFAULTS,
  FINER_DETAILS_COL_C_DEFAULTS_BY_CELL,
  HOME_LOAN_GROUP,
  HOME_LOAN_GROUP_BY_CELL,
  INCOME_EVENT_GROUPS,
  INCOME_EVENT_GROUPS_BY_CELL,
  LIQUIDATION_RANK_CELLS,
  LIQUIDATION_RANK_FIELDS,
  OTHER_LOAN_GROUP,
  OTHER_LOAN_GROUP_BY_CELL,
  OTHER_WORK_GROUP,
  OTHER_WORK_GROUP_BY_CELL,
  POST_RETIREMENT_INCOME_GROUP,
  POST_RETIREMENT_INCOME_GROUP_BY_CELL,
  PROJECTION_GATE_CELLS,
  PROJECTION_GATE_FIELDS,
  PROPERTY_GROUPS,
  PROPERTY_GROUPS_BY_CELL,
  REQUIRED_CORE_CELLS,
  REQUIRED_CORE_FIELDS,
  SKIP_REVEAL_CRITICAL_CELLS,
  SKIP_REVEAL_CRITICAL_FIELDS,
  STOCK_MARKET_CRASH_GROUPS,
  STOCK_MARKET_CRASH_GROUPS_BY_CELL
} from "../../src/model/inputSchema";

function mapFieldRecordToCells<T>(record: Partial<Record<FieldId, T>>): Partial<Record<InputCell, T>> {
  return Object.fromEntries(
    Object.entries(record).map(([fieldId, value]) => [FIELD_ID_TO_CELL[fieldId as FieldId], value])
  ) as Partial<Record<InputCell, T>>;
}

function mapFieldListToCells(fields: readonly FieldId[]): InputCell[] {
  return fields.map((fieldId) => FIELD_ID_TO_CELL[fieldId]);
}

function mapCellListToFields(cells: readonly InputCell[]): FieldId[] {
  return cells.map((cell) => CELL_TO_FIELD_ID[cell]);
}

test("cell-keyed schema exports match the field-keyed source when remapped", () => {
  assert.deepEqual(FINER_DETAILS_COL_C_DEFAULTS_BY_CELL, mapFieldRecordToCells(FINER_DETAILS_COL_C_DEFAULTS));
  assert.deepEqual(FIELD_VALIDATION_RULES_BY_CELL, mapFieldRecordToCells(FIELD_VALIDATION_RULES));
  assert.deepEqual(COERCED_NUMERIC_BOUNDS_BY_CELL, mapFieldRecordToCells(COERCED_NUMERIC_BOUNDS));
  assert.deepEqual([...ALLOW_NEGATIVE_INPUT_CELLS], mapFieldListToCells([...ALLOW_NEGATIVE_FIELDS]));

  assert.deepEqual(REQUIRED_CORE_CELLS, mapFieldListToCells(REQUIRED_CORE_FIELDS));
  assert.deepEqual(PROJECTION_GATE_CELLS, mapFieldListToCells(PROJECTION_GATE_FIELDS));
  assert.deepEqual(SKIP_REVEAL_CRITICAL_CELLS, mapFieldListToCells(SKIP_REVEAL_CRITICAL_FIELDS));
  assert.deepEqual(LIQUIDATION_RANK_CELLS, mapFieldListToCells(LIQUIDATION_RANK_FIELDS));
});

test("field and cell group exports round-trip without drift", () => {
  assert.equal(DEPENDENT_GROUPS.length, 5);
  assert.equal(DEPENDENT_GROUPS_BY_CELL.length, 5);
  assert.equal(PROPERTY_GROUPS.length, 5);
  assert.equal(PROPERTY_GROUPS_BY_CELL.length, 5);
  assert.equal(ASSET_OF_VALUE_GROUPS.length, 5);
  assert.equal(ASSET_OF_VALUE_GROUPS_BY_CELL.length, 5);
  assert.equal(STOCK_MARKET_CRASH_GROUPS.length, 5);
  assert.equal(STOCK_MARKET_CRASH_GROUPS_BY_CELL.length, 5);
  assert.equal(LIQUIDATION_RANK_FIELDS.length, 10);
  assert.equal(LIQUIDATION_RANK_CELLS.length, 10);

  assert.deepEqual(
    DEPENDENT_GROUPS_BY_CELL,
    DEPENDENT_GROUPS.map((group) => ({
      nameCell: FIELD_ID_TO_CELL[group.nameField],
      annualCostCell: FIELD_ID_TO_CELL[group.annualCostField],
      yearsCell: FIELD_ID_TO_CELL[group.yearsField]
    }))
  );
  assert.deepEqual(
    DEPENDENT_GROUPS,
    DEPENDENT_GROUPS_BY_CELL.map((group) => ({
      nameField: CELL_TO_FIELD_ID[group.nameCell],
      annualCostField: CELL_TO_FIELD_ID[group.annualCostCell],
      yearsField: CELL_TO_FIELD_ID[group.yearsCell]
    }))
  );

  assert.deepEqual(
    PROPERTY_GROUPS_BY_CELL,
    PROPERTY_GROUPS.map((group) => ({
      nameCell: FIELD_ID_TO_CELL[group.nameField],
      valueCell: FIELD_ID_TO_CELL[group.valueField],
      annualCostsCell: FIELD_ID_TO_CELL[group.annualCostsField],
      rentalIncomeCell: FIELD_ID_TO_CELL[group.rentalIncomeField],
      loanBalanceCell: FIELD_ID_TO_CELL[group.loanBalanceField],
      loanRateCell: FIELD_ID_TO_CELL[group.loanRateField],
      loanRepaymentCell: FIELD_ID_TO_CELL[group.loanRepaymentField],
      liquidationRankCell: FIELD_ID_TO_CELL[group.liquidationRankField]
    }))
  );
  assert.deepEqual(
    PROPERTY_GROUPS,
    PROPERTY_GROUPS_BY_CELL.map((group) => ({
      nameField: CELL_TO_FIELD_ID[group.nameCell],
      valueField: CELL_TO_FIELD_ID[group.valueCell],
      annualCostsField: CELL_TO_FIELD_ID[group.annualCostsCell],
      rentalIncomeField: CELL_TO_FIELD_ID[group.rentalIncomeCell],
      loanBalanceField: CELL_TO_FIELD_ID[group.loanBalanceCell],
      loanRateField: CELL_TO_FIELD_ID[group.loanRateCell],
      loanRepaymentField: CELL_TO_FIELD_ID[group.loanRepaymentCell],
      liquidationRankField: CELL_TO_FIELD_ID[group.liquidationRankCell]
    }))
  );
  assert.deepEqual(
    ASSET_OF_VALUE_GROUPS_BY_CELL,
    ASSET_OF_VALUE_GROUPS.map((group) => ({
      nameCell: FIELD_ID_TO_CELL[group.nameField],
      valueCell: FIELD_ID_TO_CELL[group.valueField],
      appreciationRateCell: FIELD_ID_TO_CELL[group.appreciationRateField],
      loanBalanceCell: FIELD_ID_TO_CELL[group.loanBalanceField],
      loanRateCell: FIELD_ID_TO_CELL[group.loanRateField],
      loanRepaymentCell: FIELD_ID_TO_CELL[group.loanRepaymentField],
      liquidationRankCell: FIELD_ID_TO_CELL[group.liquidationRankField]
    }))
  );
  assert.deepEqual(
    ASSET_OF_VALUE_GROUPS,
    ASSET_OF_VALUE_GROUPS_BY_CELL.map((group) => ({
      nameField: CELL_TO_FIELD_ID[group.nameCell],
      valueField: CELL_TO_FIELD_ID[group.valueCell],
      appreciationRateField: CELL_TO_FIELD_ID[group.appreciationRateCell],
      loanBalanceField: CELL_TO_FIELD_ID[group.loanBalanceCell],
      loanRateField: CELL_TO_FIELD_ID[group.loanRateCell],
      loanRepaymentField: CELL_TO_FIELD_ID[group.loanRepaymentCell],
      liquidationRankField: CELL_TO_FIELD_ID[group.liquidationRankCell]
    }))
  );

  assert.deepEqual(
    INCOME_EVENT_GROUPS_BY_CELL,
    INCOME_EVENT_GROUPS.map((group) => ({
      nameCell: FIELD_ID_TO_CELL[group.nameField],
      amountCell: FIELD_ID_TO_CELL[group.amountField],
      yearCell: FIELD_ID_TO_CELL[group.yearField]
    }))
  );
  assert.deepEqual(
    EXPENSE_EVENT_GROUPS_BY_CELL,
    EXPENSE_EVENT_GROUPS.map((group) => ({
      nameCell: FIELD_ID_TO_CELL[group.nameField],
      amountCell: FIELD_ID_TO_CELL[group.amountField],
      yearCell: FIELD_ID_TO_CELL[group.yearField]
    }))
  );
  assert.deepEqual(
    STOCK_MARKET_CRASH_GROUPS_BY_CELL,
    STOCK_MARKET_CRASH_GROUPS.map((group) => ({
      yearCell: FIELD_ID_TO_CELL[group.yearField],
      dropCell: FIELD_ID_TO_CELL[group.dropField],
      recoveryCell: FIELD_ID_TO_CELL[group.recoveryField]
    }))
  );
});

test("single-group schema exports preserve exact mappings and ordering", () => {
  assert.deepEqual(HOME_LOAN_GROUP_BY_CELL, {
    homeValueCell: FIELD_ID_TO_CELL[HOME_LOAN_GROUP.homeValueField],
    rentCell: FIELD_ID_TO_CELL[HOME_LOAN_GROUP.rentField],
    balanceCell: FIELD_ID_TO_CELL[HOME_LOAN_GROUP.balanceField],
    rateCell: FIELD_ID_TO_CELL[HOME_LOAN_GROUP.rateField],
    repaymentCell: FIELD_ID_TO_CELL[HOME_LOAN_GROUP.repaymentField]
  });
  assert.deepEqual(OTHER_WORK_GROUP_BY_CELL, {
    incomeCell: FIELD_ID_TO_CELL[OTHER_WORK_GROUP.incomeField],
    untilAgeCell: FIELD_ID_TO_CELL[OTHER_WORK_GROUP.untilAgeField]
  });
  assert.deepEqual(OTHER_LOAN_GROUP_BY_CELL, {
    balanceCell: FIELD_ID_TO_CELL[OTHER_LOAN_GROUP.balanceField],
    rateCell: FIELD_ID_TO_CELL[OTHER_LOAN_GROUP.rateField],
    repaymentCell: FIELD_ID_TO_CELL[OTHER_LOAN_GROUP.repaymentField]
  });
  assert.deepEqual(POST_RETIREMENT_INCOME_GROUP_BY_CELL, {
    amountCell: FIELD_ID_TO_CELL[POST_RETIREMENT_INCOME_GROUP.amountField],
    fromAgeCell: FIELD_ID_TO_CELL[POST_RETIREMENT_INCOME_GROUP.fromAgeField],
    toAgeCell: FIELD_ID_TO_CELL[POST_RETIREMENT_INCOME_GROUP.toAgeField]
  });

  assert.deepEqual(mapCellListToFields(REQUIRED_CORE_CELLS), REQUIRED_CORE_FIELDS);
  assert.deepEqual(mapCellListToFields(PROJECTION_GATE_CELLS), PROJECTION_GATE_FIELDS);
  assert.deepEqual(mapCellListToFields(LIQUIDATION_RANK_CELLS), LIQUIDATION_RANK_FIELDS);
});
