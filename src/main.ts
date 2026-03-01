import "./app.css";
import { runModel } from "./model";
import type { RunModelResult } from "./model/index";
import { FINER_DETAILS_COL_C_DEFAULTS } from "./model/inputSchema";
import { InputDefinition, INPUT_DEFINITIONS } from "./ui/inputDefinitions";
import { ModelUiState, RawInputs } from "./model/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const textCells = new Set(["B33", "B38", "B43", "B50", "B55", "B60", "B100", "B105", "B110", "B117", "B122", "B127"]);

const rawInputs: RawInputs = {};
for (const def of INPUT_DEFINITIONS) rawInputs[def.cell as keyof RawInputs] = null;
for (const [cell, value] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS)) {
  rawInputs[cell as keyof RawInputs] = value;
}

let uiState: ModelUiState = {
  deeperDiveOpen: false,
  finerDetailsOpen: false,
  earlyRetirementAge: 65
};

let debounceHandle: number | null = null;
let pendingFocusCell: string | null = null;

const MILESTONE_YOY_THRESHOLD = 0.2;
const MILESTONE_MAX_ITEMS = 12;
const MILESTONE_MIN_DENOMINATOR = 1;
const TIMELINE_MIN_HEIGHT = 520;
const TIMELINE_YEAR_PIXELS = 14;
const TIMELINE_MILESTONE_MIN_GAP = 16;
const TIMELINE_EDGE_PADDING = 26;
const RETIREMENT_CASH_FLOOR_EPSILON = 1e-6;

app.innerHTML = `
  <main class="layout">
    <section class="left" id="inputs-panel"></section>
    <section class="right">
      <header class="retirement-control">
        <button id="retire-check-btn" class="retire-check-btn" type="button">Can I retire early?</button>
        <p id="retire-check-result" class="retire-check-result" hidden></p>
        <div class="retirement-stepper">
          <button id="early-ret-down" class="step-btn" type="button" aria-label="Decrease early retirement age">-</button>
          <input id="early-ret-age" type="number" min="18" max="100" step="1" value="" inputmode="numeric" pattern="[0-9]*" aria-label="Early retirement age" />
          <button id="early-ret-up" class="step-btn" type="button" aria-label="Increase early retirement age">+</button>
        </div>
      </header>
      <article class="chart-card">
        <div class="chart-header">
          <h2>Cash</h2>
          <div class="chart-legend" id="cash-legend" aria-hidden="true">
            <span class="chart-legend-item">
              <span class="chart-legend-line"></span>
              <span id="cash-legend-a">Retire at early age</span>
            </span>
            <span class="chart-legend-item">
              <span class="chart-legend-line is-dashed"></span>
              <span id="cash-legend-b">Retire at statutory age</span>
            </span>
          </div>
        </div>
        <canvas id="cash-chart" width="920" height="300"></canvas>
      </article>
      <article class="chart-card">
        <div class="chart-header">
          <h2>Net Worth</h2>
          <div class="chart-legend" id="nw-legend" aria-hidden="true">
            <span class="chart-legend-item">
              <span class="chart-legend-line"></span>
              <span id="nw-legend-a">Retire at early age</span>
            </span>
            <span class="chart-legend-item">
              <span class="chart-legend-line is-dashed"></span>
              <span id="nw-legend-b">Retire at statutory age</span>
            </span>
          </div>
        </div>
        <canvas id="nw-chart" width="920" height="300"></canvas>
      </article>
    </section>
    <aside class="timeline-panel" id="timeline-panel">
      <header class="timeline-header">
        <h2>Main Events</h2>
      </header>
      <div class="timeline-scroll" id="timeline-scroll">
        <div class="timeline-track" id="timeline-track"></div>
      </div>
    </aside>
  </main>
`;

const inputsPanel = document.getElementById("inputs-panel") as HTMLDivElement;
const spinner = document.getElementById("early-ret-age") as HTMLInputElement;
const spinnerDown = document.getElementById("early-ret-down") as HTMLButtonElement;
const spinnerUp = document.getElementById("early-ret-up") as HTMLButtonElement;
const retireCheckResult = document.getElementById("retire-check-result") as HTMLParagraphElement;
const retireCheckButton = document.getElementById("retire-check-btn") as HTMLButtonElement;
const cashCanvas = document.getElementById("cash-chart") as HTMLCanvasElement;
const nwCanvas = document.getElementById("nw-chart") as HTMLCanvasElement;
const cashLegendA = document.getElementById("cash-legend-a") as HTMLSpanElement;
const cashLegendB = document.getElementById("cash-legend-b") as HTMLSpanElement;
const nwLegendA = document.getElementById("nw-legend-a") as HTMLSpanElement;
const nwLegendB = document.getElementById("nw-legend-b") as HTMLSpanElement;
const timelinePanel = document.getElementById("timeline-panel") as HTMLDivElement;
const timelineScroll = document.getElementById("timeline-scroll") as HTMLDivElement;
const timelineTrack = document.getElementById("timeline-track") as HTMLDivElement;

const sectionState = {
  quickStartOpen: true,
  deeperOpen: false,
  finerOpen: false
};

let visibleDependents = 1;
const dependent1Cells = ["B33", "B34", "B35"] as const;
const dependent2Cells = ["B38", "B39", "B40"] as const;
const dependent3Cells = ["B43", "B44", "B45"] as const;
let visibleProperties = 1;
const property1Cells = ["B50", "B51", "B52"] as const;
const property2Cells = ["B55", "B56", "B57"] as const;
const property3Cells = ["B60", "B61", "B62"] as const;
let visibleIncomeEvents = 1;
const incomeEvent1Cells = ["B100", "B101", "B102"] as const;
const incomeEvent2Cells = ["B105", "B106", "B107"] as const;
const incomeEvent3Cells = ["B110", "B111", "B112"] as const;
let visibleExpenseEvents = 1;
const expenseEvent1Cells = ["B117", "B118", "B119"] as const;
const expenseEvent2Cells = ["B122", "B123", "B124"] as const;
const expenseEvent3Cells = ["B127", "B128", "B129"] as const;
const displayOrderOverride: Record<string, number> = {
  // In Quick Start, place statutory retirement age before current age.
  B19: 3.9,
  // In "Other income", show other-work controls before rental-income controls.
  B70: 66.1,
  B71: 66.2,
  B66: 66.3,
  B67: 66.4,
  B68: 66.5,
  // In loans, show property loans before generic other loans.
  B78: 74.1,
  B79: 74.2,
  B80: 74.3,
  B83: 74.4,
  B84: 74.5,
  B85: 74.6,
  B88: 74.7,
  B89: 74.8,
  B90: 74.9
};

interface PanelCursorState {
  scrollTop: number;
  activeCell: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
}

interface TimelineMilestone {
  age: number;
  year: number;
  cashPct: number | null;
  netWorthPct: number | null;
  magnitude: number;
  label: string;
  notes: string[];
}

