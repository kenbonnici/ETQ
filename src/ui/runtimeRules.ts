import type { RunModelResult } from "../model/index";
import { FieldId } from "../model/fieldRegistry";
import type { RawInputValue } from "../model/types";
import type { ValidationMessage } from "../model/inputSchema";
import type { InputDefinition } from "./inputDefinitions";
import {
  DEPENDENT_RUNTIME_GROUPS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  INCOME_EVENT_RUNTIME_GROUPS,
  OTHER_LOAN_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS
} from "./runtimeFields";

export type RuntimeValues = Partial<Record<FieldId, RawInputValue>>;

export interface RuntimeVisibilityState {
  visibleDependents: number;
  visibleProperties: number;
  visibleIncomeEvents: number;
  visibleExpenseEvents: number;
}

export interface PropertyRuntimeConfig {
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
}

export interface TimelineYearEvent {
  label: string;
  amount: number | null;
}

export interface TimelineMilestone {
  age: number;
  year: number;
  cashPct: number | null;
  netWorthPct: number | null;
  magnitude: number;
  label: string;
  notes: string[];
}

export const FIELD_STEPPER_STEPS: Readonly<Partial<Record<FieldId, number>>> = {
  [RUNTIME_FIELDS.currentAge]: 1,
  [RUNTIME_FIELDS.currentNetIncomeAnnual]: 100,
  [RUNTIME_FIELDS.cashBalance]: 100,
  [RUNTIME_FIELDS.stockMarketInvestments]: 100,
  [HOME_FIELDS.homeValue]: 1000,
  [HOME_FIELDS.mortgageBalance]: 100,
  [HOME_FIELDS.mortgageMonthlyRepayment]: 10,
  [RUNTIME_FIELDS.statutoryRetirementAge]: 1,
  [RUNTIME_FIELDS.annualPensionAtRetirement]: 100,
  [HOME_FIELDS.housingRentAnnual]: 100,
  [RUNTIME_FIELDS.annualLivingExpenses]: 100,
  [OTHER_WORK_FIELDS.income]: 100,
  [OTHER_WORK_FIELDS.untilAge]: 1,
  [OTHER_LOAN_FIELDS.balance]: 100,
  [OTHER_LOAN_FIELDS.monthlyRepayment]: 10,
  [RUNTIME_FIELDS.lifeExpectancyAge]: 1,
  [RUNTIME_FIELDS.spendingAdjustmentPre65]: 0.001,
  [RUNTIME_FIELDS.spendingAdjustment66To75]: 0.001,
  [RUNTIME_FIELDS.spendingAdjustment76Plus]: 0.001,
  [POST_RETIREMENT_INCOME_FIELDS.amount]: 100,
  [POST_RETIREMENT_INCOME_FIELDS.fromAge]: 1,
  [POST_RETIREMENT_INCOME_FIELDS.toAge]: 1,
  [RUNTIME_FIELDS.generalInflation]: 0.002,
  [RUNTIME_FIELDS.propertyAnnualAppreciation]: 0.001,
  [RUNTIME_FIELDS.cashInterestRate]: 0.001,
  [RUNTIME_FIELDS.stockMarketReturn]: 0.002,
  [RUNTIME_FIELDS.salaryAnnualGrowthRate]: 0.001,
  [RUNTIME_FIELDS.rentalIncomeAnnualIncrease]: 0.001,
  [RUNTIME_FIELDS.pensionReductionPerYearEarly]: 10,
  [RUNTIME_FIELDS.minimumCashBuffer]: 1000,
  [RUNTIME_FIELDS.stockSellingCostRate]: 0.001,
  [RUNTIME_FIELDS.propertyDisposalCostRate]: 0.001,
  [HOME_FIELDS.mortgageInterestRateAnnual]: 0.001,
  [OTHER_LOAN_FIELDS.interestRateAnnual]: 0.001
};

for (const group of DEPENDENT_RUNTIME_GROUPS) {
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.annualCostField] = 100;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.yearsField] = 1;
}

for (const group of PROPERTY_RUNTIME_GROUPS) {
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.valueField] = 1000;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.annualCostsField] = 100;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.rentalIncomeField] = 100;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.loanBalanceField] = 100;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.loanRateField] = 0.001;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.loanRepaymentField] = 10;
}

