import { applySectionActivation, pruneInactiveFieldState } from "../model/activation";
import { runModel } from "../model/index";
import { createEmptyFieldState, getDefaultFieldValue, FIELD_VALIDATION_RULES } from "../model/inputSchema";
import { FieldState, ModelUiState, RawInputValue } from "../model/types";
import { FieldId } from "../model/fieldRegistry";
import {
  ActivationCtx,
  buildFullSequence,
  findNextToConfirm,
  isQuestionActive,
  pruneOrphanedAnswers,
  QuestionDef
} from "./sequence";
import { createCard, createChapterDivider, createChip, formatCurrency, formatPercent } from "./render";
import { drawMiniChart } from "./chart";
import { findEarliestRetirementAge } from "../shared/findEarliestRetirementAge";
import { DEFAULT_CURRENCY, TOP_CURRENCIES, currencySymbolFor, formatCurrencyAmount, isSupportedCurrency } from "../shared/currency";
import {
  applySeedToFields,
  clearOnboardingState,
  clearQuickEstimateSeed,
  navigateToCalculator,
  PersistedOnboardingState,
  readOnboardingState,
  readQuickEstimateSeed,
  writeDraftFromOnboarding,
  writeOnboardingState
} from "./handoff";
import {
  createEmptyLivingExpenseCategoryValues,
  hasAnyLivingExpenseCategoryValue,
  LIVING_EXPENSE_CATEGORY_DEFINITIONS,
  LivingExpenseCategoryId,
  LivingExpenseCategoryValues,
  LivingExpensesMode,
  seedLivingExpenseCategoryValuesFromTotal,
  sumLivingExpenseCategoryValues
} from "../ui/livingExpenses";

const DEFAULT_EARLY_RETIREMENT_AGE = 55;
const RUN_DEBOUNCE_MS = 150;
const SPENDING_TAPER_DEFAULTS = {
  firstEndAge: 65,
  secondEndAge: 75,
  firstDelta: 0.0,
  secondDelta: -0.1,
  finalDelta: -0.2
};

interface OnboardingUiState {
  answered: Set<string>;
  staleAnswered: Set<string>;
  gates: Record<string, "YES" | "NO" | null>;
  acceptedAssumptions: Set<string>;
  seededQuestions: Set<string>;
  livingExpensesMode: LivingExpensesMode;
  livingExpenseCategoryValues: LivingExpenseCategoryValues;
  activeQuestionId: string | null;
  completed: boolean;
}

const appRoot = document.querySelector<HTMLElement>("#app");
if (!appRoot) throw new Error("Missing #app root for onboarding.");
const app: HTMLElement = appRoot;

const restored = readOnboardingState();
const seededFromInit = new Set<string>();
const fieldState: FieldState = initializeFieldState(restored, seededFromInit);
const sequence = buildFullSequence();
const uiState: OnboardingUiState = {
  answered: new Set(restored?.ui.answered ?? []),
  staleAnswered: new Set(restored?.ui.staleAnswered ?? []),
  gates: { ...(restored?.ui.gates ?? {}) },
  acceptedAssumptions: new Set(restored?.ui.acceptedAssumptions ?? []),
  seededQuestions: new Set(restored?.ui.seededQuestions ?? Array.from(seededFromInit)),
  livingExpensesMode: restored?.ui.livingExpensesMode ?? "single",
  livingExpenseCategoryValues: restored?.ui.livingExpenseCategoryValues
    ? { ...createEmptyLivingExpenseCategoryValues(), ...restored.ui.livingExpenseCategoryValues }
    : createEmptyLivingExpenseCategoryValues(),
  activeQuestionId: restored?.ui.activeQuestionId ?? null,
  completed: false
};
let selectedCurrency = isSupportedCurrency(restored?.ui.selectedCurrency)
  ? restored.ui.selectedCurrency
  : DEFAULT_CURRENCY;

const modelUiState: ModelUiState = {
  majorFutureEventsOpen: false,
  advancedAssumptionsOpen: false,
  earlyRetirementAge: DEFAULT_EARLY_RETIREMENT_AGE,
  manualPropertyLiquidationOrder: false
};

let runHandle: number | null = null;
let lastRunResult: ReturnType<typeof runModel> | null = null;
let lastRenderedActiveId: string | null = null;
let canvasReady = false;
let activeKeyHandler: ((ev: KeyboardEvent) => void) | null = null;
let displayedAge: number | null = null;
let ageTweenHandle: number | null = null;
const AGE_TWEEN_MS = 600;

buildLayout();
mountCurrencySelector();
wireNavJump();
wireEscapeKey();
advanceToFirstUnanswered();
render();
syncRestartVisibility();

function wireEscapeKey(): void {
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (document.querySelector(".confirm-overlay")) return; // dialog handles its own Escape
    if (!isMidEdit()) return;
    ev.preventDefault();
    cancelChipEdit();
  });
}

function isMidEdit(): boolean {
  if (uiState.staleAnswered.size === 0) return false;
  const id = uiState.activeQuestionId;
  if (!id) return false;
  return !uiState.answered.has(id);
}

function cancelChipEdit(): void {
  const id = uiState.activeQuestionId;
  if (id) uiState.answered.add(id);
  uiState.staleAnswered.clear();
  uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
  advanceToFirstUnanswered();
  render();
  focusActiveInput();
}

function wireNavJump(): void {
  const home = document.querySelector<HTMLAnchorElement>("[data-onboarding-home]");
  if (home) {
    home.addEventListener("click", async (ev) => {
      if (!hasClearableState()) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || (ev as MouseEvent).button === 1) return;
      ev.preventDefault();
      const ok = await showConfirm(
        "Leave the walkthrough? Your answers so far will be lost. This cannot be undone.",
        { okLabel: "Leave", cancelLabel: "Stay here" }
      );
      if (ok) window.location.assign(home.getAttribute("href") ?? "index.html");
    });
  }
  const btn = document.querySelector<HTMLButtonElement>("[data-onboarding-jump]");
  if (btn) {
    btn.addEventListener("click", () => {
      writeDraftFromOnboarding(
        fieldState,
        modelUiState.earlyRetirementAge,
        uiState.livingExpensesMode,
        uiState.livingExpenseCategoryValues,
        selectedCurrency
      );
      clearOnboardingState();
      clearQuickEstimateSeed();
      navigateToCalculator();
    });
  }
  const restart = document.querySelector<HTMLButtonElement>("[data-onboarding-restart]");
  if (restart) {
    restart.addEventListener("click", async () => {
      if (!hasClearableState()) return;
      const ok = await showConfirm(
        "Start over? Your answers so far will be cleared and you'll begin from the first question. This cannot be undone."
      );
      if (!ok) return;
      try { window.localStorage.removeItem("etq:scenario:draft:v2"); } catch { /* ignore */ }
      clearOnboardingState();
      clearQuickEstimateSeed();
      window.location.assign("onboarding.html");
    });
  }
}

function hasClearableState(): boolean {
  if (uiState.answered.size > 0) return true;
  try {
    if (window.localStorage.getItem("etq:scenario:draft:v2")) return true;
    if (window.localStorage.getItem("etq:onboarding:state:v1")) return true;
  } catch { /* ignore */ }
  return false;
}

