import {
  INPUT_DEFINITION_BY_CELL,
  RawValidationMessage,
  ValidationMessage,
  DEPENDENT_GROUPS_BY_CELL,
  EXPENSE_EVENT_GROUPS_BY_CELL,
  FIELD_VALIDATION_RULES_BY_CELL,
  HOME_LOAN_GROUP_BY_CELL,
  INCOME_EVENT_GROUPS_BY_CELL,
  LIQUIDATION_RANK_CELLS,
  OTHER_LOAN_GROUP_BY_CELL,
  OTHER_WORK_GROUP_BY_CELL,
  PROJECTION_GATE_CELLS,
  POST_RETIREMENT_INCOME_GROUP_BY_CELL,
  PROPERTY_GROUPS_BY_CELL
} from "./inputSchema";
import { fieldStateToRawInputs } from "./excelAdapter";
import { FieldState, InputCell, RawInputs } from "./types";

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
}

function asNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getCellLabel(cell: InputCell): string {
  return INPUT_DEFINITION_BY_CELL[cell]?.label ?? cell;
}

function pushMessage(
  messages: RawValidationMessage[],
  cell: InputCell,
  severity: "error" | "warning",
  message: string,
  blocksProjection = false
): void {
  messages.push({ cell, severity, message, blocksProjection });
}

function projectionEndYear(raw: RawInputs): number | null {
  const ageNow = asNumber(raw.B4);
  const endAge = asNumber(raw.B134);
  if (ageNow === null || endAge === null || endAge <= ageNow) return null;
  return new Date().getFullYear() + Math.round(endAge - ageNow);
}

function nextProjectionYear(): number {
  return new Date().getFullYear() + 1;
}

function monthlyInterestDue(balance: number, annualRate: number): number {
  return annualRate > 0 ? balance * (annualRate / 12) : 0;
}

