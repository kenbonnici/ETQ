import { FieldState } from "../model/types";
import { pruneInactiveFieldState } from "../model/activation";

const DRAFT_KEY = "etq:scenario:draft:v2";
const SESSION_SEED_KEY = "etq:landing:quick-estimate";
const ONBOARDING_STATE_KEY = "etq:onboarding:state:v1";

export interface QuickEstimateSeed {
  age?: number | null;
  netAnnualIncome?: number | null;
  livingExpensesAnnual?: number | null;
  cashBalance?: number | null;
  equityBalance?: number | null;
  statePensionAnnual?: number | null;
}

export function readQuickEstimateSeed(): QuickEstimateSeed | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_SEED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as QuickEstimateSeed;
  } catch {
    return null;
  }
}

export function clearQuickEstimateSeed(): void {
  try { window.sessionStorage.removeItem(SESSION_SEED_KEY); } catch { /* ignore */ }
}

export function applySeedToFields(seed: QuickEstimateSeed | null, fields: FieldState): void {
  if (!seed) return;
  const set = (fieldId: string, value: number | null | undefined): void => {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) return;
    fields[fieldId as keyof FieldState] = Number(value);
  };
  set("profile.currentAge", seed.age ?? null);
  set("income.employment.netAnnual", seed.netAnnualIncome ?? null);
  set("spending.livingExpenses.annual", seed.livingExpensesAnnual ?? null);
  set("assets.cash.totalBalance", seed.cashBalance ?? null);
  set("assets.equities.marketValue", seed.equityBalance ?? null);
  set("retirement.statePension.netAnnualAtStart", seed.statePensionAnnual ?? null);
}

export interface PersistedSnapshotOnboarding {
  version: 2;
  savedAt: string;
  fields: FieldState;
  plannedSellYears: Record<string, number | null>;
  ui: {
    majorFutureEventsOpen: boolean;
    advancedAssumptionsOpen: boolean;
    earlyRetirementAge: number;
    selectedCurrency: string;
    livingExpensesMode: "single" | "expanded";
    livingExpenseCategoryValues: Record<string, number | null>;
  };
}

export function writeDraftFromOnboarding(
  fields: FieldState,
  earlyRetirementAge: number
): void {
  const snapshot: PersistedSnapshotOnboarding = {
    version: 2,
    savedAt: new Date().toISOString(),
    fields: pruneInactiveFieldState({ ...fields }),
    plannedSellYears: {},
    ui: {
      majorFutureEventsOpen: false,
      advancedAssumptionsOpen: false,
      earlyRetirementAge,
      selectedCurrency: "EUR",
      livingExpensesMode: "single",
      livingExpenseCategoryValues: {}
    }
  };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
  } catch { /* ignore quota errors */ }
}

export function navigateToCalculator(): void {
  window.location.href = "calculator.html#from=onboarding";
}

export interface PersistedOnboardingState {
  version: 1;
  savedAt: string;
  fields: FieldState;
  ui: {
    answered: string[];
    staleAnswered: string[];
    gates: Record<string, "YES" | "NO" | null>;
    acceptedAssumptions: string[];
    activeQuestionId: string | null;
  };
}

export function readOnboardingState(): PersistedOnboardingState | null {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    if (!parsed.fields || typeof parsed.fields !== "object") return null;
    if (!parsed.ui || typeof parsed.ui !== "object") return null;
    return parsed as PersistedOnboardingState;
  } catch {
    return null;
  }
}

export function writeOnboardingState(state: PersistedOnboardingState): void {
  try {
    window.localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore quota errors */ }
}

export function clearOnboardingState(): void {
  try { window.localStorage.removeItem(ONBOARDING_STATE_KEY); } catch { /* ignore */ }
}