function syncRestartVisibility(): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-onboarding-restart]");
  if (!btn) return;
  btn.hidden = !hasClearableState();
}

function showConfirm(
  message: string,
  options: { okLabel?: string; cancelLabel?: string } = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `<div class="confirm-dialog" role="alertdialog" aria-modal="true">
      <p></p>
      <div class="confirm-actions">
        <button class="confirm-cancel" type="button"></button>
        <button class="confirm-ok" type="button"></button>
      </div>
    </div>`;
    overlay.querySelector("p")!.textContent = message;
    overlay.querySelector<HTMLButtonElement>(".confirm-cancel")!.textContent = options.cancelLabel ?? "Cancel";
    overlay.querySelector<HTMLButtonElement>(".confirm-ok")!.textContent = options.okLabel ?? "Start over";
    const cancel = overlay.querySelector<HTMLButtonElement>(".confirm-cancel")!;
    const ok = overlay.querySelector<HTMLButtonElement>(".confirm-ok")!;
    const close = (result: boolean): void => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(result);
    };
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") { ev.preventDefault(); close(false); }
    };
    cancel.addEventListener("click", () => close(false));
    ok.addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(false); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    cancel.focus();
  });
}

function initializeFieldState(
  restored: PersistedOnboardingState | null,
  seededOut: Set<string>
): FieldState {
  const state = createEmptyFieldState();
  if (restored) {
    for (const [k, v] of Object.entries(restored.fields)) {
      state[k as keyof FieldState] = v as RawInputValue;
    }
    return state;
  }
  const seed = readQuickEstimateSeed();
  if (seed) {
    const seeded = applySeedToFields(seed, state);
    seeded.forEach((id) => seededOut.add(id));
  }
  return state;
}

function persistOnboardingState(): void {
  writeOnboardingState({
    version: 1,
    savedAt: new Date().toISOString(),
    fields: { ...fieldState },
    ui: {
      answered: Array.from(uiState.answered),
      staleAnswered: Array.from(uiState.staleAnswered),
      gates: { ...uiState.gates },
      acceptedAssumptions: Array.from(uiState.acceptedAssumptions),
      seededQuestions: Array.from(uiState.seededQuestions),
      selectedCurrency,
      livingExpensesMode: uiState.livingExpensesMode,
      livingExpenseCategoryValues: { ...uiState.livingExpenseCategoryValues },
      activeQuestionId: uiState.activeQuestionId
    }
  });
}

function wrapInListItem(child: HTMLElement, presentational = false, sticky = false): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "ob-list-item";
  if (presentational) li.setAttribute("role", "presentation");
  if (sticky) li.setAttribute("data-sticky", "true");
  li.appendChild(child);
  return li;
}

function buildLayout(): void {
  app.classList.add("ob-shell");
  const left = document.createElement("ol");
  left.className = "ob-conversation";
  left.id = "ob-conversation";
  const right = document.createElement("aside");
  right.className = "ob-estimate";
  right.id = "ob-estimate";
  right.innerHTML = `
    <p class="ob-estimate-placeholder-label">Your estimate</p>
    <p class="ob-estimate-label">You could stop working at</p>
    <div class="ob-estimate-age" id="ob-estimate-age" aria-live="polite">—</div>
    <span class="ob-estimate-delta-shift" id="ob-estimate-delta-shift" aria-hidden="true"></span>
    <p class="ob-estimate-placeholder" id="ob-estimate-placeholder">Your earliest possible retirement age will appear as you answer.</p>
    <p class="ob-estimate-delta" id="ob-estimate-delta" hidden></p>
    <p class="ob-estimate-warning" id="ob-estimate-warning" hidden></p>
    <div class="ob-chart-wrap" id="ob-chart-wrap">
      <canvas class="ob-chart-canvas" id="ob-chart-canvas"></canvas>
      <div class="ob-chart-legend" id="ob-chart-legend">
        <span class="ob-chart-legend-item" data-series="cash">
          <span class="ob-chart-legend-dot"></span> cash
        </span>
        <span class="ob-chart-legend-item" data-series="networth" hidden>
          <span class="ob-chart-legend-dot" data-series="networth"></span> net worth
        </span>
      </div>
    </div>
    <details class="ob-estimate-assumptions" id="ob-estimate-assumptions">
      <summary class="ob-estimate-assumptions-summary">
        <span class="ob-estimate-assumptions-summary-text">This estimate uses default assumptions and skips some things only the full calculator covers.</span>
        <span class="ob-estimate-assumptions-toggle" aria-hidden="true"></span>
      </summary>
      <div class="ob-estimate-assumptions-section">
        <p class="ob-estimate-assumptions-section-label">Adjust in the full calculator</p>
        <ul class="ob-estimate-assumptions-list">
          <li>Investment growth rates (equities, cash, rental income, salary)</li>
          <li>Property appreciation, and selling costs on stocks, property, and other assets</li>
          <li>Inflation applied to spending and other figures over time</li>
          <li>How your spending shifts through retirement</li>
          <li>Early-retirement pension reduction and partner timing</li>
          <li>Planning horizon and the order assets are drawn down</li>
        </ul>
      </div>
      <div class="ob-estimate-assumptions-section">
        <p class="ob-estimate-assumptions-section-label">Add in the full calculator</p>
        <ul class="ob-estimate-assumptions-list">
          <li>One-off future events (inheritance, asset sales, weddings, renovations)</li>
          <li>Plans to downsize or change your home later in life</li>
          <li>Side income (freelance, consulting) and any post-retirement work</li>
          <li>A cash reserve to keep on hand and money to leave behind</li>
          <li>Effects of future market crashes you want to plan around</li>
        </ul>
      </div>
    </details>
  `;
  app.appendChild(left);
  app.appendChild(right);
}

function mountCurrencySelector(): void {
  const navActions = document.querySelector<HTMLElement>(".nav-actions");
  if (!navActions || navActions.querySelector("[data-onboarding-currency]")) return;
  const wrap = document.createElement("div");
  wrap.className = "nav-currency";
  wrap.innerHTML = `
    <span class="nav-currency-value" aria-hidden="true">${selectedCurrency}</span>
    <select class="nav-currency-select" data-onboarding-currency aria-label="Currency selector">
      ${TOP_CURRENCIES.map((currency) => `<option value="${currency.code}" ${currency.code === selectedCurrency ? "selected" : ""}>${currency.code}</option>`).join("")}
    </select>
  `;
  navActions.insertBefore(wrap, navActions.firstChild);
  const select = wrap.querySelector<HTMLSelectElement>("[data-onboarding-currency]");
  const value = wrap.querySelector<HTMLElement>(".nav-currency-value");
  select?.addEventListener("change", () => {
    selectedCurrency = isSupportedCurrency(select.value) ? select.value : DEFAULT_CURRENCY;
    if (value) value.textContent = selectedCurrency;
    render();
    focusActiveInput();
  });
}

function ctx(): ActivationCtx {
  return { fields: fieldState, gates: uiState.gates };
}

function advanceToFirstUnanswered(): void {
  const next = findNextToConfirm(sequence, ctx(), uiState.answered, uiState.staleAnswered);
  if (!next) {
    uiState.activeQuestionId = "handoff";
    uiState.completed = true;
  } else {
    uiState.activeQuestionId = next.id;
    uiState.completed = next.id === "handoff";
  }
}

