import {
  ASSET_OF_VALUE_GROUPS,
  DOWNSIZING_GROUP,
  INPUT_DEFINITION_BY_FIELD_ID,
  ValidationMessage,
  DEPENDENT_GROUPS,
  EXPENSE_EVENT_GROUPS,
  FIELD_VALIDATION_RULES,
  HOME_LOAN_GROUP,
  INCOME_EVENT_GROUPS,
  LIQUIDATION_RANK_FIELDS,
  OTHER_LOAN_GROUP,
  OTHER_WORK_GROUP,
  PARTNER_GROUP,
  PROJECTION_GATE_FIELDS,
  POST_RETIREMENT_INCOME_GROUP,
  PROPERTY_GROUPS,
  STOCK_MARKET_CRASH_GROUPS,
  getFieldLabel
} from "./inputSchema";
import {
  ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS,
  getProjectionYearWindow,
  PlannedSellYearFieldId,
  PROPERTY_PLANNED_SELL_YEAR_FIELDS,
  resolveValidPlannedSellYear
} from "./plannedSales";
import {
  estimateDownsizing,
  getDownsizingProjectionWindow,
  isDownsizingYearInProjectionWindow,
  normalizeDownsizingMode
} from "./downsizing";
import { FieldId, FieldState } from "./types";

interface PlannedSellYearFieldValues {
  properties: unknown[];
  assetsOfValue: unknown[];
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
}

function asNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function isYes(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "YES";
}

function pushMessage(
  messages: ValidationMessage[],
  fieldId: FieldId,
  severity: "error" | "warning",
  message: string,
  blocksProjection = false
): void {
  messages.push({ fieldId, severity, message, blocksProjection });
}

function projectionEndYear(fields: FieldState): number | null {
  const ageNow = asNumber(fields["profile.currentAge"]);
  const endAge = asNumber(fields["planning.lifeExpectancyAge"]);
  if (ageNow === null || endAge === null || endAge < ageNow) return null;
  return new Date().getFullYear() + Math.max(0, Math.round(endAge - ageNow - 1));
}

function nextProjectionYear(): number {
  return new Date().getFullYear();
}

function monthlyInterestDue(balance: number, annualRate: number): number {
  return annualRate > 0 ? balance * (annualRate / 12) : 0;
}