for (const group of INCOME_EVENT_RUNTIME_GROUPS) {
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.amountField] = 100;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.yearField] = 1;
}

for (const group of EXPENSE_EVENT_RUNTIME_GROUPS) {
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.amountField] = 100;
  (FIELD_STEPPER_STEPS as Partial<Record<FieldId, number>>)[group.yearField] = 1;
}

export const FIELD_STEPPER_DECIMALS: Readonly<Partial<Record<FieldId, number>>> = {
  [RUNTIME_FIELDS.currentAge]: 0,
  [RUNTIME_FIELDS.currentNetIncomeAnnual]: 0,
  [RUNTIME_FIELDS.cashBalance]: 0,
  [RUNTIME_FIELDS.stockMarketInvestments]: 0,
  [HOME_FIELDS.homeValue]: 0,
  [HOME_FIELDS.mortgageBalance]: 0,
  [HOME_FIELDS.mortgageMonthlyRepayment]: 0,
  [RUNTIME_FIELDS.statutoryRetirementAge]: 0,
  [RUNTIME_FIELDS.annualPensionAtRetirement]: 0,
  [HOME_FIELDS.housingRentAnnual]: 0,
  [RUNTIME_FIELDS.annualLivingExpenses]: 0,
  [OTHER_WORK_FIELDS.income]: 0,
  [OTHER_WORK_FIELDS.untilAge]: 0,
  [OTHER_LOAN_FIELDS.balance]: 0,
  [OTHER_LOAN_FIELDS.monthlyRepayment]: 0,
  [RUNTIME_FIELDS.lifeExpectancyAge]: 0,
  [RUNTIME_FIELDS.spendingAdjustmentPre65]: 3,
  [RUNTIME_FIELDS.spendingAdjustment66To75]: 3,
  [RUNTIME_FIELDS.spendingAdjustment76Plus]: 3,
  [POST_RETIREMENT_INCOME_FIELDS.amount]: 0,
  [POST_RETIREMENT_INCOME_FIELDS.fromAge]: 0,
  [POST_RETIREMENT_INCOME_FIELDS.toAge]: 0,
  [RUNTIME_FIELDS.generalInflation]: 3,
  [RUNTIME_FIELDS.propertyAnnualAppreciation]: 3,
  [RUNTIME_FIELDS.cashInterestRate]: 3,
  [RUNTIME_FIELDS.stockMarketReturn]: 3,
  [RUNTIME_FIELDS.salaryAnnualGrowthRate]: 3,
  [RUNTIME_FIELDS.rentalIncomeAnnualIncrease]: 3,
  [RUNTIME_FIELDS.pensionReductionPerYearEarly]: 0,
  [RUNTIME_FIELDS.minimumCashBuffer]: 0,
  [RUNTIME_FIELDS.stockSellingCostRate]: 3,
  [RUNTIME_FIELDS.propertyDisposalCostRate]: 3,
  [HOME_FIELDS.mortgageInterestRateAnnual]: 3,
  [OTHER_LOAN_FIELDS.interestRateAnnual]: 3
};

for (const group of DEPENDENT_RUNTIME_GROUPS) {
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.annualCostField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.yearsField] = 0;
}

for (const group of PROPERTY_RUNTIME_GROUPS) {
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.valueField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.annualCostsField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.rentalIncomeField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.loanBalanceField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.loanRateField] = 3;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.loanRepaymentField] = 0;
}

for (const group of INCOME_EVENT_RUNTIME_GROUPS) {
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.amountField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.yearField] = 0;
}

for (const group of EXPENSE_EVENT_RUNTIME_GROUPS) {
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.amountField] = 0;
  (FIELD_STEPPER_DECIMALS as Partial<Record<FieldId, number>>)[group.yearField] = 0;
}

export const FIELD_DISPLAY_ORDER_OVERRIDE: Readonly<Partial<Record<FieldId, number>>> = {
  [RUNTIME_FIELDS.statutoryRetirementAge]: 3.9
};