interface TimelineYearEvent {
  label: string;
  amount: number | null;
}

function isNonZeroNumber(v: unknown): boolean {
  return !isBlank(v) && asNumber(v) !== 0;
}

function isPositiveNumber(v: unknown): boolean {
  return asNumber(v) > 0;
}

function shouldRerenderOnInput(cell: string, prevValue: unknown, nextValue: unknown): boolean {
  switch (cell) {
    case "B12":
      return isPositiveNumber(prevValue) !== isPositiveNumber(nextValue);
    case "B15":
    case "B78":
    case "B83":
    case "B88":
    case "B93":
    case "B33":
    case "B38":
    case "B43":
    case "B100":
    case "B105":
    case "B110":
    case "B117":
    case "B122":
    case "B127":
      return isBlank(prevValue) !== isBlank(nextValue);
    case "B50":
    case "B55":
    case "B60":
      return String(prevValue ?? "") !== String(nextValue ?? "");
    case "B70":
      return isNonZeroNumber(prevValue) !== isNonZeroNumber(nextValue);
    case "B141":
      return isPositiveNumber(prevValue) !== isPositiveNumber(nextValue);
    default:
      return false;
  }
}

function isDuplicateLiquidationRank(cell: string, nextValue: unknown): boolean {
  if (!["B166", "B167", "B168"].includes(cell)) return false;
  const rank = Number(nextValue);
  if (!Number.isInteger(rank) || rank <= 0) return false;
  for (const c of ["B166", "B167", "B168"] as const) {
    if (c === cell) continue;
    const existing = Number(rawInputs[c]);
    if (Number.isInteger(existing) && existing > 0 && existing === rank) {
      return true;
    }
  }
  return false;
}

function isOutOfRangeLiquidationRank(cell: string, nextValue: unknown): boolean {
  if (!["B166", "B167", "B168"].includes(cell)) return false;
  if (nextValue === null || nextValue === undefined || String(nextValue).trim() === "") return false;
  const rank = Number(nextValue);
  if (!Number.isInteger(rank)) return true;
  return rank < 0 || rank > 3;
}

function capturePanelCursorState(): PanelCursorState {
  const active = document.activeElement as HTMLInputElement | null;
  const inPanel = !!active && inputsPanel.contains(active) && active.matches("input[data-cell]");
  const supportsSelection = inPanel && active!.type !== "number";
  return {
    scrollTop: inputsPanel.scrollTop,
    activeCell: inPanel ? active!.dataset.cell ?? null : null,
    selectionStart: supportsSelection ? active!.selectionStart : null,
    selectionEnd: supportsSelection ? active!.selectionEnd : null
  };
}

function restorePanelCursorState(state: PanelCursorState): void {
  inputsPanel.scrollTop = state.scrollTop;
  if (!state.activeCell) return;
  const input = inputsPanel.querySelector<HTMLInputElement>(`input[data-cell="${state.activeCell}"]`);
  if (!input) return;
  input.focus({ preventScroll: true });
  if (input.type !== "number" && state.selectionStart !== null && state.selectionEnd !== null) {
    input.setSelectionRange(state.selectionStart, state.selectionEnd);
  }
}

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "";
}

function anyValue(cells: readonly string[]): boolean {
  for (const cell of cells) {
    const v = rawInputs[cell as keyof RawInputs];
    if (!isBlank(v)) return true;
  }
  return false;
}

function asNumber(v: unknown): number {
  if (v === null || v === undefined || String(v).trim() === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function syncTimelineLabelTooltipState(): void {
  const labels = timelineTrack.querySelectorAll<HTMLElement>(".timeline-item-label");
  labels.forEach((label) => {
    const truncated = label.scrollWidth > label.clientWidth + 1;
    const title = label.closest<HTMLElement>(".timeline-item-title");
    if (!title) return;
    if (truncated) title.dataset.tooltipActive = "true";
    else delete title.dataset.tooltipActive;
  });
}

function safeYoYChange(nextValue: number, prevValue: number): number {
  const denominator = Math.max(MILESTONE_MIN_DENOMINATOR, Math.abs(nextValue), Math.abs(prevValue));
  return (nextValue - prevValue) / denominator;
}

function normalizeTimelineLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  if (/^stock sale executed$/i.test(trimmed)) return "Sell stocks";

  const saleMatch = /^sale of (.+?) property$/i.exec(trimmed);
  if (saleMatch) {
    return `Sell ${saleMatch[1]} property`;
  }

  return trimmed;
}

function formatImpact(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount)) return "";
  const k = Math.round(amount / 1000);
  const sign = k < 0 ? "-" : "";
  return `${sign}${Math.abs(k).toLocaleString("en-US")}k`;
}

function composeTimelineLabel(events: TimelineYearEvent[]): string {
  const unique = events.filter((event, idx, arr) =>
    arr.findIndex((x) => x.label === event.label && x.amount === event.amount) === idx
  );
  const propertySales: Array<{ name: string; amount: number | null }> = [];
  const others: TimelineYearEvent[] = [];
  let hasStockSale = false;
  let stockSaleAmount = 0;

  for (const event of unique) {
    if (/^sell stocks$/i.test(event.label)) {
      hasStockSale = true;
      stockSaleAmount += event.amount ?? 0;
      continue;
    }
    const propMatch = /^sell (.+) property$/i.exec(event.label);
    if (propMatch) {
      propertySales.push({ name: propMatch[1], amount: event.amount });
      continue;
    }
    others.push(event);
  }

  const parts: string[] = [];
  if (hasStockSale) {
    const amountText = formatImpact(stockSaleAmount);
    parts.push(amountText ? `Sell stocks (${amountText})` : "Sell stocks");
  }
  if (propertySales.length === 1) {
    const sale = propertySales[0];
    const amountText = formatImpact(sale.amount);
    parts.push(amountText ? `Sell ${sale.name} (${amountText})` : `Sell ${sale.name}`);
  } else if (propertySales.length > 1) {
    const grouped = propertySales
      .map((sale) => {
        const amountText = formatImpact(sale.amount);
        return amountText ? `${sale.name} (${amountText})` : sale.name;
      })
      .join(" & ");
    parts.push(`Sell ${grouped}`);
  }
  for (const other of others) {
    const amountText = formatImpact(other.amount);
    parts.push(amountText ? `${other.label} (${amountText})` : other.label);
  }

  return parts.join(" + ");
}

