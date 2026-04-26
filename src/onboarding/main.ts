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
  activeQuestionId: string | null;
  completed: boolean;
}

const appRoot = document.querySelector<HTMLElement>("#app");
if (!appRoot) throw new Error("Missing #app root for onboarding.");
const app: HTMLElement = appRoot;

const restored = readOnboardingState();
const fieldState: FieldState = initializeFieldState(restored);
const sequence = buildFullSequence();
const uiState: OnboardingUiState = {
  answered: new Set(restored?.ui.answered ?? []),
  staleAnswered: new Set(restored?.ui.staleAnswered ?? []),
  gates: { ...(restored?.ui.gates ?? {}) },
  acceptedAssumptions: new Set(restored?.ui.acceptedAssumptions ?? []),
  activeQuestionId: restored?.ui.activeQuestionId ?? null,
  completed: false
};

const modelUiState: ModelUiState = {
  majorFutureEventsOpen: false,
  advancedAssumptionsOpen: false,
  earlyRetirementAge: DEFAULT_EARLY_RETIREMENT_AGE,
  manualPropertyLiquidationOrder: false
};

let runHandle: number | null = null;
let lastRunResult: ReturnType<typeof runModel> | null = null;
let canvasReady = false;
let activeKeyHandler: ((ev: KeyboardEvent) => void) | null = null;

buildLayout();
wireNavJump();
advanceToFirstUnanswered();
render();
syncRestartVisibility();

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
      writeDraftFromOnboarding(fieldState, modelUiState.earlyRetirementAge);
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

function initializeFieldState(restored: PersistedOnboardingState | null): FieldState {
  const state = createEmptyFieldState();
  if (restored) {
    for (const [k, v] of Object.entries(restored.fields)) {
      state[k as keyof FieldState] = v as RawInputValue;
    }
    return state;
  }
  const seed = readQuickEstimateSeed();
  if (seed) applySeedToFields(seed, state);
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
      activeQuestionId: uiState.activeQuestionId
    }
  });
}

