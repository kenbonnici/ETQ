import { createEmptyFieldState } from "../model/inputSchema";
import { ModelUiState } from "../model/types";
import { applySeedToFields, LANDING_INPUTS_KEY, QuickEstimateSeed, writeDraftFromOnboarding } from "../onboarding/handoff";
import { findEarliestRetirementAge } from "../shared/findEarliestRetirementAge";

const SEED_KEY = "etq:landing:quick-estimate";
const FIELD_IDS = ["c-age", "c-income", "c-spend", "c-savings", "c-invest", "c-pension"] as const;
const DEBOUNCE_MS = 150;
const DEFAULT_EARLY_RETIREMENT_AGE = 55;

const baseUi: ModelUiState = {
  majorFutureEventsOpen: false,
  advancedAssumptionsOpen: false,
  earlyRetirementAge: DEFAULT_EARLY_RETIREMENT_AGE,
  manualPropertyLiquidationOrder: false
};

const parseMoney = (s: string): number => Number(String(s).replace(/[^0-9.]/g, "")) || 0;

function getInput(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

function readSeed(): QuickEstimateSeed {
  return {
    age: parseMoney(getInput("c-age")?.value ?? "") || null,
    netAnnualIncome: parseMoney(getInput("c-income")?.value ?? "") || null,
    livingExpensesAnnual: parseMoney(getInput("c-spend")?.value ?? "") || null,
    cashBalance: parseMoney(getInput("c-savings")?.value ?? "") || null,
    equityBalance: parseMoney(getInput("c-invest")?.value ?? "") || null,
    statePensionAnnual: parseMoney(getInput("c-pension")?.value ?? "") || null
  };
}

let runHandle: number | null = null;

function setResultLabel(text: string): void {
  const label = document.getElementById("c-out-label");
  if (label) label.textContent = text;
}

function recalc(): void {
  const out = document.getElementById("c-out");
  if (!out) return;
  const seed = readSeed();
  if (!seed.age || !seed.livingExpensesAnnual) {
    out.textContent = "—";
    setResultLabel("Earliest viable at");
    return;
  }
  const fields = createEmptyFieldState();
  applySeedToFields(seed, fields);
  const { age } = findEarliestRetirementAge(fields, baseUi);
  if (age === null) {
    out.textContent = "—";
    setResultLabel("Earliest viable at");
    return;
  }
  out.textContent = String(age);
  setResultLabel(age === seed.age ? "Viable now, at age" : "Earliest viable at age");
}

function scheduleRecalc(): void {
  if (runHandle !== null) window.clearTimeout(runHandle);
  runHandle = window.setTimeout(() => {
    runHandle = null;
    recalc();
  }, DEBOUNCE_MS);
}

function persistInputs(): void {
  try {
    const obj: Record<string, string> = {};
    FIELD_IDS.forEach((id) => {
      obj[id] = getInput(id)?.value ?? "";
    });
    sessionStorage.setItem(LANDING_INPUTS_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function restoreInputs(): void {
  try {
    const raw = sessionStorage.getItem(LANDING_INPUTS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, unknown>;
    FIELD_IDS.forEach((id) => {
      const input = getInput(id);
      if (input && Object.prototype.hasOwnProperty.call(obj, id)) {
        input.value = String(obj[id] ?? "");
      }
    });
  } catch { /* ignore */ }
}

function writeSeedOnNav(): void {
  try {
    sessionStorage.setItem(SEED_KEY, JSON.stringify(readSeed()));
  } catch { /* ignore */ }
}

function hasAnySeedValue(seed: QuickEstimateSeed): boolean {
  return Object.values(seed).some((v) => v !== null && v !== undefined);
}

function writeDraftOnCalculatorNav(): void {
  const seed = readSeed();
  if (!hasAnySeedValue(seed)) return;
  const fields = createEmptyFieldState();
  applySeedToFields(seed, fields);
  writeDraftFromOnboarding(fields, DEFAULT_EARLY_RETIREMENT_AGE);
}

function initCounter(): void {
  const el = document.getElementById("counter");
  if (!el) return;
  let count = 247583;
  setInterval(() => {
    count += Math.random() < 0.6 ? 1 : 0;
    el.textContent = count.toLocaleString();
  }, 3200);
}

restoreInputs();
FIELD_IDS.forEach((id) => {
  getInput(id)?.addEventListener("input", () => {
    scheduleRecalc();
    persistInputs();
  });
});
document.getElementById("c-clear")?.addEventListener("click", () => {
  FIELD_IDS.forEach((id) => {
    const input = getInput(id);
    if (input) input.value = "";
  });
  try { sessionStorage.removeItem(SEED_KEY); } catch { /* ignore */ }
  persistInputs();
  recalc();
  getInput("c-age")?.focus();
});
document.querySelectorAll<HTMLAnchorElement>('a[href="onboarding.html"]').forEach((a) => {
  a.addEventListener("click", writeSeedOnNav);
});
document.querySelectorAll<HTMLAnchorElement>('a[href="calculator.html"]').forEach((a) => {
  a.addEventListener("click", writeDraftOnCalculatorNav);
});
recalc();
initCounter();