function collectSpecificLabelsByYear(result: RunModelResult): Map<number, TimelineYearEvent[]> {
  const labelsByYear = new Map<number, TimelineYearEvent[]>();

  const pushLabel = (year: number, name: string, amount: number | null = null): void => {
    if (!name || !Number.isFinite(year) || year <= 0) return;
    const existing = labelsByYear.get(year) ?? [];
    existing.push({ label: name, amount });
    labelsByYear.set(year, existing);
  };

  const eventCells = [
    { nameCell: "B100", amountCell: "B101", yearCell: "B102", kind: "income" },
    { nameCell: "B105", amountCell: "B106", yearCell: "B107", kind: "income" },
    { nameCell: "B110", amountCell: "B111", yearCell: "B112", kind: "income" },
    { nameCell: "B117", amountCell: "B118", yearCell: "B119", kind: "expense" },
    { nameCell: "B122", amountCell: "B123", yearCell: "B124", kind: "expense" },
    { nameCell: "B127", amountCell: "B128", yearCell: "B129", kind: "expense" }
  ] as const;

  for (const pair of eventCells) {
    const name = String(rawInputs[pair.nameCell] ?? "").trim();
    const year = Math.round(asNumber(rawInputs[pair.yearCell]));
    const amount = Math.abs(asNumber(rawInputs[pair.amountCell]));
    const signedAmount = pair.kind === "expense" ? -amount : amount;
    pushLabel(year, name, signedAmount);
  }

  const dependentCells = [
    { nameCell: "B33", annualCostCell: "B34", yearsCell: "B35" },
    { nameCell: "B38", annualCostCell: "B39", yearsCell: "B40" },
    { nameCell: "B43", annualCostCell: "B44", yearsCell: "B45" }
  ] as const;

  const firstAge = result.outputs.ages[0];
  const firstYear = result.outputs.years[0];
  for (const dep of dependentCells) {
    const supportYears = Math.round(asNumber(rawInputs[dep.yearsCell]));
    if (supportYears <= 0) continue;
    const depName = String(rawInputs[dep.nameCell] ?? "").trim();
    const label = depName ? `${depName} support ends` : "Dependent support ends";
    const endAge = firstAge + supportYears;
    const idx = result.outputs.ages.findIndex((value) => Math.round(value) === Math.round(endAge));
    const year = idx >= 0 ? result.outputs.years[idx] : firstYear + supportYears;
    pushLabel(year, label, Math.abs(asNumber(rawInputs[dep.annualCostCell])));
  }

  const statutory = getStatutoryAge();
  if (statutory !== null && asNumber(rawInputs.B21) > 0) {
    const idx = result.outputs.ages.findIndex((value) => Math.round(value) === statutory);
    if (idx >= 0) pushLabel(result.outputs.years[idx], "State pension starts", Math.abs(asNumber(rawInputs.B21)));
  }

  for (const hint of result.outputs.scenarioEarly.milestoneHints) {
    pushLabel(hint.year, hint.label, hint.amount ?? null);
  }

  return labelsByYear;
}

function mergeMilestone(existing: TimelineMilestone, incoming: TimelineMilestone): TimelineMilestone {
  const notes = [...existing.notes];
  for (const note of incoming.notes) {
    if (!notes.includes(note)) notes.push(note);
  }
  return {
    age: existing.age,
    year: existing.year,
    cashPct: incoming.cashPct ?? existing.cashPct,
    netWorthPct: incoming.netWorthPct ?? existing.netWorthPct,
    magnitude: Math.max(existing.magnitude, incoming.magnitude),
    label: existing.label,
    notes
  };
}

function buildTimelineMilestones(result: RunModelResult): TimelineMilestone[] {
  const ages = result.outputs.ages;
  const years = result.outputs.years;
  const cash = result.outputs.cashSeriesEarly;
  const netWorth = result.outputs.netWorthSeriesEarly;
  if (ages.length === 0) return [];

  const labelsByYear = collectSpecificLabelsByYear(result);
  const byYear = new Map<number, TimelineMilestone>();

  const putMilestone = (milestone: TimelineMilestone): void => {
    const existing = byYear.get(milestone.year);
    if (!existing) {
      byYear.set(milestone.year, milestone);
      return;
    }
    byYear.set(milestone.year, mergeMilestone(existing, milestone));
  };

  for (let i = 1; i < ages.length; i += 1) {
    const cashPct = safeYoYChange(cash[i], cash[i - 1]);
    const netWorthPct = safeYoYChange(netWorth[i], netWorth[i - 1]);
    const cashAbs = Math.abs(cashPct);
    const netWorthAbs = Math.abs(netWorthPct);
    if (cashAbs < MILESTONE_YOY_THRESHOLD && netWorthAbs < MILESTONE_YOY_THRESHOLD) continue;
    const year = years[i];
    const allowedEvents = labelsByYear.get(year) ?? [];
    if (allowedEvents.length === 0) continue;
    const normalized = allowedEvents
      .map((event) => ({ ...event, label: normalizeTimelineLabel(event.label) }))
      .filter((event) => event.label.length > 0);
    if (normalized.length === 0) continue;
    const label = composeTimelineLabel(normalized);
    if (!label) continue;

    putMilestone({
      age: ages[i],
      year,
      cashPct,
      netWorthPct,
      magnitude: Math.max(cashAbs, netWorthAbs),
      label,
      notes: []
    });
  }
  const allMilestones = [...byYear.values()];
  const trimmed = allMilestones
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, MILESTONE_MAX_ITEMS);
  trimmed.sort((a, b) => a.age - b.age);
  return trimmed;
}

function renderMilestoneTimeline(result: RunModelResult): void {
  const enteredAge = Number(rawInputs.B4);
  const hasValidEnteredAge = !isBlank(rawInputs.B4) && Number.isFinite(enteredAge) && enteredAge >= 18 && enteredAge <= 100;
  timelinePanel.hidden = !hasValidEnteredAge;
  if (!hasValidEnteredAge) {
    timelineTrack.style.height = "";
    timelineTrack.innerHTML = "";
    return;
  }

  const ages = result.outputs.ages;
  const years = result.outputs.years;
  if (ages.length === 0) {
    timelineTrack.innerHTML = `<p class="timeline-empty">No timeline data available.</p>`;
    return;
  }
  const startAge = ages[0];
  const endAge = ages[ages.length - 1];
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const span = Math.max(1, endAge - startAge);
  const viewportHeight = timelineScroll.clientHeight;
  const trackHeight = Math.max(TIMELINE_MIN_HEIGHT, viewportHeight, Math.round(span * TIMELINE_YEAR_PIXELS));
  timelineTrack.style.height = `${trackHeight}px`;

  const milestones = buildTimelineMilestones(result);
  const topPad = TIMELINE_EDGE_PADDING;
  const bottomPad = TIMELINE_EDGE_PADDING;
  const usable = Math.max(1, trackHeight - topPad - bottomPad);
  const positioned = milestones.map((item) => {
    const ratio = (item.age - startAge) / span;
    const y = topPad + (1 - Math.max(0, Math.min(1, ratio))) * usable;
    return { ...item, y };
  });
  const minGap = window.matchMedia("(max-width: 960px)").matches
    ? Math.max(TIMELINE_MILESTONE_MIN_GAP, 18)
    : TIMELINE_MILESTONE_MIN_GAP;
  for (let i = 1; i < positioned.length; i += 1) {
    positioned[i].y = Math.min(positioned[i].y, positioned[i - 1].y - minGap);
  }
  for (let i = positioned.length - 2; i >= 0; i -= 1) {
    positioned[i].y = Math.max(positioned[i].y, positioned[i + 1].y + minGap);
  }
  for (const item of positioned) {
    item.y = Math.max(topPad, Math.min(trackHeight - bottomPad, item.y));
  }
  const milestonesHtml = positioned
    .map((item) => {
      return `
        <article class="timeline-milestone" style="top:${item.y.toFixed(2)}px">
          <span class="timeline-item-year">${Math.round(item.age)}</span>
          <span class="timeline-dot" aria-hidden="true"></span>
          <div class="timeline-item-title" data-full-label="${escapeHtml(item.label)}">
            <span class="timeline-item-label">${escapeHtml(item.label)}</span>
          </div>
        </article>
      `;
    })
    .join("");

  timelineTrack.innerHTML = `
    <div class="timeline-axis"></div>
    <div class="timeline-endcap timeline-endcap-top">
      <span class="timeline-end-year">${Math.round(endAge)}</span>
      <span class="timeline-end-age">${Math.round(endYear)}</span>
    </div>
    <div class="timeline-endcap timeline-endcap-bottom">
      <span class="timeline-end-year">${Math.round(startAge)}</span>
      <span class="timeline-end-age">${Math.round(startYear)}</span>
    </div>
    ${milestonesHtml}
  `;
  syncTimelineLabelTooltipState();
  requestAnimationFrame(syncTimelineLabelTooltipState);
}

