import { applySectionActivation, pruneInactiveFieldState } from "../model/activation";
import { runModel } from "../model/index";
import { createEmptyFieldState, getDefaultFieldValue } from "../model/inputSchema";
import { FieldState, ModelUiState, RawInputValue } from "../model/types";
import { FieldId } from "../model/fieldRegistry";
import {
  ActivationCtx,
  buildFullSequence,
  collectActiveAnswered,
  findFirstUnanswered,
  isQuestionActive,
  pruneOrphanedAnswers,
  QuestionDef
} from "./sequence";
import { createCard, createChapterDivider, createChip, formatCurrency, formatPercent } from "./render";
import { drawMiniChart } from "./chart";
import { findEarliestRetirementAge } from "../shared/findEarliestRetirementAge";
import {
  applySeedToFields,
  clearQuickEstimateSeed,
  navigateToCalculator,
  readQuickEstimateSeed,
  writeDraftFromOnboarding
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
  gates: Record<string, "YES" | "NO" | null>;
  acceptedAssumptions: Set<string>;
  activeQuestionId: string | null;
  completed: boolean;
}

const appRoot = document.querySelector<HTMLElement>("#app");
if (!appRoot) throw new Error("Missing #app root for onboarding.");
const app: HTMLElement = appRoot;

const fieldState: FieldState = initializeFieldState();
const sequence = buildFullSequence();
const uiState: OnboardingUiState = {
  answered: new Set(),
  gates: {},
  acceptedAssumptions: new Set(),
  activeQuestionId: null,
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
advanceToFirstUnanswered();
render();

function initializeFieldState(): FieldState {
  const state = createEmptyFieldState();
  const seed = readQuickEstimateSeed();
  if (seed) applySeedToFields(seed, state);
  return state;
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
    <p class="ob-estimate-label">You could stop working at</p>
    <div class="ob-estimate-age" id="ob-estimate-age" aria-live="polite">—</div>
    <p class="ob-estimate-placeholder" id="ob-estimate-placeholder">The age will start to appear as you answer.</p>
    <p class="ob-estimate-delta" id="ob-estimate-delta" hidden></p>
    <p class="ob-estimate-warning" id="ob-estimate-warning" hidden></p>
    <div class="ob-confidence" id="ob-confidence" hidden>
      <span class="ob-confidence-dots">
        <span class="ob-confidence-dot" data-idx="0"></span>
        <span class="ob-confidence-dot" data-idx="1"></span>
        <span class="ob-confidence-dot" data-idx="2"></span>
      </span>
      <span id="ob-confidence-label">Rough estimate · add more answers to sharpen it.</span>
    </div>
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
    <p class="ob-estimate-assumptions" id="ob-estimate-assumptions">
      Assuming 8% equity returns, 3% property growth. Fine-tune in the full calculator.
    </p>
  `;
  app.appendChild(left);
  app.appendChild(right);
}

function ctx(): ActivationCtx {
  return { fields: fieldState, gates: uiState.gates };
}

function advanceToFirstUnanswered(): void {
  const next = findFirstUnanswered(sequence, ctx(), uiState.answered);
  if (!next) {
    uiState.activeQuestionId = "handoff";
    uiState.completed = true;
  } else {
    uiState.activeQuestionId = next.id;
    uiState.completed = next.id === "handoff";
  }
}

function render(): void {
  const left = document.getElementById("ob-conversation");
  if (!left) return;
  if (activeKeyHandler) {
    document.removeEventListener("keydown", activeKeyHandler);
    activeKeyHandler = null;
  }
  left.innerHTML = "";

  let lastChapter: string | null = null;
  for (const q of sequence) {
    if (!isQuestionActive(q, ctx())) continue;
    if (!uiState.answered.has(q.id)) break;
    if (q.chapter !== lastChapter && q.chapterTitle) {
      left.appendChild(createChapterDivider(q.chapterTitle));
      lastChapter = q.chapter;
    }
    const chip = renderChip(q);
    left.appendChild(chip);
  }

  if (uiState.completed || uiState.activeQuestionId === "handoff") {
    left.appendChild(renderHandoffCard());
  } else if (uiState.activeQuestionId) {
    const active = sequence.find((s) => s.id === uiState.activeQuestionId);
    if (active) left.appendChild(renderActiveCard(active));
  }

  scheduleRun();
}

function renderChip(q: QuestionDef): HTMLElement {
  const formatted = formatAnswer(q);
  const assumptionText = q.assumption && uiState.acceptedAssumptions.has(q.id)
    ? `default: ${q.defaultAssumptionLabel ?? "accepted"}`
    : undefined;
  const chip = createChip(q, formatted, assumptionText);
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
  uiState.activeQuestionId = q.id;
  uiState.completed = false;
  // Mark subsequent chips as stale visually via re-render (they just disappear;
  // we remove all later answers so the user walks back through).
  const idx = sequence.findIndex((s) => s.id === q.id);
  if (idx >= 0) {
    for (let i = idx + 1; i < sequence.length; i += 1) {
      uiState.answered.delete(sequence[i].id);
      if (sequence[i].assumption) uiState.acceptedAssumptions.delete(sequence[i].id);
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
    uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
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
        const parsed = parseNumeric(q.kind, input.value);
        if (parsed.error) { errorEl.textContent = parsed.error; return; }
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
          uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
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
          uiState.answered = pruneOrphanedAnswers(sequence, ctx(), uiState.answered);
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
          uiState.acceptedAssumptions.add(q.id);
          uiState.answered.add(q.id);
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
  const total = activeList.length;
  return `${q.chapterTitle.toUpperCase()} · ${position} of ${total}`;
}

function parseNumeric(kind: QuestionDef["kind"], raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, error: "We need a number for this one." };
  const cleaned = trimmed.replace(/[€$£,\s]/g, "").replace(/%$/, "");
  const asNum = Number(cleaned);
  if (!Number.isFinite(asNum)) return { value: null, error: "That doesn't look like a number." };
  if (kind === "percent") {
    const rate = Math.abs(asNum) > 1 ? asNum / 100 : asNum;
    return { value: rate, error: null };
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
    placeholderEl.hidden = uiState.answered.size > 3;
    deltaEl.hidden = true;
    warningEl.hidden = true;
    confidenceEl.hidden = uiState.answered.size === 0;
    renderConfidenceDots();
    return;
  }
  if (hasBlockers) {
    ageEl.textContent = "—";
    placeholderEl.hidden = true;
    warningEl.hidden = false;
    warningEl.textContent = "One of the numbers needs a second look.";
    deltaEl.hidden = true;
    return;
  }
  ageEl.textContent = hasAge ? String(age) : "—";
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