function buildLayout(): void {
  app.classList.add("ob-shell");
  const left = document.createElement("div");
  left.className = "ob-conversation";
  left.id = "ob-conversation";
  const right = document.createElement("aside");
  right.className = "ob-estimate";
  right.id = "ob-estimate";
  right.innerHTML = `
    <div class="ob-confidence" id="ob-confidence" hidden>
      <span class="ob-confidence-dots">
        <span class="ob-confidence-dot" data-idx="0"></span>
        <span class="ob-confidence-dot" data-idx="1"></span>
        <span class="ob-confidence-dot" data-idx="2"></span>
      </span>
      <span id="ob-confidence-label">Rough estimate · add more answers to sharpen it.</span>
    </div>
    <p class="ob-estimate-label">You could stop working at</p>
    <div class="ob-estimate-age" id="ob-estimate-age" aria-live="polite">—</div>
    <p class="ob-estimate-placeholder" id="ob-estimate-placeholder">The age will start to appear as you answer.</p>
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
  left.innerHTML = "";

  if (uiState.completed || uiState.activeQuestionId === "handoff") {
    left.appendChild(renderHandoffCard());
  } else if (uiState.activeQuestionId) {
    const active = sequence.find((s) => s.id === uiState.activeQuestionId);
    if (active) left.appendChild(renderActiveCard(active));
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
    if (ch.title) left.appendChild(createChapterDivider(ch.title));
    for (let j = ch.questions.length - 1; j >= 0; j -= 1) {
      left.appendChild(renderChip(ch.questions[j]));
    }
  }

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

function renderActiveCard(q: QuestionDef): HTMLElement {
  const progressText = buildProgressText(q);
  const card = createCard(q, progressText);

  const errorEl = document.createElement("p");
  errorEl.className = "ob-error";
  errorEl.id = `ob-error-${q.id}`;

  const attach = (body: HTMLElement): void => { card.appendChild(body); };

  const commitAndAdvance = (): void => {
    uiState.answered.add(q.id);
    uiState.staleAnswered.delete(q.id);
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
      prefix.textContent = q.kind === "currency" ? "€" : "";
      const input = document.createElement("input");
      input.className = "ob-input";
      input.type = "text";
      input.inputMode = q.kind === "currency" ? "decimal" : q.kind === "integer" ? "numeric" : "decimal";
      input.autocomplete = "off";
      input.setAttribute("data-onboarding-input", q.id);
      if (q.fieldId) input.setAttribute("data-field-id", q.fieldId);
      const initial = q.fieldId ? fieldState[q.fieldId] : null;
      input.value = formatInputInitial(q, initial);
      row.appendChild(prefix);
      row.appendChild(input);
      attach(row);
      attach(errorEl);
      const actions = buildActions(q, () => {
        if (q.skippable && input.value.trim() === "") { skipAndAdvance(); return; }
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
      activeKeyHandler = (ev: KeyboardEvent) => {
        if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        const target = ev.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        const key = ev.key.toLowerCase();
        const tag = key === "y" ? "YES" : key === "n" ? "NO" : null;
        if (!tag) return;
        ev.preventDefault();
        chips.querySelector<HTMLButtonElement>(`[data-onboarding-option="${tag}"]`)?.click();
      };
      document.addEventListener("keydown", activeKeyHandler);
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
      break;
    }
    case "spendingTaper": {
      const chips = document.createElement("div");
      chips.className = "ob-chips";
      for (const opt of [
        { label: "Taper gently", tag: "TAPER" },
        { label: "Hold steady",  tag: "STEADY" }
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
      break;
    }
  }
  return card;
}

function renderHandoffCard(): HTMLElement {
  const age = resolveEarliestAge();
  const card = document.createElement("section");
  card.className = "ob-card";
  card.setAttribute("data-onboarding-card", "handoff");
  card.innerHTML = `
    <p class="ob-eyebrow">That's the picture</p>
    <h2 class="ob-prompt">${age !== null ? `You could stop working at ${age}.` : "Your picture is ready."}</h2>
    <p class="ob-helper">
      There's more you can explore in the full model — stock-market downturns, one-off future events,
      the order we'd sell things in if you needed to. None of it is required.
    </p>
    <div class="ob-actions">
      <button type="button" class="btn btn-primary" data-onboarding-handoff>Take me to the full calculator →</button>
      <button type="button" class="ob-skip" data-onboarding-save>save and come back later</button>
    </div>
  `;
  card.querySelector<HTMLButtonElement>("[data-onboarding-handoff]")?.addEventListener("click", () => {
    writeDraftFromOnboarding(fieldState, modelUiState.earlyRetirementAge);
    clearOnboardingState();
    clearQuickEstimateSeed();
    navigateToCalculator();
  });
  card.querySelector<HTMLButtonElement>("[data-onboarding-save]")?.addEventListener("click", () => {
    writeDraftFromOnboarding(fieldState, modelUiState.earlyRetirementAge);
    (card.querySelector("[data-onboarding-save]") as HTMLElement).textContent = "saved locally";
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

function buildProgressText(q: QuestionDef): string {
  const activeList = sequence.filter((s) => isQuestionActive(s, ctx()) && s.id !== "handoff");
  const idx = activeList.findIndex((s) => s.id === q.id);
  const position = idx >= 0 ? idx + 1 : 1;
  return `${q.chapterTitle.toUpperCase()} · STEP ${position}`;
}

function formatLimit(kind: QuestionDef["kind"], value: number): string {
  if (kind === "percent") return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
  if (kind === "currency") return `€${Math.round(value).toLocaleString("en-IE")}`;
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
  const cleaned = trimmed.replace(/[€$£,\s]/g, "").replace(/%$/, "");
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
    if (first === 0 && second === 0 && final === 0) return "Hold steady";
    return "Taper gently";
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
    return formatCurrency(typeof v === "number" ? v : null);
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

function paintEstimate(): void {
  const ageEl = document.getElementById("ob-estimate-age");
  const placeholderEl = document.getElementById("ob-estimate-placeholder");
  const deltaEl = document.getElementById("ob-estimate-delta");
  const warningEl = document.getElementById("ob-estimate-warning");
  const confidenceEl = document.getElementById("ob-confidence");
  if (!ageEl || !placeholderEl || !deltaEl || !warningEl || !confidenceEl) return;

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

  if (!hasAge && !hasBlockers) {
    ageEl.textContent = "—";
    ageEl.dataset.state = "empty";
    placeholderEl.hidden = false;
    placeholderEl.textContent = pendingEstimateMessage();
    deltaEl.hidden = true;
    warningEl.hidden = true;
    confidenceEl.hidden = true;
    return;
  }
  if (hasBlockers) {
    ageEl.textContent = "—";
    ageEl.dataset.state = "empty";
    placeholderEl.hidden = true;
    warningEl.hidden = false;
    warningEl.textContent = "One of the numbers needs a second look.";
    deltaEl.hidden = true;
    return;
  }
  ageEl.textContent = hasAge ? String(age) : "—";
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

  confidenceEl.hidden = false;
  renderConfidenceDots();
}

function pendingEstimateMessage(): string {
  if (uiState.answered.size === 0) {
    return "The age will start to appear as you answer.";
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

function renderConfidenceDots(): void {
  const filled = Math.min(3, Math.floor(uiState.answered.size / 5));
  document.querySelectorAll<HTMLSpanElement>(".ob-confidence-dot").forEach((dot, i) => {
    if (i < filled) dot.setAttribute("data-filled", "true");
    else dot.removeAttribute("data-filled");
  });
  const label = document.getElementById("ob-confidence-label");
  if (label) {
    label.textContent =
      filled === 0 ? "Rough estimate · add more answers to sharpen it."
      : filled === 1 ? "Getting there · a few more answers will sharpen it."
      : filled === 2 ? "Close to a full picture."
      : "You've given us a full picture.";
  }
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
    lineWidth: 1.5
  });
  if (hasNetWorthSignal) {
    series.push({
      values: networth,
      color: "#1f3a35",
      lineWidth: 1.5
    });
  }
  drawMiniChart(canvas, { ages, currentAge, series });

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