function getStatutoryAge(): number | null {
  const raw = rawInputs.B19;
  if (isBlank(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 18) return null;
  return Math.round(n);
}

function updateEarlyRetirementButtons(statutory: number | null): void {
  if (statutory === null) {
    spinnerDown.disabled = true;
    spinnerUp.disabled = true;
    return;
  }

  const raw = spinner.value.trim();
  const entered = Math.round(Number(raw));
  const current = Number.isFinite(entered) ? entered : uiState.earlyRetirementAge;
  const clamped = Math.max(18, Math.min(statutory, current));
  spinnerDown.disabled = clamped <= 18;
  spinnerUp.disabled = clamped >= statutory;
}

function setRetireCheckMessage(message: string | null, tone: "positive" | "neutral" = "neutral"): void {
  if (message === null) {
    retireCheckResult.textContent = "";
    retireCheckResult.hidden = true;
    retireCheckResult.classList.remove("is-positive", "is-neutral");
    return;
  }
  retireCheckResult.textContent = message;
  retireCheckResult.classList.toggle("is-positive", tone === "positive");
  retireCheckResult.classList.toggle("is-neutral", tone === "neutral");
  retireCheckResult.hidden = false;
}

function updateRetireCheckButton(statutory: number | null): void {
  retireCheckButton.disabled = statutory === null || statutory <= 18;
}

function findEarliestRetirementAgeBeforeStatutory(statutory: number): number | null {
  const baseline = runModel(rawInputs, uiState);
  const firstProjectedAge = baseline.outputs.ages[0];
  if (!Number.isFinite(firstProjectedAge)) return null;

  const candidateStartAge = Math.max(18, Math.round(firstProjectedAge));
  const candidateEndAge = statutory - 1;
  if (candidateStartAge > candidateEndAge) return null;

  for (let candidateAge = candidateStartAge; candidateAge <= candidateEndAge; candidateAge += 1) {
    const candidateResult = runModel(rawInputs, { ...uiState, earlyRetirementAge: candidateAge });
    const startIndex = candidateResult.outputs.ages.findIndex((age) => Math.round(age) >= candidateAge);
    if (startIndex < 0) continue;
    const staysNonNegative = candidateResult.outputs.cashSeriesEarly
      .slice(startIndex)
      .every((cash) => cash >= -RETIREMENT_CASH_FLOOR_EPSILON);
    if (staysNonNegative) return candidateAge;
  }

  return null;
}

function syncEarlyRetirementControl(defaultIfEmpty: boolean): void {
  const statutory = getStatutoryAge();
  spinner.min = "18";
  if (statutory === null) {
    spinner.max = "100";
    spinner.disabled = true;
    spinner.value = "";
    updateEarlyRetirementButtons(null);
    updateRetireCheckButton(null);
    setRetireCheckMessage(null);
    return;
  }

  spinner.disabled = false;
  spinner.max = String(statutory);
  const raw = spinner.value.trim();
  if (defaultIfEmpty && raw === "") {
    uiState.earlyRetirementAge = statutory;
    spinner.value = String(statutory);
    updateEarlyRetirementButtons(statutory);
    updateRetireCheckButton(statutory);
    return;
  }
  if (raw === "") {
    updateEarlyRetirementButtons(statutory);
    updateRetireCheckButton(statutory);
    return;
  }

  const v = Math.round(Number(raw));
  if (!Number.isFinite(v)) {
    spinner.value = String(uiState.earlyRetirementAge);
    updateEarlyRetirementButtons(statutory);
    updateRetireCheckButton(statutory);
    return;
  }
  uiState.earlyRetirementAge = Math.max(18, Math.min(statutory, v));
  spinner.value = String(uiState.earlyRetirementAge);
  updateEarlyRetirementButtons(statutory);
  updateRetireCheckButton(statutory);
}

function adjustEarlyRetirementAge(delta: number): void {
  const statutory = getStatutoryAge();
  if (statutory === null) return;

  const raw = spinner.value.trim();
  const entered = Math.round(Number(raw));
  const current = Number.isFinite(entered) ? entered : uiState.earlyRetirementAge;
  uiState.earlyRetirementAge = Math.max(18, Math.min(statutory, current + delta));
  spinner.value = String(uiState.earlyRetirementAge);
  updateEarlyRetirementButtons(statutory);
  setRetireCheckMessage(null);
  queueRecalc();
}

function sanitizeNumericText(text: string, kind: "number" | "integer" | "percent"): string {
  const base = text.replace(/,/g, "").replace(/\s+/g, "");
  const src = kind === "percent" ? base.replace(/%/g, "") : base;
  let out = "";
  let hasMinus = false;
  let hasDot = false;
  for (const ch of src) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if (ch === "-" && !hasMinus && out.length === 0) {
      out += ch;
      hasMinus = true;
      continue;
    }
    if (ch === "." && kind !== "integer" && !hasDot) {
      out += ch;
      hasDot = true;
    }
  }
  return out;
}