export const STRUCTURAL_RERENDER_FIELDS = new Set<FieldId>([
  HOME_FIELDS.homeValue,
  HOME_FIELDS.mortgageBalance,
  ...DEPENDENT_RUNTIME_GROUPS.map((group) => group.nameField),
  ...PROPERTY_RUNTIME_GROUPS.flatMap((group) => [group.nameField, group.valueField]),
  OTHER_WORK_FIELDS.income,
  ...PROPERTY_RUNTIME_GROUPS.map((group) => group.loanBalanceField),
  OTHER_LOAN_FIELDS.balance,
  INCOME_EVENT_RUNTIME_GROUPS[0].nameField,
  INCOME_EVENT_RUNTIME_GROUPS[1].nameField,
  INCOME_EVENT_RUNTIME_GROUPS[2].nameField,
  EXPENSE_EVENT_RUNTIME_GROUPS[0].nameField,
  EXPENSE_EVENT_RUNTIME_GROUPS[1].nameField,
  EXPENSE_EVENT_RUNTIME_GROUPS[2].nameField,
  POST_RETIREMENT_INCOME_FIELDS.amount
]);

export const PROPERTY_LIQUIDATION_FIELDS = new Set<FieldId>(
  PROPERTY_RUNTIME_GROUPS.map((group) => group.liquidationRankField)
);

export const RETIRE_CHECK_REQUIRED_FIELDS = new Set<FieldId>([
  RUNTIME_FIELDS.currentAge,
  RUNTIME_FIELDS.statutoryRetirementAge,
  RUNTIME_FIELDS.annualLivingExpenses,
  RUNTIME_FIELDS.lifeExpectancyAge
]);

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
}

