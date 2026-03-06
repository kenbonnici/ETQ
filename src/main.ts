import "./app.css";
import { pruneInactiveFieldState } from "./model/activation";
import { runModel } from "./model";
import { CELL_TO_FIELD_ID } from "./model/fieldRegistry";
import { createEmptyFieldState, rawInputsToFieldState } from "./model/excelAdapter";
import type { RunModelResult } from "./model/index";
import {
  INPUT_DEFINITION_BY_FIELD_ID,
  ALLOW_NEGATIVE_INPUT_CELLS,
  COERCED_NUMERIC_BOUNDS,
  FINER_DETAILS_COL_C_DEFAULTS,
  InputDefinition,
  INPUT_DEFINITIONS,
  SKIP_REVEAL_CRITICAL_CELLS,
  ValidationMessage
} from "./model/inputSchema";
import { EXCEL_BASELINE_SPECIMEN } from "./model/parity/excelBaselineSpecimen";
import { FieldId, InputCell, ModelUiState, RawInputValue, RawInputs } from "./model/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

type WorkingInputs = Record<string, RawInputValue>;

const fieldState = createEmptyFieldState();
for (const [fieldId, value] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS)) {
  fieldState[fieldId as FieldId] = value;
}

const rawInputs = new Proxy(fieldState as WorkingInputs, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && prop in CELL_TO_FIELD_ID) {
      return Reflect.get(target, CELL_TO_FIELD_ID[prop as InputCell], receiver);
    }
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    if (typeof prop === "string" && prop in CELL_TO_FIELD_ID) {
      return Reflect.set(target, CELL_TO_FIELD_ID[prop as InputCell], value, receiver);
    }
    return Reflect.set(target, prop, value, receiver);
  }
}) as RawInputs & WorkingInputs;

function fieldIdForCell(cell: InputCell): FieldId {
  return CELL_TO_FIELD_ID[cell];
}

let uiState: ModelUiState = {
  deeperDiveOpen: false,
  finerDetailsOpen: false,
  earlyRetirementAge: 65
};

let debounceHandle: number | null = null;
let pendingFocusCell: string | null = null;
let selectedCurrency = "EUR";
let stepperHoldTimeout: number | null = null;
let stepperHoldInterval: number | null = null;
let stepperHoldListenersBound = false;
let excelLoadBusy = false;
let latestValidationMessages: ValidationMessage[] = [];
let validationRevealAll = false;
const touchedCells = new Set<FieldId>();
const attemptedFieldMessages = new Map<FieldId, ValidationMessage>();

const TIMELINE_EDGE_PADDING = 26;
const MILESTONE_EVENT_MIN_ABS_AMOUNT = 1000;
const RETIREMENT_CASH_FLOOR_EPSILON = 1e-6;
const TIMELINE_ROW_HEIGHT_DEFAULT = 20;
const TIMELINE_ROW_GAP_EXTRA = 2;
const TIMELINE_ENDCAP_CLEARANCE = 18;
const CHART_PAD = { l: 72, r: 24, t: 26, b: 34 } as const;
const CHART_PRIMARY_COLOR = "#0284c7";
const CHART_COMPARISON_COLOR = "#d97706";
const CHART_TOOLTIP_DELAY_MS = 60;
const PROJECTION_EMPTY_GUIDANCE = "Enter statutory retirement age, your age and other relevant info to start seeing projections.";
const TOP_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" }
] as const;
const STEPPER_CONFIG: Record<string, number> = {
  B4: 1,
  B6: 100,
  B8: 100,
  B10: 100,
  B12: 1000,
  B15: 100,
  B17: 10,
  B19: 1,
  B21: 100,
  B23: 100,
  B34: 100,
  B39: 100,
  B44: 100,
  B51: 1000,
  B52: 100,
  B56: 1000,
  B57: 100,
  B61: 1000,
  B62: 100,
  B66: 100,
  B67: 100,
  B68: 100,
  B70: 100,
  B75: 100,
  B78: 100,
  B80: 10,
  B83: 100,
  B85: 10,
  B88: 100,
  B90: 10,
  B93: 100,
  B95: 10,
  B101: 100,
  B134: 1,
  B106: 100,
  B111: 100,
  B118: 100,
  B123: 100,
  B128: 100,
  B102: 1,
  B107: 1,
  B112: 1,
  B119: 1,
  B124: 1,
  B129: 1,
  B137: 0.001,
  B138: 0.001,
  B139: 0.001,
  B141: 100,
  B142: 1,
  B143: 1,
  B35: 1,
  B40: 1,
  B45: 1,
  B71: 1,
  B25: 100,
  B16: 0.001,
  B79: 0.001,
  B84: 0.001,
  B89: 0.001,
  B94: 0.001,
  B145: 0.002,
  B147: 0.001,
  B149: 0.001,
  B151: 0.002,
  B153: 0.001,
  B155: 0.001,
  B157: 10,
  B159: 1000,
  B161: 0.001,
  B163: 0.001
};
const STEP_DECIMALS: Record<string, number> = {
  B4: 0,
  B6: 0,
  B8: 0,
  B10: 0,
  B12: 0,
  B15: 0,
  B17: 0,
  B19: 0,
  B21: 0,
  B23: 0,
  B34: 0,
  B39: 0,
  B44: 0,
  B51: 0,
  B52: 0,
  B56: 0,
  B57: 0,
  B61: 0,
  B62: 0,
  B66: 0,
  B67: 0,
  B68: 0,
  B70: 0,
  B75: 0,
  B78: 0,
  B80: 0,
  B83: 0,
  B85: 0,
  B88: 0,
  B90: 0,
  B93: 0,
  B95: 0,
  B101: 0,
  B134: 0,
  B106: 0,
  B111: 0,
  B118: 0,
  B123: 0,
  B128: 0,
  B102: 0,
  B107: 0,
  B112: 0,
  B119: 0,
  B124: 0,
  B129: 0,
  B137: 3,
  B138: 3,
  B139: 3,
  B141: 0,
  B142: 0,
  B143: 0,
  B35: 0,
  B40: 0,
  B45: 0,
  B71: 0,
  B25: 0,
  B16: 3,
  B79: 3,
  B84: 3,
  B89: 3,
  B94: 3,
  B145: 3,
  B147: 3,
  B149: 3,
  B151: 3,
  B153: 3,
  B155: 3,
  B157: 0,
  B159: 0,
  B161: 3,
  B163: 3
};
function resolveFieldId(key: string): FieldId {
  return (key in CELL_TO_FIELD_ID ? CELL_TO_FIELD_ID[key as InputCell] : key) as FieldId;
}

function getDynamicMinConstraint(key: string): number | null {
  if (resolveFieldId(key) !== "planning.lifeExpectancyAge") return null;
  const currentAge = getCurrentAge();
  if (currentAge === null) return null;
  return currentAge + 1;
}

function applyFieldNumericConstraint(key: string, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  let bounded = value;
  const cfg = COERCED_NUMERIC_BOUNDS[resolveFieldId(key)];
  if (cfg) {
    if (Number.isFinite(cfg.min)) bounded = Math.max(cfg.min as number, bounded);
    if (Number.isFinite(cfg.max)) bounded = Math.min(cfg.max as number, bounded);
  }
  const dynamicMin = getDynamicMinConstraint(key);
  if (Number.isFinite(dynamicMin)) bounded = Math.max(dynamicMin as number, bounded);
  return bounded;
}

function enforceLiveUntilAgeConstraint(syncVisibleInput: boolean): boolean {
  const current = rawInputs.B134;
  const numericCurrent = typeof current === "number" && Number.isFinite(current) ? current : null;
  const constrained = applyFieldNumericConstraint("B134", numericCurrent);
  if (constrained === numericCurrent) return false;
  rawInputs.B134 = constrained;
  if (syncVisibleInput) {
    const input = inputsPanel.querySelector<HTMLInputElement>('input[data-cell="B134"]');
    const def = INPUT_DEFINITIONS.find((d) => d.cell === "B134");
    if (input && def && document.activeElement !== input) {
      input.value = formatFieldValue(def, constrained);
    }
  }
  return true;
}

