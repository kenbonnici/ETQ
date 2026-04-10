import {
  ASSET_OF_VALUE_GROUPS,
  DOWNSIZING_GROUP,
  DEPENDENT_GROUPS,
  HOME_LOAN_GROUP,
  INCOME_EVENT_GROUPS,
  EXPENSE_EVENT_GROUPS,
  OTHER_LOAN_GROUP,
  OTHER_WORK_GROUP,
  POST_RETIREMENT_INCOME_GROUP,
  PROPERTY_GROUPS,
  STOCK_MARKET_CRASH_GROUPS
} from "./inputSchema";
import { isDownsizingYearInProjectionWindow } from "./downsizing";
import { FieldState, FieldId, ModelUiState } from "./types";

export interface ActivationResult {
  activatedFields: FieldState;
  canCollapseMajorFutureEvents: boolean;
  canCollapseAdvancedAssumptions: boolean;
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

function clearFields(target: FieldState, fields: readonly FieldId[]): void {
  for (const fieldId of fields) target[fieldId] = null;
}

function applyDependencyPruning(target: FieldState): void {
  const hasHome = asNumber(target[HOME_LOAN_GROUP.homeValueField]) > 0;
  const hasDownsizingYear = isDownsizingYearInProjectionWindow(
    target[DOWNSIZING_GROUP.yearField],
    target["profile.currentAge"],
    target["planning.lifeExpectancyAge"]
  );
  const downsizingMode = String(target[DOWNSIZING_GROUP.modeField] ?? "").trim().toUpperCase();
  if (hasHome) {
    target[HOME_LOAN_GROUP.rentField] = null;
  } else {
    clearFields(target, [HOME_LOAN_GROUP.balanceField, HOME_LOAN_GROUP.rateField, HOME_LOAN_GROUP.repaymentField]);
  }

  if (!(asNumber(target[HOME_LOAN_GROUP.balanceField]) > 0)) {
    clearFields(target, [HOME_LOAN_GROUP.rateField, HOME_LOAN_GROUP.repaymentField]);
  }

  if (!hasDownsizingYear) {
    clearFields(target, [
      DOWNSIZING_GROUP.modeField,
      DOWNSIZING_GROUP.purchaseCostField,
      DOWNSIZING_GROUP.rentField
    ]);
  } else if (!hasHome) {
    clearFields(target, [
      DOWNSIZING_GROUP.modeField,
      DOWNSIZING_GROUP.purchaseCostField
    ]);
  } else if (downsizingMode === "BUY") {
    clearFields(target, [DOWNSIZING_GROUP.rentField]);
  } else if (downsizingMode === "RENT") {
    clearFields(target, [DOWNSIZING_GROUP.purchaseCostField]);
  } else {
    clearFields(target, [DOWNSIZING_GROUP.purchaseCostField, DOWNSIZING_GROUP.rentField]);
  }

  for (const dep of DEPENDENT_GROUPS) {
    if (isBlank(target[dep.nameField])) {
      clearFields(target, [dep.annualCostField, dep.yearsField]);
    }
  }

  for (const property of PROPERTY_GROUPS) {
    if (isBlank(target[property.nameField])) {
      clearFields(target, [
        property.valueField,
        property.annualCostsField,
        property.rentalIncomeField,
        property.loanBalanceField,
        property.loanRateField,
        property.loanRepaymentField,
        property.liquidationRankField
      ]);
      continue;
    }

    if (!(asNumber(target[property.loanBalanceField]) > 0)) {
      clearFields(target, [property.loanRateField, property.loanRepaymentField]);
    }
  }

  for (const asset of ASSET_OF_VALUE_GROUPS) {
    if (isBlank(target[asset.nameField])) {
      clearFields(target, [
        asset.valueField,
        asset.appreciationRateField,
        asset.loanBalanceField,
        asset.loanRateField,
        asset.loanRepaymentField,
        asset.liquidationRankField
      ]);
      continue;
    }

    if (!(asNumber(target[asset.loanBalanceField]) > 0)) {
      clearFields(target, [asset.loanRateField, asset.loanRepaymentField]);
    }
  }

  if (!(asNumber(target[OTHER_WORK_GROUP.incomeField]) > 0)) {
    target[OTHER_WORK_GROUP.untilAgeField] = null;
  }

  if (!(asNumber(target[OTHER_LOAN_GROUP.balanceField]) > 0)) {
    clearFields(target, [OTHER_LOAN_GROUP.rateField, OTHER_LOAN_GROUP.repaymentField]);
  }

  for (const event of INCOME_EVENT_GROUPS) {
    if (isBlank(target[event.nameField])) {
      clearFields(target, [event.amountField, event.yearField]);
    }
  }

  for (const event of EXPENSE_EVENT_GROUPS) {
    if (isBlank(target[event.nameField])) {
      clearFields(target, [event.amountField, event.yearField]);
    }
  }

  for (const crash of STOCK_MARKET_CRASH_GROUPS) {
    if (isBlank(target[crash.yearField])) {
      clearFields(target, [crash.dropField, crash.recoveryField]);
    }
  }

  if (!(asNumber(target[POST_RETIREMENT_INCOME_GROUP.amountField]) > 0)) {
    clearFields(target, [POST_RETIREMENT_INCOME_GROUP.fromAgeField, POST_RETIREMENT_INCOME_GROUP.toAgeField]);
  }
}

export function applySectionActivation(fields: FieldState, uiState: ModelUiState): ActivationResult {
  void uiState;
  const activatedFields: FieldState = { ...fields };
  applyDependencyPruning(activatedFields);

  return {
    activatedFields,
    canCollapseMajorFutureEvents: true,
    canCollapseAdvancedAssumptions: true
  };
}

export function pruneInactiveFieldState(fields: FieldState): FieldState {
  const next: FieldState = { ...fields };
  applyDependencyPruning(next);
  return next;
}