export function asNumber(value: unknown): number {
  if (isBlank(value)) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function anyValue(values: RuntimeValues, fields: readonly FieldId[]): boolean {
  return fields.some((fieldId) => !isBlank(values[fieldId]));
}

function deriveVisibleGroupCount(values: RuntimeValues, groups: ReadonlyArray<readonly FieldId[]>): number {
  for (let idx = groups.length - 1; idx >= 1; idx -= 1) {
    if (anyValue(values, groups[idx])) return idx + 1;
  }
  return 1;
}

export function deriveRuntimeVisibilityState(values: RuntimeValues): RuntimeVisibilityState {
  return {
    visibleDependents: deriveVisibleGroupCount(values, DEPENDENT_RUNTIME_GROUPS.map((group) => group.fields)),
    visibleProperties: deriveVisibleGroupCount(values, PROPERTY_RUNTIME_GROUPS.map((group) => group.coreFields)),
    visibleIncomeEvents: deriveVisibleGroupCount(values, INCOME_EVENT_RUNTIME_GROUPS.map((group) => group.fields)),
    visibleExpenseEvents: deriveVisibleGroupCount(values, EXPENSE_EVENT_RUNTIME_GROUPS.map((group) => group.fields))
  };
}

export function getRuntimeFieldValue(values: RuntimeValues, fieldId: FieldId): RawInputValue {
  return values[fieldId];
}

export function getPropertyName(values: RuntimeValues, group: PropertyRuntimeConfig): string {
  return String(values[group.nameField] ?? "").trim() || group.fallbackName;
}

export function shouldRerenderOnInput(fieldId: FieldId, prevValue: unknown, nextValue: unknown): boolean {
  if (fieldId === HOME_FIELDS.homeValue) return isPositiveNumber(prevValue) !== isPositiveNumber(nextValue);
  if (fieldId === OTHER_WORK_FIELDS.income) return isNonZeroNumber(prevValue) !== isNonZeroNumber(nextValue);
  if (fieldId === POST_RETIREMENT_INCOME_FIELDS.amount) return isPositiveNumber(prevValue) !== isPositiveNumber(nextValue);
  if (PROPERTY_RUNTIME_GROUPS.some((group) => group.valueField === fieldId)) {
    return asNumber(prevValue) !== asNumber(nextValue);
  }
  if (
    fieldId === HOME_FIELDS.mortgageBalance
    || fieldId === OTHER_LOAN_FIELDS.balance
    || PROPERTY_RUNTIME_GROUPS.some((group) => group.loanBalanceField === fieldId)
    || DEPENDENT_RUNTIME_GROUPS.some((group) => group.nameField === fieldId)
    || INCOME_EVENT_RUNTIME_GROUPS.some((group) => group.nameField === fieldId)
    || EXPENSE_EVENT_RUNTIME_GROUPS.some((group) => group.nameField === fieldId)
  ) {
    return isBlank(prevValue) !== isBlank(nextValue);
  }
  if (PROPERTY_RUNTIME_GROUPS.some((group) => group.nameField === fieldId)) {
    return String(prevValue ?? "") !== String(nextValue ?? "");
  }
  return false;
}

function isNonZeroNumber(value: unknown): boolean {
  return !isBlank(value) && asNumber(value) !== 0;
}

function isPositiveNumber(value: unknown): boolean {
  return asNumber(value) > 0;
}

export function isOutOfRangeLiquidationRank(fieldId: FieldId, nextValue: unknown): boolean {
  if (!PROPERTY_LIQUIDATION_FIELDS.has(fieldId)) return false;
  if (nextValue === null || nextValue === undefined || String(nextValue).trim() === "") return false;
  const rank = Number(nextValue);
  if (!Number.isInteger(rank)) return true;
  return rank < 0 || rank > PROPERTY_RUNTIME_GROUPS.length;
}

export function isDuplicateLiquidationRank(values: RuntimeValues, fieldId: FieldId, nextValue: unknown): boolean {
  if (!PROPERTY_LIQUIDATION_FIELDS.has(fieldId)) return false;
  const rank = Number(nextValue);
  if (!Number.isInteger(rank) || rank <= 0) return false;
  for (const group of PROPERTY_RUNTIME_GROUPS) {
    if (group.liquidationRankField === fieldId) continue;
    const existing = Number(values[group.liquidationRankField]);
    if (Number.isInteger(existing) && existing > 0 && existing === rank) {
      return true;
    }
  }
  return false;
}

export function hasRetireCheckEssentialErrors(messages: ValidationMessage[]): boolean {
  return messages.some((message) => message.severity === "error" && RETIRE_CHECK_REQUIRED_FIELDS.has(message.fieldId));
}

export function fieldVisible(
  values: RuntimeValues,
  fieldId: FieldId,
  visibility: RuntimeVisibilityState
): boolean {
  if (fieldId === HOME_FIELDS.mortgageBalance) return asNumber(values[HOME_FIELDS.homeValue]) > 0;
  if (fieldId === HOME_FIELDS.mortgageInterestRateAnnual || fieldId === HOME_FIELDS.mortgageMonthlyRepayment) {
    return asNumber(values[HOME_FIELDS.homeValue]) > 0 && !isBlank(values[HOME_FIELDS.mortgageBalance]);
  }
  if (fieldId === HOME_FIELDS.housingRentAnnual) {
    return isBlank(values[HOME_FIELDS.homeValue]) || asNumber(values[HOME_FIELDS.homeValue]) === 0;
  }

  for (const group of DEPENDENT_RUNTIME_GROUPS) {
    if (fieldId === group.annualCostField || fieldId === group.yearsField) {
      return dependentSlotVisible(values, group, visibility.visibleDependents) && !isBlank(values[group.nameField]);
    }
    if (fieldId === group.nameField && group.idx > 0) {
      return dependentSlotVisible(values, group, visibility.visibleDependents);
    }
  }

  for (const group of PROPERTY_RUNTIME_GROUPS) {
    if (fieldId === group.nameField && group.idx > 0) {
      return propertySlotVisible(values, group, visibility.visibleProperties);
    }
    if (fieldId === group.valueField || fieldId === group.annualCostsField) {
      return propertySlotVisible(values, group, visibility.visibleProperties) && !isBlank(values[group.nameField]);
    }
    if (fieldId === group.rentalIncomeField) {
      return (propertySlotVisible(values, group, visibility.visibleProperties) && !isBlank(values[group.nameField]))
        || !isBlank(values[group.rentalIncomeField]);
    }
    if (fieldId === group.loanBalanceField) {
      return !isBlank(values[group.nameField]);
    }
    if (fieldId === group.loanRateField || fieldId === group.loanRepaymentField) {
      return !isBlank(values[group.nameField]) && !isBlank(values[group.loanBalanceField]);
    }
    if (fieldId === group.liquidationRankField) {
      return anyValue(values, group.coreFields);
    }
  }

  if (fieldId === OTHER_LOAN_FIELDS.interestRateAnnual || fieldId === OTHER_LOAN_FIELDS.monthlyRepayment) {
    return !isBlank(values[OTHER_LOAN_FIELDS.balance]);
  }

  if (fieldId === RUNTIME_FIELDS.propertyDisposalCostRate) {
    return asNumber(values[HOME_FIELDS.homeValue]) > 0 || PROPERTY_RUNTIME_GROUPS.some((group) => anyValue(values, group.coreFields));
  }

  if (fieldId === RUNTIME_FIELDS.propertyAnnualAppreciation) {
    return asNumber(values[HOME_FIELDS.homeValue]) > 0
      || PROPERTY_RUNTIME_GROUPS.some((group) => asNumber(values[group.valueField]) > 0);
  }

  if (fieldId === RUNTIME_FIELDS.rentalIncomeAnnualIncrease) {
    return PROPERTY_RUNTIME_GROUPS.some((group) => asNumber(values[group.rentalIncomeField]) !== 0);
  }

  for (const group of INCOME_EVENT_RUNTIME_GROUPS) {
    if (fieldId === group.amountField || fieldId === group.yearField) {
      return incomeEventSlotVisible(values, group, visibility.visibleIncomeEvents) && !isBlank(values[group.nameField]);
    }
    if (fieldId === group.nameField && group.idx > 0) {
      return incomeEventSlotVisible(values, group, visibility.visibleIncomeEvents);
    }
  }

  for (const group of EXPENSE_EVENT_RUNTIME_GROUPS) {
    if (fieldId === group.amountField || fieldId === group.yearField) {
      return expenseEventSlotVisible(values, group, visibility.visibleExpenseEvents) && !isBlank(values[group.nameField]);
    }
    if (fieldId === group.nameField && group.idx > 0) {
      return expenseEventSlotVisible(values, group, visibility.visibleExpenseEvents);
    }
  }

  if (fieldId === OTHER_WORK_FIELDS.untilAge) {
    return !isBlank(values[OTHER_WORK_FIELDS.income]) && asNumber(values[OTHER_WORK_FIELDS.income]) !== 0;
  }

  if (fieldId === POST_RETIREMENT_INCOME_FIELDS.fromAge || fieldId === POST_RETIREMENT_INCOME_FIELDS.toAge) {
    return asNumber(values[POST_RETIREMENT_INCOME_FIELDS.amount]) > 0;
  }

  return true;
}

function dependentSlotVisible(values: RuntimeValues, group: typeof DEPENDENT_RUNTIME_GROUPS[number], visibleDependents: number): boolean {
  return group.idx === 0 || visibleDependents >= group.idx + 1 || anyValue(values, group.fields);
}

function propertySlotVisible(values: RuntimeValues, group: PropertyRuntimeConfig, visibleProperties: number): boolean {
  return group.idx === 0 || visibleProperties >= group.idx + 1 || anyValue(values, group.coreFields);
}

function incomeEventSlotVisible(values: RuntimeValues, group: typeof INCOME_EVENT_RUNTIME_GROUPS[number], visibleIncomeEvents: number): boolean {
  return group.idx === 0 || visibleIncomeEvents >= group.idx + 1 || anyValue(values, group.fields);
}

function expenseEventSlotVisible(values: RuntimeValues, group: typeof EXPENSE_EVENT_RUNTIME_GROUPS[number], visibleExpenseEvents: number): boolean {
  return group.idx === 0 || visibleExpenseEvents >= group.idx + 1 || anyValue(values, group.fields);
}

export function getDynamicFieldLabel(def: InputDefinition, values: RuntimeValues): string {
  const propertyByRentalIncomeField = PROPERTY_RUNTIME_GROUPS.find((group) => group.rentalIncomeField === def.fieldId);
  if (propertyByRentalIncomeField) {
    return "Net annual rental income";
  }
  if (def.fieldId === RUNTIME_FIELDS.generalInflation) return "General inflation";
  const propertyByRankField = PROPERTY_RUNTIME_GROUPS.find((group) => group.liquidationRankField === def.fieldId);
  if (propertyByRankField) {
    return String(values[propertyByRankField.nameField] ?? "").trim() || propertyByRankField.fallbackName;
  }
  return def.label;
}

export function getDynamicGroupTail(def: InputDefinition, values: RuntimeValues): string[] {
  const tail = [...def.groupTail];
  const propertyByRentalIncomeField = PROPERTY_RUNTIME_GROUPS.find((group) => group.rentalIncomeField === def.fieldId);
  if (propertyByRentalIncomeField) {
    const name = String(values[propertyByRentalIncomeField.nameField] ?? "").trim();
    tail[0] = "Other income";
    tail[1] = "Rental income from properties";
    tail[2] = name || propertyByRentalIncomeField.fallbackName;
    return tail;
  }
  if (def.fieldId === OTHER_WORK_FIELDS.income || def.fieldId === OTHER_WORK_FIELDS.untilAge) {
    tail[0] = "Other income";
    tail[1] = "Other work income";
    return tail;
  }
  const propertyLoanGroup = PROPERTY_RUNTIME_GROUPS.find((group) => group.loanFields.includes(def.fieldId));
  if (!propertyLoanGroup) return tail;
  const name = String(values[propertyLoanGroup.nameField] ?? "").trim();
  tail[0] = "Other property loans";
  tail[1] = name ? `${name} Property` : propertyLoanGroup.fallbackName;
  return tail;
}

export function activePropertyConfigs(values: RuntimeValues): PropertyRuntimeConfig[] {
  return PROPERTY_RUNTIME_GROUPS.filter((group) => anyValue(values, group.coreFields));
}

export function parsePropertyRank(values: RuntimeValues, fieldId: FieldId): number | null {
  const raw = values[fieldId];
  if (isBlank(raw)) return null;
  const rank = Number(raw);
  if (!Number.isFinite(rank)) return null;
  return Math.trunc(rank);
}

export function defaultPropertyOrder(values: RuntimeValues, active: PropertyRuntimeConfig[]): PropertyRuntimeConfig[] {
  return [...active].sort((a, b) => (asNumber(values[a.valueField]) - asNumber(values[b.valueField])) || (a.idx - b.idx));
}

export function buildPropertyLiquidationOrder(
  values: RuntimeValues,
  active: PropertyRuntimeConfig[],
  manualOverrideActive: boolean
): PropertyRuntimeConfig[] {
  if (active.length <= 1) return [...active];
  if (!manualOverrideActive) return defaultPropertyOrder(values, active);
  const ranked = active
    .filter((group) => {
      const rank = parsePropertyRank(values, group.liquidationRankField);
      return rank !== null && rank > 0;
    })
    .sort((a, b) => {
      const rankA = parsePropertyRank(values, a.liquidationRankField) ?? 0;
      const rankB = parsePropertyRank(values, b.liquidationRankField) ?? 0;
      return (rankA - rankB) || (a.idx - b.idx);
    });
  const unranked = active.filter((group) => !ranked.includes(group));
  return [...ranked, ...unranked];
}

export function syncManualPropertyOrderForNewProperties(
  values: RuntimeValues,
  previousActivePropertyIndices: ReadonlySet<number>,
  manualOverrideActive: boolean
): Array<{ fieldId: FieldId; value: number }> {
  const active = activePropertyConfigs(values);
  if (active.length <= 1) return [];
  if (!manualOverrideActive) return [];

  const ranked = active
    .map((group) => ({ group, rank: parsePropertyRank(values, group.liquidationRankField) }))
    .filter((item) => item.rank !== null && item.rank > 0)
    .sort((a, b) => ((a.rank ?? 0) - (b.rank ?? 0)) || (a.group.idx - b.group.idx));

  let nextRank = ranked.length > 0 ? (ranked[ranked.length - 1].rank ?? 0) : 0;
  const updates: Array<{ fieldId: FieldId; value: number }> = [];
  for (const group of active) {
    if (previousActivePropertyIndices.has(group.idx)) continue;
    if (!isBlank(values[group.liquidationRankField])) continue;
    nextRank += 1;
    updates.push({ fieldId: group.liquidationRankField, value: nextRank });
  }
  return updates;
}

export function buildPropertyLiquidationAssignments(
  order: PropertyRuntimeConfig[],
  active: PropertyRuntimeConfig[]
): Array<{ fieldId: FieldId; value: number | null }> {
  const assignments: Array<{ fieldId: FieldId; value: number | null }> = [];
  const activeSet = new Set(active.map((group) => group.idx));
  for (const group of PROPERTY_RUNTIME_GROUPS) {
    if (activeSet.has(group.idx)) assignments.push({ fieldId: group.liquidationRankField, value: null });
  }
  order.forEach((group, idx) => {
    assignments.push({ fieldId: group.liquidationRankField, value: idx + 1 });
  });
  return assignments;
}

export function collectSpecificLabelsByYear(
  values: RuntimeValues,
  result: RunModelResult,
  statutoryAge: number | null,
  milestoneEventMinAbsAmount: number
): Map<number, TimelineYearEvent[]> {
  const labelsByYear = new Map<number, TimelineYearEvent[]>();
  const pushLabel = (year: number, label: string, amount: number | null = null): void => {
    if (!label || !Number.isFinite(year) || year <= 0) return;
    if (amount !== null && Number.isFinite(amount) && Math.abs(amount) < milestoneEventMinAbsAmount) return;
    const existing = labelsByYear.get(year) ?? [];
    existing.push({ label, amount });
    labelsByYear.set(year, existing);
  };
  const findYearForAge = (targetAge: number): number | null => {
    const idx = result.outputs.ages.findIndex((age: number) => Math.round(age) === Math.round(targetAge));
    if (idx < 0) return null;
    return result.outputs.years[idx] ?? null;
  };

  for (const group of INCOME_EVENT_RUNTIME_GROUPS) {
    const name = String(values[group.nameField] ?? "").trim();
    const year = Math.round(asNumber(values[group.yearField]));
    const amount = Math.abs(asNumber(values[group.amountField]));
    pushLabel(year, name, amount);
  }

  for (const group of EXPENSE_EVENT_RUNTIME_GROUPS) {
    const name = String(values[group.nameField] ?? "").trim();
    const year = Math.round(asNumber(values[group.yearField]));
    const amount = -Math.abs(asNumber(values[group.amountField]));
    pushLabel(year, name, amount);
  }

  const firstAge = result.outputs.ages[0];
  const firstYear = result.outputs.years[0];
  for (const group of DEPENDENT_RUNTIME_GROUPS) {
    const supportYears = Math.round(asNumber(values[group.yearsField]));
    if (supportYears <= 0) continue;
    const depName = String(values[group.nameField] ?? "").trim();
    const label = depName ? `${depName} support ends` : "Dependent support ends";
    const endAge = firstAge + supportYears;
    const idx = result.outputs.ages.findIndex((value: number) => Math.round(value) === Math.round(endAge));
    const year = idx >= 0 ? result.outputs.years[idx] : firstYear + supportYears;
    pushLabel(year, label, Math.abs(asNumber(values[group.annualCostField])));
  }

  if (statutoryAge !== null && asNumber(values[RUNTIME_FIELDS.annualPensionAtRetirement]) > 0) {
    const idx = result.outputs.ages.findIndex((value: number) => Math.round(value) === statutoryAge);
    if (idx >= 0) {
      pushLabel(
        result.outputs.years[idx],
        "State pension starts",
        Math.abs(asNumber(values[RUNTIME_FIELDS.annualPensionAtRetirement]))
      );
    }
  }

  const otherWorkIncomeAnnual = asNumber(values[OTHER_WORK_FIELDS.income]);
  const otherWorkUntilAge = Math.round(asNumber(values[OTHER_WORK_FIELDS.untilAge]));
  if (otherWorkIncomeAnnual !== 0 && otherWorkUntilAge > 0) {
    const endYear = findYearForAge(otherWorkUntilAge + 1);
    if (endYear !== null) pushLabel(endYear, "Other income ends", -Math.abs(otherWorkIncomeAnnual));
  }

  const postRetirementIncomeAnnual = asNumber(values[POST_RETIREMENT_INCOME_FIELDS.amount]);
  const postRetirementFromAge = Math.round(asNumber(values[POST_RETIREMENT_INCOME_FIELDS.fromAge]));
  const postRetirementToAge = Math.round(asNumber(values[POST_RETIREMENT_INCOME_FIELDS.toAge]));
  if (postRetirementIncomeAnnual > 0) {
    if (postRetirementFromAge > 0) {
      const startYear = findYearForAge(postRetirementFromAge);
      if (startYear !== null) {
        pushLabel(startYear, "Other post-retirement income starts", Math.abs(postRetirementIncomeAnnual));
      }
    }
    if (postRetirementToAge > 0 && postRetirementToAge >= postRetirementFromAge) {
      const endYear = findYearForAge(postRetirementToAge + 1);
      if (endYear !== null) {
        pushLabel(endYear, "Other post-retirement income ends", -Math.abs(postRetirementIncomeAnnual));
      }
    }
  }

  for (const hint of result.outputs.scenarioEarly.milestoneHints) {
    pushLabel(hint.year, hint.label, hint.amount ?? null);
  }

  return labelsByYear;
}

export function normalizeTimelineLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (/^stock sale executed$/i.test(trimmed)) return "Sell stocks";
  const saleMatch = /^sale of (.+?) property$/i.exec(trimmed);
  if (saleMatch) return `Sell ${saleMatch[1]} property`;
  return trimmed;
}