app.innerHTML = `
  <main class="layout">
    <section class="left" id="inputs-panel"></section>
    <section class="right">
      <header class="retirement-control">
        <button id="retire-check-btn" class="retire-check-btn" type="button">Enough to quit?</button>
        <p id="retire-check-result" class="retire-check-result" hidden></p>
        <div class="retirement-stepper">
          <span class="retirement-stepper-label">Retire at</span>
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
        <h2>Events Timeline</h2>
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
const PROPERTY_LIQUIDATION_CONFIG: readonly PropertyLiquidationConfig[] = [
  { idx: 0, rankCell: "B166", nameCell: "B50", valueCell: "B51", cells: property1Cells },
  { idx: 1, rankCell: "B167", nameCell: "B55", valueCell: "B56", cells: property2Cells },
  { idx: 2, rankCell: "B168", nameCell: "B60", valueCell: "B61", cells: property3Cells }
] as const;
const PROPERTY_LIQUIDATION_CELLS = new Set<string>(["B166", "B167", "B168"]);
const FINER_DETAILS_CELLS = INPUT_DEFINITIONS
  .filter((def) => def.section === "FINER DETAILS")
  .map((def) => def.cell as keyof RawInputs);
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
const STRUCTURAL_RERENDER_CELLS = new Set<string>([
  "B12", "B15", "B33", "B38", "B43", "B50", "B55", "B60",
  "B70", "B78", "B83", "B88", "B93", "B100", "B105", "B110",
  "B117", "B122", "B127", "B141"
]);

interface PanelCursorState {
  scrollTop: number;
  activeCell: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
}

interface PropertyLiquidationConfig {
  idx: 0 | 1 | 2;
  rankCell: "B166" | "B167" | "B168";
  nameCell: "B50" | "B55" | "B60";
  valueCell: "B51" | "B56" | "B61";
  cells: readonly string[];
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

interface ExcelSpecimenPayload {
  early_retirement_age?: number;
  raw_inputs?: Partial<Record<string, unknown>>;
}

interface ChartHoverData {
  ages: number[];
  years: number[];
  seriesPrimary: number[];
  seriesComparison: number[];
  retireNowAge: number | null;
  statutoryAge: number | null;
  metricLabel: string;
  contextByYear: Map<number, TimelineYearEvent[]>;
}

const chartHoverData = new Map<HTMLCanvasElement, ChartHoverData>();
const chartTooltips = new Map<HTMLCanvasElement, HTMLDivElement>();
const chartHoverIndex = new Map<HTMLCanvasElement, number | null>();
const chartHoverDelayHandle = new Map<HTMLCanvasElement, number | null>();
const chartHoverPending = new Map<HTMLCanvasElement, { idx: number; clientX: number; clientY: number } | null>();

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

function currentCurrencySymbol(): string {
  return TOP_CURRENCIES.find((currency) => currency.code === selectedCurrency)?.symbol ?? "€";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validationPriority(severity: ValidationMessage["severity"]): number {
  return severity === "error" ? 2 : 1;
}

function markFieldTouched(cell: InputCell): void {
  touchedCells.add(fieldIdForCell(cell));
}

function clearTouchedFields(cells?: readonly InputCell[]): void {
  if (!cells) {
    touchedCells.clear();
    return;
  }
  for (const cell of cells) touchedCells.delete(fieldIdForCell(cell));
}

function clearAttemptedFieldMessage(cell: InputCell): void {
  attemptedFieldMessages.delete(fieldIdForCell(cell));
}

function clearAllAttemptedFieldMessages(): void {
  attemptedFieldMessages.clear();
}

function clearAgeConstraintAttemptMessages(): void {
  clearAttemptedFieldMessage("B4");
  clearAttemptedFieldMessage("B19");
}

function setAttemptedFieldMessage(cell: InputCell, message: string): void {
  attemptedFieldMessages.set(fieldIdForCell(cell), {
    fieldId: fieldIdForCell(cell),
    severity: "error",
    message,
    blocksProjection: true
  });
}

function getOrderedDefinitions(defs: InputDefinition[]): InputDefinition[] {
  return [...defs].sort((a, b) => {
    const ra = displayOrderOverride[a.cell] ?? a.row;
    const rb = displayOrderOverride[b.cell] ?? b.row;
    return ra - rb;
  });
}

function getVisibleInputOrder(): InputCell[] {
  const ordered = [
    ...getOrderedDefinitions(INPUT_DEFINITIONS.filter((def) => def.section === "QUICK START")),
    ...getOrderedDefinitions(INPUT_DEFINITIONS.filter((def) => def.section === "DEEPER DIVE")),
    ...getOrderedDefinitions(INPUT_DEFINITIONS.filter((def) => def.section === "FINER DETAILS"))
  ];
  return ordered
    .filter((def) => fieldVisible(def.cell) && !PROPERTY_LIQUIDATION_CELLS.has(def.cell))
    .map((def) => def.cell as InputCell);
}

function hasUserEnteredValue(cell: InputCell): boolean {
  return touchedCells.has(fieldIdForCell(cell)) && !isBlank(rawInputs[cell]);
}

function getSkippedCriticalCells(): Set<InputCell> {
  const skipped = new Set<InputCell>();
  const criticalCells = new Set<InputCell>(SKIP_REVEAL_CRITICAL_CELLS);
  const orderedCells = getVisibleInputOrder();
  let laterUserEnteredValueExists = false;
  for (let idx = orderedCells.length - 1; idx >= 0; idx -= 1) {
    const cell = orderedCells[idx];
    if (criticalCells.has(cell) && isBlank(rawInputs[cell as keyof RawInputs]) && laterUserEnteredValueExists) {
      skipped.add(cell);
    }
    if (hasUserEnteredValue(cell as keyof RawInputs)) {
      laterUserEnteredValueExists = true;
    }
  }
  return skipped;
}

function getVisibleValidationMessages(messages: ValidationMessage[]): ValidationMessage[] {
  if (validationRevealAll) return messages;
  const skippedCriticalCells = getSkippedCriticalCells();
  return messages.filter((message) => (
    touchedCells.has(message.fieldId)
    || (message.severity === "error" && message.blocksProjection && skippedCriticalCells.has(INPUT_DEFINITION_BY_FIELD_ID[message.fieldId].cell))
  ));
}

function hasProjectionBlockingValidation(messages: ValidationMessage[]): boolean {
  return messages.some((message) => message.severity === "error" && message.blocksProjection);
}

function formatBlockingFieldLabel(cell: InputCell): string {
  if (cell === "B134") return "end age";
  const label = INPUT_DEFINITION_BY_FIELD_ID[fieldIdForCell(cell)].label.trim();
  return label.length > 0 ? `${label.charAt(0).toLowerCase()}${label.slice(1)}` : cell;
}

function joinHumanLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function getProjectionBlockingLines(messages: ValidationMessage[]): string[] {
  const blockingErrors = messages.filter((message) => message.severity === "error" && message.blocksProjection);
  if (blockingErrors.length === 0) {
    return [PROJECTION_EMPTY_GUIDANCE];
  }
  const missingCells = Array.from(new Set(
    blockingErrors
      .filter((message) => isBlank(rawInputs[INPUT_DEFINITION_BY_FIELD_ID[message.fieldId].cell]))
      .map((message) => INPUT_DEFINITION_BY_FIELD_ID[message.fieldId].cell)
  ));
  if (missingCells.length > 0 && missingCells.length === new Set(blockingErrors.map((message) => INPUT_DEFINITION_BY_FIELD_ID[message.fieldId].cell)).size) {
    const labels = missingCells.map((cell) => formatBlockingFieldLabel(cell));
    return [`Enter ${joinHumanLabels(labels)} to see projections.`];
  }
  return ["Fix highlighted inputs to see projections."];
}

function applyRetireCheckReadiness(messages: ValidationMessage[], statutory: number | null): void {
  const hasEssentialErrors = messages.some((message) => (
    message.severity === "error"
    && (message.fieldId === fieldIdForCell("B4")
      || message.fieldId === fieldIdForCell("B19")
      || message.fieldId === fieldIdForCell("B25")
      || message.fieldId === fieldIdForCell("B134"))
  ));
  retireCheckButton.disabled = hasEssentialErrors || statutory === null || statutory <= getMinEarlyRetirementAge();
  if (retireCheckButton.disabled) {
    setRetireCheckMessage(null);
  }
}

function renderValidationState(messages: ValidationMessage[]): void {
  latestValidationMessages = messages;
  const fields = inputsPanel.querySelectorAll<HTMLElement>(".field[data-field-id]");
  fields.forEach((field) => {
    field.classList.remove("has-error", "has-warning");
    field.querySelectorAll<HTMLElement>(".field-feedback").forEach((node) => node.remove());
  });

  const visibleMessages = getVisibleValidationMessages(messages);
  const byFieldId = new Map<string, ValidationMessage[]>();
  for (const message of visibleMessages) {
    const arr = byFieldId.get(message.fieldId) ?? [];
    arr.push(message);
    byFieldId.set(message.fieldId, arr);
  }
  for (const [fieldId, message] of attemptedFieldMessages) {
    const arr = byFieldId.get(fieldId) ?? [];
    arr.push(message);
    byFieldId.set(fieldId, arr);
  }

  for (const field of fields) {
    const fieldId = field.dataset.fieldId;
    if (!fieldId) continue;
    const fieldMessages = byFieldId.get(fieldId);
    if (!fieldMessages || fieldMessages.length === 0) continue;
    fieldMessages.sort((a, b) => validationPriority(b.severity) - validationPriority(a.severity));
    const primary = fieldMessages[0];
    field.classList.add(primary.severity === "error" ? "has-error" : "has-warning");
    const feedback = document.createElement("small");
    feedback.className = `field-feedback ${primary.severity === "error" ? "is-error" : "is-warning"}`;
    feedback.textContent = primary.message;
    field.appendChild(feedback);
  }
}

function drawEmptyChart(canvas: HTMLCanvasElement, lines: string[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const messageLines = lines.length > 0 ? lines : [PROJECTION_EMPTY_GUIDANCE];
  const titleY = canvas.height / 2 - (messageLines.length > 1 ? 18 : 0);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#475569";
  ctx.font = '500 15px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(messageLines[0], canvas.width / 2, titleY);
  if (messageLines.length === 1) return;
  ctx.fillStyle = "#64748b";
  ctx.font = '400 13px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  messageLines.slice(1, 4).forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, titleY + 26 + (idx * 18));
  });
}

function clearTimeline(message: string): void {
  timelineTrack.innerHTML = `<div class="timeline-empty">${escapeHtml(message)}</div>`;
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
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const symbol = currentCurrencySymbol();
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${sign}${symbol}${Number(scaled.toFixed(digits)).toLocaleString("en-US")}m`;
  }
  const k = Math.round(abs / 1000);
  return `${sign}${symbol}${k.toLocaleString("en-US")}k`;
}

