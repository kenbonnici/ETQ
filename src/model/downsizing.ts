import { fv, safePow } from "./components/finance";
import { resolveProjectionTiming } from "./projectionTiming";

export type DownsizingMode = "BUY" | "RENT" | null;

export interface DownsizingProjectionWindow {
  minYear: number;
  maxYear: number | null;
}

export interface DownsizingEstimate {
  year: number;
  homeowner: boolean;
  futureHomeValue: number;
  saleProceeds: number;
  mortgagePayoff: number;
  netEquityReleased: number;
  replacementPurchaseCostAtDownsize: number | null;
}

export interface DownsizingEstimateInput {
  downsizingYear: unknown;
  homeValue: unknown;
  homeLoanBalance: unknown;
  homeLoanRate: unknown;
  homeLoanRepaymentMonthly: unknown;
  propertyAppreciation: unknown;
  propertyDisposalCosts: unknown;
  newHomePurchaseCostToday?: unknown;
  projectionMonthOverride?: number | null;
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

function asWholeYear(value: unknown): number | null {
  const num = asNumber(value);
  if (num === null || !Number.isInteger(num)) return null;
  return num;
}

function nperMonths(balance: number, annualRate: number, monthlyRepayment: number): number {
  if (!(balance > 0 && monthlyRepayment > 0)) return 0;
  if (!(annualRate > 0)) {
    return balance / monthlyRepayment;
  }
  const monthlyRate = annualRate / 12;
  if (monthlyRepayment <= balance * monthlyRate) {
    return Number.POSITIVE_INFINITY;
  }
  const ratio = monthlyRepayment / (monthlyRepayment - balance * monthlyRate);
  if (ratio <= 0) return Number.POSITIVE_INFINITY;
  return Math.log(ratio) / Math.log(1 + monthlyRate);
}

export function normalizeDownsizingMode(value: unknown): DownsizingMode {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "BUY") return "BUY";
  if (normalized === "RENT") return "RENT";
  return null;
}

export function getDownsizingProjectionWindow(ageNow: unknown, endAge: unknown, currentYear = new Date().getFullYear()): DownsizingProjectionWindow {
  const age = asNumber(ageNow);
  const horizonAge = asNumber(endAge);
  if (age === null || horizonAge === null || horizonAge < age) {
    return { minYear: currentYear, maxYear: null };
  }
  return {
    minYear: currentYear,
    maxYear: currentYear + Math.max(0, Math.round(horizonAge - age - 1))
  };
}

export function isDownsizingYearInProjectionWindow(year: unknown, ageNow: unknown, endAge: unknown, currentYear = new Date().getFullYear()): boolean {
  const wholeYear = asWholeYear(year);
  if (wholeYear === null) return false;
  const { minYear, maxYear } = getDownsizingProjectionWindow(ageNow, endAge, currentYear);
  if (wholeYear < minYear) return false;
  if (maxYear !== null && wholeYear > maxYear) return false;
  return true;
}

export function estimateDownsizing(input: DownsizingEstimateInput): DownsizingEstimate | null {
  const downsizingYear = asWholeYear(input.downsizingYear);
  const homeValue = asNumber(input.homeValue) ?? 0;
  const homeLoanBalance = asNumber(input.homeLoanBalance) ?? 0;
  const homeLoanRate = asNumber(input.homeLoanRate) ?? 0;
  const homeLoanRepaymentMonthly = asNumber(input.homeLoanRepaymentMonthly) ?? 0;
  const propertyAppreciation = asNumber(input.propertyAppreciation) ?? 0;
  const propertyDisposalCosts = asNumber(input.propertyDisposalCosts) ?? 0;
  const newHomePurchaseCostToday = asNumber(input.newHomePurchaseCostToday);

  if (downsizingYear === null || downsizingYear <= 0) return null;

  const timing = resolveProjectionTiming(new Date(), input.projectionMonthOverride ?? null);
  if (downsizingYear < timing.currentYear) return null;
  const yearIndex = downsizingYear - timing.currentYear;
  const growthExponent = yearIndex + timing.proRate;
  const homeowner = homeValue > 0;
  const futureHomeValue = homeowner ? homeValue * safePow(1 + propertyAppreciation, growthExponent) : 0;
  const projectedMortgageBalance = homeowner && homeLoanBalance > 0
    ? (() => {
        if (homeLoanRepaymentMonthly <= 0 && homeLoanRate > 0) return homeLoanBalance;
        const totalMonths = nperMonths(homeLoanBalance, homeLoanRate, homeLoanRepaymentMonthly);
        if (totalMonths <= 0) return 0;
        return Math.max(
          fv(
            homeLoanRate / 12,
            (yearIndex + 1) * 12 + timing.monthOffset,
            homeLoanRepaymentMonthly,
            -homeLoanBalance
          ),
          0
        );
      })()
    : 0;
  const saleProceeds = homeowner ? futureHomeValue * (1 - propertyDisposalCosts) : 0;
  const replacementPurchaseCostAtDownsize = newHomePurchaseCostToday !== null && newHomePurchaseCostToday > 0
    ? newHomePurchaseCostToday * safePow(1 + propertyAppreciation, growthExponent)
    : null;

  return {
    year: downsizingYear,
    homeowner,
    futureHomeValue,
    saleProceeds,
    mortgagePayoff: projectedMortgageBalance,
    netEquityReleased: saleProceeds - projectedMortgageBalance,
    replacementPurchaseCostAtDownsize
  };
}