export function composeTimelineLabel(events: TimelineYearEvent[], formatImpact: (amount: number | null) => string): string {
  const unique = events.filter((event, idx, arr) =>
    arr.findIndex((candidate) => candidate.label === event.label && candidate.amount === event.amount) === idx
  );
  const propertySales: Array<{ name: string; amount: number | null }> = [];
  const others: TimelineYearEvent[] = [];
  let hasStockSale = false;
  let stockSaleAmount = 0;

  for (const event of unique) {
    if (/^sell stocks$/i.test(event.label)) {
      hasStockSale = true;
      stockSaleAmount += event.amount ?? 0;
      continue;
    }
    const propertyMatch = /^sell (.+) property$/i.exec(event.label);
    if (propertyMatch) {
      propertySales.push({ name: propertyMatch[1], amount: event.amount });
      continue;
    }
    others.push(event);
  }

  const parts: string[] = [];
  if (hasStockSale) {
    const amountText = formatImpact(stockSaleAmount);
    parts.push(amountText ? `Sell stocks ${amountText}` : "Sell stocks");
  }
  if (propertySales.length === 1) {
    const sale = propertySales[0];
    const amountText = formatImpact(sale.amount);
    parts.push(amountText ? `Sell ${sale.name} ${amountText}` : `Sell ${sale.name}`);
  } else if (propertySales.length > 1) {
    const grouped = propertySales
      .map((sale) => {
        const amountText = formatImpact(sale.amount);
        return amountText ? `${sale.name} ${amountText}` : sale.name;
      })
      .join(" & ");
    parts.push(`Sell ${grouped}`);
  }
  for (const other of others) {
    const amountText = formatImpact(other.amount);
    parts.push(amountText ? `${other.label} ${amountText}` : other.label);
  }
  return parts.join(", ");
}

export function buildTimelineMilestones(
  values: RuntimeValues,
  result: RunModelResult,
  statutoryAge: number | null,
  milestoneEventMinAbsAmount: number,
  formatImpact: (amount: number | null) => string
): TimelineMilestone[] {
  const ages = result.outputs.ages;
  const years = result.outputs.years;
  if (ages.length === 0 || years.length === 0) return [];
  const labelsByYear = collectSpecificLabelsByYear(values, result, statutoryAge, milestoneEventMinAbsAmount);
  const milestones: TimelineMilestone[] = [];
  for (let i = 0; i < ages.length; i += 1) {
    const year = years[i];
    const allowed = labelsByYear.get(year) ?? [];
    if (allowed.length === 0) continue;
    const normalized = allowed
      .map((event) => ({ ...event, label: normalizeTimelineLabel(event.label) }))
      .filter((event) => event.label.length > 0);
    if (normalized.length === 0) continue;
    const label = composeTimelineLabel(normalized, formatImpact);
    if (!label) continue;
    milestones.push({
      age: ages[i],
      year,
      cashPct: null,
      netWorthPct: null,
      magnitude: 0,
      label,
      notes: []
    });
  }
  milestones.sort((a, b) => a.age - b.age);
  return milestones;
}