function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currentCurrencySymbol();
  if (abs >= 1_000_000_000) {
    const scaled = abs / 1_000_000_000;
    const digits = scaled >= 10 ? 1 : 2;
    return `${sign}${symbol}${Number(scaled.toFixed(digits)).toLocaleString("en-US")}b`;
  }
  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    const digits = scaled >= 10 ? 1 : 2;
    return `${sign}${symbol}${Number(scaled.toFixed(digits)).toLocaleString("en-US")}m`;
  }
  if (abs >= 1_000) {
    const scaled = abs / 1_000;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${sign}${symbol}${Number(scaled.toFixed(digits)).toLocaleString("en-US")}k`;
  }
  return `${sign}${symbol}${Math.round(abs).toLocaleString("en-US")}`;
}

function formatCurrencyPrecise(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currentCurrencySymbol();
  const maxFractionDigits = abs >= 1000 ? 0 : 2;
  return `${sign}${symbol}${abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits
  })}`;
}

type TooltipValueMode = "full" | "compact";
type TooltipCompactUnit = "k" | "m" | "b";

function formatCurrencyCompactTooltip(value: number, unit: TooltipCompactUnit): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currentCurrencySymbol();
  if (unit === "b") {
    const scaled = abs / 1_000_000_000;
    return `${sign}${symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}b`;
  }
  if (unit === "m") {
    const scaled = abs / 1_000_000;
    return `${sign}${symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m`;
  }
  const scaled = abs / 1_000;
  return `${sign}${symbol}${scaled.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k`;
}

function formatTooltipCurrency(value: number, mode: TooltipValueMode, compactUnit: TooltipCompactUnit): string {
  if (!Number.isFinite(value)) return "—";
  return mode === "compact" ? formatCurrencyCompactTooltip(value, compactUnit) : formatCurrencyPrecise(value);
}

function chooseTooltipValueMode(values: number[]): TooltipValueMode {
  return values.some((value) => Number.isFinite(value) && Math.abs(value) >= 1_000_000) ? "compact" : "full";
}

function chooseTooltipCompactUnit(values: number[]): TooltipCompactUnit {
  const maxAbs = values.reduce((max, value) => {
    if (!Number.isFinite(value)) return max;
    return Math.max(max, Math.abs(value));
  }, 0);
  if (maxAbs >= 1_000_000_000) return "b";
  if (maxAbs >= 1_000_000) return "m";
  return "k";
}

function buildChartContextByYear(result: RunModelResult): Map<number, TimelineYearEvent[]> {
  const labelsByYear = collectSpecificLabelsByYear(result);
  const contextByYear = new Map<number, TimelineYearEvent[]>();
  for (const [year, events] of labelsByYear.entries()) {
    const normalized = events
      .map((event) => ({
        label: normalizeTimelineLabel(event.label).trim(),
        amount: event.amount
      }))
      .filter((event) => event.label.length > 0);
    if (normalized.length === 0) continue;
    const deduped = normalized.filter((event, idx, arr) =>
      arr.findIndex((candidate) => candidate.label === event.label && candidate.amount === event.amount) === idx
    );
    contextByYear.set(year, deduped);
  }
  return contextByYear;
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
    parts.push(amountText ? `Sell stocks ${amountText}` : "Sell stocks");
  }
  if (propertySales.length === 1) {
    const sale = propertySales[0];
    const amountText = formatImpact(sale.amount);
    parts.push(amountText ? `Sell ${sale.name} ${amountText}` : `Sell ${sale.name}`);
  } else if (propertySales.length > 1) {
    const grouped = propertySales
      .map((sale) => {
        const amountText = formatImpact(sale.amount);
        return amountText ? `${sale.name} ${amountText}` : sale.name;
      })
      .join(" & ");
    parts.push(`Sell ${grouped}`);
  }
  for (const other of others) {
    const amountText = formatImpact(other.amount);
    parts.push(amountText ? `${other.label} ${amountText}` : other.label);
  }

  return parts.join(", ");
}

function collectSpecificLabelsByYear(result: RunModelResult): Map<number, TimelineYearEvent[]> {
  const labelsByYear = new Map<number, TimelineYearEvent[]>();

  const pushLabel = (year: number, name: string, amount: number | null = null): void => {
    if (!name || !Number.isFinite(year) || year <= 0) return;
    if (amount !== null && Number.isFinite(amount) && Math.abs(amount) < MILESTONE_EVENT_MIN_ABS_AMOUNT) return;
    const existing = labelsByYear.get(year) ?? [];
    existing.push({ label: name, amount });
    labelsByYear.set(year, existing);
  };
  const findYearForAge = (targetAge: number): number | null => {
    const idx = result.outputs.ages.findIndex((age) => Math.round(age) === Math.round(targetAge));
    if (idx < 0) return null;
    return result.outputs.years[idx] ?? null;
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

  const otherWorkIncomeAnnual = asNumber(rawInputs.B70);
  const otherWorkUntilAge = Math.round(asNumber(rawInputs.B71));
  if (otherWorkIncomeAnnual !== 0 && otherWorkUntilAge > 0) {
    const endYear = findYearForAge(otherWorkUntilAge + 1);
    if (endYear !== null) {
      pushLabel(endYear, "Other income ends", -Math.abs(otherWorkIncomeAnnual));
    }
  }

  const postRetIncomeAnnual = asNumber(rawInputs.B141);
  const postRetIncomeFromAge = Math.round(asNumber(rawInputs.B142));
  const postRetIncomeToAge = Math.round(asNumber(rawInputs.B143));
  if (postRetIncomeAnnual > 0) {
    if (postRetIncomeFromAge > 0) {
      const startYear = findYearForAge(postRetIncomeFromAge);
      if (startYear !== null) pushLabel(startYear, "Other post-retirement income starts", Math.abs(postRetIncomeAnnual));
    }
    if (postRetIncomeToAge > 0 && postRetIncomeToAge >= postRetIncomeFromAge) {
      const endYear = findYearForAge(postRetIncomeToAge + 1);
      if (endYear !== null) pushLabel(endYear, "Other post-retirement income ends", -Math.abs(postRetIncomeAnnual));
    }
  }

  for (const hint of result.outputs.scenarioEarly.milestoneHints) {
    pushLabel(hint.year, hint.label, hint.amount ?? null);
  }

  return labelsByYear;
}

function buildTimelineMilestones(result: RunModelResult): TimelineMilestone[] {
  const ages = result.outputs.ages;
  const years = result.outputs.years;
  if (ages.length === 0) return [];

  const labelsByYear = collectSpecificLabelsByYear(result);
  const milestones: TimelineMilestone[] = [];

  for (let i = 0; i < ages.length; i += 1) {
    const year = years[i];
    const allowedEvents = labelsByYear.get(year) ?? [];
    if (allowedEvents.length === 0) continue;
    const normalized = allowedEvents
      .map((event) => ({ ...event, label: normalizeTimelineLabel(event.label) }))
      .filter((event) => event.label.length > 0);
    if (normalized.length === 0) continue;
    const label = composeTimelineLabel(normalized);
    if (!label) continue;

    milestones.push({
      age: ages[i],
      year,
      cashPct: null,
      netWorthPct: null,
      magnitude: 0,
      label,
      notes: []
    });
  }
  milestones.sort((a, b) => a.age - b.age);
  return milestones;
}

function renderMilestoneTimeline(result: RunModelResult): void {
  const enteredAge = Number(rawInputs.B4);
  const hasValidEnteredAge = !isBlank(rawInputs.B4) && Number.isFinite(enteredAge) && enteredAge >= 18 && enteredAge <= 100;
  timelinePanel.hidden = !hasValidEnteredAge;
  if (!hasValidEnteredAge) {
    timelineTrack.style.height = "";
    timelineScroll.style.overflowY = "hidden";
    timelineScroll.style.overflowX = "hidden";
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
  const startLabelAge = Math.round(enteredAge);
  const span = Math.max(1, endAge - startAge);
  const milestones = buildTimelineMilestones(result);
  const topPad = TIMELINE_EDGE_PADDING + TIMELINE_ENDCAP_CLEARANCE;
  const bottomPad = TIMELINE_EDGE_PADDING + TIMELINE_ENDCAP_CLEARANCE;
  const viewportHeight = Math.max(320, timelineScroll.clientHeight);
  const trackHeight = viewportHeight;
  timelineTrack.style.height = `${trackHeight}px`;
  timelineScroll.style.overflowY = "hidden";
  timelineScroll.style.overflowX = "hidden";

  const usable = Math.max(1, trackHeight - topPad - bottomPad);
  const segmentCount = Math.max(1, milestones.length - 1);
  const maxGapFromViewport = usable / segmentCount;
  const rowHeight = Math.max(
    4,
    Math.min(TIMELINE_ROW_HEIGHT_DEFAULT, Math.floor(maxGapFromViewport - TIMELINE_ROW_GAP_EXTRA))
  );
  const preferredGap = Math.max(6, rowHeight + TIMELINE_ROW_GAP_EXTRA);
  const minGap = milestones.length > 1
    ? Math.max(1, Math.min(preferredGap, maxGapFromViewport))
    : 0;
  timelineTrack.style.setProperty("--timeline-row-height", `${rowHeight}px`);
  const positioned = milestones.map((item) => {
    const ratio = (item.age - startAge) / span;
    const y = topPad + (1 - Math.max(0, Math.min(1, ratio))) * usable;
    return { ...item, y };
  });
  const topLimit = topPad;
  const bottomLimit = trackHeight - bottomPad;
  if (positioned.length === 1) {
    positioned[0].y = Math.max(topLimit, Math.min(bottomLimit, positioned[0].y));
  } else if (positioned.length > 1) {
    const topIdx = positioned.length - 1;
    const topUpper = bottomLimit - topIdx * minGap;
    positioned[topIdx].y = Math.max(topLimit, Math.min(topUpper, positioned[topIdx].y));
    for (let i = topIdx - 1; i >= 0; i -= 1) {
      const upper = bottomLimit - i * minGap;
      const lower = positioned[i + 1].y + minGap;
      positioned[i].y = Math.max(lower, Math.min(upper, positioned[i].y));
    }
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
    </div>
    <div class="timeline-endcap timeline-endcap-bottom">
      <span class="timeline-end-year">${startLabelAge}</span>
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
  const capped = applyFieldNumericConstraint("B19", n);
  if (capped === null || capped < 50) return null;
  return Math.round(capped);
}

function updateEarlyRetirementButtons(statutory: number | null): void {
  if (statutory === null) {
    spinnerDown.disabled = true;
    spinnerUp.disabled = true;
    return;
  }

  const minRetirementAge = getMinEarlyRetirementAge();
  const raw = spinner.value.trim();
  const entered = Math.round(Number(raw));
  const current = Number.isFinite(entered) ? entered : uiState.earlyRetirementAge;
  const clamped = Math.max(minRetirementAge, Math.min(statutory, current));
  spinnerDown.disabled = clamped <= minRetirementAge;
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
  const isReady = statutory !== null && statutory > getMinEarlyRetirementAge();
  retireCheckButton.disabled = !isReady;
}

function findEarliestRetirementAgeBeforeStatutory(statutory: number): number | null {
  const baseline = runModel(fieldState, uiState);
  const firstProjectedAge = baseline.outputs.ages[0];
  if (!Number.isFinite(firstProjectedAge)) return null;

  const candidateStartAge = Math.max(18, Math.round(firstProjectedAge));
  const candidateEndAge = statutory - 1;
  if (candidateStartAge > candidateEndAge) return null;

  for (let candidateAge = candidateStartAge; candidateAge <= candidateEndAge; candidateAge += 1) {
    const candidateResult = runModel(fieldState, { ...uiState, earlyRetirementAge: candidateAge });
    const startIndex = candidateResult.outputs.ages.findIndex((age) => Math.round(age) >= candidateAge);
    if (startIndex < 0) continue;
    const staysNonNegative = candidateResult.outputs.cashSeriesEarly
      .slice(startIndex)
      .every((cash) => cash >= -RETIREMENT_CASH_FLOOR_EPSILON);
    if (staysNonNegative) return candidateAge;
  }

  return null;
}

function getCurrentAge(): number | null {
  const raw = rawInputs.B4;
  if (isBlank(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 18 || n > 100) return null;
  return Math.round(n);
}

function getMinEarlyRetirementAge(): number {
  const currentAge = getCurrentAge();
  return currentAge === null ? 18 : Math.max(18, currentAge);
}

function syncEarlyRetirementControl(defaultIfEmpty: boolean): void {
  const statutory = getStatutoryAge();
  const minRetirementAge = getMinEarlyRetirementAge();
  spinner.min = String(minRetirementAge);
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
  uiState.earlyRetirementAge = Math.max(minRetirementAge, Math.min(statutory, v));
  spinner.value = String(uiState.earlyRetirementAge);
  updateEarlyRetirementButtons(statutory);
  updateRetireCheckButton(statutory);
}

function adjustEarlyRetirementAge(delta: number): void {
  const statutory = getStatutoryAge();
  if (statutory === null) return;
  const minRetirementAge = getMinEarlyRetirementAge();

  const raw = spinner.value.trim();
  const entered = Math.round(Number(raw));
  const current = Number.isFinite(entered) ? entered : uiState.earlyRetirementAge;
  uiState.earlyRetirementAge = Math.max(minRetirementAge, Math.min(statutory, current + delta));
  spinner.value = String(uiState.earlyRetirementAge);
  updateEarlyRetirementButtons(statutory);
  setRetireCheckMessage(null);
  queueRecalc();
}

function sanitizeNumericText(text: string, kind: "number" | "integer" | "percent", allowNegative: boolean): string {
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
    if (allowNegative && ch === "-" && !hasMinus && out.length === 0) {
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

function fieldAllowsNegative(key: string): boolean {
  const cell = key in CELL_TO_FIELD_ID ? key as InputCell : INPUT_DEFINITION_BY_FIELD_ID[key as FieldId]?.cell;
  return !!cell && ALLOW_NEGATIVE_INPUT_CELLS.has(cell);
}

function parseIntegerInput(text: string, allowNegative: boolean): number | null {
  const cleaned = sanitizeNumericText(text, "integer", allowNegative);
  if (cleaned === "" || cleaned === "-") return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseNumberInput(text: string, allowNegative: boolean): number | null {
  const cleaned = sanitizeNumericText(text, "number", allowNegative);
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePercentInput(text: string, allowNegative: boolean): number | null {
  const cleaned = sanitizeNumericText(text, "percent", allowNegative);
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

function fieldHasCurrencyAdornment(def: InputDefinition): boolean {
  return def.type === "number";
}

function fieldHasPercentAdornment(def: InputDefinition): boolean {
  return def.type === "percent";
}

function stopStepperHold(): void {
  if (stepperHoldTimeout !== null) {
    window.clearTimeout(stepperHoldTimeout);
    stepperHoldTimeout = null;
  }
  if (stepperHoldInterval !== null) {
    window.clearInterval(stepperHoldInterval);
    stepperHoldInterval = null;
  }
}

function getAgeStepperLimitMessage(cell: keyof RawInputs, dir: number, nextValue: number): string | null {
  if (cell === "B4" && dir > 0) {
    const statutory = getStatutoryAge();
    if (statutory !== null && nextValue >= statutory) {
      return "Your age must be less than statutory retirement age.";
    }
  }
  if (cell === "B19" && dir < 0) {
    const currentAge = getCurrentAge();
    if (currentAge !== null && nextValue <= currentAge) {
      return "Statutory retirement age must be greater than your current age.";
    }
  }
  return null;
}

function applyStepperDelta(cell: keyof RawInputs, dir: number): void {
  if (!Number.isFinite(dir) || (dir !== -1 && dir !== 1)) return;
  const step = STEPPER_CONFIG[cell];
  const def = INPUT_DEFINITIONS.find((d) => d.cell === cell);
  if (!Number.isFinite(step) || !def) return;
  markFieldTouched(cell);

  const currentRaw = rawInputs[cell];
  const current = typeof currentRaw === "number" && Number.isFinite(currentRaw) ? currentRaw : 0;
  const next = current + dir * step;
  const ageLimitMessage = getAgeStepperLimitMessage(cell, dir, next);
  if (ageLimitMessage !== null) {
    setAttemptedFieldMessage(cell as InputCell, ageLimitMessage);
    renderValidationState(latestValidationMessages);
    return;
  }
  const decimals = STEP_DECIMALS[cell] ?? 0;
  const rounded = Number(next.toFixed(decimals));
  const constrained = applyFieldNumericConstraint(cell, rounded);
  if (constrained === null) return;
  if (isOutOfRangeLiquidationRank(String(cell), constrained) || isDuplicateLiquidationRank(String(cell), constrained)) return;

  if (cell === "B4" || cell === "B19") {
    clearAgeConstraintAttemptMessages();
  }
  rawInputs[cell] = constrained;
  if (String(cell) === "B4") {
    rawInputs.B4 = Math.max(18, Math.min(100, Math.round(asNumber(rawInputs.B4))));
    enforceLiveUntilAgeConstraint(true);
  }
  if (String(cell) === "B19") {
    const statutory = getStatutoryAge();
    if (statutory !== null) {
      uiState.earlyRetirementAge = statutory;
      spinner.value = String(statutory);
    }
    syncEarlyRetirementControl(true);
  }

  const input = inputsPanel.querySelector<HTMLInputElement>(`input[data-cell="${cell}"]`);
  if (input) input.value = formatFieldValue(def, rawInputs[cell]);

  setRetireCheckMessage(null);
  queueRecalc();
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

function activePropertyConfigs(): PropertyLiquidationConfig[] {
  return PROPERTY_LIQUIDATION_CONFIG.filter((cfg) => anyValue(cfg.cells)) as PropertyLiquidationConfig[];
}

function parseRankCellValue(cell: "B166" | "B167" | "B168"): number | null {
  const raw = rawInputs[cell];
  if (isBlank(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function defaultPropertyOrder(active: PropertyLiquidationConfig[]): PropertyLiquidationConfig[] {
  const indexed = active.map((cfg) => ({ cfg, value: asNumber(rawInputs[cfg.valueCell]) }));
  indexed.sort((a, b) => (a.value - b.value) || (a.cfg.idx - b.cfg.idx));
  return indexed.map((item) => item.cfg);
}

function buildPropertyLiquidationOrder(active: PropertyLiquidationConfig[]): PropertyLiquidationConfig[] {
  if (active.length <= 1) return [...active];

  const hasManual = active.some((cfg) => !isBlank(rawInputs[cfg.rankCell]));
  if (!hasManual) return defaultPropertyOrder(active);

  const ranked = active
    .filter((cfg) => {
      const rank = parseRankCellValue(cfg.rankCell);
      return rank !== null && rank > 0;
    })
    .sort((a, b) => {
      const ra = parseRankCellValue(a.rankCell) ?? 0;
      const rb = parseRankCellValue(b.rankCell) ?? 0;
      return (ra - rb) || (a.idx - b.idx);
    });
  const unranked = active.filter((cfg) => !ranked.includes(cfg));
  return [...ranked, ...unranked];
}

function syncManualPropertyOrderForNewProperties(): boolean {
  const active = activePropertyConfigs();
  if (active.length <= 1) return false;
  const hasManual = active.some((cfg) => !isBlank(rawInputs[cfg.rankCell]));
  if (!hasManual) return false;

  const ranked = active
    .map((cfg) => ({ cfg, rank: parseRankCellValue(cfg.rankCell) }))
    .filter((item) => item.rank !== null && item.rank > 0)
    .sort((a, b) => ((a.rank ?? 0) - (b.rank ?? 0)) || (a.cfg.idx - b.cfg.idx));

  let nextRank = ranked.length > 0 ? (ranked[ranked.length - 1].rank ?? 0) : 0;
  let changed = false;
  for (const cfg of active) {
    if (!isBlank(rawInputs[cfg.rankCell])) continue;
    nextRank += 1;
    rawInputs[cfg.rankCell] = nextRank;
    changed = true;
  }
  return changed;
}

function persistPropertyLiquidationOrder(order: PropertyLiquidationConfig[], active: PropertyLiquidationConfig[]): void {
  const activeSet = new Set(active.map((cfg) => cfg.idx));
  for (const cfg of PROPERTY_LIQUIDATION_CONFIG) {
    if (activeSet.has(cfg.idx)) rawInputs[cfg.rankCell] = null;
  }
  order.forEach((cfg, idx) => {
    rawInputs[cfg.rankCell] = idx + 1;
  });
}

function renderPropertyLiquidationOrderControl(): string {
  const active = activePropertyConfigs();
  if (active.length === 0) return "";
  const ordered = buildPropertyLiquidationOrder(active);
  const canDrag = ordered.length > 1;
  const rows = ordered.map((cfg, idx) => {
    const name = String(rawInputs[cfg.nameCell] ?? "").trim() || `Property ${cfg.idx + 1}`;
    const value = asNumber(rawInputs[cfg.valueCell]);
    const valueText = `${currentCurrencySymbol()}${Math.round(value).toLocaleString("en-US")}`;
    return `
      <li class="liquidation-item ${canDrag ? "" : "is-disabled"}" data-liquidation-idx="${cfg.idx}" draggable="${canDrag ? "true" : "false"}">
        <span class="liquidation-rank">${idx + 1}</span>
        <span class="liquidation-name">${escapeHtml(name)}</span>
        <span class="liquidation-value">${escapeHtml(valueText)}</span>
      </li>
    `;
  }).join("");
  return `
    <div class="liquidation-reorder" data-liquidation-reorder="true" data-drag-enabled="${canDrag ? "true" : "false"}">
      <div class="liquidation-title">Property liquidation order</div>
      <small class="liquidation-help">${canDrag ? "Drag to reorder. Top sells first." : "Add at least two properties to reorder."}</small>
      <ul class="liquidation-list">${rows}</ul>
    </div>
  `;
}

function applyFinerDefaultsIfNeeded(): void {
  for (const [cell, val] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS)) {
    const key = cell as keyof RawInputs;
    const current = rawInputs[key];
    if (isBlank(current) && val !== null && val !== undefined) {
      rawInputs[key] = applyFieldNumericConstraint(key, Number(val));
    }
  }
}

async function loadInputsFromEtqExcelSnapshot(): Promise<void> {
  if (excelLoadBusy) return;
  excelLoadBusy = true;
  validationRevealAll = false;
  clearTouchedFields();
  clearAllAttemptedFieldMessages();
  renderInputs();
  try {
    const payload = EXCEL_BASELINE_SPECIMEN as unknown as ExcelSpecimenPayload;
    const incoming = payload.raw_inputs ?? {};

    for (const def of INPUT_DEFINITIONS) {
      const key = def.cell as keyof RawInputs;
      rawInputs[key] = null;
    }

    for (const def of INPUT_DEFINITIONS) {
      const cell = def.cell;
      if (!(cell in incoming)) continue;
      const nextRaw = incoming[cell];
      const key = cell as keyof RawInputs;
      if (nextRaw === null || nextRaw === undefined || String(nextRaw).trim() === "") {
        rawInputs[key] = null;
        continue;
      }
      if (def.type === "text") {
        rawInputs[key] = String(nextRaw);
      } else {
        const n = Number(nextRaw);
        rawInputs[key] = Number.isFinite(n) ? applyFieldNumericConstraint(key, n) : null;
      }
    }

    const statutory = getStatutoryAge();
    if (statutory !== null) {
      uiState.earlyRetirementAge = statutory;
    } else {
      const fromPayload = Number(payload.early_retirement_age);
      if (Number.isFinite(fromPayload) && fromPayload >= 18) {
        uiState.earlyRetirementAge = Math.round(fromPayload);
      }
    }

    setRetireCheckMessage(null);
    syncEarlyRetirementControl(true);
    renderInputs();
    queueRecalc();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load ETQ workbook snapshot";
    window.alert(message);
  } finally {
    excelLoadBusy = false;
    renderInputs();
  }
}

function clearAllInputsPreservingFinerDefaults(): void {
  for (const def of INPUT_DEFINITIONS) {
    const key = def.cell as keyof RawInputs;
    rawInputs[key] = null;
  }
  validationRevealAll = false;
  clearTouchedFields();
  clearAllAttemptedFieldMessages();
  applyFinerDefaultsIfNeeded();
  setRetireCheckMessage(null);
  const statutory = getStatutoryAge();
  if (statutory !== null) {
    uiState.earlyRetirementAge = statutory;
  }
  syncEarlyRetirementControl(true);
  renderInputs();
  queueRecalc();
}

function clearFinerDetailsInputs(): void {
  for (const cell of FINER_DETAILS_CELLS) {
    rawInputs[cell] = null;
  }
  validationRevealAll = false;
  clearTouchedFields(FINER_DETAILS_CELLS);
  clearAllAttemptedFieldMessages();
  setRetireCheckMessage(null);
  renderInputs();
  queueRecalc();
}

function loadFinerDetailsDefaults(): void {
  for (const cell of FINER_DETAILS_CELLS) {
    rawInputs[cell] = null;
  }
  for (const [cell, value] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS)) {
    rawInputs[cell as keyof RawInputs] = value;
  }
  validationRevealAll = false;
  clearTouchedFields(FINER_DETAILS_CELLS);
  clearAllAttemptedFieldMessages();
  setRetireCheckMessage(null);
  renderInputs();
  queueRecalc();
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
  const appendedOrder = syncManualPropertyOrderForNewProperties();
  if (appendedOrder) queueRecalc();
  const grouped = {
    "QUICK START": INPUT_DEFINITIONS.filter((d) => d.section === "QUICK START"),
    "DEEPER DIVE": INPUT_DEFINITIONS.filter((d) => d.section === "DEEPER DIVE"),
    "FINER DETAILS": INPUT_DEFINITIONS.filter((d) => d.section === "FINER DETAILS")
  } as const;

  const block = (title: string, open: boolean, canToggle: boolean, controlsHtml: string, sectionClass: string) => {
    if (!canToggle) {
      const quickStartAction = title === "QUICK START"
        ? `
          <div class="section-header-actions">
            <button type="button" class="quickstart-clear-btn" id="clear-inputs-btn">Clear inputs</button>
            <button type="button" class="quickstart-load-btn" id="load-etq-excel-btn" ${excelLoadBusy ? "disabled" : ""}>${excelLoadBusy ? "Loading..." : "Load sample data"}</button>
          </div>
        `
        : "";
      return `
        <section class="input-section ${sectionClass}">
          <div class="section-header-row">
            <h2>${title}</h2>
            ${quickStartAction}
          </div>
          ${controlsHtml}
        </section>
      `;
    }
    return `<section class="input-section ${sectionClass}"><button type="button" class="section-toggle" data-section="${title}">${open ? `Hide ${title}` : title}</button>${open ? controlsHtml : ""}</section>`;
  };

  const controls = (defs: InputDefinition[]) => {
    const orderedDefs = getOrderedDefinitions(defs);
    let html = "";
    let prevTop = "";
    let prevSub = "";
    let liquidationRendered = false;
    for (const def of orderedDefs) {
      if (!fieldVisible(def.cell)) continue;
      if (PROPERTY_LIQUIDATION_CELLS.has(def.cell)) {
        if (!liquidationRendered) {
          const controlHtml = renderPropertyLiquidationOrderControl();
          if (controlHtml) {
            html += controlHtml;
          }
          liquidationRendered = true;
        }
        continue;
      }
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
      const hasPrefix = fieldHasCurrencyAdornment(def);
      const hasSuffix = fieldHasPercentAdornment(def);
      const stepSize = STEPPER_CONFIG[def.cell];
      const hasStepper = Number.isFinite(stepSize);
      const inputShellClass = [
        "input-shell",
        hasPrefix ? "has-prefix" : "",
        hasSuffix ? "has-suffix" : "",
        hasStepper ? "has-stepper" : ""
      ].join(" ").trim();
      html += `
        <label class="field" data-cell="${def.cell}" data-field-id="${def.fieldId}">
          <span>${label}</span>
          <div class="${inputShellClass}">
            ${hasPrefix ? `<span class="input-prefix" aria-hidden="true">${escapeHtml(currentCurrencySymbol())}</span>` : ""}
            <input data-cell="${def.cell}" data-field-id="${def.fieldId}" type="${inputType}" inputmode="${inputMode}" value="${valStr}" placeholder="" />
            ${hasSuffix ? `<span class="input-suffix" aria-hidden="true">%</span>` : ""}
            ${hasStepper ? `
              <div class="field-stepper">
                <button type="button" class="field-step-btn" data-step-cell="${def.cell}" data-step-dir="-1" tabindex="-1" aria-label="Decrease ${escapeHtml(label)}">-</button>
                <button type="button" class="field-step-btn" data-step-cell="${def.cell}" data-step-dir="1" tabindex="-1" aria-label="Increase ${escapeHtml(label)}">+</button>
              </div>
            ` : ""}
          </div>
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
  const finerActionsHtml = `
    <div class="finer-default-actions section-header-actions">
      <button type="button" class="quickstart-clear-btn" id="clear-finer-defaults-btn">Clear Defaults</button>
      <button type="button" class="quickstart-load-btn" id="load-finer-defaults-btn">Load Defaults</button>
    </div>
  `;
  const currencySelectHtml = `
    <label class="field currency-selector">
      <span>Currency</span>
      <select id="currency-selector" aria-label="Currency selector">
        ${TOP_CURRENCIES.map((currency) => `<option value="${currency.code}" ${currency.code === selectedCurrency ? "selected" : ""}>${currency.code} - ${currency.label}</option>`).join("")}
      </select>
    </label>
  `;
  inputsPanel.innerHTML =
    block("QUICK START", true, false, currencySelectHtml + quickHtml, "section-quick-start") +
    block("DEEPER DIVE", sectionState.deeperOpen, true, deeperHtml, "section-deeper-dive") +
    block("FINER DETAILS", sectionState.finerOpen, true, finerActionsHtml + finerHtml, "section-finer-details");

  const currencySelector = inputsPanel.querySelector<HTMLSelectElement>("#currency-selector");
  if (currencySelector) {
    currencySelector.addEventListener("change", () => {
      selectedCurrency = currencySelector.value;
      renderInputs();
      queueRecalc();
    });
  }

  const loadEtqExcelBtn = inputsPanel.querySelector<HTMLButtonElement>("#load-etq-excel-btn");
  if (loadEtqExcelBtn) {
    loadEtqExcelBtn.addEventListener("click", () => {
      void loadInputsFromEtqExcelSnapshot();
    });
  }

  const clearInputsBtn = inputsPanel.querySelector<HTMLButtonElement>("#clear-inputs-btn");
  if (clearInputsBtn) {
    clearInputsBtn.addEventListener("click", () => {
      clearAllInputsPreservingFinerDefaults();
    });
  }

  const clearFinerDefaultsBtn = inputsPanel.querySelector<HTMLButtonElement>("#clear-finer-defaults-btn");
  if (clearFinerDefaultsBtn) {
    clearFinerDefaultsBtn.addEventListener("click", () => {
      clearFinerDetailsInputs();
    });
  }

  const loadFinerDefaultsBtn = inputsPanel.querySelector<HTMLButtonElement>("#load-finer-defaults-btn");
  if (loadFinerDefaultsBtn) {
    loadFinerDefaultsBtn.addEventListener("click", () => {
      loadFinerDetailsDefaults();
    });
  }

  inputsPanel.querySelectorAll<HTMLInputElement>("input[data-cell]").forEach((el) => {
    el.addEventListener("keydown", (ev) => {
      const stepCell = el.dataset.cell as keyof RawInputs;
      if ((ev.key === "ArrowUp" || ev.key === "ArrowDown") && Number.isFinite(STEPPER_CONFIG[stepCell])) {
        ev.preventDefault();
        applyStepperDelta(stepCell, ev.key === "ArrowUp" ? 1 : -1);
        return;
      }
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
      markFieldTouched(cell);
      if (cell === "B4" || cell === "B19") {
        clearAgeConstraintAttemptMessages();
      }
      const def = INPUT_DEFINITIONS.find((d) => d.cell === cell)!;
      const prevValue = rawInputs[cell];
      const allowNegative = fieldAllowsNegative(cell);
      if (def.type === "integer") {
        const sanitized = sanitizeNumericText(el.value, "integer", allowNegative);
        if (sanitized !== el.value) el.value = sanitized;
      } else if (def.type === "number") {
        const sanitized = sanitizeNumericText(el.value, "number", allowNegative);
        if (sanitized !== el.value) el.value = sanitized;
      } else if (def.type === "percent") {
        const sanitized = sanitizeNumericText(el.value, "percent", allowNegative);
        if (sanitized !== el.value) el.value = sanitized;
      }

      let nextValue = def.type === "text"
        ? el.value
        : def.type === "percent"
          ? parsePercentInput(el.value, allowNegative)
          : def.type === "integer"
            ? parseIntegerInput(el.value, allowNegative)
            : parseNumberInput(el.value, allowNegative);

      if (def.type !== "text") {
        nextValue = applyFieldNumericConstraint(cell, nextValue as number | null);
      }

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
      if (String(cell) === "B4") {
        enforceLiveUntilAgeConstraint(true);
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
      markFieldTouched(cell);
      if (cell === "B4" || cell === "B19") {
        clearAgeConstraintAttemptMessages();
      }
      const def = INPUT_DEFINITIONS.find((d) => d.cell === cell)!;
      if (def.type !== "text") {
        const current = rawInputs[cell];
        const numericCurrent = typeof current === "number" && Number.isFinite(current) ? current : null;
        const constrained = applyFieldNumericConstraint(cell, numericCurrent);
        if (constrained !== numericCurrent) {
          rawInputs[cell] = constrained;
          queueRecalc();
        }
      }
      const pruned = pruneInactiveFieldState(fieldState);
      let changedByPrune = false;
      for (const key of Object.keys(pruned) as Array<FieldId>) {
        if (fieldState[key] !== pruned[key]) changedByPrune = true;
        fieldState[key] = pruned[key];
      }
      if (changedByPrune) queueRecalc();
      if (String(cell) === "B4" && rawInputs.B4 !== null && rawInputs.B4 !== undefined) {
        const age = Number(rawInputs.B4);
        if (Number.isFinite(age)) {
          rawInputs.B4 = Math.max(18, Math.min(100, Math.round(age)));
          enforceLiveUntilAgeConstraint(true);
          queueRecalc();
        }
      }
      if (def.type === "percent" || def.type === "integer" || def.type === "number") {
        el.value = formatFieldValue(def, rawInputs[cell]);
      }
      if (def.type === "text") {
        if (STRUCTURAL_RERENDER_CELLS.has(String(cell)) || changedByPrune) {
          renderInputs();
        }
        return;
      }
      if (STRUCTURAL_RERENDER_CELLS.has(String(cell)) || changedByPrune) {
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

  inputsPanel.querySelectorAll<HTMLButtonElement>(".field-step-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      stopStepperHold();
      const cell = btn.dataset.stepCell as keyof RawInputs;
      if (!cell) return;
      const dir = Number(btn.dataset.stepDir);
      if (!Number.isFinite(dir) || (dir !== -1 && dir !== 1)) return;
      applyStepperDelta(cell, dir);
      stepperHoldTimeout = window.setTimeout(() => {
        stepperHoldInterval = window.setInterval(() => applyStepperDelta(cell, dir), 80);
      }, 320);
    });
  });

  if (!stepperHoldListenersBound) {
    const stopHoldEvents = ["pointerup", "pointercancel", "pointerleave"] as const;
    for (const eventName of stopHoldEvents) {
      inputsPanel.addEventListener(eventName, stopStepperHold);
    }
    window.addEventListener("blur", stopStepperHold);
    stepperHoldListenersBound = true;
  }

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

  const liquidationRoot = inputsPanel.querySelector<HTMLElement>('[data-liquidation-reorder="true"]');
  if (liquidationRoot && liquidationRoot.dataset.dragEnabled === "true") {
    let draggingIdx: number | null = null;
    const items = Array.from(liquidationRoot.querySelectorAll<HTMLElement>(".liquidation-item"));

    const clearDropMarkers = () => {
      items.forEach((item) => item.classList.remove("is-drop-target"));
    };

    items.forEach((item) => {
      item.addEventListener("dragstart", (ev) => {
        draggingIdx = Number(item.dataset.liquidationIdx);
        item.classList.add("is-dragging");
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", String(draggingIdx));
        }
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
        clearDropMarkers();
        draggingIdx = null;
      });

      item.addEventListener("dragover", (ev) => {
        if (draggingIdx === null) return;
        ev.preventDefault();
        clearDropMarkers();
        item.classList.add("is-drop-target");
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("is-drop-target");
      });

      item.addEventListener("drop", (ev) => {
        ev.preventDefault();
        item.classList.remove("is-drop-target");
        if (draggingIdx === null) return;
        const targetIdx = Number(item.dataset.liquidationIdx);
        if (!Number.isFinite(targetIdx) || targetIdx === draggingIdx) return;

        const active = activePropertyConfigs();
        const order = buildPropertyLiquidationOrder(active);
        const fromPos = order.findIndex((cfg) => cfg.idx === draggingIdx);
        const toBasePos = order.findIndex((cfg) => cfg.idx === targetIdx);
        if (fromPos < 0 || toBasePos < 0) return;

        const rect = item.getBoundingClientRect();
        const insertAfter = ev.clientY > rect.top + rect.height / 2;
        const toPos = toBasePos + (insertAfter ? 1 : 0);
        const [moved] = order.splice(fromPos, 1);
        const normalizedToPos = toPos > fromPos ? toPos - 1 : toPos;
        order.splice(Math.max(0, Math.min(order.length, normalizedToPos)), 0, moved);

        persistPropertyLiquidationOrder(order, active);
        setRetireCheckMessage(null);
        queueRecalc();
        renderInputs();
      });
    });
  }

  restorePanelCursorState(cursorState);
  renderValidationState(latestValidationMessages);
}

function getOrCreateChartTooltip(canvas: HTMLCanvasElement): HTMLDivElement | null {
  const existing = chartTooltips.get(canvas);
  if (existing) return existing;
  const card = canvas.closest<HTMLElement>(".chart-card");
  if (!card) return null;
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  card.appendChild(tooltip);
  chartTooltips.set(canvas, tooltip);
  return tooltip;
}

function hideChartTooltip(canvas: HTMLCanvasElement): void {
  const tooltip = chartTooltips.get(canvas);
  if (!tooltip) return;
  tooltip.hidden = true;
}

function clearChartHoverDelay(canvas: HTMLCanvasElement): void {
  const handle = chartHoverDelayHandle.get(canvas);
  if (handle !== null && handle !== undefined) {
    window.clearTimeout(handle);
  }
  chartHoverDelayHandle.set(canvas, null);
  chartHoverPending.set(canvas, null);
}

function positionChartTooltip(canvas: HTMLCanvasElement, tooltip: HTMLDivElement, clientX: number, clientY: number): void {
  const card = canvas.closest<HTMLElement>(".chart-card");
  if (!card) return;
  const cardRect = card.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const pad = 10;
  const offset = 14;

  let left = clientX - cardRect.left + offset;
  let top = clientY - cardRect.top + offset;

  if (left + tooltipRect.width > cardRect.width - pad) {
    left = clientX - cardRect.left - tooltipRect.width - offset;
  }
  if (left < pad) left = pad;
  if (top + tooltipRect.height > cardRect.height - pad) {
    top = cardRect.height - tooltipRect.height - pad;
  }
  if (top < pad) top = pad;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function renderChartTooltip(
  canvas: HTMLCanvasElement,
  data: ChartHoverData,
  tooltip: HTMLDivElement,
  idx: number,
  clientX: number,
  clientY: number
): void {
  const age = Math.round(data.ages[idx] ?? 0);
  const year = Math.round(data.years[idx] ?? 0);
  const primary = data.seriesPrimary[idx];
  const comparison = data.seriesComparison[idx];
  const delta = Number.isFinite(primary) && Number.isFinite(comparison)
    ? Math.abs(primary - comparison)
    : Number.NaN;
  const retireNowAge = data.retireNowAge !== null ? Math.round(data.retireNowAge) : null;
  const statutoryAge = data.statutoryAge !== null ? Math.round(data.statutoryAge) : null;
  const contextEvents = data.contextByYear.get(year) ?? [];
  const contextAmounts = contextEvents
    .map((event) => event.amount)
    .filter((amount): amount is number => Number.isFinite(amount));
  const valueMode = chooseTooltipValueMode([primary, comparison, delta, ...contextAmounts]);
  const compactUnit = chooseTooltipCompactUnit([primary, comparison, delta, ...contextAmounts]);
  const contextItemsHtml = contextEvents
    .map((event) => {
      const amount = event.amount;
      const amountText = amount !== null && Number.isFinite(amount) ? ` (${formatImpact(amount)})` : "";
      return `<li>${escapeHtml(`${event.label}${amountText}`)}</li>`;
    })
    .join("");

  tooltip.innerHTML = `
    <div class="chart-tooltip-head">
      <div class="chart-tooltip-age">Age ${age} · ${year}</div>
      <div class="chart-tooltip-metric-chip">${escapeHtml(data.metricLabel)}</div>
    </div>
    <div class="chart-tooltip-row">
      <span class="chart-tooltip-key">Normal (${statutoryAge === null ? "—" : String(statutoryAge)})</span>
      <span class="chart-tooltip-value">${escapeHtml(formatTooltipCurrency(comparison, valueMode, compactUnit))}</span>
    </div>
    <div class="chart-tooltip-row">
      <span class="chart-tooltip-key">Early (${retireNowAge === null ? "—" : String(retireNowAge)})</span>
      <span class="chart-tooltip-value">${escapeHtml(formatTooltipCurrency(primary, valueMode, compactUnit))}</span>
    </div>
    <div class="chart-tooltip-row is-delta">
      <span class="chart-tooltip-key">Difference</span>
      <span class="chart-tooltip-value">${escapeHtml(formatTooltipCurrency(delta, valueMode, compactUnit))}</span>
    </div>
    ${contextItemsHtml ? `<div class="chart-tooltip-context"><ul class="chart-tooltip-context-list">${contextItemsHtml}</ul></div>` : ""}
  `;
  tooltip.hidden = false;
  positionChartTooltip(canvas, tooltip, clientX, clientY);
}

function setupChartHover(canvas: HTMLCanvasElement): void {
  canvas.addEventListener("pointermove", (ev) => {
    const data = chartHoverData.get(canvas);
    const tooltip = getOrCreateChartTooltip(canvas);
    if (!data || !tooltip || data.ages.length === 0 || data.years.length === 0) {
      clearChartHoverDelay(canvas);
      chartHoverIndex.set(canvas, null);
      hideChartTooltip(canvas);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      clearChartHoverDelay(canvas);
      hideChartTooltip(canvas);
      return;
    }

    const cx = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((ev.clientY - rect.top) / rect.height) * canvas.height;
    const plotLeft = CHART_PAD.l;
    const plotRight = canvas.width - CHART_PAD.r;
    const plotTop = CHART_PAD.t;
    const plotBottom = canvas.height - CHART_PAD.b;
    if (cx < plotLeft || cx > plotRight || cy < plotTop || cy > plotBottom) {
      clearChartHoverDelay(canvas);
      if ((chartHoverIndex.get(canvas) ?? null) !== null) {
        chartHoverIndex.set(canvas, null);
        drawChart(canvas, data.ages, data.seriesPrimary, data.seriesComparison);
      }
      hideChartTooltip(canvas);
      return;
    }

    const maxIndex = Math.max(0, data.ages.length - 1);
    const ratio = maxIndex === 0 ? 0 : (cx - plotLeft) / Math.max(1, plotRight - plotLeft);
    const idx = Math.max(0, Math.min(maxIndex, Math.round(ratio * maxIndex)));
    if ((chartHoverIndex.get(canvas) ?? null) !== idx) {
      chartHoverIndex.set(canvas, idx);
      drawChart(canvas, data.ages, data.seriesPrimary, data.seriesComparison, idx);
    }
    const pending = { idx, clientX: ev.clientX, clientY: ev.clientY };
    chartHoverPending.set(canvas, pending);

    if (tooltip.hidden) {
      const existingHandle = chartHoverDelayHandle.get(canvas);
      if (existingHandle !== null && existingHandle !== undefined) {
        window.clearTimeout(existingHandle);
      }
      const nextHandle = window.setTimeout(() => {
        const latest = chartHoverPending.get(canvas);
        const latestData = chartHoverData.get(canvas);
        const latestTooltip = getOrCreateChartTooltip(canvas);
        chartHoverDelayHandle.set(canvas, null);
        if (!latest || !latestData || !latestTooltip) return;
        renderChartTooltip(canvas, latestData, latestTooltip, latest.idx, latest.clientX, latest.clientY);
      }, CHART_TOOLTIP_DELAY_MS);
      chartHoverDelayHandle.set(canvas, nextHandle);
    } else {
      clearChartHoverDelay(canvas);
      renderChartTooltip(canvas, data, tooltip, idx, ev.clientX, ev.clientY);
    }
  });

  const dismiss = () => {
    clearChartHoverDelay(canvas);
    const data = chartHoverData.get(canvas);
    if (data && (chartHoverIndex.get(canvas) ?? null) !== null) {
      chartHoverIndex.set(canvas, null);
      drawChart(canvas, data.ages, data.seriesPrimary, data.seriesComparison);
    }
    hideChartTooltip(canvas);
  };
  canvas.addEventListener("pointerleave", dismiss);
  canvas.addEventListener("blur", dismiss);
}

function drawChart(
  canvas: HTMLCanvasElement,
  x: number[],
  a: number[],
  b: number[],
  hoverIdx: number | null = null
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const pad = CHART_PAD;
  const allY = [...a, ...b];
  const rawMinY = Math.min(...allY);
  const rawMaxY = Math.max(...allY);
  const axisHasMeaningfulRange = Math.abs(rawMaxY - rawMinY) > 1e-6 || Math.abs(rawMaxY) > 1e-6 || Math.abs(rawMinY) > 1e-6;
  const axisLabelInset = 10;

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

  let tickStep = niceStep(effectiveSpan / targetTicks);
  let yMinTick = Math.floor(rawMinY / tickStep) * tickStep;
  let yMaxTick = Math.ceil(rawMaxY / tickStep) * tickStep;
  while ((yMaxTick - yMinTick) / tickStep > 8) {
    tickStep = niceStep(tickStep * 1.5);
    yMinTick = Math.floor(rawMinY / tickStep) * tickStep;
    yMaxTick = Math.ceil(rawMaxY / tickStep) * tickStep;
  }

  const axisAbsMax = Math.max(Math.abs(yMinTick), Math.abs(yMaxTick));
  const axisUnit: { div: number; suffix: "" | "k" | "m" | "b" } =
    axisAbsMax >= 1_000_000_000 ? { div: 1_000_000_000, suffix: "b" } :
    axisAbsMax >= 1_000_000 ? { div: 1_000_000, suffix: "m" } :
    axisAbsMax >= 1_000 ? { div: 1_000, suffix: "k" } :
    { div: 1, suffix: "" };
  const axisStepScaled = tickStep / axisUnit.div;
  const axisDecimals = axisStepScaled < 1 ? 1 : 0;
  const formatAxisCurrency = (value: number): string => {
    const sign = value < 0 ? "-" : "";
    const symbol = currentCurrencySymbol();
    if (axisUnit.div === 1) return `${sign}${symbol}${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
    const scaled = Math.abs(value) / axisUnit.div;
    const rounded = Number(scaled.toFixed(axisDecimals));
    return `${sign}${symbol}${rounded.toLocaleString("en-US", {
      minimumFractionDigits: axisDecimals,
      maximumFractionDigits: axisDecimals
    })}${axisUnit.suffix}`;
  };

  const minY = yMinTick;
  const maxY = yMaxTick;
  const ySpan = maxY - minY || 1;
  const xp = (i: number) => pad.l + (i / Math.max(1, x.length - 1)) * (w - pad.l - pad.r);
  const yp = (v: number) => h - pad.b - ((v - minY) / ySpan) * (h - pad.t - pad.b);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const primaryColor = CHART_PRIMARY_COLOR;
  const comparisonColor = CHART_COMPARISON_COLOR;

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
      ctx.strokeStyle = "rgba(100, 116, 139, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(w - pad.r, yy);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "#c8d3df";
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

  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < x.length) {
    const hoverX = xp(hoverIdx);
    ctx.save();
    ctx.strokeStyle = "rgba(71, 85, 105, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hoverX, pad.t);
    ctx.lineTo(hoverX, h - pad.b);
    ctx.stroke();
    ctx.restore();
  }

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
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  if (axisHasMeaningfulRange) {
    for (let yv = yMinTick; yv <= yMaxTick + 0.5; yv += tickStep) {
      const yy = yp(yv);
      ctx.fillStyle = "#1f2937";
      ctx.fillText(formatAxisCurrency(yv), axisLabelInset, yy + 4);
    }
  }

  if (x.length > 0) {
    const startAge = Math.round(x[0]);
    const endAge = Math.round(x[x.length - 1]);
    const ageSpan = Math.max(0, endAge - startAge);
    const majorTickStep = ageSpan > 28 ? 4 : 2;
    for (let i = 0; i < x.length; i += 1) {
      const age = Math.round(x[i]);
      const xx = xp(i);
      ctx.strokeStyle = "#cfd8e3";
      ctx.beginPath();
      ctx.moveTo(xx, h - pad.b);
      const isMajorTick = (age - startAge) % majorTickStep === 0;
      ctx.lineTo(xx, h - pad.b + (isMajorTick ? 5 : 3));
      ctx.stroke();
      if (!isMajorTick) continue;
      ctx.fillStyle = "#1f2937";
      const label = String(age);
      const labelWidth = ctx.measureText(label).width;
      ctx.fillText(label, xx - labelWidth / 2, h - 8);
    }
  }
}

function recalc(): void {
  syncEarlyRetirementControl(false);
  clearChartHoverDelay(cashCanvas);
  clearChartHoverDelay(nwCanvas);
  chartHoverIndex.set(cashCanvas, null);
  chartHoverIndex.set(nwCanvas, null);
  hideChartTooltip(cashCanvas);
  hideChartTooltip(nwCanvas);

  const result = runModel(fieldState, uiState);
  renderValidationState(result.validationMessages);
  const visibleValidationMessages = getVisibleValidationMessages(result.validationMessages);
  const hasBlockingErrors = hasProjectionBlockingValidation(result.validationMessages);
  const hasVisibleBlockingErrors = hasProjectionBlockingValidation(visibleValidationMessages);
  const statutory = getStatutoryAge();
  applyRetireCheckReadiness(result.validationMessages, statutory);
  if (hasBlockingErrors) {
    cashLegendA.textContent = "Retire at early age";
    cashLegendB.textContent = statutory === null ? "Retire at statutory age" : `Retire at ${statutory}`;
    nwLegendA.textContent = "Retire at early age";
    nwLegendB.textContent = statutory === null ? "Retire at statutory age" : `Retire at ${statutory}`;
    chartHoverData.delete(cashCanvas);
    chartHoverData.delete(nwCanvas);
    const chartLines = hasVisibleBlockingErrors
      ? getProjectionBlockingLines(visibleValidationMessages)
      : [PROJECTION_EMPTY_GUIDANCE];
    const timelineMessage = hasVisibleBlockingErrors
      ? chartLines[0]
      : PROJECTION_EMPTY_GUIDANCE;
    drawEmptyChart(cashCanvas, chartLines);
    drawEmptyChart(nwCanvas, chartLines);
    clearTimeline(timelineMessage);
    return;
  }

  const contextByYear = buildChartContextByYear(result);
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
    result.outputs.cashSeriesNorm
  );
  chartHoverData.set(cashCanvas, {
    ages: result.outputs.ages,
    years: result.outputs.years,
    seriesPrimary: result.outputs.cashSeriesEarly,
    seriesComparison: result.outputs.cashSeriesNorm,
    retireNowAge: uiState.earlyRetirementAge,
    statutoryAge: statutory,
    metricLabel: "Cash",
    contextByYear
  });
  drawChart(
    nwCanvas,
    result.outputs.ages,
    result.outputs.netWorthSeriesEarly,
    result.outputs.netWorthSeriesNorm
  );
  chartHoverData.set(nwCanvas, {
    ages: result.outputs.ages,
    years: result.outputs.years,
    seriesPrimary: result.outputs.netWorthSeriesEarly,
    seriesComparison: result.outputs.netWorthSeriesNorm,
    retireNowAge: uiState.earlyRetirementAge,
    statutoryAge: statutory,
    metricLabel: "Net worth",
    contextByYear
  });
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
  spinner.min = String(getMinEarlyRetirementAge());
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
  uiState.earlyRetirementAge = Math.max(getMinEarlyRetirementAge(), Math.min(statutory, v));
  spinner.value = String(uiState.earlyRetirementAge);
  updateEarlyRetirementButtons(statutory);
  setRetireCheckMessage(null);
  queueRecalc();
});

spinnerDown.addEventListener("click", () => adjustEarlyRetirementAge(-1));
spinnerUp.addEventListener("click", () => adjustEarlyRetirementAge(1));

retireCheckButton.addEventListener("click", () => {
  validationRevealAll = true;
  const statutory = getStatutoryAge();
  if (statutory === null) {
    updateRetireCheckButton(null);
    setRetireCheckMessage(null);
    renderValidationState(latestValidationMessages);
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
  const currentAge = getCurrentAge();
  const positiveMessage = currentAge !== null && canRetAge === currentAge + 1
    ? "Yes! You can retire next year!"
    : `Not quite, but you can retire at ${canRetAge}`;
  setRetireCheckMessage(positiveMessage, "positive");
  queueRecalc();
});

setupChartHover(cashCanvas);
setupChartHover(nwCanvas);

renderInputs();
recalc();
