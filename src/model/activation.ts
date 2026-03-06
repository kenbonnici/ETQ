import {
  DEPENDENT_GROUPS_BY_CELL,
  HOME_LOAN_GROUP_BY_CELL,
  INCOME_EVENT_GROUPS_BY_CELL,
  EXPENSE_EVENT_GROUPS_BY_CELL,
  OTHER_LOAN_GROUP_BY_CELL,
  OTHER_WORK_GROUP_BY_CELL,
  POST_RETIREMENT_INCOME_GROUP_BY_CELL,
  PROPERTY_GROUPS_BY_CELL
} from "./inputSchema";
import { fieldStateToRawInputs, rawInputsToFieldState } from "./excelAdapter";
import { FieldState, InputCell, ModelUiState, RawInputs } from "./types";

export interface ActivationResult {
  activatedInputs: RawInputs;
  canCollapseDeeperDive: boolean;
  canCollapseFinerDetails: boolean;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
}

function asNumber(value: unknown): number {
  if (isBlank(value)) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function clearCells(target: RawInputs, cells: readonly InputCell[]): void {
  for (const cell of cells) target[cell] = null;
}

function applyDependencyPruning(target: RawInputs): void {
  const hasHome = asNumber(target[HOME_LOAN_GROUP_BY_CELL.homeValueCell]) > 0;
  if (hasHome) {
    target[HOME_LOAN_GROUP_BY_CELL.rentCell] = null;
  } else {
    clearCells(target, [HOME_LOAN_GROUP_BY_CELL.balanceCell, HOME_LOAN_GROUP_BY_CELL.rateCell, HOME_LOAN_GROUP_BY_CELL.repaymentCell]);
  }

  if (!(asNumber(target[HOME_LOAN_GROUP_BY_CELL.balanceCell]) > 0)) {
    clearCells(target, [HOME_LOAN_GROUP_BY_CELL.rateCell, HOME_LOAN_GROUP_BY_CELL.repaymentCell]);
  }

  for (const dep of DEPENDENT_GROUPS_BY_CELL) {
    if (isBlank(target[dep.nameCell])) {
      clearCells(target, [dep.annualCostCell, dep.yearsCell]);
    }
  }

  for (const property of PROPERTY_GROUPS_BY_CELL) {
    if (isBlank(target[property.nameCell])) {
      clearCells(target, [
        property.valueCell,
        property.annualCostsCell,
        property.rentalIncomeCell,
        property.loanBalanceCell,
        property.loanRateCell,
        property.loanRepaymentCell,
        property.liquidationRankCell
      ]);
      continue;
    }

    if (!(asNumber(target[property.loanBalanceCell]) > 0)) {
      clearCells(target, [property.loanRateCell, property.loanRepaymentCell]);
    }
  }

  if (!(asNumber(target[OTHER_WORK_GROUP_BY_CELL.incomeCell]) > 0)) {
    target[OTHER_WORK_GROUP_BY_CELL.untilAgeCell] = null;
  }

  if (!(asNumber(target[OTHER_LOAN_GROUP_BY_CELL.balanceCell]) > 0)) {
    clearCells(target, [OTHER_LOAN_GROUP_BY_CELL.rateCell, OTHER_LOAN_GROUP_BY_CELL.repaymentCell]);
  }

  for (const event of INCOME_EVENT_GROUPS_BY_CELL) {
    if (isBlank(target[event.nameCell])) {
      clearCells(target, [event.amountCell, event.yearCell]);
    }
  }

  for (const event of EXPENSE_EVENT_GROUPS_BY_CELL) {
    if (isBlank(target[event.nameCell])) {
      clearCells(target, [event.amountCell, event.yearCell]);
    }
  }

  if (!(asNumber(target[POST_RETIREMENT_INCOME_GROUP_BY_CELL.amountCell]) > 0)) {
    clearCells(target, [POST_RETIREMENT_INCOME_GROUP_BY_CELL.fromAgeCell, POST_RETIREMENT_INCOME_GROUP_BY_CELL.toAgeCell]);
  }
}

export function applySectionActivation(raw: RawInputs, uiState: ModelUiState): ActivationResult {
  void uiState;
  const activatedInputs: RawInputs = { ...raw };
  applyDependencyPruning(activatedInputs);

  return {
    activatedInputs,
    canCollapseDeeperDive: true,
    canCollapseFinerDetails: true
  };
}

export function pruneInactiveRawInputs(raw: RawInputs): RawInputs {
  const next: RawInputs = { ...raw };
  applyDependencyPruning(next);
  return next;
}

export function pruneInactiveFieldState(fields: FieldState): FieldState {
  return rawInputsToFieldState(pruneInactiveRawInputs(fieldStateToRawInputs(fields)));
}
