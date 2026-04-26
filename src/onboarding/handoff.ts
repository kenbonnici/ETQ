import { FieldState } from "../model/types";
import { pruneInactiveFieldState } from "../model/activation";
import {
  createEmptyLivingExpenseCategoryValues,
  hasAnyLivingExpenseCategoryValue,
  LivingExpenseCategoryValues,
  LivingExpensesMode
} from "../ui/livingExpenses";

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

// Maps each QuickEstimateSeed slot to (FieldId, the onboarding question id that
// should soft-confirm if the slot was applied). Mirrors §2.2 of the spec.
const SEED_FIELD_MAP: ReadonlyArray<readonly [keyof QuickEstimateSeed, string, string]> = [
  ["age", "profile.currentAge", "age"],
  ["netAnnualIncome", "income.employment.netAnnual", "userIncome"],
  ["livingExpensesAnnual", "spending.livingExpenses.annual", "livingExpenses"],
  ["cashBalance", "assets.cash.totalBalance", "cash"],
  ["equityBalance", "assets.equities.marketValue", "equities"],
  ["statePensionAnnual", "retirement.statePension.netAnnualAtStart", "statePension"]
];

export function applySeedToFields(seed: QuickEstimateSeed | null, fields: FieldState): Set<string> {
  const seededQuestions = new Set<string>();
  if (!seed) return seededQuestions;
  for (const [seedKey, fieldId, questionId] of SEED_FIELD_MAP) {
    const raw = seed[seedKey];
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) continue;
    fields[fieldId as keyof FieldState] = Number(raw);
    seededQuestions.add(questionId);
  }
  return seededQuestions;
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
  earlyRetirementAge: number,
  livingExpensesMode: LivingExpensesMode = "single",
  livingExpenseCategoryValues: LivingExpenseCategoryValues = createEmptyLivingExpenseCategoryValues()
): void {
  const usingExpanded =
    livingExpensesMode === "expanded" && hasAnyLivingExpenseCategoryValue(livingExpenseCategoryValues);
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
      livingExpensesMode: usingExpanded ? "expanded" : "single",
      livingExpenseCategoryValues: usingExpanded ? { ...livingExpenseCategoryValues } : {}
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
    seededQuestions?: string[];
    livingExpensesMode?: LivingExpensesMode;
    livingExpenseCategoryValues?: LivingExpenseCategoryValues;
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
