import { RawInputValue } from "./types";

export const PROPERTY_PLANNED_SELL_YEAR_FIELDS = [
  "properties.01.plannedSellYear",
  "properties.02.plannedSellYear",
  "properties.03.plannedSellYear",
  "properties.04.plannedSellYear",
  "properties.05.plannedSellYear"
] as const;

export const ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS = [
  "assetsOfValue.01.plannedSellYear",
  "assetsOfValue.02.plannedSellYear",
  "assetsOfValue.03.plannedSellYear",
  "assetsOfValue.04.plannedSellYear",
  "assetsOfValue.05.plannedSellYear"
] as const;

export const PLANNED_SELL_YEAR_FIELDS = [
  ...PROPERTY_PLANNED_SELL_YEAR_FIELDS,
  ...ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS
] as const;

export type PlannedSellYearFieldId = (typeof PLANNED_SELL_YEAR_FIELDS)[number];

export interface ResolvedPlannedSaleYears {
  properties: Array<number | null>;
  assetsOfValue: Array<number | null>;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return String(value).trim() === "";
}

function asFiniteNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parsePlannedSellYearValue(value: unknown): number | null {
  const numeric = asFiniteNumber(value);
  if (numeric === null || !Number.isInteger(numeric)) return null;
  return Math.trunc(numeric);
}

export function getProjectionYearWindow(
  ageNowValue: unknown,
  liveUntilAgeValue: unknown,
  currentYear = new Date().getFullYear()
): { minYear: number; maxYear: number | null } {
  const ageNow = asFiniteNumber(ageNowValue);
  const liveUntilAge = asFiniteNumber(liveUntilAgeValue);
  if (ageNow === null || liveUntilAge === null || liveUntilAge < ageNow) {
    return {
      minYear: currentYear,
      maxYear: null
    };
  }

  return {
    minYear: currentYear,
    maxYear: currentYear + Math.max(0, Math.round(liveUntilAge - ageNow - 1))
  };
}

export function isProjectionYearWithinWindow(
  year: number | null,
  ageNowValue: unknown,
  liveUntilAgeValue: unknown,
  currentYear = new Date().getFullYear()
): boolean {
  if (year === null) return false;
  const window = getProjectionYearWindow(ageNowValue, liveUntilAgeValue, currentYear);
  if (year < window.minYear) return false;
  if (window.maxYear !== null && year > window.maxYear) return false;
  return true;
}

export function resolveValidPlannedSellYear(
  value: unknown,
  ageNowValue: unknown,
  liveUntilAgeValue: unknown,
  currentYear = new Date().getFullYear()
): number | null {
  const year = parsePlannedSellYearValue(value);
  if (!isProjectionYearWithinWindow(year, ageNowValue, liveUntilAgeValue, currentYear)) {
    return null;
  }
  return year;
}

export function resolvePlannedSaleYears(
  values: Partial<Record<string, RawInputValue>>,
  ageNowValue: unknown,
  liveUntilAgeValue: unknown,
  currentYear = new Date().getFullYear()
): ResolvedPlannedSaleYears {
  return {
    properties: PROPERTY_PLANNED_SELL_YEAR_FIELDS.map((fieldId) =>
      resolveValidPlannedSellYear(values[fieldId], ageNowValue, liveUntilAgeValue, currentYear)
    ),
    assetsOfValue: ASSET_OF_VALUE_PLANNED_SELL_YEAR_FIELDS.map((fieldId) =>
      resolveValidPlannedSellYear(values[fieldId], ageNowValue, liveUntilAgeValue, currentYear)
    )
  };
}