// Drop stale entries for questions that are no longer active or no longer answered.
function pruneStaleAnswered(): void {
  const next = new Set<string>();
  for (const id of uiState.staleAnswered) {
    if (!uiState.answered.has(id)) continue;
    const q = sequence.find((s) => s.id === id);
    if (!q) continue;
    if (!isQuestionActive(q, ctx())) continue;
    next.add(id);
  }
  uiState.staleAnswered = next;
}

function render(): void {
  const left = document.getElementById("ob-conversation");
  if (!left) return;
  if (activeKeyHandler) {
    document.removeEventListener("keydown", activeKeyHandler);
    activeKeyHandler = null;
  }
  const scrollY = window.scrollY;
  left.innerHTML = "";

  const active = uiState.activeQuestionId
    ? sequence.find((s) => s.id === uiState.activeQuestionId) ?? null
    : null;
  const activeIdChanged = uiState.activeQuestionId !== lastRenderedActiveId;

  const markAnimate = (card: HTMLElement): HTMLElement => {
    if (activeIdChanged) card.setAttribute("data-animate-in", "true");
    return card;
  };

  const onHandoff = uiState.completed || uiState.activeQuestionId === "handoff";
  if (onHandoff) app.setAttribute("data-on-handoff", "true");
  else app.removeAttribute("data-on-handoff");

  // Every active question — including compact "add another?" gates — gets the
  // pinned, sticky treatment. The card's eyebrow already names the chapter, so
  // the gate doesn't need to sit inline among its siblings.
  if (onHandoff) {
    left.appendChild(wrapInListItem(markAnimate(renderHandoffCard())));
  } else if (active) {
    if (uiState.staleAnswered.size > 0) {
      const hint = document.createElement("p");
      hint.className = "ob-edit-hint";
      const n = uiState.staleAnswered.size;
      hint.textContent = `Editing — you'll re-confirm ${n} later answer${n === 1 ? "" : "s"} as you continue.`;
      left.appendChild(hint);
    }
    left.appendChild(wrapInListItem(markAnimate(renderActiveCard(active)), false, true));
  }

  const chapters: { title: string; questions: QuestionDef[] }[] = [];
  for (const q of sequence) {
    if (!isQuestionActive(q, ctx())) continue;
    if (q.id === uiState.activeQuestionId) continue;
    if (!uiState.answered.has(q.id)) continue;
    const last = chapters[chapters.length - 1];
    if (last && last.title === q.chapterTitle) last.questions.push(q);
    else chapters.push({ title: q.chapterTitle, questions: [q] });
  }
  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    const ch = chapters[i];
    if (ch.title) left.appendChild(wrapInListItem(createChapterDivider(ch.title), true));
    for (let j = ch.questions.length - 1; j >= 0; j -= 1) {
      left.appendChild(wrapInListItem(renderChip(ch.questions[j])));
    }
  }

  lastRenderedActiveId = uiState.activeQuestionId;
  if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
  scheduleRun();
  syncRestartVisibility();
  persistOnboardingState();
}

function renderChip(q: QuestionDef): HTMLElement {
  const formatted = formatAnswer(q);
  const assumptionText = q.assumption && uiState.acceptedAssumptions.has(q.id)
    ? `default: ${q.defaultAssumptionLabel ?? "accepted"}`
    : undefined;
  const chip = createChip(q, formatted, assumptionText);
  if (uiState.staleAnswered.has(q.id)) chip.setAttribute("data-stale", "true");
  chip.addEventListener("click", () => editChip(q));
  chip.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key === "Enter") {
      ev.preventDefault();
      editChip(q);
    }
  });
  return chip;
}

function editChip(q: QuestionDef): void {
  uiState.answered.delete(q.id);
  uiState.staleAnswered.delete(q.id);
  uiState.activeQuestionId = q.id;
  uiState.completed = false;
  // Mark subsequent answered questions as stale: their values are kept so most
  // re-confirmations are Enter-Enter, but the user must walk through each before
  // the projection is considered final. This prevents stale dependent answers
  // from quietly persisting after an upstream edit.
  const idx = sequence.findIndex((s) => s.id === q.id);
  if (idx >= 0) {
    for (let i = idx + 1; i < sequence.length; i += 1) {
      const later = sequence[i];
      if (uiState.answered.has(later.id)) {
        uiState.staleAnswered.add(later.id);
      }
    }
  }
  render();
  focusActiveInput();
}

function findPreviousAnswered(q: QuestionDef): QuestionDef | null {
  const idx = sequence.findIndex((s) => s.id === q.id);
  if (idx <= 0) return null;
  const c = ctx();
  for (let i = idx - 1; i >= 0; i -= 1) {
    const candidate = sequence[i];
    if (candidate.id === "handoff") continue;
    if (!isQuestionActive(candidate, c)) continue;
    if (!uiState.answered.has(candidate.id)) continue;
    return candidate;
  }
  return null;
}

function dependentNameFor(q: QuestionDef): string | null {
  const m = q.id.match(/^dependent(\d+)(Cost|Years)$/);
  if (!m) return null;
  const pad = String(Number(m[1])).padStart(2, "0");
  const fieldId = `dependents.${pad}.displayName` as FieldId;
  const raw = String(fieldState[fieldId] ?? "").trim();
  return raw || null;
}

function resolvePromptPlaceholders(q: QuestionDef): string {
  if (!q.prompt.includes("{name}")) return q.prompt;
  const name = dependentNameFor(q);
  if (name) return q.prompt.replace(/\{name\}/g, name);
  // Fallback: drop the bracketed phrase that uses {name} so we never show the
  // raw placeholder. "support {name} each year" → "each year".
  return q.prompt.replace(/support \{name\} /g, "").replace(/\{name\}/g, "");
}

function softConfirmPrompt(q: QuestionDef): string | null {
  if (!uiState.seededQuestions.has(q.id) || !q.fieldId) return null;
  const raw = fieldState[q.fieldId];
  if (raw === null || raw === undefined || raw === "") return null;
  if (q.id === "age") return `We have you down as ${raw} — does that still feel right?`;
  if (q.kind === "currency") {
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    return `You told us ${formatCurrencyAmount(num, selectedCurrency, "en-IE")} — does that still feel right?`;
  }
  return null;
}

function applyCurrencyPrefixStyle(el: HTMLElement, currencyCode: string): void {
  const symbol = currencySymbolFor(currencyCode);
  el.textContent = symbol;
  el.classList.toggle("is-currency-code", symbol.length > 1);
}