export function validateFieldState(
  fields: FieldState,
  plannedSellYearValues: PlannedSellYearFieldValues = { properties: [], assetsOfValue: [] }
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const projectionGateFields = new Set<FieldId>(PROJECTION_GATE_FIELDS);

  for (const [fieldId, rule] of Object.entries(FIELD_VALIDATION_RULES) as Array<[FieldId, NonNullable<typeof FIELD_VALIDATION_RULES[FieldId]>]>) {
    const def = INPUT_DEFINITION_BY_FIELD_ID[fieldId];
    const value = fields[fieldId];
    const numeric = asNumber(value);

    if (rule.required && isBlank(value)) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} is required.`, projectionGateFields.has(fieldId));
      continue;
    }
    if (numeric === null) continue;

    if (rule.integer && !Number.isInteger(numeric)) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} must be a whole number.`, projectionGateFields.has(fieldId));
    }
    if (rule.nonNegative && numeric < 0) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} cannot be negative.`, projectionGateFields.has(fieldId));
    }
    if (rule.positive && numeric <= 0) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} must be greater than 0.`, projectionGateFields.has(fieldId));
    }

    if (rule.clampBounds?.min !== undefined && numeric < rule.clampBounds.min) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} must be at least ${def.type === "percent" ? `${(rule.clampBounds.min * 100).toFixed(0)}%` : rule.clampBounds.min}.`, projectionGateFields.has(fieldId));
    }
    if (rule.clampBounds?.max !== undefined && numeric > rule.clampBounds.max) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} must be at most ${def.type === "percent" ? `${(rule.clampBounds.max * 100).toFixed(0)}%` : rule.clampBounds.max}.`, projectionGateFields.has(fieldId));
    }

    if (def.type === "percent" && numeric <= -1) {
      pushMessage(messages, fieldId, "error", `${getFieldLabel(fieldId)} cannot be less than or equal to -100%.`);
    }

    if (rule.warningBounds?.min !== undefined && numeric < rule.warningBounds.min) {
      pushMessage(messages, fieldId, "warning", `${getFieldLabel(fieldId)} is unusually low for planning assumptions.`);
    }
    if (rule.warningBounds?.max !== undefined && numeric > rule.warningBounds.max) {
      pushMessage(messages, fieldId, "warning", `${getFieldLabel(fieldId)} is unusually high for planning assumptions.`);
    }
  }

  const ageNow = asNumber(fields["profile.currentAge"]);
  const lifeExpectancy = asNumber(fields["planning.lifeExpectancyAge"]);
  const statutoryAge = asNumber(fields["retirement.statutoryAge"]);
  const includePartner = isYes(fields[PARTNER_GROUP.includeField]);
  const partnerAgeNow = asNumber(fields[PARTNER_GROUP.ageField]);
  if (ageNow !== null && statutoryAge !== null && ageNow >= statutoryAge) {
    pushMessage(messages, "profile.currentAge", "error", "Your age must be less than statutory retirement age.", true);
    pushMessage(messages, "retirement.statutoryAge", "error", "Statutory retirement age must be greater than your current age.", true);
  }

  if (includePartner && isBlank(fields[PARTNER_GROUP.ageField])) {
    pushMessage(messages, PARTNER_GROUP.ageField, "error", "Partner age is required when partner is included.", true);
  }
  if (includePartner && partnerAgeNow !== null && statutoryAge !== null && partnerAgeNow >= statutoryAge) {
    pushMessage(messages, PARTNER_GROUP.ageField, "error", "Partner age must be less than statutory retirement age.", true);
  }

  if (ageNow !== null && lifeExpectancy !== null && lifeExpectancy < ageNow) {
    pushMessage(messages, "planning.lifeExpectancyAge", "error", "Plan to live until age must be current age or later.", true);
  }
  if (includePartner && partnerAgeNow !== null && lifeExpectancy !== null && lifeExpectancy < partnerAgeNow) {
    pushMessage(messages, PARTNER_GROUP.ageField, "error", "Partner age must be within the projection horizon.", true);
  }

  if (statutoryAge !== null && lifeExpectancy !== null && statutoryAge > lifeExpectancy) {
    pushMessage(messages, "retirement.statutoryAge", "error", "State pension start age cannot exceed plan to live until age.", true);
  }

  const spendingAge1 = asNumber(fields["spending.adjustments.firstBracket.endAge"]);
  const spendingAge2 = asNumber(fields["spending.adjustments.secondBracket.endAge"]);
  if (spendingAge1 !== null) {
    if (ageNow !== null && spendingAge1 < ageNow) {
      pushMessage(messages, "spending.adjustments.firstBracket.endAge", "error", "First bracket end age must be current age or later.");
    }
    if (lifeExpectancy !== null && spendingAge1 >= lifeExpectancy) {
      pushMessage(messages, "spending.adjustments.firstBracket.endAge", "error", "First bracket end age must leave room for the next bracket within the projection horizon.");
    }
  }
  if (spendingAge2 !== null) {
    if (lifeExpectancy !== null && spendingAge2 > lifeExpectancy) {
      pushMessage(messages, "spending.adjustments.secondBracket.endAge", "error", "Second bracket end age cannot exceed the projection horizon.");
    }
    if (spendingAge1 !== null && spendingAge2 <= spendingAge1) {
      pushMessage(messages, "spending.adjustments.secondBracket.endAge", "error", "Second bracket end age must be greater than first bracket end age.");
    }
  }

  if (lifeExpectancy !== null && lifeExpectancy > 100) {
    pushMessage(messages, "planning.lifeExpectancyAge", "warning", "Planning past age 100 is allowed, but double-check that horizon.");
  }

  if ((asNumber(fields["housing.01Residence.marketValue"]) ?? 0) > 0 && (asNumber(fields["housing.rentAnnual"]) ?? 0) > 0) {
    pushMessage(messages, "housing.rentAnnual", "error", `${getFieldLabel("housing.rentAnnual")} must be blank when a home value is provided.`);
  }

  const downsizingYear = asNumber(fields[DOWNSIZING_GROUP.yearField]);
  const downsizingWindow = getDownsizingProjectionWindow(ageNow, lifeExpectancy);
  const downsizingYearValid = isDownsizingYearInProjectionWindow(
    fields[DOWNSIZING_GROUP.yearField],
    ageNow,
    lifeExpectancy
  );
  if (downsizingYear !== null && Number.isInteger(downsizingYear)) {
    if (downsizingYear < downsizingWindow.minYear) {
      pushMessage(
        messages,
        DOWNSIZING_GROUP.yearField,
        "error",
        `Downsizing year must be ${downsizingWindow.minYear} or later.`
      );
    }
    if (downsizingWindow.maxYear !== null && downsizingYear > downsizingWindow.maxYear) {
      pushMessage(messages, DOWNSIZING_GROUP.yearField, "error", "Downsizing year cannot exceed the projection horizon.");
    }
  }

  if (downsizingYearValid) {
    const hasHome = (asNumber(fields[HOME_LOAN_GROUP.homeValueField]) ?? 0) > 0;
    const downsizingMode = normalizeDownsizingMode(fields[DOWNSIZING_GROUP.modeField]);
    const purchaseCost = asNumber(fields[DOWNSIZING_GROUP.purchaseCostField]) ?? 0;
    const newRent = asNumber(fields[DOWNSIZING_GROUP.rentField]) ?? 0;
    const currentHomeValue = asNumber(fields[HOME_LOAN_GROUP.homeValueField]) ?? 0;
    const currentAnnualRent = asNumber(fields[HOME_LOAN_GROUP.rentField]) ?? 0;
    const downsizingEstimate = estimateDownsizing({
      downsizingYear,
      homeValue: fields[HOME_LOAN_GROUP.homeValueField],
      homeLoanBalance: fields[HOME_LOAN_GROUP.balanceField],
      homeLoanRate: fields[HOME_LOAN_GROUP.rateField],
      homeLoanRepaymentMonthly: fields[HOME_LOAN_GROUP.repaymentField],
      propertyAppreciation: fields["assumptions.propertyAppreciationRateAnnual"],
      propertyDisposalCosts: fields["liquidation.propertyDisposalCostRate"],
      newHomePurchaseCostToday: fields[DOWNSIZING_GROUP.purchaseCostField]
    });

    if (hasHome) {
      if (downsizingMode === null) {
        pushMessage(messages, DOWNSIZING_GROUP.modeField, "error", "Choose whether the downsized home will be bought or rented.");
      }
      if (downsizingMode === "BUY" && purchaseCost <= 0) {
        pushMessage(messages, DOWNSIZING_GROUP.purchaseCostField, "error", "New home purchase cost is required when downsizing to buy.");
      }
      if (downsizingMode === "RENT" && newRent <= 0) {
        pushMessage(messages, DOWNSIZING_GROUP.rentField, "error", "New home monthly rent is required when downsizing to rent.");
      }
      if (downsizingMode === "BUY" && purchaseCost > 0 && currentHomeValue > 0 && purchaseCost >= currentHomeValue) {
        pushMessage(messages, DOWNSIZING_GROUP.purchaseCostField, "warning", "Replacement purchase cost is not lower than the current home value.");
      }
      if (downsizingEstimate && downsizingEstimate.netEquityReleased <= 0) {
        pushMessage(messages, DOWNSIZING_GROUP.yearField, "warning", "Estimated net cash released after sale costs and mortgage payoff is zero or negative.");
      }
    } else if (newRent <= 0) {
      pushMessage(messages, DOWNSIZING_GROUP.rentField, "error", "New home monthly rent is required when downsizing from renting.");
    } else if (currentAnnualRent > 0 && newRent >= currentAnnualRent) {
      pushMessage(messages, DOWNSIZING_GROUP.rentField, "warning", "New home rent is not lower than the current rent.");
    }
  }

  const homeLoanBalance = asNumber(fields[HOME_LOAN_GROUP.balanceField]) ?? 0;
  if (homeLoanBalance > 0) {
    if ((asNumber(fields[HOME_LOAN_GROUP.repaymentField]) ?? 0) <= 0) {
      pushMessage(messages, HOME_LOAN_GROUP.repaymentField, "error", "Monthly repayment is required when mortgage balance is above 0.");
    }
    if (isBlank(fields[HOME_LOAN_GROUP.rateField])) {
      pushMessage(messages, HOME_LOAN_GROUP.rateField, "error", "Interest rate is required when mortgage balance is above 0.");
    }
    const homeValue = asNumber(fields[HOME_LOAN_GROUP.homeValueField]) ?? 0;
    if (homeValue > 0 && homeLoanBalance > homeValue) {
      pushMessage(messages, HOME_LOAN_GROUP.balanceField, "warning", "Mortgage balance exceeds home value.");
    }
    const interestRate = asNumber(fields[HOME_LOAN_GROUP.rateField]) ?? 0;
    const monthlyRepayment = asNumber(fields[HOME_LOAN_GROUP.repaymentField]) ?? 0;
    if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(homeLoanBalance, interestRate)) {
      pushMessage(messages, HOME_LOAN_GROUP.repaymentField, "warning", "Monthly repayment does not cover current mortgage interest.");
    }
  }

  for (const dep of DEPENDENT_GROUPS) {
    const hasAny = !isBlank(fields[dep.nameField]) || !isBlank(fields[dep.annualCostField]) || !isBlank(fields[dep.yearsField]);
    if (!hasAny) continue;

    if (isBlank(fields[dep.nameField])) {
      pushMessage(messages, dep.nameField, "error", "Dependent name is required when support details are entered.");
    }
    if ((asNumber(fields[dep.annualCostField]) ?? 0) <= 0) {
      pushMessage(messages, dep.annualCostField, "error", "Annual cost must be greater than 0 for an active dependent.");
    }
    const years = asNumber(fields[dep.yearsField]);
    if (years === null || !Number.isInteger(years) || years <= 0) {
      pushMessage(messages, dep.yearsField, "error", "Years to support must be a whole number greater than 0.");
    } else if (ageNow !== null && lifeExpectancy !== null && years > Math.max(1, lifeExpectancy - ageNow)) {
      pushMessage(messages, dep.yearsField, "error", "Years to support cannot extend beyond the projection horizon.");
    }
  }

  for (const [index, property] of PROPERTY_GROUPS.entries()) {
    const hasAny = !isBlank(fields[property.nameField])
      || !isBlank(fields[property.valueField])
      || !isBlank(fields[property.annualCostsField])
      || !isBlank(fields[property.rentalIncomeField])
      || !isBlank(fields[property.loanBalanceField])
      || !isBlank(fields[property.loanRateField])
      || !isBlank(fields[property.loanRepaymentField])
      || !isBlank(plannedSellYearValues.properties[index]);
    if (!hasAny) continue;

    if (isBlank(fields[property.nameField])) {
      pushMessage(messages, property.nameField, "error", "Property name is required when property details are entered.");
      continue;
    }

    if ((asNumber(fields[property.valueField]) ?? 0) <= 0) {
      pushMessage(messages, property.valueField, "error", "Market value must be greater than 0 for an active property.");
    }

    const loanBalance = asNumber(fields[property.loanBalanceField]) ?? 0;
    if (loanBalance > 0) {
      if ((asNumber(fields[property.loanRepaymentField]) ?? 0) <= 0) {
        pushMessage(messages, property.loanRepaymentField, "error", "Monthly repayment is required when property loan balance is above 0.");
      }
      if (isBlank(fields[property.loanRateField])) {
        pushMessage(messages, property.loanRateField, "error", "Interest rate is required when property loan balance is above 0.");
      }
      const propertyValue = asNumber(fields[property.valueField]) ?? 0;
      if (propertyValue > 0 && loanBalance > propertyValue) {
        pushMessage(messages, property.loanBalanceField, "warning", "Property loan balance exceeds property value.");
      }
      const interestRate = asNumber(fields[property.loanRateField]) ?? 0;
      const monthlyRepayment = asNumber(fields[property.loanRepaymentField]) ?? 0;
      if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(loanBalance, interestRate)) {
        pushMessage(messages, property.loanRepaymentField, "warning", "Monthly repayment does not cover current property-loan interest.");
      }
    }
  }

  for (const [index, asset] of ASSET_OF_VALUE_GROUPS.entries()) {
    const hasAny = !isBlank(fields[asset.nameField])
      || !isBlank(fields[asset.valueField])
      || !isBlank(fields[asset.annualCostsField])
      || !isBlank(fields[asset.appreciationRateField])
      || !isBlank(fields[asset.loanBalanceField])
      || !isBlank(fields[asset.loanRateField])
      || !isBlank(fields[asset.loanRepaymentField])
      || !isBlank(plannedSellYearValues.assetsOfValue[index]);
    if (!hasAny) continue;

    if (isBlank(fields[asset.nameField])) {
      pushMessage(messages, asset.nameField, "error", "Asset name is required when asset details are entered.");
      continue;
    }

    if ((asNumber(fields[asset.valueField]) ?? 0) <= 0) {
      pushMessage(messages, asset.valueField, "error", "Market value must be greater than 0 for an active asset.");
    }

    const loanBalance = asNumber(fields[asset.loanBalanceField]) ?? 0;
    if (loanBalance > 0) {
      if ((asNumber(fields[asset.loanRepaymentField]) ?? 0) <= 0) {
        pushMessage(messages, asset.loanRepaymentField, "error", "Monthly repayment is required when asset loan balance is above 0.");
      }
      if (isBlank(fields[asset.loanRateField])) {
        pushMessage(messages, asset.loanRateField, "error", "Interest rate is required when asset loan balance is above 0.");
      }
      const assetValue = asNumber(fields[asset.valueField]) ?? 0;
      if (assetValue > 0 && loanBalance > assetValue) {
        pushMessage(messages, asset.loanBalanceField, "warning", "Asset loan balance exceeds asset value.");
      }
      const interestRate = asNumber(fields[asset.loanRateField]) ?? 0;
      const monthlyRepayment = asNumber(fields[asset.loanRepaymentField]) ?? 0;
      if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(loanBalance, interestRate)) {
        pushMessage(messages, asset.loanRepaymentField, "warning", "Monthly repayment does not cover current asset-loan interest.");
      }
    }
  }

  if ((asNumber(fields[OTHER_WORK_GROUP.incomeField]) ?? 0) > 0) {
    const untilAge = asNumber(fields[OTHER_WORK_GROUP.untilAgeField]);
    if (untilAge !== null && !Number.isInteger(untilAge)) {
      pushMessage(messages, OTHER_WORK_GROUP.untilAgeField, "error", "Other work end age must be a whole number.");
    } else if (untilAge !== null) {
      if (ageNow !== null && untilAge < ageNow) {
        pushMessage(messages, OTHER_WORK_GROUP.untilAgeField, "error", "Other work end age must be current age or later.");
      }
      if (lifeExpectancy !== null && untilAge > lifeExpectancy) {
        pushMessage(messages, OTHER_WORK_GROUP.untilAgeField, "error", "Other work end age cannot exceed the projection horizon.");
      }
    }
  }

  if ((asNumber(fields[OTHER_LOAN_GROUP.balanceField]) ?? 0) > 0) {
    if ((asNumber(fields[OTHER_LOAN_GROUP.repaymentField]) ?? 0) <= 0) {
      pushMessage(messages, OTHER_LOAN_GROUP.repaymentField, "error", "Monthly repayment is required when other loan balance is above 0.");
    }
    if (isBlank(fields[OTHER_LOAN_GROUP.rateField])) {
      pushMessage(messages, OTHER_LOAN_GROUP.rateField, "error", "Interest rate is required when other loan balance is above 0.");
    }
    const interestRate = asNumber(fields[OTHER_LOAN_GROUP.rateField]) ?? 0;
    const monthlyRepayment = asNumber(fields[OTHER_LOAN_GROUP.repaymentField]) ?? 0;
    const loanBalance = asNumber(fields[OTHER_LOAN_GROUP.balanceField]) ?? 0;
    if (monthlyRepayment > 0 && monthlyRepayment <= monthlyInterestDue(loanBalance, interestRate)) {
      pushMessage(messages, OTHER_LOAN_GROUP.repaymentField, "warning", "Monthly repayment does not cover current other-loan interest.");
    }
  }

  const minYear = nextProjectionYear();
  const maxYear = projectionEndYear(fields);
  for (const event of [...INCOME_EVENT_GROUPS, ...EXPENSE_EVENT_GROUPS]) {
    const hasAny = !isBlank(fields[event.nameField]) || !isBlank(fields[event.amountField]) || !isBlank(fields[event.yearField]);
    if (!hasAny) continue;

    if (isBlank(fields[event.nameField])) {
      pushMessage(messages, event.nameField, "error", "Event name is required when event amount or year is entered.");
    }
    if ((asNumber(fields[event.amountField]) ?? 0) <= 0) {
      pushMessage(messages, event.amountField, "error", "Event amount must be greater than 0.");
    }
    const year = asNumber(fields[event.yearField]);
    if (year === null || !Number.isInteger(year)) {
      pushMessage(messages, event.yearField, "error", "Event year must be a whole calendar year.");
    } else {
      if (year < minYear) {
        pushMessage(messages, event.yearField, "error", `Event year must be ${minYear} or later.`);
      }
      if (maxYear !== null && year > maxYear) {
        pushMessage(messages, event.yearField, "error", "Event year cannot exceed the projection horizon.");
      }
    }
  }

  for (const crash of STOCK_MARKET_CRASH_GROUPS) {
    const hasAny = !isBlank(fields[crash.yearField]) || !isBlank(fields[crash.dropField]) || !isBlank(fields[crash.recoveryField]);
    if (!hasAny) continue;

    const year = asNumber(fields[crash.yearField]);
    if (year === null || !Number.isInteger(year)) {
      pushMessage(messages, crash.yearField, "error", "Crash year must be a whole calendar year.");
    } else {
      if (year < minYear) {
        pushMessage(messages, crash.yearField, "error", `Crash year must be ${minYear} or later.`);
      }
      if (maxYear !== null && year > maxYear) {
        pushMessage(messages, crash.yearField, "error", "Crash year cannot exceed the projection horizon.");
      }
    }

    const drop = asNumber(fields[crash.dropField]);
    if (drop === null) {
      pushMessage(messages, crash.dropField, "error", "Crash % drop is required when a stock market crash year is entered.");
    } else if (drop > 0.5) {
      pushMessage(messages, crash.dropField, "warning", "Crash % drop is unusually severe for planning assumptions.");
    }

    const recoveryYears = asNumber(fields[crash.recoveryField]);
    if (recoveryYears === null || !Number.isInteger(recoveryYears) || recoveryYears <= 0) {
      pushMessage(messages, crash.recoveryField, "error", "Time to recover must be a whole number greater than 0.");
    } else if (recoveryYears > 10) {
      pushMessage(messages, crash.recoveryField, "warning", "Time to recover is unusually long for planning assumptions.");
    }
  }

  const activeCrashWindows = STOCK_MARKET_CRASH_GROUPS.map((crash) => {
    const year = asNumber(fields[crash.yearField]);
    const recoveryYears = asNumber(fields[crash.recoveryField]);
    if (year === null || !Number.isInteger(year) || recoveryYears === null || !Number.isInteger(recoveryYears) || recoveryYears <= 0) {
      return null;
    }
    return {
      yearField: crash.yearField,
      year,
      recoveryYears
    };
  }).filter((crash): crash is { yearField: FieldId; year: number; recoveryYears: number } => crash !== null);

  const seenCrashYears = new Map<number, FieldId>();
  for (const crash of activeCrashWindows) {
    const duplicateYearCell = seenCrashYears.get(crash.year);
    if (duplicateYearCell !== undefined) {
      pushMessage(messages, crash.yearField, "error", "Crash year must be unique.");
      continue;
    }
    seenCrashYears.set(crash.year, crash.yearField);
  }

  const sortedCrashWindows = [...activeCrashWindows].sort((a, b) => a.year - b.year);
  for (let idx = 1; idx < sortedCrashWindows.length; idx += 1) {
    const previous = sortedCrashWindows[idx - 1];
    const current = sortedCrashWindows[idx];
    if (current.year <= previous.year + previous.recoveryYears) {
      pushMessage(
        messages,
        current.yearField,
        "error",
        "Crash year must be after the previous crash has fully recovered."
      );
    }
  }

  if ((asNumber(fields[POST_RETIREMENT_INCOME_GROUP.amountField]) ?? 0) > 0) {
    const fromAge = asNumber(fields[POST_RETIREMENT_INCOME_GROUP.fromAgeField]);
    const toAge = asNumber(fields[POST_RETIREMENT_INCOME_GROUP.toAgeField]);
    if (fromAge === null || !Number.isInteger(fromAge)) {
      pushMessage(messages, POST_RETIREMENT_INCOME_GROUP.fromAgeField, "error", "From age is required when other post-retirement income is entered.");
    }
    if (toAge === null || !Number.isInteger(toAge)) {
      pushMessage(messages, POST_RETIREMENT_INCOME_GROUP.toAgeField, "error", "To age is required when other post-retirement income is entered.");
    }
    if (fromAge !== null && toAge !== null) {
      if (fromAge > toAge) {
        pushMessage(messages, POST_RETIREMENT_INCOME_GROUP.toAgeField, "error", "To age must be greater than or equal to from age.");
      }
      if (ageNow !== null && fromAge < ageNow) {
        pushMessage(messages, POST_RETIREMENT_INCOME_GROUP.fromAgeField, "error", "From age must be current age or later.");
      }
      if (lifeExpectancy !== null && toAge > lifeExpectancy) {
        pushMessage(messages, POST_RETIREMENT_INCOME_GROUP.toAgeField, "error", "To age cannot exceed the projection horizon.");
      }
    }
  }

  const spendAdjustments = [
    { fieldId: "spending.adjustments.firstBracket.deltaRate" as const, label: getFieldLabel("spending.adjustments.firstBracket.deltaRate") },
    { fieldId: "spending.adjustments.secondBracket.deltaRate" as const, label: getFieldLabel("spending.adjustments.secondBracket.deltaRate") },
    { fieldId: "spending.adjustments.finalBracket.deltaRate" as const, label: getFieldLabel("spending.adjustments.finalBracket.deltaRate") }
  ];
  for (const adjustment of spendAdjustments) {
    const value = asNumber(fields[adjustment.fieldId]);
    if (value !== null && value <= -1) {
      pushMessage(messages, adjustment.fieldId, "error", `${adjustment.label} cannot reduce living expenses below zero.`);
    }
  }

  const liquidationRanks = LIQUIDATION_RANK_FIELDS
    .map((fieldId, idx) => {
      const propertyCount = PROPERTY_GROUPS.length;
      const isScheduled = idx < propertyCount
        ? resolveValidPlannedSellYear(plannedSellYearValues.properties[idx], fields["profile.currentAge"], fields["planning.lifeExpectancyAge"]) !== null
        : resolveValidPlannedSellYear(plannedSellYearValues.assetsOfValue[idx - propertyCount], fields["profile.currentAge"], fields["planning.lifeExpectancyAge"]) !== null;
      return { fieldId, value: isScheduled ? null : asNumber(fields[fieldId]) };
    })
    .filter((entry) => entry.value !== null && Number.isInteger(entry.value) && (entry.value as number) > 0) as Array<{ fieldId: FieldId; value: number }>;
  for (let i = 0; i < liquidationRanks.length; i += 1) {
    for (let j = i + 1; j < liquidationRanks.length; j += 1) {
      if (liquidationRanks[i].value === liquidationRanks[j].value) {
        pushMessage(
          messages,
          liquidationRanks[j].fieldId,
          "error",
          `Asset liquidation ranks 1-${LIQUIDATION_RANK_FIELDS.length} must be unique. Use 0 for never sell.`
        );
      }
    }
  }

  const startingLiquidAssets = (asNumber(fields["assets.cash.totalBalance"]) ?? 0) + (asNumber(fields["assets.equities.marketValue"]) ?? 0);
  const cashBuffer = asNumber(fields["liquidity.minimumCashBuffer"]) ?? 0;
  if (cashBuffer > 0 && startingLiquidAssets > 0 && cashBuffer > startingLiquidAssets) {
    pushMessage(messages, "liquidity.minimumCashBuffer", "warning", "Cash buffer exceeds starting cash plus stock balances.");
  }

  const annualPension = asNumber(fields["retirement.statePension.netAnnualAtStart"]) ?? 0;
  const pensionReduction = asNumber(fields["retirement.earlyPensionReductionPerYear"]) ?? 0;
  if (annualPension > 0 && pensionReduction > 0 && ageNow !== null && statutoryAge !== null) {
    const maxYearsEarly = Math.max(0, statutoryAge - ageNow);
    if (pensionReduction * maxYearsEarly > annualPension) {
      pushMessage(messages, "retirement.earlyPensionReductionPerYear", "warning", "Maximum early-retirement reduction would fully eliminate the pension.");
    }
  }

  return messages;
}