function parseIntegerInput(text: string): number | null {
  const cleaned = sanitizeNumericText(text, "integer");
  if (cleaned === "" || cleaned === "-") return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseNumberInput(text: string): number | null {
  const cleaned = sanitizeNumericText(text, "number");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePercentInput(text: string): number | null {
  const cleaned = sanitizeNumericText(text, "percent");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

function formatFieldValue(def: InputDefinition, value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const isYearField = def.label.trim().toLowerCase() === "year";
  if (def.type === "percent") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return `${(n * 100).toFixed(2)}%`;
  }
  if (def.type === "integer" || def.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    if (isYearField) {
      return String(Math.trunc(n));
    }
    if (def.type === "integer") {
      return Math.trunc(n).toLocaleString("en-US");
    }
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(value);
}

function fieldVisible(cell: string): boolean {
  const v = (c: string) => rawInputs[c as keyof RawInputs];
  switch (cell) {
    case "B15":
      return asNumber(v("B12")) > 0;
    case "B16":
    case "B17":
      return asNumber(v("B12")) > 0 && !isBlank(v("B15"));
    case "B23":
      return isBlank(v("B12")) || asNumber(v("B12")) === 0;
    case "B34":
    case "B35":
      return !isBlank(v("B33"));
    case "B38":
      return visibleDependents >= 2 || anyValue(dependent2Cells);
    case "B39":
    case "B40":
      return (visibleDependents >= 2 || anyValue(dependent2Cells)) && !isBlank(v("B38"));
    case "B43":
      return visibleDependents >= 3 || anyValue(dependent3Cells);
    case "B44":
    case "B45":
      return (visibleDependents >= 3 || anyValue(dependent3Cells)) && !isBlank(v("B43"));
    case "B51":
    case "B52":
      return !isBlank(v("B50"));
    case "B66":
      return !isBlank(v("B50")) || !isBlank(v("B66"));
    case "B55":
      return visibleProperties >= 2 || anyValue(property2Cells);
    case "B56":
    case "B57":
      return (visibleProperties >= 2 || anyValue(property2Cells)) && !isBlank(v("B55"));
    case "B67":
      return ((visibleProperties >= 2 || anyValue(property2Cells)) && !isBlank(v("B55"))) || !isBlank(v("B67"));
    case "B60":
      return visibleProperties >= 3 || anyValue(property3Cells);
    case "B61":
    case "B62":
      return (visibleProperties >= 3 || anyValue(property3Cells)) && !isBlank(v("B60"));
    case "B68":
      return ((visibleProperties >= 3 || anyValue(property3Cells)) && !isBlank(v("B60"))) || !isBlank(v("B68"));
    case "B78":
      return !isBlank(v("B50"));
    case "B79":
    case "B80":
      return !isBlank(v("B50")) && !isBlank(v("B78"));
    case "B83":
      return !isBlank(v("B55"));
    case "B84":
    case "B85":
      return !isBlank(v("B55")) && !isBlank(v("B83"));
    case "B88":
      return !isBlank(v("B60"));
    case "B89":
    case "B90":
      return !isBlank(v("B60")) && !isBlank(v("B88"));
    case "B94":
    case "B95":
      return !isBlank(v("B93"));
    case "B166":
      return anyValue(property1Cells);
    case "B167":
      return anyValue(property2Cells);
    case "B168":
      return anyValue(property3Cells);
    case "B163":
      return asNumber(v("B12")) > 0 || anyValue(property1Cells) || anyValue(property2Cells) || anyValue(property3Cells);
    case "B147":
      return asNumber(v("B12")) > 0 || asNumber(v("B51")) > 0 || asNumber(v("B56")) > 0 || asNumber(v("B61")) > 0;
    case "B155":
      return asNumber(v("B66")) !== 0 || asNumber(v("B67")) !== 0 || asNumber(v("B68")) !== 0;
    case "B101":
    case "B102":
      return !isBlank(v("B100"));
    case "B105":
      return visibleIncomeEvents >= 2 || anyValue(incomeEvent2Cells);
    case "B106":
    case "B107":
      return (visibleIncomeEvents >= 2 || anyValue(incomeEvent2Cells)) && !isBlank(v("B105"));
    case "B110":
      return visibleIncomeEvents >= 3 || anyValue(incomeEvent3Cells);
    case "B111":
    case "B112":
      return (visibleIncomeEvents >= 3 || anyValue(incomeEvent3Cells)) && !isBlank(v("B110"));
    case "B118":
    case "B119":
      return !isBlank(v("B117"));
    case "B122":
      return visibleExpenseEvents >= 2 || anyValue(expenseEvent2Cells);
    case "B123":
    case "B124":
      return (visibleExpenseEvents >= 2 || anyValue(expenseEvent2Cells)) && !isBlank(v("B122"));
    case "B127":
      return visibleExpenseEvents >= 3 || anyValue(expenseEvent3Cells);
    case "B128":
    case "B129":
      return (visibleExpenseEvents >= 3 || anyValue(expenseEvent3Cells)) && !isBlank(v("B127"));
    case "B71":
      return !isBlank(v("B70")) && asNumber(v("B70")) !== 0;
    case "B142":
    case "B143":
      return asNumber(v("B141")) > 0;
    default:
      return true;
  }
}

function dynamicLabel(def: InputDefinition): string {
  if (def.cell === "B66") {
    const name = String(rawInputs.B50 ?? "").trim();
    return name ? `Rental income: ${name}` : "Rental income:";
  }
  if (def.cell === "B67") {
    const name = String(rawInputs.B55 ?? "").trim();
    return name ? `Rental income: ${name}` : "Rental income:";
  }
  if (def.cell === "B68") {
    const name = String(rawInputs.B60 ?? "").trim();
    return name ? `Rental income: ${name}` : "Rental income:";
  }
  if (def.cell === "B145") return "General inflation";
  if (def.cell === "B166") {
    const name = String(rawInputs.B50 ?? "").trim();
    return name || "Property 1";
  }
  if (def.cell === "B167") {
    const name = String(rawInputs.B55 ?? "").trim();
    return name || "Property 2";
  }
  if (def.cell === "B168") {
    const name = String(rawInputs.B60 ?? "").trim();
    return name || "Property 3";
  }
  return def.label;
}

function dynamicGroupTail(def: InputDefinition): string[] {
  const tail = [...def.groupTail];
  const property1LoanCells = new Set(["B78", "B79", "B80"]);
  const property2LoanCells = new Set(["B83", "B84", "B85"]);
  const property3LoanCells = new Set(["B88", "B89", "B90"]);

  if (property1LoanCells.has(def.cell)) {
    const name = String(rawInputs.B50 ?? "").trim();
    tail[0] = "Other property loans";
    tail[1] = name ? `${name} Property` : "Property 1";
  } else if (property2LoanCells.has(def.cell)) {
    const name = String(rawInputs.B55 ?? "").trim();
    tail[0] = "Other property loans";
    tail[1] = name ? `${name} Property` : "Property 2";
  } else if (property3LoanCells.has(def.cell)) {
    const name = String(rawInputs.B60 ?? "").trim();
    tail[0] = "Other property loans";
    tail[1] = name ? `${name} Property` : "Property 3";
  }

  return tail;
}

function applyFinerDefaultsIfNeeded(): void {
  for (const [cell, val] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS)) {
    const key = cell as keyof RawInputs;
    const current = rawInputs[key];
    if (isBlank(current) && val !== null && val !== undefined) {
      rawInputs[key] = val;
    }
  }
}

function renderInputs(): void {
  const cursorState = capturePanelCursorState();
  if (anyValue(dependent3Cells)) visibleDependents = Math.max(visibleDependents, 3);
  else if (anyValue(dependent2Cells)) visibleDependents = Math.max(visibleDependents, 2);
  if (anyValue(property3Cells)) visibleProperties = Math.max(visibleProperties, 3);
  else if (anyValue(property2Cells)) visibleProperties = Math.max(visibleProperties, 2);
  if (anyValue(incomeEvent3Cells)) visibleIncomeEvents = Math.max(visibleIncomeEvents, 3);
  else if (anyValue(incomeEvent2Cells)) visibleIncomeEvents = Math.max(visibleIncomeEvents, 2);
  if (anyValue(expenseEvent3Cells)) visibleExpenseEvents = Math.max(visibleExpenseEvents, 3);
  else if (anyValue(expenseEvent2Cells)) visibleExpenseEvents = Math.max(visibleExpenseEvents, 2);
  const grouped = {
    "QUICK START": INPUT_DEFINITIONS.filter((d) => d.section === "QUICK START"),
    "DEEPER DIVE": INPUT_DEFINITIONS.filter((d) => d.section === "DEEPER DIVE"),
    "FINER DETAILS": INPUT_DEFINITIONS.filter((d) => d.section === "FINER DETAILS")
  } as const;

  const block = (title: string, open: boolean, canToggle: boolean, controlsHtml: string) => {
    if (!canToggle) return `<section class="input-section"><h2>${title}</h2>${controlsHtml}</section>`;
    return `<section class="input-section"><button type="button" class="section-toggle" data-section="${title}">${open ? `Hide ${title}` : title}</button>${open ? controlsHtml : ""}</section>`;
  };

  const controls = (defs: InputDefinition[]) => {
    const orderedDefs = [...defs].sort((a, b) => {
      const ra = displayOrderOverride[a.cell] ?? a.row;
      const rb = displayOrderOverride[b.cell] ?? b.row;
      return ra - rb;
    });
    let html = "";
    let prevTop = "";
    let prevSub = "";
    for (const def of orderedDefs) {
      if (!fieldVisible(def.cell)) continue;
      const tail = dynamicGroupTail(def).map((s) => s.trim()).filter((s) => s.length > 0);
      if (tail.length === 0) {
        prevTop = "";
        prevSub = "";
      } else {
        const top = tail[0] ?? "";
        const sub = tail.slice(1).join(" > ");
        if (top && top !== prevTop) {
          const suppressTopHeading = top.toLowerCase() === "other post-retirement income";
          if (!suppressTopHeading) {
            html += `<h3 class="group-top">${top}</h3>`;
          }
          prevTop = top;
          prevSub = "";
        }
        if (sub && sub !== prevSub) {
          html += `<h4 class="group-sub">${sub}</h4>`;
          prevSub = sub;
        }
      }
      const label = dynamicLabel(def);
      const value = rawInputs[def.cell as keyof RawInputs];
      const valStr = formatFieldValue(def, value);
      const inputType = "text";
      const inputMode = def.type === "text" ? "text" : (def.type === "integer" ? "numeric" : "decimal");
      const showTooltip = !["B4", "B23"].includes(def.cell) && !!def.tooltip;
      html += `
        <label class="field" data-cell="${def.cell}">
          <span>${label}</span>
          <input data-cell="${def.cell}" type="${inputType}" inputmode="${inputMode}" value="${valStr}" placeholder="" />
          ${showTooltip ? `<small>${def.tooltip}</small>` : ""}
        </label>
      `;

      if (def.cell === "B35" && visibleDependents < 2 && !isBlank(rawInputs.B33)) {
        html += `<button type="button" class="add-dependent-btn" data-next-dependent="2">Add another dependent</button>`;
      }
      if (def.cell === "B40" && visibleDependents < 3 && !isBlank(rawInputs.B38)) {
        html += `<button type="button" class="add-dependent-btn" data-next-dependent="3">Add another dependent</button>`;
      }
      if (def.cell === "B52" && visibleProperties < 2 && !isBlank(rawInputs.B50)) {
        html += `<button type="button" class="add-property-btn" data-next-property="2">Add another property</button>`;
      }
      if (def.cell === "B57" && visibleProperties < 3 && !isBlank(rawInputs.B55)) {
        html += `<button type="button" class="add-property-btn" data-next-property="3">Add another property</button>`;
      }
      if (def.cell === "B102" && visibleIncomeEvents < 2 && !isBlank(rawInputs.B100)) {
        html += `<button type="button" class="add-event-btn" data-next-income-event="2">Add another income event</button>`;
      }
      if (def.cell === "B107" && visibleIncomeEvents < 3 && !isBlank(rawInputs.B105)) {
        html += `<button type="button" class="add-event-btn" data-next-income-event="3">Add another income event</button>`;
      }
      if (def.cell === "B119" && visibleExpenseEvents < 2 && !isBlank(rawInputs.B117)) {
        html += `<button type="button" class="add-event-btn" data-next-expense-event="2">Add another expense event</button>`;
      }
      if (def.cell === "B124" && visibleExpenseEvents < 3 && !isBlank(rawInputs.B122)) {
        html += `<button type="button" class="add-event-btn" data-next-expense-event="3">Add another expense event</button>`;
      }
    }
    return html;
  };

  const quickHtml = controls(grouped["QUICK START"]);
  const deeperHtml = controls(grouped["DEEPER DIVE"]);
  const finerHtml = controls(grouped["FINER DETAILS"]);

  inputsPanel.innerHTML =
    block("QUICK START", true, false, quickHtml) +
    block("DEEPER DIVE", sectionState.deeperOpen, true, deeperHtml) +
    block("FINER DETAILS", sectionState.finerOpen, true, finerHtml);

  inputsPanel.querySelectorAll<HTMLInputElement>("input[data-cell]").forEach((el) => {
    el.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab" || ev.shiftKey) return;
      const cell = el.dataset.cell;
      if (cell !== "B15") return;
      const balanceWillBeNonBlank = el.value.trim() !== "";
      const interestInputPresent = !!inputsPanel.querySelector<HTMLInputElement>('input[data-cell="B16"]');
      if (balanceWillBeNonBlank && !interestInputPresent) {
        pendingFocusCell = "B16";
      }
    });

    el.addEventListener("input", () => {
      const cell = el.dataset.cell as keyof RawInputs;
      const def = INPUT_DEFINITIONS.find((d) => d.cell === cell)!;
      const prevValue = rawInputs[cell];
      if (def.type === "integer") {
        const sanitized = sanitizeNumericText(el.value, "integer");
        if (sanitized !== el.value) el.value = sanitized;
      } else if (def.type === "number") {
        const sanitized = sanitizeNumericText(el.value, "number");
        if (sanitized !== el.value) el.value = sanitized;
      } else if (def.type === "percent") {
        const sanitized = sanitizeNumericText(el.value, "percent");
        if (sanitized !== el.value) el.value = sanitized;
      }

      const nextValue = def.type === "text"
        ? el.value
        : def.type === "percent"
          ? parsePercentInput(el.value)
          : def.type === "integer"
            ? parseIntegerInput(el.value)
            : parseNumberInput(el.value);

      if (isOutOfRangeLiquidationRank(String(cell), nextValue) || isDuplicateLiquidationRank(String(cell), nextValue)) {
        el.value = prevValue === null || prevValue === undefined ? "" : String(prevValue);
        return;
      }

      if (def.type === "text") {
        rawInputs[cell] = nextValue as string;
      } else {
        rawInputs[cell] = nextValue as number | null;
      }
      setRetireCheckMessage(null);
      if (String(cell) === "B19") {
        const statutory = getStatutoryAge();
        if (statutory !== null) {
          uiState.earlyRetirementAge = statutory;
          spinner.value = String(statutory);
        }
        syncEarlyRetirementControl(true);
      }
      queueRecalc();
      // For numeric dependency-driver fields, defer UI structural rerender to blur
      // to avoid caret reset behavior in number inputs.
      const rerenderNow = shouldRerenderOnInput(String(cell), prevValue, nextValue);
      if (rerenderNow) {
        renderInputs();
      }
    });
    el.addEventListener("focus", () => {
      const cell = el.dataset.cell as keyof RawInputs;
      const def = INPUT_DEFINITIONS.find((d) => d.cell === cell)!;
      const current = rawInputs[cell];
      if (def.type === "percent") {
        if (current === null || current === undefined || String(current).trim() === "") {
          el.value = "";
          return;
        }
        const n = Number(current);
        el.value = Number.isFinite(n) ? (n * 100).toFixed(2) : "";
        return;
      }
      if (def.type === "integer" || def.type === "number") {
        if (current === null || current === undefined || String(current).trim() === "") {
          el.value = "";
          return;
        }
        el.value = String(current);
      }
    });
    el.addEventListener("blur", (ev) => {
      const cell = el.dataset.cell as keyof RawInputs;
      const def = INPUT_DEFINITIONS.find((d) => d.cell === cell)!;
      if (String(cell) === "B4" && rawInputs.B4 !== null && rawInputs.B4 !== undefined) {
        const age = Number(rawInputs.B4);
        if (Number.isFinite(age)) {
          rawInputs.B4 = Math.max(18, Math.min(100, Math.round(age)));
          queueRecalc();
        }
      }
      if (def.type === "percent" || def.type === "integer" || def.type === "number") {
        el.value = formatFieldValue(def, rawInputs[cell]);
      }
      if (def.type === "text") return;
      if (["B12", "B15", "B70", "B141"].includes(String(cell))) {
        const next = ev.relatedTarget as HTMLElement | null;
        const nextCell = next?.getAttribute?.("data-cell");
        renderInputs();
        if (pendingFocusCell) {
          const pendingInput = inputsPanel.querySelector<HTMLInputElement>(`input[data-cell="${pendingFocusCell}"]`);
          pendingFocusCell = null;
          if (pendingInput) {
            pendingInput.focus({ preventScroll: true });
            return;
          }
        }
        if (nextCell) {
          const nextInput = inputsPanel.querySelector<HTMLInputElement>(`input[data-cell="${nextCell}"]`);
          if (nextInput) nextInput.focus({ preventScroll: true });
        }
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".section-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      if (section === "DEEPER DIVE") {
        if (sectionState.deeperOpen) {
          sectionState.deeperOpen = false;
          uiState.deeperDiveOpen = false;
        } else {
          sectionState.deeperOpen = true;
          uiState.deeperDiveOpen = true;
        }
      }
      if (section === "FINER DETAILS") {
        if (sectionState.finerOpen) {
          sectionState.finerOpen = false;
          uiState.finerDetailsOpen = false;
        } else {
          sectionState.finerOpen = true;
          uiState.finerDetailsOpen = true;
          applyFinerDefaultsIfNeeded();
        }
      }
      setRetireCheckMessage(null);
      queueRecalc();
      renderInputs();
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".add-dependent-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.nextDependent);
      if (Number.isFinite(next)) {
        visibleDependents = Math.max(visibleDependents, Math.min(3, next));
        renderInputs();
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".add-property-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.nextProperty);
      if (Number.isFinite(next)) {
        visibleProperties = Math.max(visibleProperties, Math.min(3, next));
        renderInputs();
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".add-event-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextIncome = Number(btn.dataset.nextIncomeEvent);
      if (Number.isFinite(nextIncome)) {
        visibleIncomeEvents = Math.max(visibleIncomeEvents, Math.min(3, nextIncome));
        renderInputs();
        return;
      }
      const nextExpense = Number(btn.dataset.nextExpenseEvent);
      if (Number.isFinite(nextExpense)) {
        visibleExpenseEvents = Math.max(visibleExpenseEvents, Math.min(3, nextExpense));
        renderInputs();
      }
    });
  });

  restorePanelCursorState(cursorState);
}

function drawChart(
  canvas: HTMLCanvasElement,
  x: number[],
  a: number[],
  b: number[],
  labelA: string,
  labelB: string
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const pad = { l: 64, r: 24, t: 26, b: 34 };
  const allY = [...a, ...b];
  const rawMinY = Math.min(...allY);
  const rawMaxY = Math.max(...allY);
  const axisHasMeaningfulRange = Math.abs(rawMaxY - rawMinY) > 1e-6 || Math.abs(rawMaxY) > 1e-6 || Math.abs(rawMinY) > 1e-6;

  const targetTicks = 6;
  const rawSpan = rawMaxY - rawMinY;
  const effectiveSpan = rawSpan === 0 ? Math.max(Math.abs(rawMaxY), 1) : rawSpan;

  const niceStep = (v: number): number => {
    const safe = Math.max(v, 1e-9);
    const exp = Math.floor(Math.log10(safe));
    const base = 10 ** exp;
    const f = safe / base;
    const niceF = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return niceF * base;
  };

  const formatEuroAbbrev = (value: number): string => {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) {
      const scaled = abs / 1_000_000_000;
      const digits = scaled >= 10 ? 1 : 2;
      return `${sign}€${Number(scaled.toFixed(digits)).toLocaleString("en-US")}b`;
    }
    if (abs >= 1_000_000) {
      const scaled = abs / 1_000_000;
      const digits = scaled >= 10 ? 1 : 2;
      return `${sign}€${Number(scaled.toFixed(digits)).toLocaleString("en-US")}m`;
    }
    if (abs >= 1_000) {
      const scaled = abs / 1_000;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${sign}€${Number(scaled.toFixed(digits)).toLocaleString("en-US")}k`;
    }
    return `${sign}€${Math.round(abs).toLocaleString("en-US")}`;
  };

  let tickStep = niceStep(effectiveSpan / targetTicks);
  let yMinTick = Math.floor(rawMinY / tickStep) * tickStep;
  let yMaxTick = Math.ceil(rawMaxY / tickStep) * tickStep;
  while ((yMaxTick - yMinTick) / tickStep > 8) {
    tickStep = niceStep(tickStep * 1.5);
    yMinTick = Math.floor(rawMinY / tickStep) * tickStep;
    yMaxTick = Math.ceil(rawMaxY / tickStep) * tickStep;
  }

  const minY = yMinTick;
  const maxY = yMaxTick;
  const ySpan = maxY - minY || 1;
  const xp = (i: number) => pad.l + (i / Math.max(1, x.length - 1)) * (w - pad.l - pad.r);
  const yp = (v: number) => h - pad.b - ((v - minY) / ySpan) * (h - pad.t - pad.b);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const primaryColor = "#0284c7";
  const comparisonColor = "#ea580c";

  if (rawMinY < 0) {
    const yZero = yp(0);
    const yBottom = h - pad.b;
    if (yBottom > yZero) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.045)";
      ctx.fillRect(pad.l, yZero, w - pad.l - pad.r, yBottom - yZero);
    }
  }

  if (axisHasMeaningfulRange) {
    for (let yv = yMinTick; yv <= yMaxTick + 0.5; yv += tickStep) {
      const yy = yp(yv);
      if (Math.abs(yv) < tickStep * 0.001) continue;
      ctx.strokeStyle = "rgba(100, 116, 139, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(w - pad.r, yy);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "#cfd8e3";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(pad.l, h - pad.b);
  ctx.lineTo(w - pad.r, h - pad.b);
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, h - pad.b);
  ctx.stroke();

  const plot = (series: number[], color: string, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dash);
    ctx.beginPath();
    series.forEach((v, i) => {
      const xx = xp(i);
      const yy = yp(v);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Draw early as solid and statutory as dashed so both remain visible
  // even when they overlap closely.
  plot(a, primaryColor);
  plot(b, comparisonColor, [10, 6]);

  if (rawMinY < 0 && rawMaxY > 0) {
    const y0 = yp(0);
    ctx.save();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pad.l, y0);
    ctx.lineTo(w - pad.r, y0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.font = '600 13px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  if (axisHasMeaningfulRange) {
    for (let yv = yMinTick; yv <= yMaxTick + 0.5; yv += tickStep) {
      const yy = yp(yv);
      ctx.fillStyle = "#334155";
      ctx.fillText(formatEuroAbbrev(yv), 4, yy + 4);
    }
  }

  if (x.length > 0) {
    const startAge = Math.round(x[0]);
    for (let i = 0; i < x.length; i += 1) {
      const age = Math.round(x[i]);
      if ((age - startAge) % 2 !== 0) continue;
      const xx = xp(i);
      ctx.strokeStyle = "#cfd8e3";
      ctx.beginPath();
      ctx.moveTo(xx, h - pad.b);
      ctx.lineTo(xx, h - pad.b + 5);
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.fillText(String(age), xx - 8, h - 8);
    }
  }
}

function recalc(): void {
  syncEarlyRetirementControl(false);

  const result = runModel(rawInputs, uiState);
  const statutory = getStatutoryAge();
  const earlyLabel = spinner.value.trim() === "" ? "Retire at early age" : `Retire at ${uiState.earlyRetirementAge}`;
  const statutoryLabel = statutory === null ? "Retire at statutory age" : `Retire at ${statutory}`;
  cashLegendA.textContent = earlyLabel;
  cashLegendB.textContent = statutoryLabel;
  nwLegendA.textContent = earlyLabel;
  nwLegendB.textContent = statutoryLabel;
  drawChart(
    cashCanvas,
    result.outputs.ages,
    result.outputs.cashSeriesEarly,
    result.outputs.cashSeriesNorm,
    earlyLabel,
    statutoryLabel
  );
  drawChart(
    nwCanvas,
    result.outputs.ages,
    result.outputs.netWorthSeriesEarly,
    result.outputs.netWorthSeriesNorm,
    earlyLabel,
    statutoryLabel
  );
  renderMilestoneTimeline(result);
}

function queueRecalc(): void {
  if (debounceHandle !== null) window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(() => {
    recalc();
    debounceHandle = null;
  }, 200);
}

spinner.addEventListener("input", () => {
  const statutory = getStatutoryAge();
  if (statutory === null) return;
  spinner.max = String(statutory);
  spinner.min = "18";
  setRetireCheckMessage(null);
  const raw = spinner.value.trim();
  if (raw === "") {
    updateEarlyRetirementButtons(statutory);
    return;
  }
  const v = Math.round(Number(raw));
  if (!Number.isFinite(v)) {
    updateEarlyRetirementButtons(statutory);
    return;
  }
  // Allow direct typing without forcing immediate clamp on each keypress.
  uiState.earlyRetirementAge = v;
  updateEarlyRetirementButtons(statutory);
  queueRecalc();
});

spinner.addEventListener("blur", () => {
  const statutory = getStatutoryAge();
  if (statutory === null) {
    spinner.value = "";
    updateEarlyRetirementButtons(null);
    return;
  }
  const raw = spinner.value.trim();
  if (raw === "") {
    spinner.value = String(uiState.earlyRetirementAge);
    updateEarlyRetirementButtons(statutory);
    return;
  }
  const v = Math.round(Number(raw));
  if (!Number.isFinite(v)) {
    spinner.value = String(uiState.earlyRetirementAge);
    updateEarlyRetirementButtons(statutory);
    return;
  }
  uiState.earlyRetirementAge = Math.max(18, Math.min(statutory, v));
  spinner.value = String(uiState.earlyRetirementAge);
  updateEarlyRetirementButtons(statutory);
  setRetireCheckMessage(null);
  queueRecalc();
});

spinnerDown.addEventListener("click", () => adjustEarlyRetirementAge(-1));
spinnerUp.addEventListener("click", () => adjustEarlyRetirementAge(1));

retireCheckButton.addEventListener("click", () => {
  const statutory = getStatutoryAge();
  if (statutory === null) {
    updateRetireCheckButton(null);
    setRetireCheckMessage(null);
    return;
  }

  const canRetAge = findEarliestRetirementAgeBeforeStatutory(statutory);
  if (canRetAge === null) {
    uiState.earlyRetirementAge = statutory;
    spinner.value = String(statutory);
    updateEarlyRetirementButtons(statutory);
    setRetireCheckMessage("No. Update your inputs and try again.", "neutral");
    queueRecalc();
    return;
  }

  uiState.earlyRetirementAge = canRetAge;
  spinner.value = String(canRetAge);
  updateEarlyRetirementButtons(statutory);
  setRetireCheckMessage(`Yes. You can retire at ${canRetAge}.`, "positive");
  queueRecalc();
});

renderInputs();
recalc();