function renderActiveCard(q: QuestionDef): HTMLElement {
  if (q.id === "livingExpenses" && uiState.livingExpensesMode === "expanded") {
    return renderLivingExpensesExpanded(q);
  }
  const { chapter, counter } = buildProgressLabels(q);
  const softPrompt = softConfirmPrompt(q);
  const resolvedPrompt = softPrompt ?? resolvePromptPlaceholders(q);
  const prev = findPreviousAnswered(q);
  const onBack = prev ? () => editChip(prev) : undefined;
  const card = createCard(resolvedPrompt !== q.prompt ? { ...q, prompt: resolvedPrompt } : q, chapter, counter, onBack);

  const errorEl = document.createElement("p");
  errorEl.className = "ob-error";
  errorEl.id = `ob-error-${q.id}`;

  const attach = (body: HTMLElement): void => { card.appendChild(body); };

  const commitAndAdvance = (): void => {
    uiState.answered.add(q.id);
    uiState.staleAnswered.delete(q.id);
    uiState.seededQuestions.delete(q.id);
    uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
    pruneStaleAnswered();
    advanceToFirstUnanswered();
    render();
    focusActiveInput();
  };

  const skipAndAdvance = (): void => {
    if (q.fieldId) fieldState[q.fieldId] = null;
    commitAndAdvance();
  };

  switch (q.kind) {
    case "integer":
    case "currency":
    case "percent": {
      const row = document.createElement("div");
      row.className = "ob-input-row";
      const prefix = document.createElement("span");
      prefix.className = "ob-input-prefix";
      if (q.kind === "currency") applyCurrencyPrefixStyle(prefix, selectedCurrency);
      const input = document.createElement("input");
      input.className = q.kind === "percent" ? "ob-input ob-input--auto" : "ob-input";
      input.type = "text";
      input.inputMode = q.kind === "currency" ? "decimal" : q.kind === "integer" ? "numeric" : "decimal";
      input.autocomplete = "off";
      input.setAttribute("data-onboarding-input", q.id);
      if (q.fieldId) input.setAttribute("data-field-id", q.fieldId);
      const initial = q.fieldId ? fieldState[q.fieldId] : null;
      input.value = formatInputInitial(q, initial);
      row.appendChild(prefix);
      row.appendChild(input);
      if (q.kind === "percent") {
        const suffix = document.createElement("span");
        suffix.className = "ob-input-suffix";
        suffix.textContent = "%";
        row.appendChild(suffix);
        row.addEventListener("mousedown", (ev) => {
          if (ev.target === input) return;
          ev.preventDefault();
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);
        });
      }
      attach(row);
      attach(errorEl);
      const actions = buildActions(q, () => {
        if (q.skippable && input.value.trim() === "") { skipAndAdvance(); return; }
        if (q.blankAsZero && input.value.trim() === "") {
          if (q.fieldId) fieldState[q.fieldId] = 0;
          commitAndAdvance();
          return;
        }
        const parsed = parseNumeric(q.kind, input.value);
        if (parsed.error) { errorEl.textContent = parsed.error; return; }
        if (parsed.value !== null) {
          const rangeError = validateNumericValue(q, parsed.value);
          if (rangeError) { errorEl.textContent = rangeError; return; }
        }
        if (q.fieldId) fieldState[q.fieldId] = parsed.value;
        if (q.assumption && parsed.value !== null) {
          const fieldDefault = getDefaultForField(q.fieldId);
          if (fieldDefault !== null && Math.abs(parsed.value - fieldDefault) < 1e-6) {
            uiState.acceptedAssumptions.add(q.id);
          } else {
            uiState.acceptedAssumptions.delete(q.id);
          }
        }
        commitAndAdvance();
      }, skipAndAdvance);
      attach(actions);
      if (q.id === "livingExpenses") attach(buildBreakItDownLink());
      input.addEventListener("keydown", (ev) => {
        if ((ev as KeyboardEvent).key === "Enter") {
          ev.preventDefault();
          (actions.querySelector<HTMLButtonElement>("[data-onboarding-continue]"))?.click();
        }
      });
      break;
    }
    case "text": {
      if (q.id === "handoff") break;
      const row = document.createElement("div");
      row.className = "ob-input-row";
      const input = document.createElement("input");
      input.className = "ob-input";
      input.type = "text";
      input.setAttribute("data-onboarding-input", q.id);
      if (q.fieldId) input.setAttribute("data-field-id", q.fieldId);
      const initial = q.fieldId ? String(fieldState[q.fieldId] ?? "") : "";
      input.value = initial;
      row.appendChild(input);
      attach(row);
      attach(errorEl);
      const actions = buildActions(q, () => {
        const v = input.value.trim();
        if (v === "") { errorEl.textContent = "A short name helps keep the picture clear."; return; }
        if (v.length > 60) { errorEl.textContent = "Try to keep the name under 60 characters."; return; }
        if (q.fieldId) fieldState[q.fieldId] = v;
        commitAndAdvance();
      }, skipAndAdvance);
      attach(actions);
      input.addEventListener("keydown", (ev) => {
        if ((ev as KeyboardEvent).key === "Enter") {
          ev.preventDefault();
          (actions.querySelector<HTMLButtonElement>("[data-onboarding-continue]"))?.click();
        }
      });
      break;
    }
    case "yesNo": {
      const chips = document.createElement("div");
      chips.className = "ob-chips";
      for (const opt of ["Yes", "No"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ob-chip-btn";
        btn.textContent = opt;
        btn.setAttribute("data-onboarding-yesno", q.id);
        btn.setAttribute("data-onboarding-option", opt.toUpperCase());
        btn.addEventListener("click", () => {
          if (q.gateId) uiState.gates[q.gateId] = opt.toUpperCase() === "YES" ? "YES" : "NO";
          if (q.fieldId) fieldState[q.fieldId] = opt;
          if (q.id === "hasMortgage" && opt === "No") {
            fieldState["housing.01Residence.mortgage.balance"] = null;
            fieldState["housing.01Residence.mortgage.interestRateAnnual"] = null;
            fieldState["housing.01Residence.mortgage.monthlyRepayment"] = null;
          }
          uiState.answered.add(q.id);
          uiState.staleAnswered.delete(q.id);
          uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
          pruneStaleAnswered();
          advanceToFirstUnanswered();
          render();
          focusActiveInput();
        });
        chips.appendChild(btn);
      }
      attach(chips);
      attachChipKeyShortcuts(chips);
      break;
    }
    case "ownerRenter": {
      const chips = document.createElement("div");
      chips.className = "ob-chips";
      for (const opt of ["Owner", "Renter"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ob-chip-btn";
        btn.textContent = opt;
        btn.setAttribute("data-onboarding-option", opt.toUpperCase());
        btn.setAttribute("data-toggle-field-id", "housing.status");
        btn.setAttribute("data-toggle-option", opt);
        btn.addEventListener("click", () => {
          if (q.fieldId) fieldState[q.fieldId] = opt;
          uiState.gates["housingStatus"] = opt === "Owner" ? "YES" : "NO";
          if (opt === "Renter") {
            fieldState["housing.01Residence.marketValue"] = null;
            fieldState["housing.01Residence.mortgage.balance"] = null;
            fieldState["housing.01Residence.mortgage.interestRateAnnual"] = null;
            fieldState["housing.01Residence.mortgage.monthlyRepayment"] = null;
          } else {
            fieldState["housing.rentAnnual"] = null;
          }
          uiState.answered.add(q.id);
          uiState.staleAnswered.delete(q.id);
          uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
          pruneStaleAnswered();
          advanceToFirstUnanswered();
          render();
          focusActiveInput();
        });
        chips.appendChild(btn);
      }
      attach(chips);
      attachChipKeyShortcuts(chips);
      break;
    }
    case "spendingTaper": {
      const chips = document.createElement("div");
      chips.className = "ob-chips";
      for (const opt of [
        { label: "Taper", tag: "TAPER" },
        { label: "Steady",  tag: "STEADY" }
      ]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ob-chip-btn";
        btn.textContent = opt.label;
        btn.setAttribute("data-onboarding-option", opt.tag);
        btn.addEventListener("click", () => {
          if (opt.tag === "TAPER") {
            fieldState["spending.adjustments.firstBracket.endAge"] = SPENDING_TAPER_DEFAULTS.firstEndAge;
            fieldState["spending.adjustments.secondBracket.endAge"] = SPENDING_TAPER_DEFAULTS.secondEndAge;
            fieldState["spending.adjustments.firstBracket.deltaRate"] = SPENDING_TAPER_DEFAULTS.firstDelta;
            fieldState["spending.adjustments.secondBracket.deltaRate"] = SPENDING_TAPER_DEFAULTS.secondDelta;
            fieldState["spending.adjustments.finalBracket.deltaRate"] = SPENDING_TAPER_DEFAULTS.finalDelta;
          } else {
            fieldState["spending.adjustments.firstBracket.deltaRate"] = 0;
            fieldState["spending.adjustments.secondBracket.deltaRate"] = 0;
            fieldState["spending.adjustments.finalBracket.deltaRate"] = 0;
          }
          uiState.answered.add(q.id);
          uiState.staleAnswered.delete(q.id);
          pruneStaleAnswered();
          advanceToFirstUnanswered();
          render();
          focusActiveInput();
        });
        chips.appendChild(btn);
      }
      attach(chips);
      attachChipKeyShortcuts(chips);
      break;
    }
    case "downsizingMode": {
      const chips = document.createElement("div");
      chips.className = "ob-chips";
      for (const opt of ["Buy", "Rent"]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ob-chip-btn";
        btn.textContent = opt;
        btn.setAttribute("data-onboarding-option", opt.toUpperCase());
        btn.addEventListener("click", () => {
          if (q.fieldId) fieldState[q.fieldId] = opt;
          if (opt === "Buy") fieldState["housing.downsize.newRentAnnual"] = null;
          else fieldState["housing.downsize.newHomePurchaseCost"] = null;
          uiState.answered.add(q.id);
          uiState.staleAnswered.delete(q.id);
          uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
          pruneStaleAnswered();
          advanceToFirstUnanswered();
          render();
          focusActiveInput();
        });
        chips.appendChild(btn);
      }
      attach(chips);
      attachChipKeyShortcuts(chips);
      break;
    }
    case "appreciationChoice": {
      const chips = document.createElement("div");
      chips.className = "ob-chips";
      for (const opt of [
        { label: "Holding value", rate: 0 },
        { label: "Growing with inflation", rate: 0.02 },
        { label: "Slowly losing value", rate: -0.02 }
      ]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ob-chip-btn";
        btn.textContent = opt.label;
        btn.setAttribute("data-onboarding-option", opt.label);
        btn.addEventListener("click", () => {
          if (q.fieldId) fieldState[q.fieldId] = opt.rate;
          uiState.answered.add(q.id);
          uiState.staleAnswered.delete(q.id);
          pruneStaleAnswered();
          advanceToFirstUnanswered();
          render();
          focusActiveInput();
        });
        chips.appendChild(btn);
      }
      attach(chips);
      attachChipKeyShortcuts(chips);
      break;
    }
  }
  return card;
}

function attachChipKeyShortcuts(chips: HTMLElement): void {
  activeKeyHandler = (ev: KeyboardEvent) => {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (ev.key.length !== 1) return;
    const key = ev.key.toLowerCase();
    const buttons = chips.querySelectorAll<HTMLButtonElement>("button.ob-chip-btn");
    for (const btn of buttons) {
      const label = (btn.textContent || "").trim();
      if (label && label[0].toLowerCase() === key) {
        ev.preventDefault();
        btn.click();
        return;
      }
    }
  };
  document.addEventListener("keydown", activeKeyHandler);
}

function buildBreakItDownLink(): HTMLElement {
  const wrap = document.createElement("p");
  wrap.className = "ob-break-it-down";
  const link = document.createElement("button");
  link.type = "button";
  link.className = "ob-link";
  link.setAttribute("data-onboarding-break-down", "true");
  link.textContent = "I'd rather break it down by category";
  link.addEventListener("click", () => {
    const total = Number(fieldState["spending.livingExpenses.annual"] ?? 0);
    if (!hasAnyLivingExpenseCategoryValue(uiState.livingExpenseCategoryValues) && total > 0) {
      uiState.livingExpenseCategoryValues = seedLivingExpenseCategoryValuesFromTotal(total);
    }
    uiState.livingExpensesMode = "expanded";
    render();
    focusActiveInput();
  });
  wrap.appendChild(link);
  return wrap;
}

function renderLivingExpensesExpanded(q: QuestionDef): HTMLElement {
  const { chapter, counter } = buildProgressLabels(q);
  const card = createCard({
    ...q,
    prompt: "Let's break it down — roughly what do you spend on each, in a year?",
    helper: "Skip categories that don't apply. We'll add up the total for the projection."
  }, chapter, counter);

  const grid = document.createElement("div");
  grid.className = "ob-le-grid";

  const inputs: Array<{ id: LivingExpenseCategoryId; el: HTMLInputElement }> = [];
  for (const { id, label } of LIVING_EXPENSE_CATEGORY_DEFINITIONS) {
    const row = document.createElement("label");
    row.className = "ob-le-row";
    const lbl = document.createElement("span");
    lbl.className = "ob-le-label";
    lbl.textContent = label;
    const inputWrap = document.createElement("span");
    inputWrap.className = "ob-le-input-wrap";
    const prefix = document.createElement("span");
    prefix.className = "ob-le-prefix";
    applyCurrencyPrefixStyle(prefix, selectedCurrency);
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.className = "ob-le-input";
    input.setAttribute("data-onboarding-le-category", id);
    const v = uiState.livingExpenseCategoryValues[id];
    input.value = v === null || v === undefined ? "" : String(Math.round(v));
    inputWrap.appendChild(prefix);
    inputWrap.appendChild(input);
    row.appendChild(lbl);
    row.appendChild(inputWrap);
    grid.appendChild(row);
    inputs.push({ id, el: input });
  }
  card.appendChild(grid);

  const totalEl = document.createElement("p");
  totalEl.className = "ob-le-total";
  const updateTotal = (): void => {
    let sum = 0;
    for (const { el } of inputs) {
      const n = Number(el.value.replace(/[^\d.+-]/g, ""));
      if (Number.isFinite(n)) sum += n;
    }
    totalEl.textContent = `Total: ${formatCurrencyAmount(sum, selectedCurrency, "en-IE")} a year`;
  };
  updateTotal();
  for (const { el } of inputs) el.addEventListener("input", updateTotal);
  card.appendChild(totalEl);

  const errorEl = document.createElement("p");
  errorEl.className = "ob-error";
  errorEl.id = `ob-error-${q.id}`;
  card.appendChild(errorEl);

  const actions = document.createElement("div");
  actions.className = "ob-actions";
  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-primary";
  continueBtn.setAttribute("data-onboarding-continue", q.id);
  continueBtn.textContent = "Continue →";
  continueBtn.addEventListener("click", () => {
    const next = createEmptyLivingExpenseCategoryValues();
    let anyValue = false;
    for (const { id, el } of inputs) {
      const trimmed = el.value.trim();
      if (trimmed === "") { next[id] = null; continue; }
      const n = Number(trimmed.replace(/[^\d.+-]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        errorEl.textContent = "One of the categories doesn't look like a number.";
        return;
      }
      next[id] = n;
      if (n > 0) anyValue = true;
    }
    if (!anyValue) {
      errorEl.textContent = "Add at least one category, or switch back to a single number.";
      return;
    }
    uiState.livingExpenseCategoryValues = next;
    fieldState["spending.livingExpenses.annual"] = sumLivingExpenseCategoryValues(next);
    uiState.answered.add(q.id);
    uiState.staleAnswered.delete(q.id);
    uiState.seededQuestions.delete(q.id);
    uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
    pruneStaleAnswered();
    advanceToFirstUnanswered();
    render();
    focusActiveInput();
  });
  actions.appendChild(continueBtn);
  card.appendChild(actions);

  const switchBack = document.createElement("p");
  switchBack.className = "ob-break-it-down";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ob-link";
  back.textContent = "Back to a single number";
  back.addEventListener("click", () => {
    uiState.livingExpensesMode = "single";
    render();
    focusActiveInput();
  });
  switchBack.appendChild(back);
  card.appendChild(switchBack);

  return card;
}

function renderHandoffCard(): HTMLElement {
  const age = resolveEarliestAge();
  const card = document.createElement("section");
  card.className = "ob-card ob-card-handoff";
  card.setAttribute("data-onboarding-card", "handoff");
  const ageBlock = age !== null
    ? `<p class="ob-handoff-label">You could stop working at</p>
       <div class="ob-handoff-age">${age}</div>`
    : `<p class="ob-handoff-label">Your picture is ready</p>`;
  card.innerHTML = `
    <p class="ob-eyebrow">That's the picture</p>
    ${ageBlock}
    <p class="ob-helper ob-handoff-helper">
      There's more you can explore in the full model — stock-market downturns, one-off future events,
      the order we'd sell things in if you needed to. None of it is required.
    </p>
    <div class="ob-actions ob-handoff-actions">
      <button type="button" class="btn btn-primary" data-onboarding-handoff>Take me to the full calculator →</button>
      <button type="button" class="ob-skip" data-onboarding-save>save and come back later</button>
      <span class="ob-saved-toast" data-onboarding-saved-toast aria-live="polite"></span>
    </div>
  `;
  card.querySelector<HTMLButtonElement>("[data-onboarding-handoff]")?.addEventListener("click", () => {
    writeDraftFromOnboarding(
      fieldState,
      modelUiState.earlyRetirementAge,
      uiState.livingExpensesMode,
      uiState.livingExpenseCategoryValues,
      selectedCurrency
    );
    clearOnboardingState();
    clearQuickEstimateSeed();
    navigateToCalculator();
  });
  const saveBtn = card.querySelector<HTMLButtonElement>("[data-onboarding-save]");
  const toast = card.querySelector<HTMLElement>("[data-onboarding-saved-toast]");
  let toastHandle: number | null = null;
  saveBtn?.addEventListener("click", () => {
    writeDraftFromOnboarding(
      fieldState,
      modelUiState.earlyRetirementAge,
      uiState.livingExpensesMode,
      uiState.livingExpenseCategoryValues,
      selectedCurrency
    );
    if (toast) {
      toast.textContent = "Saved on this device — pick up here next visit.";
      toast.setAttribute("data-visible", "true");
      if (toastHandle !== null) window.clearTimeout(toastHandle);
      toastHandle = window.setTimeout(() => {
        toast?.removeAttribute("data-visible");
        toastHandle = null;
      }, 3200);
    }
  });
  return card;
}

function buildActions(q: QuestionDef, onContinue: () => void, onSkip: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "ob-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-primary";
  btn.setAttribute("data-onboarding-continue", q.id);
  btn.textContent = "Continue →";
  btn.addEventListener("click", onContinue);
  wrap.appendChild(btn);
  if (q.skippable) {
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "ob-skip";
    skip.setAttribute("data-onboarding-skip", q.id);
    skip.textContent = "skip for now";
    skip.addEventListener("click", onSkip);
    wrap.appendChild(skip);
  }
  return wrap;
}

function buildProgressLabels(q: QuestionDef): { chapter: string; counter: string } {
  const activeList = sequence.filter((s) => isQuestionActive(s, ctx()) && s.id !== "handoff");
  const sameChapter = activeList.filter((s) => s.chapterTitle === q.chapterTitle);
  const chapterIdx = sameChapter.findIndex((s) => s.id === q.id);
  const chapterPos = chapterIdx >= 0 ? chapterIdx + 1 : 1;
  const chapterTotal = sameChapter.length || chapterPos;
  return {
    chapter: q.chapterTitle.toUpperCase(),
    counter: `${chapterPos} of ${chapterTotal}`
  };
}

function formatLimit(kind: QuestionDef["kind"], value: number): string {
  if (kind === "percent") return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
  if (kind === "currency") return formatCurrencyAmount(value, selectedCurrency, "en-IE");
  return String(value);
}

function validateNumericValue(q: QuestionDef, value: number): string | null {
  if (!Number.isFinite(value)) return "That doesn't look like a number.";

  // Sanity cap independent of any field-specific rule.
  if (q.kind === "percent" && Math.abs(value) > 1) {
    // parseNumeric divides values >1 by 100, so a remaining magnitude >1 means
    // the user really did mean something like 500% — almost always a typo.
    return "That rate looks too high — enter as a percent, e.g. 4.5 for 4.5%.";
  }

  const rule = q.fieldId ? FIELD_VALIDATION_RULES[q.fieldId] : undefined;
  if (rule) {
    if (rule.integer && !Number.isInteger(value)) return "Needs to be a whole number.";
    if (rule.positive && value <= 0) return "Needs to be greater than zero.";
    if (rule.nonNegative && value < 0) return "Can't be negative.";
    if (rule.clampBounds?.min !== undefined && value < rule.clampBounds.min) {
      return `Needs to be at least ${formatLimit(q.kind, rule.clampBounds.min)}.`;
    }
    if (rule.clampBounds?.max !== undefined && value > rule.clampBounds.max) {
      return `Needs to be at most ${formatLimit(q.kind, rule.clampBounds.max)}.`;
    }
    if (q.kind === "percent" && value <= -1) return "Can't be -100% or lower.";
  } else if (q.kind === "currency") {
    // Default: currency amounts can't be negative.
    if (value < 0) return "Can't be negative.";
  }

  return validateCrossField(q, value);
}

function validateCrossField(q: QuestionDef, value: number): string | null {
  // Only check against fields the user has actually answered. Default values
  // (e.g. statutory age default of 65) must not block earlier questions, since
  // the user hasn't seen the helper text or constraints for them yet.
  const answered = uiState.answered;

  switch (q.fieldId) {
    case "retirement.statutoryAge": {
      // Current age is always answered first in the sequence.
      const ageNow = Number(fieldState["profile.currentAge"] ?? NaN);
      if (Number.isFinite(ageNow) && value <= ageNow) {
        return `Needs to be later than your current age (${ageNow}). Edit that step if you'd like to adjust.`;
      }
      if (answered.has("partnerAge")) {
        const partnerAge = Number(fieldState["partner.profile.currentAge"] ?? NaN);
        if (Number.isFinite(partnerAge) && value <= partnerAge) {
          return `Needs to be later than your partner's age (${partnerAge}).`;
        }
      }
      break;
    }
    case "profile.currentAge":
    case "partner.profile.currentAge": {
      // Only fires when re-editing age after statutory was answered (rare,
      // since editing a chip clears later answers).
      if (!answered.has("statutoryAge")) break;
      const statutory = Number(fieldState["retirement.statutoryAge"] ?? NaN);
      if (Number.isFinite(statutory) && value >= statutory) {
        return `Needs to be less than your statutory pension age (${statutory}).`;
      }
      break;
    }
    case "housing.01Residence.mortgage.balance":
      break;
    case "housing.downsize.year": {
      const thisYear = new Date().getFullYear();
      if (value <= thisYear) {
        return `Needs to be a year after ${thisYear}.`;
      }
      const ageNowDz = Number(fieldState["profile.currentAge"] ?? NaN);
      const lifeExpectancyDz = Number(fieldState["planning.lifeExpectancyAge"] ?? NaN);
      if (Number.isFinite(ageNowDz) && Number.isFinite(lifeExpectancyDz)) {
        const maxYear = thisYear + Math.max(0, Math.round(lifeExpectancyDz - ageNowDz - 1));
        if (value > maxYear) {
          return `Needs to be on or before ${maxYear} to stay within the plan horizon.`;
        }
      }
      break;
    }
  }

  // A named dependent with zero annual cost is meaningless — calculator's
  // cross-field validator would flag this later; surface it inline instead.
  if (/^dependent\d+Cost$/.test(q.id) && value <= 0) {
    return "Needs to be greater than zero.";
  }
  const dependentYearsMatch = q.id.match(/^dependent(\d+)Years$/);
  if (dependentYearsMatch) {
    const ageNow = Number(fieldState["profile.currentAge"] ?? NaN);
    const lifeExpectancy = Number(fieldState["planning.lifeExpectancyAge"] ?? NaN);
    if (Number.isFinite(ageNow) && Number.isFinite(lifeExpectancy)) {
      const maxYears = Math.max(1, lifeExpectancy - ageNow);
      if (value > maxYears) {
        return `Needs to be ${maxYears} year${maxYears === 1 ? "" : "s"} or less to stay within the plan horizon.`;
      }
    }
  }

  return null;
}

function parseNumeric(kind: QuestionDef["kind"], raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, error: "We need a number for this one." };
  const cleaned = trimmed.replace(/%$/, "").replace(/[^\d.+-]/g, "");
  const asNum = Number(cleaned);
  if (!Number.isFinite(asNum)) return { value: null, error: "That doesn't look like a number." };
  if (kind === "percent") {
    return { value: asNum / 100, error: null };
  }
  if (kind === "integer" && !Number.isInteger(asNum)) return { value: Math.round(asNum), error: null };
  return { value: asNum, error: null };
}

function formatInputInitial(q: QuestionDef, raw: RawInputValue): string {
  if (raw === null || raw === undefined) {
    if (q.assumption && q.fieldId) {
      const def = getDefaultForField(q.fieldId);
      if (def !== null) return q.kind === "percent" ? (def * 100).toFixed(1) : String(def);
    }
    return "";
  }
  if (q.kind === "percent") {
    const asNum = Number(raw);
    if (!Number.isFinite(asNum)) return "";
    return (asNum * 100).toFixed(1);
  }
  return String(raw);
}

function getDefaultForField(fieldId: FieldId | undefined): number | null {
  if (!fieldId) return null;
  const v = getDefaultFieldValue(fieldId);
  return typeof v === "number" ? v : null;
}

function formatAnswer(q: QuestionDef): string {
  if (q.kind === "yesNo") {
    const v = q.gateId ? uiState.gates[q.gateId] : null;
    if (v) return v === "YES" ? "Yes" : "No";
    if (q.fieldId) return String(fieldState[q.fieldId] ?? "—");
    return "—";
  }
  if (q.kind === "ownerRenter") {
    return String(fieldState["housing.status"] ?? "—");
  }
  if (q.kind === "spendingTaper") {
    const first = Number(fieldState["spending.adjustments.firstBracket.deltaRate"] ?? 0);
    const second = Number(fieldState["spending.adjustments.secondBracket.deltaRate"] ?? 0);
    const final = Number(fieldState["spending.adjustments.finalBracket.deltaRate"] ?? 0);
    if (first === 0 && second === 0 && final === 0) return "Steady";
    return "Taper";
  }
  if (q.kind === "downsizingMode") {
    if (!q.fieldId) return "—";
    const v = String(fieldState[q.fieldId] ?? "").trim();
    return v || "—";
  }
  if (q.kind === "appreciationChoice") {
    if (!q.fieldId) return "—";
    const rate = Number(fieldState[q.fieldId] ?? 0);
    if (rate === 0) return "Holding value";
    if (rate > 0) return "Growing with inflation";
    return "Slowly losing value";
  }
  if (q.kind === "text") {
    if (!q.fieldId) return "—";
    const s = String(fieldState[q.fieldId] ?? "").trim();
    return s || "—";
  }
  if (q.kind === "percent") {
    if (!q.fieldId) return "—";
    const v = fieldState[q.fieldId];
    return formatPercent(typeof v === "number" ? v : null);
  }
  if (q.kind === "currency") {
    if (!q.fieldId) return "—";
    const v = fieldState[q.fieldId];
    return formatCurrency(typeof v === "number" ? v : null, selectedCurrency);
  }
  if (q.kind === "integer") {
    if (!q.fieldId) return "—";
    const v = fieldState[q.fieldId];
    return v === null || v === undefined || v === "" ? "—" : String(v);
  }
  return "—";
}

function focusActiveInput(): void {
  window.requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(
      `[data-onboarding-input="${uiState.activeQuestionId ?? ""}"]`
    );
    if (input) input.focus();
  });
}