export function validateRawInputs(raw: RawInputs): RawValidationMessage[] {
  const messages: RawValidationMessage[] = [];
  const projectionGateCells = new Set<InputCell>(PROJECTION_GATE_CELLS);

  for (const [cell, rule] of Object.entries(FIELD_VALIDATION_RULES_BY_CELL) as Array<[InputCell, NonNullable<typeof FIELD_VALIDATION_RULES_BY_CELL[InputCell]>]>) {
    const def = INPUT_DEFINITION_BY_CELL[cell];
    const value = raw[cell];
    const numeric = asNumber(value);

    if (rule.required && isBlank(value)) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} is required.`, projectionGateCells.has(cell));
      continue;
    }
    if (numeric === null) continue;

    if (rule.integer && !Number.isInteger(numeric)) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} must be a whole number.`, projectionGateCells.has(cell));
    }
    if (rule.nonNegative && numeric < 0) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} cannot be negative.`, projectionGateCells.has(cell));
    }
    if (rule.positive && numeric <= 0) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} must be greater than 0.`, projectionGateCells.has(cell));
    }

    if (rule.clampBounds?.min !== undefined && numeric < rule.clampBounds.min) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} must be at least ${def.type === "percent" ? `${(rule.clampBounds.min * 100).toFixed(0)}%` : rule.clampBounds.min}.`, projectionGateCells.has(cell));
    }
    if (rule.clampBounds?.max !== undefined && numeric > rule.clampBounds.max) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} must be at most ${def.type === "percent" ? `${(rule.clampBounds.max * 100).toFixed(0)}%` : rule.clampBounds.max}.`, projectionGateCells.has(cell));
    }

    if (def.type === "percent" && numeric <= -1) {
      pushMessage(messages, cell, "error", `${getCellLabel(cell)} cannot be less than or equal to -100%.`);
    }

    if (rule.warningBounds?.min !== undefined && numeric < rule.warningBounds.min) {
      pushMessage(messages, cell, "warning", `${getCellLabel(cell)} is unusually low for planning assumptions.`);
    }
    if (rule.warningBounds?.max !== undefined && numeric > rule.warningBounds.max) {
      pushMessage(messages, cell, "warning", `${getCellLabel(cell)} is unusually high for planning assumptions.`);
    }
  }

  const ageNow = asNumber(raw.B4);
  const lifeExpectancy = asNumber(raw.B134);
  const statutoryAge = asNumber(raw.B19);
  if (ageNow !== null && statutoryAge !== null && ageNow >= statutoryAge) {
    pushMessage(messages, "B4", "error", "Your age must be less than statutory retirement age.", true);
    pushMessage(messages, "B19", "error", "Statutory retirement age must be greater than your current age.", true);
  }

  if (ageNow !== null && lifeExpectancy !== null && lifeExpectancy <= ageNow) {
    pushMessage(messages, "B134", "error", "Plan to live until age must be greater than current age.", true);
  }

  if (lifeExpectancy !== null && lifeExpectancy > 100) {
    pushMessage(messages, "B134", "warning", "Planning past age 100 is allowed, but double-check that horizon.");
  }

  if (asNumber(raw.B12) !== null && (asNumber(raw.B12) ?? 0) > 0 && (asNumber(raw.B23) ?? 0) > 0) {
    pushMessage(messages, "B23", "error", "Housing rent must be blank when a home value is provided.");
  }

  const homeLoanBalance = asNumber(raw[HOME_LOAN_GROUP_BY_CELL.balanceCell]) ?? 0;
  if (homeLoanBalance > 0) {
    if ((asNumber(raw[HOME_LOAN_GROUP_BY_CELL.repaymentCell]) ?? 0) <= 0) {
      pushMessage(messages, HOME_LOAN_GROUP_BY_CELL.repaymentCell, "error", "Monthly repayment is required when mortgage balance is above 0.");
    }
    if (isBlank(raw[HOME_LOAN_GROUP_BY_CELL.rateCell])) {
      pushMessage(messages, HOME_LOAN_GROUP_BY_CELL.rateCell, "error", "Interest rate is required when mortgage balance is above 0.");
    }
    const homeValue = asNumber(raw[HOME_LOAN_GROUP_BY_CELL.homeValueCell]) ?? 0;
    if (homeValue > 0 && homeLoanBalance > homeValue) {
      pushMessage(messages, HOME_LOAN_GROUP_BY_CELL.balanceCell, "warning", "Mortgage balance exceeds home value.");
    }
    const interestRate = asNumber(raw[HOME_LOAN_GROUP_BY_CELL.rateCell]) ?? 0;
    const monthlyRepayment = asNumber(raw[HOME_LOAN_GROUP_BY_CELL.repaymentCell]) ?? 0;
    if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(homeLoanBalance, interestRate)) {
      pushMessage(messages, HOME_LOAN_GROUP_BY_CELL.repaymentCell, "warning", "Monthly repayment does not cover current mortgage interest.");
    }
  }

  for (const dep of DEPENDENT_GROUPS_BY_CELL) {
    const hasAny = !isBlank(raw[dep.nameCell]) || !isBlank(raw[dep.annualCostCell]) || !isBlank(raw[dep.yearsCell]);
    if (!hasAny) continue;

    if (isBlank(raw[dep.nameCell])) {
      pushMessage(messages, dep.nameCell, "error", "Dependent name is required when support details are entered.");
    }
    if ((asNumber(raw[dep.annualCostCell]) ?? 0) <= 0) {
      pushMessage(messages, dep.annualCostCell, "error", "Annual cost must be greater than 0 for an active dependent.");
    }
    const years = asNumber(raw[dep.yearsCell]);
    if (years === null || !Number.isInteger(years) || years <= 0) {
      pushMessage(messages, dep.yearsCell, "error", "Years to support must be a whole number greater than 0.");
    } else if (ageNow !== null && lifeExpectancy !== null && years > lifeExpectancy - ageNow) {
      pushMessage(messages, dep.yearsCell, "error", "Years to support cannot extend beyond the projection horizon.");
    }
  }

  for (const property of PROPERTY_GROUPS_BY_CELL) {
    const hasAny = !isBlank(raw[property.nameCell])
      || !isBlank(raw[property.valueCell])
      || !isBlank(raw[property.annualCostsCell])
      || !isBlank(raw[property.rentalIncomeCell])
      || !isBlank(raw[property.loanBalanceCell])
      || !isBlank(raw[property.loanRateCell])
      || !isBlank(raw[property.loanRepaymentCell]);
    if (!hasAny) continue;

    if (isBlank(raw[property.nameCell])) {
      pushMessage(messages, property.nameCell, "error", "Property name is required when property details are entered.");
      continue;
    }

    if ((asNumber(raw[property.valueCell]) ?? 0) <= 0) {
      pushMessage(messages, property.valueCell, "error", "Market value must be greater than 0 for an active property.");
    }

    const loanBalance = asNumber(raw[property.loanBalanceCell]) ?? 0;
    if (loanBalance > 0) {
      if ((asNumber(raw[property.loanRepaymentCell]) ?? 0) <= 0) {
        pushMessage(messages, property.loanRepaymentCell, "error", "Monthly repayment is required when property loan balance is above 0.");
      }
      if (isBlank(raw[property.loanRateCell])) {
        pushMessage(messages, property.loanRateCell, "error", "Interest rate is required when property loan balance is above 0.");
      }
      const propertyValue = asNumber(raw[property.valueCell]) ?? 0;
      if (propertyValue > 0 && loanBalance > propertyValue) {
        pushMessage(messages, property.loanBalanceCell, "warning", "Property loan balance exceeds property value.");
      }
      const interestRate = asNumber(raw[property.loanRateCell]) ?? 0;
      const monthlyRepayment = asNumber(raw[property.loanRepaymentCell]) ?? 0;
      if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(loanBalance, interestRate)) {
        pushMessage(messages, property.loanRepaymentCell, "warning", "Monthly repayment does not cover current property-loan interest.");
      }
    }
  }

  if ((asNumber(raw[OTHER_WORK_GROUP_BY_CELL.incomeCell]) ?? 0) > 0) {
    const untilAge = asNumber(raw[OTHER_WORK_GROUP_BY_CELL.untilAgeCell]);
    if (untilAge === null || !Number.isInteger(untilAge)) {
      pushMessage(messages, OTHER_WORK_GROUP_BY_CELL.untilAgeCell, "error", "Continue other work until age is required when other work income is entered.");
    } else {
      if (ageNow !== null && untilAge <= ageNow) {
        pushMessage(messages, OTHER_WORK_GROUP_BY_CELL.untilAgeCell, "error", "Other work end age must be greater than current age.");
      }
      if (lifeExpectancy !== null && untilAge > lifeExpectancy) {
        pushMessage(messages, OTHER_WORK_GROUP_BY_CELL.untilAgeCell, "error", "Other work end age cannot exceed the projection horizon.");
      }
    }
  }

  if ((asNumber(raw[OTHER_LOAN_GROUP_BY_CELL.balanceCell]) ?? 0) > 0) {
    if ((asNumber(raw[OTHER_LOAN_GROUP_BY_CELL.repaymentCell]) ?? 0) <= 0) {
      pushMessage(messages, OTHER_LOAN_GROUP_BY_CELL.repaymentCell, "error", "Monthly repayment is required when other loan balance is above 0.");
    }
    if (isBlank(raw[OTHER_LOAN_GROUP_BY_CELL.rateCell])) {
      pushMessage(messages, OTHER_LOAN_GROUP_BY_CELL.rateCell, "error", "Interest rate is required when other loan balance is above 0.");
    }
    const interestRate = asNumber(raw[OTHER_LOAN_GROUP_BY_CELL.rateCell]) ?? 0;
    const monthlyRepayment = asNumber(raw[OTHER_LOAN_GROUP_BY_CELL.repaymentCell]) ?? 0;
    const loanBalance = asNumber(raw[OTHER_LOAN_GROUP_BY_CELL.balanceCell]) ?? 0;
    if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(loanBalance, interestRate)) {
      pushMessage(messages, OTHER_LOAN_GROUP_BY_CELL.repaymentCell, "warning", "Monthly repayment does not cover current other-loan interest.");
    }
  }

  const minYear = nextProjectionYear();
  const maxYear = projectionEndYear(raw);
  for (const event of [...INCOME_EVENT_GROUPS_BY_CELL, ...EXPENSE_EVENT_GROUPS_BY_CELL]) {
    const hasAny = !isBlank(raw[event.nameCell]) || !isBlank(raw[event.amountCell]) || !isBlank(raw[event.yearCell]);
    if (!hasAny) continue;

    if (isBlank(raw[event.nameCell])) {
      pushMessage(messages, event.nameCell, "error", "Event name is required when event amount or year is entered.");
    }
    if ((asNumber(raw[event.amountCell]) ?? 0) <= 0) {
      pushMessage(messages, event.amountCell, "error", "Event amount must be greater than 0.");
    }
    const year = asNumber(raw[event.yearCell]);
    if (year === null || !Number.isInteger(year)) {
      pushMessage(messages, event.yearCell, "error", "Event year must be a whole calendar year.");
    } else {
      if (year < minYear) {
        pushMessage(messages, event.yearCell, "error", `Event year must be ${minYear} or later.`);
      }
      if (maxYear !== null && year > maxYear) {
        pushMessage(messages, event.yearCell, "error", "Event year cannot exceed the projection horizon.");
      }
    }
  }

  if ((asNumber(raw[POST_RETIREMENT_INCOME_GROUP_BY_CELL.amountCell]) ?? 0) > 0) {
    const fromAge = asNumber(raw[POST_RETIREMENT_INCOME_GROUP_BY_CELL.fromAgeCell]);
    const toAge = asNumber(raw[POST_RETIREMENT_INCOME_GROUP_BY_CELL.toAgeCell]);
    if (fromAge === null || !Number.isInteger(fromAge)) {
      pushMessage(messages, POST_RETIREMENT_INCOME_GROUP_BY_CELL.fromAgeCell, "error", "From age is required when other post-retirement income is entered.");
    }
    if (toAge === null || !Number.isInteger(toAge)) {
      pushMessage(messages, POST_RETIREMENT_INCOME_GROUP_BY_CELL.toAgeCell, "error", "To age is required when other post-retirement income is entered.");
    }
    if (fromAge !== null && toAge !== null) {
      if (fromAge > toAge) {
        pushMessage(messages, POST_RETIREMENT_INCOME_GROUP_BY_CELL.toAgeCell, "error", "To age must be greater than or equal to from age.");
      }
      if (ageNow !== null && fromAge <= ageNow) {
        pushMessage(messages, POST_RETIREMENT_INCOME_GROUP_BY_CELL.fromAgeCell, "error", "From age must be greater than current age.");
      }
      if (lifeExpectancy !== null && toAge > lifeExpectancy) {
        pushMessage(messages, POST_RETIREMENT_INCOME_GROUP_BY_CELL.toAgeCell, "error", "To age cannot exceed the projection horizon.");
      }
    }
  }

  const spendAdjustments = [
    { cell: "B137" as const, label: getCellLabel("B137") },
    { cell: "B138" as const, label: getCellLabel("B138") },
    { cell: "B139" as const, label: getCellLabel("B139") }
  ];
  for (const adjustment of spendAdjustments) {
    const value = asNumber(raw[adjustment.cell]);
    if (value !== null && value <= -1) {
      pushMessage(messages, adjustment.cell, "error", `${adjustment.label} cannot reduce living expenses below zero.`);
    }
  }

  const liquidationRanks = LIQUIDATION_RANK_CELLS
    .map((cell) => ({ cell, value: asNumber(raw[cell]) }))
    .filter((entry) => entry.value !== null && Number.isInteger(entry.value) && (entry.value as number) > 0) as Array<{ cell: InputCell; value: number }>;
  for (let i = 0; i < liquidationRanks.length; i += 1) {
    for (let j = i + 1; j < liquidationRanks.length; j += 1) {
      if (liquidationRanks[i].value === liquidationRanks[j].value) {
        pushMessage(messages, liquidationRanks[j].cell, "error", "Property liquidation ranks 1-3 must be unique. Use 0 for never sell.");
      }
    }
  }

  const startingLiquidAssets = (asNumber(raw.B8) ?? 0) + (asNumber(raw.B10) ?? 0);
  const cashBuffer = asNumber(raw.B159) ?? 0;
  if (cashBuffer > 0 && startingLiquidAssets > 0 && cashBuffer > startingLiquidAssets) {
    pushMessage(messages, "B159", "warning", "Cash buffer exceeds starting cash plus stock balances.");
  }

  const annualPension = asNumber(raw.B21) ?? 0;
  const pensionReduction = asNumber(raw.B157) ?? 0;
  if (annualPension > 0 && pensionReduction > 0 && ageNow !== null && statutoryAge !== null) {
    const maxYearsEarly = Math.max(0, statutoryAge - ageNow);
    if (pensionReduction * maxYearsEarly > annualPension) {
      pushMessage(messages, "B157", "warning", "Maximum early-retirement reduction would fully eliminate the pension.");
    }
  }

  return messages;
}

export function validateFieldState(fields: FieldState): ValidationMessage[] {
  const raw = fieldStateToRawInputs(fields);
  return validateRawInputs(raw).map((message) => ({
    fieldId: INPUT_DEFINITION_BY_CELL[message.cell].fieldId,
    severity: message.severity,
    message: message.message,
    blocksProjection: message.blocksProjection
  }));
}