export function validatePlannedSellYearFields(fields: Partial<Record<string, unknown>>, activeFields: FieldState): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const projectionWindow = getProjectionYearWindow(activeFields["profile.currentAge"], activeFields["planning.lifeExpectancyAge"]);

  const validateYear = (fieldId: PlannedSellYearFieldId): void => {
    const rawValue = fields[fieldId];
    if (isBlank(rawValue)) return;

    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
      messages.push({
        fieldId: fieldId as FieldId,
        severity: "error",
        message: "Planned sell year must be a whole calendar year.",
        blocksProjection: false
      });
      return;
    }

    if (numeric < projectionWindow.minYear) {
      messages.push({
        fieldId: fieldId as FieldId,
        severity: "error",
        message: `Planned sell year must be ${projectionWindow.minYear} or later.`,
        blocksProjection: false
      });
      return;
    }

    if (projectionWindow.maxYear !== null && numeric > projectionWindow.maxYear) {
      messages.push({
        fieldId: fieldId as FieldId,
        severity: "error",
        message: "Planned sell year cannot exceed the projection horizon.",
        blocksProjection: false
      });
    }
  };

  PROPERTY_PLANNED_SELL_YEAR_FIELDS.forEach(validateYear);
  ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS.forEach(validateYear);
  return messages;
}