function scheduleRun(): void {
  if (runHandle !== null) window.clearTimeout(runHandle);
  runHandle = window.setTimeout(() => {
    runHandle = null;
    runAndPaint();
  }, RUN_DEBOUNCE_MS);
}

function runAndPaint(): void {
  findEarliestSuccessfulAge();
  if (!lastRunResult) {
    try {
      lastRunResult = runModel({ ...fieldState }, modelUiState);
    } catch {
      lastRunResult = null;
    }
  }
  paintEstimate();
  paintChart();
}

let cachedEarliestAge: number | null = null;

function findEarliestSuccessfulAge(): number | null {
  cachedEarliestAge = null;
  const { age, result } = findEarliestRetirementAge(fieldState, modelUiState);
  if (age !== null) {
    modelUiState.earlyRetirementAge = age;
    lastRunResult = result;
    cachedEarliestAge = age;
    return age;
  }
  lastRunResult = result;
  return null;
}

let deltaShiftHandle: number | null = null;
function flashAgeChange(ageEl: HTMLElement, from: number, to: number): void {
  ageEl.removeAttribute("data-changed");
  // restart animation
  void ageEl.offsetWidth;
  ageEl.setAttribute("data-changed", "true");
  const shift = document.getElementById("ob-estimate-delta-shift");
  if (shift) {
    const diff = to - from;
    const sign = diff > 0 ? "+" : "";
    shift.textContent = `${sign}${diff} year${Math.abs(diff) === 1 ? "" : "s"}`;
    shift.setAttribute("data-visible", "true");
    if (deltaShiftHandle !== null) window.clearTimeout(deltaShiftHandle);
    deltaShiftHandle = window.setTimeout(() => {
      shift.removeAttribute("data-visible");
      deltaShiftHandle = window.setTimeout(() => {
        shift.textContent = "";
        deltaShiftHandle = null;
      }, 240);
    }, 1800);
  }
}

function setHeroAge(ageEl: HTMLElement, target: number | null): void {
  if (ageTweenHandle !== null) {
    window.cancelAnimationFrame(ageTweenHandle);
    ageTweenHandle = null;
  }
  if (target === null) {
    ageEl.textContent = "—";
    displayedAge = null;
    return;
  }
  const previous = displayedAge;
  if (previous !== null && previous !== target) flashAgeChange(ageEl, previous, target);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = displayedAge;
  if (start === null || reduced || start === target) {
    ageEl.textContent = String(target);
    displayedAge = target;
    return;
  }
  const startTime = performance.now();
  const from = start;
  const to = target;
  const tick = (now: number): void => {
    const t = Math.min(1, (now - startTime) / AGE_TWEEN_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = Math.round(from + (to - from) * eased);
    ageEl.textContent = String(v);
    if (t < 1) {
      ageTweenHandle = window.requestAnimationFrame(tick);
    } else {
      ageEl.textContent = String(to);
      displayedAge = to;
      ageTweenHandle = null;
    }
  };
  ageTweenHandle = window.requestAnimationFrame(tick);
}

function paintEstimate(): void {
  const ageEl = document.getElementById("ob-estimate-age");
  const placeholderEl = document.getElementById("ob-estimate-placeholder");
  const deltaEl = document.getElementById("ob-estimate-delta");
  const warningEl = document.getElementById("ob-estimate-warning");
  const panelEl = document.getElementById("ob-estimate");
  if (!ageEl || !placeholderEl || !deltaEl || !warningEl || !panelEl) return;

  const rawAge = resolveEarliestAge();
  const coreAnswered = uiState.answered.has("livingExpenses") && uiState.answered.has("cash");
  const age = coreAnswered ? rawAge : null;
  const hasAge = age !== null;
  const answeredFieldIds = new Set<string>();
  for (const q of sequence) {
    if (uiState.answered.has(q.id) && q.fieldId) answeredFieldIds.add(q.fieldId);
  }
  const hasBlockers = coreAnswered && (lastRunResult?.validationMessages.some(
    (m) => m.blocksProjection && answeredFieldIds.has(String(m.fieldId))
  ) ?? false);

  // Panel chrome (border/shadow/fill) only appears once we have a real number to show.
  if (hasAge) panelEl.setAttribute("data-has-estimate", "true");
  else panelEl.removeAttribute("data-has-estimate");

  if (!hasAge && !hasBlockers) {
    setHeroAge(ageEl, null);
    ageEl.dataset.state = "empty";
    placeholderEl.hidden = false;
    placeholderEl.textContent = pendingEstimateMessage();
    deltaEl.hidden = true;
    warningEl.hidden = true;
    return;
  }
  if (hasBlockers) {
    setHeroAge(ageEl, null);
    ageEl.dataset.state = "empty";
    placeholderEl.hidden = true;
    warningEl.hidden = false;
    warningEl.textContent = "One of the numbers needs a second look.";
    deltaEl.hidden = true;
    return;
  }
  setHeroAge(ageEl, hasAge ? age : null);
  ageEl.dataset.state = hasAge ? "value" : "empty";
  placeholderEl.hidden = true;
  warningEl.hidden = true;

  const statutory = Number(fieldState["retirement.statutoryAge"] ?? 0);
  if (hasAge && statutory && statutory > age) {
    deltaEl.hidden = false;
    const gap = statutory - age;
    deltaEl.textContent = `That's ${gap} year${gap === 1 ? "" : "s"} earlier than the statutory age of ${statutory}.`;
  } else {
    deltaEl.hidden = true;
  }
}

function pendingEstimateMessage(): string {
  if (uiState.answered.size === 0) {
    return "Your earliest possible retirement age will appear as you answer.";
  }
  const needsLiving = !uiState.answered.has("livingExpenses");
  const needsCash = !uiState.answered.has("cash");
  if (needsLiving && needsCash) {
    return "We'll have an estimate once you share your annual spending and liquid savings.";
  }
  if (needsLiving) {
    return "We'll have an estimate once you share your annual spending.";
  }
  if (needsCash) {
    return "We'll have an estimate once you share your liquid savings.";
  }
  return "A few more answers should surface an age — investments, pensions, or other assets.";
}

function paintChart(): void {
  const wrap = document.getElementById("ob-chart-wrap");
  const canvas = document.getElementById("ob-chart-canvas") as HTMLCanvasElement | null;
  if (!wrap || !canvas) return;

  const cashAnswered = uiState.answered.has("cash");
  if (!cashAnswered || !lastRunResult) {
    wrap.setAttribute("data-visible", "false");
    return;
  }
  wrap.setAttribute("data-visible", "true");
  canvasReady = true;

  const res = lastRunResult;
  const ages = res.outputs.ages;
  const cash = res.outputs.cashSeriesEarly;
  const networth = res.outputs.netWorthSeriesEarly;

  const hasNetWorthSignal =
    Number(fieldState["housing.01Residence.marketValue"] ?? 0) > 0 ||
    Number(fieldState["assets.equities.marketValue"] ?? 0) > 0 ||
    hasAnyPropertyValue() ||
    hasAnyAssetOfValue();

  const currentAge = Number(fieldState["profile.currentAge"] ?? ages[0] ?? 0);
  const series = [];
  series.push({
    values: cash,
    color: "#0f766e",
    fill: "rgba(15,118,110,0.12)",
    lineWidth: 1.5,
    label: "cash"
  });
  if (hasNetWorthSignal) {
    series.push({
      values: networth,
      color: "#1f3a35",
      lineWidth: 1.5,
      label: "net worth"
    });
  }
  drawMiniChart(canvas, { ages, currentAge, series, tooltipHost: wrap });

  const legend = document.getElementById("ob-chart-legend");
  if (legend) {
    const nw = legend.querySelector<HTMLElement>('[data-series="networth"]');
    if (nw) nw.hidden = !hasNetWorthSignal;
  }
  void canvasReady;
}

function hasAnyPropertyValue(): boolean {
  for (let i = 1; i <= 5; i += 1) {
    const pad = String(i).padStart(2, "0");
    if (Number(fieldState[`properties.${pad}.marketValue` as FieldId] ?? 0) > 0) return true;
  }
  return false;
}

function hasAnyAssetOfValue(): boolean {
  for (let i = 1; i <= 5; i += 1) {
    const pad = String(i).padStart(2, "0");
    if (Number(fieldState[`assetsOfValue.${pad}.marketValue` as FieldId] ?? 0) > 0) return true;
  }
  return false;
}

function resolveEarliestAge(): number | null {
  return cachedEarliestAge;
}

void pruneInactiveFieldState;
void applySectionActivation;
