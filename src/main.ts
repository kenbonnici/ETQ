import "./app.css";
import { pruneInactiveFieldState } from "./model/activation";
import { runModel } from "./model";
import { createEmptyFieldState } from "./model/excelAdapter";
import type { RunModelResult } from "./model/index";
import {
  INPUT_DEFINITION_BY_FIELD_ID,
  ALLOW_NEGATIVE_FIELDS,
  COERCED_NUMERIC_BOUNDS,
  FINER_DETAILS_COL_C_DEFAULTS,
  FINER_DETAILS_FIELDS,
  InputDefinition,
  INPUT_DEFINITIONS,
  SKIP_REVEAL_CRITICAL_FIELDS,
  ValidationMessage
} from "./model/inputSchema";
import { EXCEL_BASELINE_SPECIMEN } from "./model/parity/excelBaselineSpecimen";
import { FieldId, ModelUiState, RawInputValue, ScenarioOutputs } from "./model/types";
import {
  ASSET_OF_VALUE_RUNTIME_GROUPS,
  DEPENDENT_RUNTIME_GROUPS,
  DOWNSIZING_FIELDS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  INCOME_EVENT_RUNTIME_GROUPS,
  OTHER_LOAN_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS,
  STOCK_MARKET_CRASH_RUNTIME_GROUPS
} from "./ui/runtimeFields";
import {
  activePropertyConfigs,
  anyValue,
  asNumber,
  buildPropertyLiquidationAssignments,
  buildPropertyLiquidationBuckets,
  buildTimelineMilestones,
  collectSpecificLabelsByYear,
  deriveRuntimeVisibilityState,
  FIELD_DISPLAY_ORDER_OVERRIDE,
  FIELD_STEPPER_DECIMALS,
  FIELD_STEPPER_STEPS,
  fieldVisible,
  getDynamicFieldLabel,
  getDynamicGroupTail,
  hasExplicitPropertyLiquidationPreferences,
  hasRetireCheckEssentialErrors,
  isBlank,
  isDuplicateLiquidationRank,
  isOutOfRangeLiquidationRank,
  normalizeTimelineLabel,
  PROPERTY_LIQUIDATION_FIELDS,
  shouldRerenderOnInput,
  STRUCTURAL_RERENDER_FIELDS,
  syncManualPropertyOrderForNewProperties
} from "./ui/runtimeRules";
import {
  createEmptyLivingExpenseCategoryValues,
  hasAnyLivingExpenseCategoryValue,
  LIVING_EXPENSE_CATEGORY_DEFINITIONS,
  LivingExpenseCategoryId,
  LivingExpenseCategoryValues,
  LivingExpensesMode,
  seedLivingExpenseCategoryValuesFromTotal,
  sumLivingExpenseCategoryValues
} from "./ui/livingExpenses";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const fieldState = createEmptyFieldState();
for (const [fieldId, value] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS)) {
  fieldState[fieldId as FieldId] = value;
}

let uiState: ModelUiState = {
  deeperDiveOpen: false,
  finerDetailsOpen: false,
  earlyRetirementAge: 65,
  manualPropertyLiquidationOrder: false
};

let debounceHandle: number | null = null;
let pendingFocusFieldId: FieldId | null = null;
let pendingLiquidationControl: { propertyIdx: number; control: "up" | "down" | "toggle"; pulse: boolean } | null = null;
let selectedCurrency = "EUR";
let stepperHoldTimeout: number | null = null;
let stepperHoldInterval: number | null = null;
let stepperHoldListenersBound = false;
let excelLoadBusy = false;
let latestValidationMessages: ValidationMessage[] = [];
let validationRevealAll = false;
const touchedCells = new Set<FieldId>();
const attemptedFieldMessages = new Map<FieldId, ValidationMessage>();
let latestRunResult: RunModelResult | null = null;
let cashflowScenario: "early" | "norm" = "early";
let projectionSectionOpen = false;
let projectionHasMounted = false;
let projectionActiveTab: ProjectionSectionKey = "cashflow";
let previousActivePropertyIndices = new Set<number>();
const cashflowExpandedGroups = new Set<string>(["cash-bridge", "inflows", "outflows"]);
const networthExpandedGroups = new Set<string>(["networth-properties", "networth-loans"]);
let liquidationPulseTimeout: number | null = null;

const TIMELINE_EDGE_PADDING = 26;
const MILESTONE_EVENT_MIN_ABS_AMOUNT = 1000;
const TIMELINE_ROW_HEIGHT_DEFAULT = 20;
const TIMELINE_ROW_GAP_EXTRA = 2;
const TIMELINE_ENDCAP_CLEARANCE = 18;
const CHART_PAD = { l: 72, r: 24, t: 26, b: 34 } as const;
const CHART_MIN_LEFT_PAD = 48;
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
const STEPPER_CONFIG = FIELD_STEPPER_STEPS;
const STEP_DECIMALS = FIELD_STEPPER_DECIMALS;
const LIVING_EXPENSES_FIELD_ID = RUNTIME_FIELDS.annualLivingExpenses;
const LIVING_EXPENSES_DEF = INPUT_DEFINITION_BY_FIELD_ID[LIVING_EXPENSES_FIELD_ID];
const DOWNSIZING_MODE_OPTIONS = ["Buy", "Rent"] as const;

function getDynamicMinConstraint(fieldId: FieldId): number | null {
  if (fieldId !== RUNTIME_FIELDS.lifeExpectancyAge) return null;
  const currentAge = getCurrentAge();
  if (currentAge === null) return null;
  return currentAge;
}

function applyFieldNumericConstraint(fieldId: FieldId, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  let bounded = value;
  const cfg = COERCED_NUMERIC_BOUNDS[fieldId];
  if (cfg) {
    if (Number.isFinite(cfg.min)) bounded = Math.max(cfg.min as number, bounded);
    if (Number.isFinite(cfg.max)) bounded = Math.min(cfg.max as number, bounded);
  }
  const dynamicMin = getDynamicMinConstraint(fieldId);
  if (Number.isFinite(dynamicMin)) bounded = Math.max(dynamicMin as number, bounded);
  return bounded;
}

function enforceLiveUntilAgeConstraint(syncVisibleInput: boolean): boolean {
  const current = fieldState[RUNTIME_FIELDS.lifeExpectancyAge];
  const numericCurrent = typeof current === "number" && Number.isFinite(current) ? current : null;
  const constrained = applyFieldNumericConstraint(RUNTIME_FIELDS.lifeExpectancyAge, numericCurrent);
  if (constrained === numericCurrent) return false;
  fieldState[RUNTIME_FIELDS.lifeExpectancyAge] = constrained;
  if (syncVisibleInput) {
    const input = inputsPanel.querySelector<HTMLInputElement>(`input[data-field-id="${RUNTIME_FIELDS.lifeExpectancyAge}"]`);
    const def = INPUT_DEFINITION_BY_FIELD_ID[RUNTIME_FIELDS.lifeExpectancyAge];
    if (input && def && document.activeElement !== input) {
      input.value = formatFieldValue(def, constrained);
    }
  }
  return true;
}

app.innerHTML = `
  <div id="dashboard-anchor" class="scroll-anchor" aria-hidden="true"></div>
  <main class="layout" id="dashboard-view">
    <section class="left" id="inputs-panel"></section>
    <section class="right">
      <header class="retirement-control">
        <div class="retirement-control-actions">
          <button id="retire-check-btn" class="retire-check-btn" type="button">Enough to quit?</button>
        </div>
        <p id="retire-check-result" class="retire-check-result" hidden></p>
        <div class="retirement-stepper">
          <span class="retirement-stepper-label">Retire at</span>
          <button id="early-ret-down" class="step-btn" type="button" aria-label="Decrease early retirement age">-</button>
          <input id="early-ret-age" type="number" min="18" max="100" step="1" value="" inputmode="numeric" pattern="[0-9]*" aria-label="Early retirement age" />
          <button id="early-ret-up" class="step-btn" type="button" aria-label="Increase early retirement age">+</button>
        </div>
      </header>
      <article class="chart-card" id="cash-chart-card">
        <div id="charts-anchor" class="scroll-anchor" aria-hidden="true"></div>
        <div class="chart-header">
          <h2>Cash</h2>
          <div class="chart-actions" id="cash-chart-actions">
            <button id="open-cashflow-btn" class="cashflow-nav-btn" type="button">Open cash flow</button>
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
        </div>
        <canvas id="cash-chart" width="920" height="300"></canvas>
      </article>
      <article class="chart-card">
        <div class="chart-header">
          <h2>Net Worth</h2>
          <div class="chart-actions" id="nw-chart-actions">
            <button id="open-networth-btn" class="cashflow-nav-btn" type="button">Open net worth</button>
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
  <div id="cashflow-anchor" class="scroll-anchor" aria-hidden="true"></div>
  <section class="cashflow-section" id="projection-section" hidden aria-hidden="true">
    <div class="cashflow-section-shell">
      <header class="cashflow-section-header">
        <div class="projection-toolbar-main">
          <div class="projection-tabs" role="tablist" aria-label="Projection table">
            <button id="projection-tab-cashflow" class="projection-tab-btn" type="button">Cash Flow</button>
            <button id="projection-tab-networth" class="projection-tab-btn" type="button">Net Worth</button>
          </div>
          <button
            id="projection-section-collapse"
            class="cashflow-section-toggle-btn"
            type="button"
            aria-label="Collapse projection section"
            title="Collapse projection section"
          >
            <span aria-hidden="true">⌃</span>
          </button>
        </div>
        <div class="cashflow-section-controls projection-toolbar-controls">
          <div class="cashflow-scenario-toggle" role="tablist" aria-label="Projection scenario">
            <button id="projection-scenario-early" class="cashflow-scenario-btn" type="button">Early</button>
            <button id="projection-scenario-norm" class="cashflow-scenario-btn" type="button">Statutory</button>
          </div>
          <div class="cashflow-page-actions" aria-label="Projection table controls">
            <button id="projection-expand-all" class="cashflow-control-btn" type="button">Expand all</button>
            <button id="projection-collapse-all" class="cashflow-control-btn" type="button">Collapse all</button>
          </div>
        </div>
      </header>
      <section class="projection-content-panel">
        <section class="cashflow-table-panel projection-tab-panel" id="cashflow-table-panel"></section>
        <section class="cashflow-table-panel projection-tab-panel" id="networth-table-panel" hidden></section>
      </section>
    </div>
  </section>
`;

const inputsPanel = document.getElementById("inputs-panel") as HTMLDivElement;
const spinner = document.getElementById("early-ret-age") as HTMLInputElement;
const spinnerDown = document.getElementById("early-ret-down") as HTMLButtonElement;
const spinnerUp = document.getElementById("early-ret-up") as HTMLButtonElement;
const retireCheckResult = document.getElementById("retire-check-result") as HTMLParagraphElement;
const retireCheckButton = document.getElementById("retire-check-btn") as HTMLButtonElement;
const openCashflowButton = document.getElementById("open-cashflow-btn") as HTMLButtonElement;
const openNetworthButton = document.getElementById("open-networth-btn") as HTMLButtonElement;
const cashCanvas = document.getElementById("cash-chart") as HTMLCanvasElement;
const nwCanvas = document.getElementById("nw-chart") as HTMLCanvasElement;
const cashChartActions = document.getElementById("cash-chart-actions") as HTMLDivElement;
const nwChartActions = document.getElementById("nw-chart-actions") as HTMLDivElement;
const cashLegend = document.getElementById("cash-legend") as HTMLDivElement;
const cashLegendA = document.getElementById("cash-legend-a") as HTMLSpanElement;
const cashLegendB = document.getElementById("cash-legend-b") as HTMLSpanElement;
const nwLegend = document.getElementById("nw-legend") as HTMLDivElement;
const nwLegendA = document.getElementById("nw-legend-a") as HTMLSpanElement;
const nwLegendB = document.getElementById("nw-legend-b") as HTMLSpanElement;
const dashboardAnchorEl = document.getElementById("dashboard-anchor") as HTMLElement;
const timelinePanel = document.getElementById("timeline-panel") as HTMLDivElement;
const timelineScroll = document.getElementById("timeline-scroll") as HTMLDivElement;
const timelineTrack = document.getElementById("timeline-track") as HTMLDivElement;
const cashflowAnchorEl = document.getElementById("cashflow-anchor") as HTMLElement;
const projectionSectionEl = document.getElementById("projection-section") as HTMLElement;
const projectionTabCashflowButton = document.getElementById("projection-tab-cashflow") as HTMLButtonElement;
const projectionTabNetworthButton = document.getElementById("projection-tab-networth") as HTMLButtonElement;
const projectionScenarioEarlyButton = document.getElementById("projection-scenario-early") as HTMLButtonElement;
const projectionScenarioNormButton = document.getElementById("projection-scenario-norm") as HTMLButtonElement;
const projectionExpandAllButton = document.getElementById("projection-expand-all") as HTMLButtonElement;
const projectionCollapseAllButton = document.getElementById("projection-collapse-all") as HTMLButtonElement;
const projectionSectionCollapseButton = document.getElementById("projection-section-collapse") as HTMLButtonElement;
const cashflowTablePanel = document.getElementById("cashflow-table-panel") as HTMLDivElement;
const networthTablePanel = document.getElementById("networth-table-panel") as HTMLDivElement;

const sectionState = {
  quickStartOpen: true,
  deeperOpen: false,
  finerOpen: false
};

let visibleDependents = 1;
const dependentFieldSets = DEPENDENT_RUNTIME_GROUPS.map((group) => group.fields);
let visibleProperties = 1;
const propertyFieldSets = PROPERTY_RUNTIME_GROUPS.map((group) => group.coreFields);
let visibleAssetsOfValue = 1;
const assetOfValueFieldSets = ASSET_OF_VALUE_RUNTIME_GROUPS.map((group) => group.coreFields);
const PROPERTY_LIQUIDATION_CELLS = PROPERTY_LIQUIDATION_FIELDS;
const FINER_DETAILS_FIELD_IDS = FINER_DETAILS_FIELDS;
let visibleIncomeEvents = 1;
const incomeEvent1Fields = INCOME_EVENT_RUNTIME_GROUPS[0].fields;
const incomeEvent2Fields = INCOME_EVENT_RUNTIME_GROUPS[1].fields;
const incomeEvent3Fields = INCOME_EVENT_RUNTIME_GROUPS[2].fields;
let visibleExpenseEvents = 1;
const expenseEvent1Fields = EXPENSE_EVENT_RUNTIME_GROUPS[0].fields;
const expenseEvent2Fields = EXPENSE_EVENT_RUNTIME_GROUPS[1].fields;
const expenseEvent3Fields = EXPENSE_EVENT_RUNTIME_GROUPS[2].fields;
let visibleStockMarketCrashes = 1;
const stockMarketCrashFieldSets = STOCK_MARKET_CRASH_RUNTIME_GROUPS.map((group) => group.revealFields);
const displayOrderOverride = FIELD_DISPLAY_ORDER_OVERRIDE;
const STRUCTURAL_RERENDER_CELLS = STRUCTURAL_RERENDER_FIELDS;
let livingExpensesMode: LivingExpensesMode = "single";
let livingExpenseCategoryValues: LivingExpenseCategoryValues = createEmptyLivingExpenseCategoryValues();

interface PanelCursorState {
  scrollTop: number;
  activeFieldId: FieldId | null;
  selectionStart: number | null;
  selectionEnd: number | null;
}

interface ProjectionScrollAnchor {
  rowId: string | null;
  offsetTop: number;
  scrollLeft: number;
  scrollTop: number;
}

type ProjectionSectionKey = "cashflow" | "networth";

interface ProjectionSectionConfig {
  key: ProjectionSectionKey;
  anchorEl: HTMLElement;
  tablePanel: HTMLDivElement;
  openButton: HTMLButtonElement;
  isOpen(): boolean;
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
  projection_month_override?: number | null;
  raw_inputs?: Partial<Record<string, unknown>>;
}

const SAMPLE_DATA_NUMERIC_OVERRIDES: Readonly<Partial<Record<FieldId, number>>> = {
  [RUNTIME_FIELDS.minimumCashBuffer]: 50_000,
  [RUNTIME_FIELDS.legacyAmount]: 1_000_000
};

interface ChartHoverData {
  ages: number[];
  years: number[];
  seriesPrimary: number[];
  seriesComparison: number[];
  zeroLineAlert: boolean;
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
let pendingCashflowScrollAnchor: ProjectionScrollAnchor | null = null;
let pendingNetworthScrollAnchor: ProjectionScrollAnchor | null = null;
let sharedProjectionScrollLeft = 0;
const pendingProjectionScrollRestoreFrame: Record<ProjectionSectionKey, number | null> = {
  cashflow: null,
  networth: null
};
let chartResizeFrame: number | null = null;

interface CanvasRenderMetrics {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

interface ChartPadMetrics {
  l: number;
  r: number;
  t: number;
  b: number;
}

function getCanvasDisplaySize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || Number(canvas.getAttribute("width")) || 920));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || Number(canvas.getAttribute("height")) || 296));
  return { width, height };
}

function alignToDevicePixel(value: number, dpr: number, lineWidth = 1): number {
  const scaledLineWidth = Math.max(1, Math.round(lineWidth * dpr));
  const offset = scaledLineWidth % 2 === 1 ? 0.5 / dpr : 0;
  return (Math.round((value - offset) * dpr) / dpr) + offset;
}

function alignTextCoordinate(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr;
}

function prepareCanvas(canvas: HTMLCanvasElement): CanvasRenderMetrics | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = getCanvasDisplaySize(canvas);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height, dpr };
}

function readChartPadMetrics(canvas: HTMLCanvasElement): ChartPadMetrics {
  const base = CHART_PAD;
  const left = Number(canvas.dataset.plotPadLeft);
  return {
    l: Number.isFinite(left) && left > 0 ? left : CHART_MIN_LEFT_PAD,
    r: base.r,
    t: base.t,
    b: base.b
  };
}

function formatAxisCurrencyParts(
  value: number,
  axisUnit: { div: number; suffix: "" | "k" | "m" | "b" },
  axisDecimals: number
): { prefix: string; amount: string } {
  const sign = value < 0 ? "-" : "";
  const symbol = currentCurrencySymbol();
  const prefix = `${sign}${symbol}`;
  if (axisUnit.div === 1) {
    return {
      prefix,
      amount: Math.round(Math.abs(value)).toLocaleString("en-US")
    };
  }
  const scaled = Math.abs(value) / axisUnit.div;
  const rounded = Math.round(scaled);
  return {
    prefix,
    amount: `${rounded.toLocaleString("en-US")}${axisUnit.suffix}`
  };
}

function measureYAxisLabelBlockWidth(
  ctx: CanvasRenderingContext2D,
  values: number[],
  axisUnit: { div: number; suffix: "" | "k" | "m" | "b" },
  axisDecimals: number,
  axisLabelFont: string,
  axisPrefixFont: string,
  axisPrefixGap: number
): number {
  let maxWidth = 0;
  for (const value of values) {
    const { prefix, amount } = formatAxisCurrencyParts(value, axisUnit, axisDecimals);
    ctx.font = axisLabelFont;
    const amountWidth = ctx.measureText(amount).width;
    ctx.font = axisPrefixFont;
    const prefixWidth = ctx.measureText(prefix).width;
    maxWidth = Math.max(maxWidth, prefixWidth + axisPrefixGap + amountWidth);
  }
  return Math.ceil(maxWidth);
}

function computeYAxisTickValues(rawMinY: number, rawMaxY: number): {
  axisUnit: { div: number; suffix: "" | "k" | "m" | "b" };
  axisDecimals: number;
  values: number[];
} {
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
  const values = Array.from({ length: Math.round((yMaxTick - yMinTick) / tickStep) + 1 }, (_, idx) => yMinTick + (tickStep * idx));
  return {
    axisUnit,
    axisDecimals,
    values
  };
}

function computeChartLeftPad(
  canvas: HTMLCanvasElement,
  seriesA: number[],
  seriesB: number[],
  axisLabelFont: string,
  axisPrefixFont: string,
  axisPrefixGap: number,
  axisLineGap: number,
  axisOuterMargin: number
): number {
  const metrics = prepareCanvas(canvas);
  if (!metrics) return CHART_MIN_LEFT_PAD;
  const { ctx } = metrics;
  const rawMinY = Math.min(...seriesA, ...seriesB);
  const rawMaxY = Math.max(...seriesA, ...seriesB);
  const axisHasMeaningfulRange = Math.abs(rawMaxY - rawMinY) > 1e-6 || Math.abs(rawMaxY) > 1e-6 || Math.abs(rawMinY) > 1e-6;
  if (!axisHasMeaningfulRange) return CHART_MIN_LEFT_PAD;
  const { axisUnit, axisDecimals, values } = computeYAxisTickValues(rawMinY, rawMaxY);
  const maxYAxisLabelWidth = measureYAxisLabelBlockWidth(
    ctx,
    values,
    axisUnit,
    axisDecimals,
    axisLabelFont,
    axisPrefixFont,
    axisPrefixGap
  );
  return Math.max(CHART_MIN_LEFT_PAD, axisOuterMargin + maxYAxisLabelWidth + axisLineGap);
}

function getProjectionSectionConfig(key: ProjectionSectionKey): ProjectionSectionConfig {
  return key === "cashflow"
    ? {
        key,
        anchorEl: cashflowAnchorEl,
        tablePanel: cashflowTablePanel,
        openButton: openCashflowButton,
        isOpen: () => projectionSectionOpen && projectionActiveTab === "cashflow"
      }
    : {
        key,
        anchorEl: cashflowAnchorEl,
        tablePanel: networthTablePanel,
        openButton: openNetworthButton,
        isOpen: () => projectionSectionOpen && projectionActiveTab === "networth"
      };
}

function capturePanelCursorState(): PanelCursorState {
  const active = document.activeElement as HTMLInputElement | null;
  const inPanel = !!active && inputsPanel.contains(active) && active.matches("input[data-field-id]");
  const supportsSelection = inPanel && active!.type !== "number";
  return {
    scrollTop: inputsPanel.scrollTop,
    activeFieldId: inPanel ? (active!.dataset.fieldId as FieldId | undefined) ?? null : null,
    selectionStart: supportsSelection ? active!.selectionStart : null,
    selectionEnd: supportsSelection ? active!.selectionEnd : null
  };
}

function syncVisibleRuntimeGroupsFromState(): void {
  const visibility = deriveRuntimeVisibilityState(fieldState);
  visibleDependents = visibility.visibleDependents;
  visibleProperties = visibility.visibleProperties;
  visibleAssetsOfValue = visibility.visibleAssetsOfValue;
  visibleIncomeEvents = visibility.visibleIncomeEvents;
  visibleExpenseEvents = visibility.visibleExpenseEvents;
  visibleStockMarketCrashes = visibility.visibleStockMarketCrashes;
}

function expandVisibleGroupCount(
  currentVisible: number,
  fieldSets: ReadonlyArray<readonly FieldId[]>
): number {
  let visible = currentVisible;
  for (let idx = fieldSets.length - 1; idx >= 1; idx -= 1) {
    if (anyValue(fieldState, fieldSets[idx])) {
      visible = Math.max(visible, idx + 1);
      break;
    }
  }
  return visible;
}

function restorePanelCursorState(state: PanelCursorState): void {
  inputsPanel.scrollTop = state.scrollTop;
  if (!state.activeFieldId) return;
  const input = inputsPanel.querySelector<HTMLInputElement>(`input[data-field-id="${state.activeFieldId}"]`);
  if (!input) return;
  input.focus({ preventScroll: true });
  if (input.type !== "number" && state.selectionStart !== null && state.selectionEnd !== null) {
    input.setSelectionRange(state.selectionStart, state.selectionEnd);
  }
}

function restorePendingLiquidationControl(): void {
  const pending = pendingLiquidationControl;
  pendingLiquidationControl = null;
  if (!pending) return;

  const button = pending.control === "toggle"
    ? inputsPanel.querySelector<HTMLButtonElement>(
      `[data-liquidation-idx="${pending.propertyIdx}"].liquidation-toggle`
    )
    : inputsPanel.querySelector<HTMLButtonElement>(
      `[data-liquidation-move="${pending.control}"][data-liquidation-idx="${pending.propertyIdx}"]`
    ) ?? inputsPanel.querySelector<HTMLButtonElement>(
      `[data-liquidation-idx="${pending.propertyIdx}"].liquidation-toggle`
    );
  if (!button) return;

  button.focus({ preventScroll: true });
  button.scrollIntoView({ block: "nearest", inline: "nearest" });

  if (!pending.pulse) return;
  const row = button.closest<HTMLElement>(".liquidation-item");
  if (!row) return;
  row.classList.add("just-moved");
  if (liquidationPulseTimeout !== null) {
    window.clearTimeout(liquidationPulseTimeout);
  }
  liquidationPulseTimeout = window.setTimeout(() => {
    row.classList.remove("just-moved");
    liquidationPulseTimeout = null;
  }, 550);
}

function getProjectionScrollContainer(tablePanel: HTMLElement): HTMLElement | null {
  return tablePanel.querySelector<HTMLElement>(".cashflow-table-scroll");
}

function clampProjectionScrollTop(scrollEl: HTMLElement, value: number): number {
  return Math.max(0, Math.min(value, scrollEl.scrollHeight - scrollEl.clientHeight));
}

function clampProjectionScrollLeft(scrollEl: HTMLElement, value: number): number {
  return Math.max(0, Math.min(value, scrollEl.scrollWidth - scrollEl.clientWidth));
}

function captureProjectionScrollContext(sectionKey: ProjectionSectionKey, rowId: string | null = null): ProjectionScrollAnchor | null {
  const section = getProjectionSectionConfig(sectionKey);
  if (!section.isOpen()) return null;
  const scrollEl = getProjectionScrollContainer(section.tablePanel);
  if (!scrollEl) return null;
  sharedProjectionScrollLeft = clampProjectionScrollLeft(scrollEl, scrollEl.scrollLeft);
  const resolvedRowId = rowId ?? (() => {
    const rows = Array.from(scrollEl.querySelectorAll<HTMLElement>("tr[data-row-id]"));
    const visibleRow = rows.find((candidate) => candidate.offsetTop + candidate.offsetHeight > scrollEl.scrollTop);
    return visibleRow?.dataset.rowId ?? null;
  })();
  if (!resolvedRowId) {
    return {
      rowId: null,
      offsetTop: 0,
      scrollLeft: scrollEl.scrollLeft,
      scrollTop: scrollEl.scrollTop
    };
  }
  const rowEl = scrollEl.querySelector<HTMLElement>(`tr[data-row-id="${resolvedRowId}"]`);
  if (!rowEl) {
    return {
      rowId: null,
      offsetTop: 0,
      scrollLeft: scrollEl.scrollLeft,
      scrollTop: scrollEl.scrollTop
    };
  }
  return {
    rowId: resolvedRowId,
    offsetTop: rowEl.offsetTop - scrollEl.scrollTop,
    scrollLeft: scrollEl.scrollLeft,
    scrollTop: scrollEl.scrollTop
  };
}

function restoreProjectionScrollContext(sectionKey: ProjectionSectionKey, anchor: ProjectionScrollAnchor | null): void {
  const section = getProjectionSectionConfig(sectionKey);
  if (!section.isOpen()) return;
  const scrollEl = getProjectionScrollContainer(section.tablePanel);
  if (!scrollEl) return;
  scrollEl.scrollLeft = clampProjectionScrollLeft(scrollEl, sharedProjectionScrollLeft);
  if (!anchor) return;
  const fallbackTop = clampProjectionScrollTop(scrollEl, anchor.scrollTop);
  if (!anchor.rowId) {
    scrollEl.scrollTop = fallbackTop;
    return;
  }
  const rowEl = scrollEl.querySelector<HTMLElement>(`tr[data-row-id="${anchor.rowId}"]`);
  if (!rowEl) {
    scrollEl.scrollTop = fallbackTop;
    return;
  }
  scrollEl.scrollTop = clampProjectionScrollTop(scrollEl, rowEl.offsetTop - anchor.offsetTop);
}

function queueProjectionScrollContextRestore(sectionKey: ProjectionSectionKey, anchor: ProjectionScrollAnchor | null): void {
  if (pendingProjectionScrollRestoreFrame[sectionKey] !== null) {
    cancelAnimationFrame(pendingProjectionScrollRestoreFrame[sectionKey]!);
    pendingProjectionScrollRestoreFrame[sectionKey] = null;
  }
  const scrollEl = getProjectionScrollContainer(getProjectionSectionConfig(sectionKey).tablePanel);
  scrollEl?.classList.add("is-restoring-scroll");
  pendingProjectionScrollRestoreFrame[sectionKey] = requestAnimationFrame(() => {
    restoreProjectionScrollContext(sectionKey, anchor);
    getProjectionScrollContainer(getProjectionSectionConfig(sectionKey).tablePanel)?.classList.remove("is-restoring-scroll");
    pendingProjectionScrollRestoreFrame[sectionKey] = null;
  });
}

function captureProjectionScrollAnchor(sectionKey: ProjectionSectionKey, rowId: string | null = null): ProjectionScrollAnchor | null {
  return captureProjectionScrollContext(sectionKey, rowId);
}

function restoreProjectionScrollAnchor(sectionKey: ProjectionSectionKey, anchor: ProjectionScrollAnchor | null): void {
  queueProjectionScrollContextRestore(sectionKey, anchor);
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

function markFieldTouched(fieldId: FieldId): void {
  touchedCells.add(fieldId);
}

function clearTouchedFields(fieldIds?: readonly FieldId[]): void {
  if (!fieldIds) {
    touchedCells.clear();
    return;
  }
  for (const fieldId of fieldIds) touchedCells.delete(fieldId);
}

function clearAttemptedFieldMessage(fieldId: FieldId): void {
  attemptedFieldMessages.delete(fieldId);
}

function clearAllAttemptedFieldMessages(): void {
  attemptedFieldMessages.clear();
}

function clearAgeConstraintAttemptMessages(): void {
  clearAttemptedFieldMessage(RUNTIME_FIELDS.currentAge);
  clearAttemptedFieldMessage(RUNTIME_FIELDS.statutoryRetirementAge);
}

function resetLivingExpensesHelperState(): void {
  livingExpensesMode = "single";
  livingExpenseCategoryValues = createEmptyLivingExpenseCategoryValues();
}

function getLivingExpensesCategoryTotal(): number | null {
  if (!hasAnyLivingExpenseCategoryValue(livingExpenseCategoryValues)) return null;
  return sumLivingExpenseCategoryValues(livingExpenseCategoryValues);
}

function syncLivingExpensesFieldFromExpandedMode(): void {
  fieldState[LIVING_EXPENSES_FIELD_ID] = getLivingExpensesCategoryTotal();
}

function syncRenderedLivingExpensesDerivedTotal(): void {
  const derivedTotalInput = inputsPanel.querySelector<HTMLInputElement>("[data-living-expenses-derived-total]");
  if (!derivedTotalInput) return;
  derivedTotalInput.value = formatFieldValue(LIVING_EXPENSES_DEF, getLivingExpensesCategoryTotal());
}

function setLivingExpensesMode(nextMode: LivingExpensesMode): void {
  if (livingExpensesMode === nextMode) return;
  if (nextMode === "expanded" && !hasAnyLivingExpenseCategoryValue(livingExpenseCategoryValues)) {
    const existingTotal = asNumber(fieldState[LIVING_EXPENSES_FIELD_ID]);
    if (existingTotal > 0) {
      livingExpenseCategoryValues = seedLivingExpenseCategoryValuesFromTotal(existingTotal);
    }
  }
  livingExpensesMode = nextMode;
  if (livingExpensesMode === "expanded") {
    syncLivingExpensesFieldFromExpandedMode();
  }
  setRetireCheckMessage(null);
  renderInputs();
  queueRecalc();
}

function setAttemptedFieldMessage(fieldId: FieldId, message: string): void {
  attemptedFieldMessages.set(fieldId, {
    fieldId,
    severity: "error",
    message,
    blocksProjection: true
  });
}

function getOrderedDefinitions(defs: InputDefinition[]): InputDefinition[] {
  return [...defs].sort((a, b) => {
    const ra = displayOrderOverride[a.fieldId] ?? a.row;
    const rb = displayOrderOverride[b.fieldId] ?? b.row;
    return ra - rb;
  });
}

function getVisibleInputOrder(): FieldId[] {
  const ordered = [
    ...getOrderedDefinitions(INPUT_DEFINITIONS.filter((def) => def.section === "QUICK START")),
    ...getOrderedDefinitions(INPUT_DEFINITIONS.filter((def) => def.section === "DEEPER DIVE")),
    ...getOrderedDefinitions(INPUT_DEFINITIONS.filter((def) => def.section === "FINER DETAILS"))
  ];
  return ordered
    .filter((def) => fieldVisible(fieldState, def.fieldId, {
      visibleDependents,
      visibleProperties,
      visibleAssetsOfValue,
      visibleIncomeEvents,
      visibleExpenseEvents,
      visibleStockMarketCrashes
    }) && !PROPERTY_LIQUIDATION_CELLS.has(def.fieldId))
    .map((def) => def.fieldId);
}

function getAdjacentVisibleFieldId(fieldId: FieldId, reverse: boolean): FieldId | null {
  const orderedFields = getVisibleInputOrder();
  const currentIndex = orderedFields.indexOf(fieldId);
  if (currentIndex < 0) return null;
  const nextIndex = currentIndex + (reverse ? -1 : 1);
  return orderedFields[nextIndex] ?? null;
}

function getRenderedFieldToggleButton(fieldId: FieldId): HTMLButtonElement | null {
  return inputsPanel.querySelector<HTMLButtonElement>(`button[data-toggle-field-id="${fieldId}"][aria-pressed="true"]`)
    ?? inputsPanel.querySelector<HTMLButtonElement>(`button[data-toggle-field-id="${fieldId}"]`);
}

function focusRenderedField(fieldId: FieldId | null): boolean {
  if (!fieldId) return false;
  const input = inputsPanel.querySelector<HTMLInputElement>(`input[data-field-id="${fieldId}"]`);
  if (input) {
    input.focus({ preventScroll: true });
    return true;
  }
  const toggleButton = getRenderedFieldToggleButton(fieldId);
  if (!toggleButton) return false;
  toggleButton.focus({ preventScroll: true });
  return true;
}

function restorePendingOrRelatedFocus(nextFieldId: string | null): void {
  const pendingFieldId = pendingFocusFieldId;
  pendingFocusFieldId = null;
  if (focusRenderedField(pendingFieldId)) return;
  if (focusRenderedField((nextFieldId as FieldId | null) ?? null)) return;
}

function hasUserEnteredValue(fieldId: FieldId): boolean {
  return touchedCells.has(fieldId) && !isBlank(fieldState[fieldId]);
}

function getSkippedCriticalFields(): Set<FieldId> {
  const skipped = new Set<FieldId>();
  const criticalFields = new Set<FieldId>(SKIP_REVEAL_CRITICAL_FIELDS);
  const orderedFields = getVisibleInputOrder();
  let laterUserEnteredValueExists = false;
  for (let idx = orderedFields.length - 1; idx >= 0; idx -= 1) {
    const fieldId = orderedFields[idx];
    if (criticalFields.has(fieldId) && isBlank(fieldState[fieldId]) && laterUserEnteredValueExists) {
      skipped.add(fieldId);
    }
    if (hasUserEnteredValue(fieldId)) {
      laterUserEnteredValueExists = true;
    }
  }
  return skipped;
}

function getVisibleValidationMessages(messages: ValidationMessage[]): ValidationMessage[] {
  if (validationRevealAll) return messages;
  const skippedCriticalFields = getSkippedCriticalFields();
  return messages.filter((message) => (
    touchedCells.has(message.fieldId)
    || (message.severity === "error" && message.blocksProjection && skippedCriticalFields.has(message.fieldId))
  ));
}

function hasProjectionBlockingValidation(messages: ValidationMessage[]): boolean {
  return messages.some((message) => message.severity === "error" && message.blocksProjection);
}

function formatBlockingFieldLabel(fieldId: FieldId): string {
  if (fieldId === RUNTIME_FIELDS.lifeExpectancyAge) return "end age";
  const label = INPUT_DEFINITION_BY_FIELD_ID[fieldId].label.trim();
  return label.length > 0 ? `${label.charAt(0).toLowerCase()}${label.slice(1)}` : fieldId;
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
  const missingFields = Array.from(new Set(
    blockingErrors
      .filter((message) => isBlank(fieldState[message.fieldId]))
      .map((message) => message.fieldId)
  ));
  if (missingFields.length > 0 && missingFields.length === new Set(blockingErrors.map((message) => message.fieldId)).size) {
    const labels = missingFields.map((fieldId) => formatBlockingFieldLabel(fieldId));
    return [`Enter ${joinHumanLabels(labels)} to see projections.`];
  }
  return ["Fix highlighted inputs to see projections."];
}

function applyRetireCheckReadiness(messages: ValidationMessage[], statutory: number | null): void {
  const hasEssentialErrors = hasRetireCheckEssentialErrors(messages);
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
  const metrics = prepareCanvas(canvas);
  if (!metrics) return;
  const { ctx, width, height, dpr } = metrics;
  canvas.dataset.plotPadLeft = String(CHART_MIN_LEFT_PAD);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f3f7f5";
  ctx.fillRect(0, 0, width, height);
  const messageLines = lines.length > 0 ? lines : [PROJECTION_EMPTY_GUIDANCE];
  const titleY = alignTextCoordinate(height / 2 - (messageLines.length > 1 ? 18 : 0), dpr);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#23413a";
  ctx.font = '500 15px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(messageLines[0], alignTextCoordinate(width / 2, dpr), titleY);
  if (messageLines.length === 1) return;
  ctx.fillStyle = "#58706a";
  ctx.font = '400 13px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  messageLines.slice(1, 4).forEach((line, idx) => {
    ctx.fillText(line, alignTextCoordinate(width / 2, dpr), alignTextCoordinate(titleY + 26 + (idx * 18), dpr));
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
    return `${sign}${symbol}${Math.round(abs / 1_000_000_000).toLocaleString("en-US")}b`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${symbol}${Math.round(abs / 1_000_000).toLocaleString("en-US")}m`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${Math.round(abs / 1_000).toLocaleString("en-US")}k`;
  }
  return `${sign}${symbol}${Math.round(abs).toLocaleString("en-US")}`;
}

function formatCurrencyPrecise(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currentCurrencySymbol();
  return `${sign}${symbol}${Math.round(abs).toLocaleString("en-US")}`;
}

type TooltipValueMode = "full" | "compact";
type TooltipCompactUnit = "k" | "m" | "b";

function formatTooltipCurrencyPrecise(value: number): string {
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
  return mode === "compact" ? formatCurrencyCompactTooltip(value, compactUnit) : formatTooltipCurrencyPrecise(value);
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

function isCashflowDisplayZero(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) < 1e-9;
}

function formatCashflowCellValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (isCashflowDisplayZero(value)) return "-";
  return formatCurrencyPrecise(value);
}

interface ProjectionLeafRow {
  type: "row";
  id: string;
  label: string;
  values: number[];
  level: number;
  tone?: "default" | "total" | "bridge";
  alwaysVisible?: boolean;
}

interface ProjectionGroupRow {
  type: "group";
  id: string;
  label: string;
  values: number[];
  level: number;
  tone?: "default" | "total" | "bridge";
  children: ProjectionNode[];
  alwaysVisible?: boolean;
}

interface ProjectionSectionRow {
  type: "section";
  id: string;
  label: string;
}

type ProjectionNode = ProjectionLeafRow | ProjectionGroupRow | ProjectionSectionRow;

const CASHFLOW_DETAIL_GROUP_IDS = [
  "cash",
  "inflows-rental",
  "inflows-income-events",
  "inflows-liquidations",
  "outflows-property-loans",
  "outflows-dependents",
  "outflows-property-costs",
  "outflows-expense-events"
] as const;

const NETWORTH_DETAIL_GROUP_IDS = [
  "networth-properties",
  "networth-loans"
] as const;

function sumProjectionSeries(seriesList: number[][], length = seriesList[0]?.length ?? 0): number[] {
  const total = Array.from({ length }, () => 0);
  for (const series of seriesList) {
    for (let i = 0; i < length; i += 1) total[i] += series[i] ?? 0;
  }
  return total;
}

function normalizeProjectionValue(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasVisibleProjectionValue(values: number[]): boolean {
  return values.some((value) => Number.isFinite(value) && Math.abs(value) > 1e-6);
}

function projectionLeaf(
  id: string,
  label: string,
  values: number[],
  level: number,
  tone: ProjectionLeafRow["tone"] = "default",
  alwaysVisible = false
): ProjectionLeafRow {
  return { type: "row", id, label, values, level, tone, alwaysVisible };
}

function projectionGroup(
  id: string,
  label: string,
  values: number[],
  level: number,
  children: ProjectionNode[],
  tone: ProjectionGroupRow["tone"] = "default",
  alwaysVisible = false
): ProjectionGroupRow {
  return { type: "group", id, label, values, level, children, tone, alwaysVisible };
}

function shiftProjectionNodeLevel(node: ProjectionNode, delta: number): ProjectionNode {
  if (delta === 0) return node;
  if (node.type === "section") return node;
  if (node.type === "row") {
    return { ...node, level: Math.max(0, node.level + delta) };
  }
  return {
    ...node,
    level: Math.max(0, node.level + delta),
    children: node.children.map((child) => shiftProjectionNodeLevel(child, delta))
  };
}

function collectVisibleProjectionNodeIds(nodes: ProjectionNode[], visibleIds = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.type === "section") continue;
    if (node.type === "row") {
      if (node.alwaysVisible || hasVisibleProjectionValue(node.values)) visibleIds.add(node.id);
      continue;
    }
    const childIdsBefore = visibleIds.size;
    collectVisibleProjectionNodeIds(node.children, visibleIds);
    const hasVisibleChildren = visibleIds.size > childIdsBefore;
    if (node.alwaysVisible || hasVisibleProjectionValue(node.values) || hasVisibleChildren) {
      visibleIds.add(node.id);
    }
  }
  return visibleIds;
}

function filterProjectionNodes(nodes: ProjectionNode[], visibleIds?: ReadonlySet<string>): ProjectionNode[] {
  const filtered: ProjectionNode[] = [];
  for (const node of nodes) {
    if (node.type === "section") {
      filtered.push(node);
      continue;
    }
    if (node.type === "row") {
      const shouldShow = visibleIds
        ? node.alwaysVisible || visibleIds.has(node.id)
        : node.alwaysVisible || hasVisibleProjectionValue(node.values);
      if (shouldShow) {
        filtered.push(node);
      }
      continue;
    }
    const children = filterProjectionNodes(node.children, visibleIds);
    const shouldShow = visibleIds
      ? node.alwaysVisible || visibleIds.has(node.id) || children.length > 0
      : node.alwaysVisible || hasVisibleProjectionValue(node.values) || children.length > 0;
    if (shouldShow) {
      filtered.push({ ...node, children });
    }
  }
  return filtered;
}

function flattenSingleChildProjectionGroups(nodes: ProjectionNode[]): ProjectionNode[] {
  const flattened: ProjectionNode[] = [];
  for (const node of nodes) {
    if (node.type !== "group") {
      flattened.push(node);
      continue;
    }
    const children = flattenSingleChildProjectionGroups(node.children);
    if (children.length === 1) {
      const child = children[0];
      if (child.type === "section") {
        flattened.push(child);
        continue;
      }
      flattened.push(shiftProjectionNodeLevel(child, node.level - child.level));
      continue;
    }
    flattened.push({ ...node, children });
  }
  return flattened;
}

function buildCashflowNodes(scenario: ScenarioOutputs): ProjectionNode[] {
  const cashFlow = scenario.cashFlow;
  const yearCount = scenario.points.length;
  const displayInflowsTotal = cashFlow.totalInflows.map((value, idx) => value + cashFlow.interestOnCash[idx]);
  const displayNetCashFlow = cashFlow.netCashFlow.map((value, idx) => value + cashFlow.interestOnCash[idx]);
  const rentalChildren = cashFlow.rentalIncomeByProperty.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 2)
  );
  const incomeEventChildren = cashFlow.incomeEvents.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 2)
  );
  const liquidationChildren = [
    projectionLeaf("liquidation-stocks", "Stocks", cashFlow.liquidationsStocks, 2),
    ...cashFlow.liquidationsByProperty.map((series) =>
      projectionLeaf(series.key, series.label, series.values, 2)
    )
  ];
  const propertyLoanChildren = [
    ...cashFlow.propertyLoanRepayments.map((series) =>
      projectionLeaf(
        series.key,
        /property$/i.test(series.label) ? series.label : `${series.label} property`,
        series.values,
        2
      )
    ),
    projectionLeaf("other-loan-repayment", "Other loan", cashFlow.otherLoanRepayment, 2)
  ];
  const dependentChildren = cashFlow.dependentsCost.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 2)
  );
  const propertyCostChildren = cashFlow.propertyCosts.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 2)
  );
  const expenseEventChildren = cashFlow.expenseEvents.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 2)
  );

  return [
    projectionGroup("inflows", "Inflows", displayInflowsTotal, 0, [
      projectionLeaf("employment-income", "Employment income", cashFlow.employmentIncome, 1),
      projectionLeaf("other-work-income", "Other work income", cashFlow.otherWorkIncome, 1),
      projectionGroup("inflows-rental", "Rental income", sumProjectionSeries(cashFlow.rentalIncomeByProperty.map((row) => row.values), yearCount), 1, rentalChildren),
      projectionLeaf("statutory-pension", "Statutory pension", cashFlow.statutoryPension, 1),
      projectionLeaf("other-post-retirement-income", "Other post-retirement income", cashFlow.otherPostRetirementIncome, 1),
      projectionGroup("inflows-income-events", "One-off income events", sumProjectionSeries(cashFlow.incomeEvents.map((row) => row.values), yearCount), 1, incomeEventChildren),
      projectionLeaf("downsizing-home-sale", "Sale of home (downsizing)", cashFlow.downsizingHomeSale, 1),
      projectionGroup("inflows-liquidations", "Liquidations", sumProjectionSeries([
        cashFlow.liquidationsStocks,
        ...cashFlow.liquidationsByProperty.map((row) => row.values)
      ], yearCount), 1, liquidationChildren),
      projectionLeaf("interest-cash", "Interest on cash", cashFlow.interestOnCash, 1),
      projectionLeaf("inflows-total-footer", "Inflows total", displayInflowsTotal, 1, "total", true)
    ], "total", true),
    projectionGroup("outflows", "Outflows", cashFlow.totalOutflows, 0, [
      projectionLeaf("credit-cards-cleared", "Credit cards cleared", cashFlow.creditCardsCleared, 1),
      projectionLeaf("home-loan-repayment", "Home loan repayment", cashFlow.homeLoanRepayment, 1),
      projectionGroup("outflows-property-loans", "Loan repayments", sumProjectionSeries([
        ...cashFlow.propertyLoanRepayments.map((row) => row.values),
        cashFlow.otherLoanRepayment
      ], yearCount), 1, propertyLoanChildren),
      projectionGroup("outflows-dependents", "Dependents cost", sumProjectionSeries(cashFlow.dependentsCost.map((row) => row.values), yearCount), 1, dependentChildren),
      projectionLeaf("housing-rent", "Housing rent", cashFlow.housingRent, 1),
      projectionLeaf("downsizing-home-purchase", "Purchase of home (downsizing)", cashFlow.downsizingHomePurchase, 1),
      projectionGroup("outflows-property-costs", "Other property costs", sumProjectionSeries(cashFlow.propertyCosts.map((row) => row.values), yearCount), 1, propertyCostChildren),
      projectionLeaf("living-expenses", "Living expenses", cashFlow.livingExpenses, 1),
      projectionGroup("outflows-expense-events", "One-off expense events", sumProjectionSeries(cashFlow.expenseEvents.map((row) => row.values), yearCount), 1, expenseEventChildren),
      projectionLeaf("outflows-total-footer", "Outflows total", cashFlow.totalOutflows, 1, "total", true)
    ], "total", true),
    projectionGroup("cash", "Cash", cashFlow.closingCash, 0, [
      projectionLeaf("opening-cash", "Opening cash balance", cashFlow.openingCash, 1, "default", true),
      projectionLeaf("net-cash-flow", "Net cash flow", displayNetCashFlow, 1, "bridge", true),
      projectionLeaf("closing-cash", "Closing cash balance", cashFlow.closingCash, 1, "bridge", true)
    ], "total", true)
  ];
}

function buildNetworthNodes(scenario: ScenarioOutputs): ProjectionNode[] {
  const netWorth = scenario.netWorth;
  const yearCount = scenario.points.length;
  const propertyValues = sumProjectionSeries(netWorth.properties.map((row) => row.values), yearCount);
  const loanValues = sumProjectionSeries(netWorth.loans.map((row) => row.values), yearCount);
  const totalValues = Array.from({ length: yearCount }, (_, idx) =>
    normalizeProjectionValue(netWorth.cash[idx]) +
    normalizeProjectionValue(netWorth.stockMarketEquity[idx]) +
    normalizeProjectionValue(propertyValues[idx]) -
    normalizeProjectionValue(loanValues[idx])
  );
  const propertyChildren = netWorth.properties.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 1)
  );
  const loanChildren = netWorth.loans.map((series) =>
    projectionLeaf(series.key, series.label, series.values, 1)
  );

  return [
    projectionGroup("networth-cash", "Cash", netWorth.cash, 0, [
      projectionLeaf("networth-cash-balance", "Cash", netWorth.cash, 1, "bridge", true)
    ], "total", true),
    projectionGroup("networth-equity", "Stock market equity", netWorth.stockMarketEquity, 0, [
      projectionLeaf("networth-stocks-balance", "Stocks", netWorth.stockMarketEquity, 1, "bridge", true)
    ], "total", true),
    projectionGroup(
      "networth-properties",
      "Properties & assets",
      propertyValues,
      0,
      propertyChildren,
      "total",
      true
    ),
    projectionGroup(
      "networth-loans",
      "Loans",
      loanValues,
      0,
      loanChildren,
      "total",
      true
    ),
    projectionLeaf("networth-total", "Net Worth", totalValues, 0, "total", true)
  ];
}

function renderProjectionRows(
  nodes: ProjectionNode[],
  years: number[],
  ages: number[],
  expandedGroups: ReadonlySet<string>
): string {
  const rows: string[] = [];
  const renderNode = (node: ProjectionNode): void => {
    if (node.type === "section") {
      rows.push(`
        <tr class="cashflow-section-row" data-row-id="${escapeHtml(node.id)}">
          <th class="cashflow-section-cell" scope="rowgroup" colspan="${years.length + 1}">
            <span class="cashflow-section-label">${escapeHtml(node.label)}</span>
          </th>
        </tr>
      `);
      return;
    }
    const isGroup = node.type === "group";
    const expanded = isGroup ? expandedGroups.has(node.id) : false;
    const toneClass = node.tone === "bridge"
      ? "is-bridge"
      : node.tone === "total"
        ? "is-total"
        : "";
    const rowClass = [
      "cashflow-row",
      toneClass,
      isGroup ? "is-group-header" : "is-line-item",
      isGroup && node.level === 0 ? "is-major-group" : "",
      !isGroup && node.level === 0 ? "is-major-line-item" : "",
      isGroup && node.level > 0 ? "is-subgroup" : "",
      node.level >= 2 ? "is-child" : "",
      node.id === "net-cash-flow" || node.id === "closing-cash" || node.id === "networth-total" ? "is-key-total" : "",
      node.id === "inflows-liquidations" ? "is-liquidation-group" : ""
    ].filter(Boolean).join(" ");
    const labelHtml = isGroup
      ? `<button class="cashflow-row-toggle" type="button" data-projection-toggle="${escapeHtml(node.id)}" aria-expanded="${expanded ? "true" : "false"}"><span class="cashflow-row-toggle-gutter"><span class="cashflow-row-toggle-icon">${expanded ? "−" : "+"}</span></span><span class="cashflow-row-toggle-text">${escapeHtml(node.label)}</span></button>`
      : `<span class="cashflow-row-label-text"><span class="cashflow-row-toggle-gutter" aria-hidden="true"></span><span class="cashflow-row-label-copy">${escapeHtml(node.label)}</span></span>`;
    const negativeSensitive = node.id === "net-cash-flow" || node.id === "closing-cash" || node.id === "inflows-liquidations";
    const showSectionValues = !(isGroup && expanded);
    const valueCells = node.values.map((value, idx) => {
      const classes = [
        "cashflow-value-cell",
        years[idx] % 5 === 0 ? "has-year-divider" : "",
        negativeSensitive && value < 0 && !isCashflowDisplayZero(value) ? "is-negative" : ""
      ].filter(Boolean).join(" ");
      return `<td class="${classes}">${showSectionValues ? escapeHtml(formatCashflowCellValue(value)) : ""}</td>`;
    }).join("");
    rows.push(`
      <tr class="${rowClass}" data-level="${node.level}" data-row-id="${escapeHtml(node.id)}">
        <th class="cashflow-label-cell" scope="row">
          <div class="cashflow-label-inner" style="--cashflow-indent:${node.level}">
            ${labelHtml}
          </div>
        </th>
        ${valueCells}
      </tr>
    `);
    if (isGroup && expanded) {
      for (const child of node.children) renderNode(child);
    }
  };
  for (const node of nodes) renderNode(node);
  const headerCells = years.map((year, idx) => `
    <th class="cashflow-year-cell${year % 5 === 0 ? " has-year-divider" : ""}" scope="col">
      <div class="cashflow-year-button">
        <span class="cashflow-year-label">${year}</span>
        <span class="cashflow-age-label">Age ${ages[idx]}</span>
      </div>
    </th>
  `).join("");
  return `
    <div class="cashflow-table-scroll">
      <table class="cashflow-table">
        <thead>
          <tr>
            <th class="cashflow-corner-cell" scope="col"></th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
    </div>
  `;
}

function syncProjectionSectionVisibility(): void {
  projectionSectionEl.hidden = !projectionSectionOpen;
  projectionSectionEl.setAttribute("aria-hidden", projectionSectionOpen ? "false" : "true");
  projectionSectionEl.classList.toggle("is-open", projectionSectionOpen);
  cashflowTablePanel.hidden = !projectionSectionOpen || projectionActiveTab !== "cashflow";
  networthTablePanel.hidden = !projectionSectionOpen || projectionActiveTab !== "networth";
  openCashflowButton.classList.remove("is-active");
  openNetworthButton.classList.remove("is-active");
  projectionTabCashflowButton.classList.toggle("is-active", projectionActiveTab === "cashflow");
  projectionTabNetworthButton.classList.toggle("is-active", projectionActiveTab === "networth");
  projectionTabCashflowButton.setAttribute("aria-selected", projectionActiveTab === "cashflow" ? "true" : "false");
  projectionTabNetworthButton.setAttribute("aria-selected", projectionActiveTab === "networth" ? "true" : "false");
  document.body.classList.toggle("cashflow-open", projectionSectionOpen);
}

function syncProjectionScenarioButtons(): void {
  const earlyButtons = [projectionScenarioEarlyButton];
  const normButtons = [projectionScenarioNormButton];
  for (const button of earlyButtons) {
    button.classList.toggle("is-active", cashflowScenario === "early");
    button.setAttribute("aria-selected", cashflowScenario === "early" ? "true" : "false");
  }
  for (const button of normButtons) {
    button.classList.toggle("is-active", cashflowScenario === "norm");
    button.setAttribute("aria-selected", cashflowScenario === "norm" ? "true" : "false");
  }
}

function scrollAnchorIntoView(anchorEl: HTMLElement | null): void {
  if (!anchorEl) return;
  anchorEl.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function ensureProjectionMounted(result: RunModelResult | null, blockingLines: string[] = []): void {
  if (projectionHasMounted) return;
  projectionHasMounted = true;
  renderCashflowPage(result, blockingLines);
  renderNetworthPage(result, blockingLines);
}

function openCashflowSection(): void {
  if (projectionSectionOpen) {
    setProjectionTab("cashflow");
    scrollAnchorIntoView(cashflowAnchorEl);
    return;
  }
  const blockingLines = latestRunResult
    ? []
    : getProjectionBlockingLines(getVisibleValidationMessages(latestValidationMessages));
  projectionActiveTab = "cashflow";
  ensureProjectionMounted(latestRunResult, blockingLines);
  projectionSectionOpen = true;
  syncProjectionSectionVisibility();
  void projectionSectionEl.offsetHeight;
  scrollAnchorIntoView(cashflowAnchorEl);
}

function openNetworthSection(): void {
  if (projectionSectionOpen) {
    setProjectionTab("networth");
    scrollAnchorIntoView(cashflowAnchorEl);
    return;
  }
  const blockingLines = latestRunResult
    ? []
    : getProjectionBlockingLines(getVisibleValidationMessages(latestValidationMessages));
  projectionActiveTab = "networth";
  ensureProjectionMounted(latestRunResult, blockingLines);
  projectionSectionOpen = true;
  syncProjectionSectionVisibility();
  void projectionSectionEl.offsetHeight;
  scrollAnchorIntoView(cashflowAnchorEl);
}

function closeProjectionSection(): void {
  if (!projectionSectionOpen) return;
  scrollAnchorIntoView(dashboardAnchorEl);
  window.setTimeout(() => {
    projectionSectionOpen = false;
    syncProjectionSectionVisibility();
  }, 220);
}

function setChartLegendsVisible(visible: boolean): void {
  if (visible) {
    cashChartActions.removeAttribute("hidden");
    nwChartActions.removeAttribute("hidden");
    cashLegend.removeAttribute("hidden");
    nwLegend.removeAttribute("hidden");
    return;
  }
  cashChartActions.setAttribute("hidden", "");
  nwChartActions.setAttribute("hidden", "");
  cashLegend.setAttribute("hidden", "");
  nwLegend.setAttribute("hidden", "");
}

function resetCashflowExpandedGroups(mode: "expanded" | "collapsed" | "top-level"): void {
  cashflowExpandedGroups.clear();
  if (mode === "collapsed") return;
  cashflowExpandedGroups.add("cash");
  cashflowExpandedGroups.add("inflows");
  cashflowExpandedGroups.add("outflows");
  if (mode === "top-level") return;
  for (const groupId of CASHFLOW_DETAIL_GROUP_IDS) cashflowExpandedGroups.add(groupId);
}

function resetNetworthExpandedGroups(mode: "expanded" | "collapsed" | "top-level"): void {
  networthExpandedGroups.clear();
  if (mode === "collapsed") return;
  for (const groupId of NETWORTH_DETAIL_GROUP_IDS) networthExpandedGroups.add(groupId);
}

function renderCashflowPage(result: RunModelResult | null, blockingLines: string[] = []): void {
  syncProjectionScenarioButtons();

  if (!result) {
    const lines = blockingLines.length > 0 ? blockingLines : [PROJECTION_EMPTY_GUIDANCE];
    cashflowTablePanel.innerHTML = `<div class="cashflow-empty">${escapeHtml(lines[0])}</div>`;
    return;
  }

  const activeScenario = cashflowScenario === "early" ? result.outputs.scenarioEarly : result.outputs.scenarioNorm;
  const comparisonScenario = cashflowScenario === "early" ? result.outputs.scenarioNorm : result.outputs.scenarioEarly;
  const activeNodes = buildCashflowNodes(activeScenario);
  const comparisonNodes = buildCashflowNodes(comparisonScenario);
  const visibleNodeIds = collectVisibleProjectionNodeIds(activeNodes);
  collectVisibleProjectionNodeIds(comparisonNodes, visibleNodeIds);
  cashflowTablePanel.innerHTML = renderProjectionRows(
    flattenSingleChildProjectionGroups(filterProjectionNodes(activeNodes, visibleNodeIds)),
    result.outputs.years,
    result.outputs.ages,
    cashflowExpandedGroups
  );
  restoreProjectionScrollAnchor("cashflow", pendingCashflowScrollAnchor);
  pendingCashflowScrollAnchor = null;
}

function renderNetworthPage(result: RunModelResult | null, blockingLines: string[] = []): void {
  syncProjectionScenarioButtons();

  if (!result) {
    const lines = blockingLines.length > 0 ? blockingLines : [PROJECTION_EMPTY_GUIDANCE];
    networthTablePanel.innerHTML = `<div class="cashflow-empty">${escapeHtml(lines[0])}</div>`;
    return;
  }

  const activeScenario = cashflowScenario === "early" ? result.outputs.scenarioEarly : result.outputs.scenarioNorm;
  const comparisonScenario = cashflowScenario === "early" ? result.outputs.scenarioNorm : result.outputs.scenarioEarly;
  const activeNodes = buildNetworthNodes(activeScenario);
  const comparisonNodes = buildNetworthNodes(comparisonScenario);
  const visibleNodeIds = collectVisibleProjectionNodeIds(activeNodes);
  collectVisibleProjectionNodeIds(comparisonNodes, visibleNodeIds);
  networthTablePanel.innerHTML = renderProjectionRows(
    flattenSingleChildProjectionGroups(filterProjectionNodes(activeNodes, visibleNodeIds)),
    result.outputs.years,
    result.outputs.ages,
    networthExpandedGroups
  );
  restoreProjectionScrollAnchor("networth", pendingNetworthScrollAnchor);
  pendingNetworthScrollAnchor = null;
}

function buildChartContextByYear(result: RunModelResult): Map<number, TimelineYearEvent[]> {
  const labelsByYear = collectSpecificLabelsByYear(fieldState, result, getStatutoryAge(), MILESTONE_EVENT_MIN_ABS_AMOUNT);
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

function renderMilestoneTimeline(result: RunModelResult): void {
  const enteredAge = Number(fieldState[RUNTIME_FIELDS.currentAge]);
  const hasValidEnteredAge = !isBlank(fieldState[RUNTIME_FIELDS.currentAge]) && Number.isFinite(enteredAge) && enteredAge >= 18 && enteredAge <= 100;
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
  const milestones = buildTimelineMilestones(
    fieldState,
    result,
    getStatutoryAge(),
    MILESTONE_EVENT_MIN_ABS_AMOUNT,
    formatImpact
  );
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
  const raw = fieldState[RUNTIME_FIELDS.statutoryRetirementAge];
  if (isBlank(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const capped = applyFieldNumericConstraint(RUNTIME_FIELDS.statutoryRetirementAge, n);
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
    if (candidateResult.outputs.scenarioEarly.retirementSuccessful) return candidateAge;
  }

  return null;
}

function getCurrentAge(): number | null {
  const raw = fieldState[RUNTIME_FIELDS.currentAge];
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
    const seeded = Number.isFinite(uiState.earlyRetirementAge) ? uiState.earlyRetirementAge : statutory;
    uiState.earlyRetirementAge = Math.max(minRetirementAge, Math.min(statutory, seeded));
    spinner.value = String(uiState.earlyRetirementAge);
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

function fieldAllowsNegative(fieldId: FieldId): boolean {
  return ALLOW_NEGATIVE_FIELDS.has(fieldId);
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

function getDownsizingModeValue(value: RawInputValue): typeof DOWNSIZING_MODE_OPTIONS[number] | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "BUY") return "Buy";
  if (normalized === "RENT") return "Rent";
  return null;
}

function renderDownsizingModeField(def: InputDefinition, label: string): string {
  const selectedMode = getDownsizingModeValue(fieldState[def.fieldId]);

  return `
    <div class="field field-choice-field" data-cell="${def.cell}" data-field-id="${def.fieldId}">
      <span>${label}</span>
      <div class="field-choice-toggle" role="group" aria-label="${escapeHtml(label)}">
        ${DOWNSIZING_MODE_OPTIONS.map((option) => `
          <button
            type="button"
            class="field-choice-btn${selectedMode === option ? " is-active" : ""}"
            data-field-id="${def.fieldId}"
            data-toggle-field-id="${def.fieldId}"
            data-toggle-option="${option}"
            aria-pressed="${selectedMode === option ? "true" : "false"}"
          >
            ${option}
          </button>
        `).join("")}
      </div>
      ${def.tooltip ? `<small>${def.tooltip}</small>` : ""}
    </div>
  `;
}

function renderStandardFieldControl(def: InputDefinition, label: string): string {
  if (def.fieldId === DOWNSIZING_FIELDS.newHomeMode) {
    return renderDownsizingModeField(def, label);
  }
  const value = fieldState[def.fieldId];
  const valStr = formatFieldValue(def, value);
  const inputType = "text";
  const inputMode = def.type === "text" ? "text" : (def.type === "integer" ? "numeric" : "decimal");
  const showTooltip = ![RUNTIME_FIELDS.currentAge, HOME_FIELDS.housingRentAnnual].includes(def.fieldId) && !!def.tooltip;
  const hasPrefix = fieldHasCurrencyAdornment(def);
  const hasSuffix = fieldHasPercentAdornment(def);
  const stepSize = STEPPER_CONFIG[def.fieldId];
  const hasStepper = Number.isFinite(stepSize);
  const inputShellClass = [
    "input-shell",
    hasPrefix ? "has-prefix" : "",
    hasSuffix ? "has-suffix" : "",
    hasStepper ? "has-stepper" : ""
  ].join(" ").trim();

  return `
    <div class="field${def.fieldId === LIVING_EXPENSES_FIELD_ID ? " living-expenses-field" : ""}" data-cell="${def.cell}" data-field-id="${def.fieldId}">
      <span>${label}</span>
      <div class="${inputShellClass}">
        ${hasPrefix ? `<span class="input-prefix" aria-hidden="true">${escapeHtml(currentCurrencySymbol())}</span>` : ""}
        <input data-cell="${def.cell}" data-field-id="${def.fieldId}" type="${inputType}" inputmode="${inputMode}" value="${valStr}" placeholder="" />
        ${hasSuffix ? `<span class="input-suffix" aria-hidden="true">%</span>` : ""}
        ${hasStepper ? `
          <div class="field-stepper">
            <button type="button" class="field-step-btn" data-field-id="${def.fieldId}" data-step-dir="-1" tabindex="-1" aria-label="Decrease ${escapeHtml(label)}">-</button>
            <button type="button" class="field-step-btn" data-field-id="${def.fieldId}" data-step-dir="1" tabindex="-1" aria-label="Increase ${escapeHtml(label)}">+</button>
          </div>
        ` : ""}
      </div>
      ${showTooltip ? `<small>${def.tooltip}</small>` : ""}
    </div>
  `;
}

function renderLivingExpensesField(def: InputDefinition, label: string): string {
  const modeToggleHtml = `
    <div class="living-expenses-mode-toggle" role="group" aria-label="Living expenses entry mode">
      <button type="button" class="living-expenses-mode-btn${livingExpensesMode === "expanded" ? " is-active" : ""}" data-living-expenses-mode="expanded" aria-pressed="${livingExpensesMode === "expanded" ? "true" : "false"}">
        <span class="living-expenses-switch-track" aria-hidden="true">
          <span class="living-expenses-switch-thumb"></span>
        </span>
        <span class="living-expenses-switch-label">Detailed breakdown</span>
      </button>
    </div>
  `;
  const topRowHtml = `
    <div class="living-expenses-top-row">
      <span class="living-expenses-heading">${label}</span>
      ${modeToggleHtml}
    </div>
  `;

  if (livingExpensesMode === "single") {
    const value = fieldState[def.fieldId];
    const valStr = formatFieldValue(def, value);
    return `
      <div class="living-expenses-wrap">
        <div class="field living-expenses-field living-expenses-field--simple" data-cell="${def.cell}" data-field-id="${def.fieldId}">
          ${topRowHtml}
          <div class="input-shell has-prefix has-stepper">
            <span class="input-prefix" aria-hidden="true">${escapeHtml(currentCurrencySymbol())}</span>
            <input data-cell="${def.cell}" data-field-id="${def.fieldId}" type="text" inputmode="decimal" value="${valStr}" placeholder="" />
            <div class="field-stepper">
              <button type="button" class="field-step-btn" data-field-id="${def.fieldId}" data-step-dir="-1" tabindex="-1" aria-label="Decrease ${escapeHtml(label)}">-</button>
              <button type="button" class="field-step-btn" data-field-id="${def.fieldId}" data-step-dir="1" tabindex="-1" aria-label="Increase ${escapeHtml(label)}">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const derivedTotal = getLivingExpensesCategoryTotal();
  const categoryFieldsHtml = LIVING_EXPENSE_CATEGORY_DEFINITIONS.map(({ id, label: categoryLabel }) => {
    const value = livingExpenseCategoryValues[id];
    const valueText = formatFieldValue(LIVING_EXPENSES_DEF, value);
    return `
      <label class="living-expenses-category">
        <span>${categoryLabel}</span>
        <div class="input-shell has-prefix">
          <span class="input-prefix" aria-hidden="true">${escapeHtml(currentCurrencySymbol())}</span>
          <input
            type="text"
            inputmode="decimal"
            value="${valueText}"
            data-living-expense-category="${id}"
            aria-label="${escapeHtml(categoryLabel)}"
          />
        </div>
      </label>
    `;
  }).join("");

  return `
    <div class="field living-expenses-field living-expenses-field--expanded" data-cell="${def.cell}" data-field-id="${def.fieldId}">
      ${topRowHtml}
      <div class="living-expenses-expanded-panel">
        <div class="input-shell has-prefix living-expenses-derived-shell">
          <span class="input-prefix" aria-hidden="true">${escapeHtml(currentCurrencySymbol())}</span>
          <input
            type="text"
            value="${formatFieldValue(LIVING_EXPENSES_DEF, derivedTotal)}"
            readonly
            tabindex="-1"
            data-living-expenses-derived-total
            aria-label="Derived annual living expenses total"
          />
        </div>
        <div class="living-expenses-category-grid">
          ${categoryFieldsHtml}
        </div>
      </div>
    </div>
  `;
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

function getAgeStepperLimitMessage(fieldId: FieldId, dir: number, nextValue: number): string | null {
  if (fieldId === RUNTIME_FIELDS.currentAge && dir > 0) {
    const statutory = getStatutoryAge();
    if (statutory !== null && nextValue >= statutory) {
      return "Your age must be less than statutory retirement age.";
    }
  }
  if (fieldId === RUNTIME_FIELDS.statutoryRetirementAge && dir < 0) {
    const currentAge = getCurrentAge();
    if (currentAge !== null && nextValue <= currentAge) {
      return "Statutory retirement age must be greater than your current age.";
    }
  }
  return null;
}

function applyStepperDelta(fieldId: FieldId, dir: number): void {
  if (!Number.isFinite(dir) || (dir !== -1 && dir !== 1)) return;
  const step = STEPPER_CONFIG[fieldId];
  const def = INPUT_DEFINITION_BY_FIELD_ID[fieldId];
  if (!Number.isFinite(step) || !def) return;
  markFieldTouched(fieldId);

  const currentRaw = fieldState[fieldId];
  const current = typeof currentRaw === "number" && Number.isFinite(currentRaw) ? currentRaw : 0;
  const next = current + dir * (step ?? 0);
  const ageLimitMessage = getAgeStepperLimitMessage(fieldId, dir, next);
  if (ageLimitMessage !== null) {
    setAttemptedFieldMessage(fieldId, ageLimitMessage);
    renderValidationState(latestValidationMessages);
    return;
  }
  const decimals = STEP_DECIMALS[fieldId] ?? 0;
  const rounded = Number(next.toFixed(decimals));
  const constrained = applyFieldNumericConstraint(fieldId, rounded);
  if (constrained === null) return;
  if (isOutOfRangeLiquidationRank(fieldId, constrained) || isDuplicateLiquidationRank(fieldState, fieldId, constrained)) return;

  if (fieldId === RUNTIME_FIELDS.currentAge || fieldId === RUNTIME_FIELDS.statutoryRetirementAge) {
    clearAgeConstraintAttemptMessages();
  }
  fieldState[fieldId] = constrained;
  if (fieldId === RUNTIME_FIELDS.currentAge) {
    fieldState[RUNTIME_FIELDS.currentAge] = Math.max(18, Math.min(100, Math.round(asNumber(fieldState[RUNTIME_FIELDS.currentAge]))));
    enforceLiveUntilAgeConstraint(true);
  }
  if (fieldId === RUNTIME_FIELDS.statutoryRetirementAge) {
    const statutory = getStatutoryAge();
    if (statutory !== null) {
      uiState.earlyRetirementAge = statutory;
      spinner.value = String(statutory);
    }
    syncEarlyRetirementControl(true);
  }

  const input = inputsPanel.querySelector<HTMLInputElement>(`input[data-field-id="${fieldId}"]`);
  if (input) input.value = formatFieldValue(def, fieldState[fieldId]);

  setRetireCheckMessage(null);
  if (STRUCTURAL_RERENDER_CELLS.has(fieldId)) {
    renderInputs();
  }
  queueRecalc();
}

function persistPropertyLiquidationOrder(order: ReturnType<typeof activePropertyConfigs>, active: ReturnType<typeof activePropertyConfigs>): void {
  uiState.manualPropertyLiquidationOrder = true;
  for (const assignment of buildPropertyLiquidationAssignments(order, active)) {
    fieldState[assignment.fieldId] = assignment.value;
  }
}

function renderLiquidationRow(
  cfg: ReturnType<typeof activePropertyConfigs>[number],
  rank: number | null,
  action: "exclude" | "include",
  options: { moveUpDisabled?: boolean; moveDownDisabled?: boolean } = {}
): string {
  const name = String(fieldState[cfg.nameField] ?? "").trim() || cfg.fallbackName;
  const value = asNumber(fieldState[cfg.valueField]);
  const valueText = `${currentCurrencySymbol()}${Math.round(value).toLocaleString("en-US")}`;
  const isSellable = action === "exclude";
  const rankHtml = rank === null
    ? `<span class="liquidation-rank liquidation-rank--empty" aria-hidden="true">•</span>`
    : `<span class="liquidation-rank">${rank}</span>`;
  const reorderControls = isSellable ? `
        <div class="liquidation-reorder-controls" aria-label="Reorder ${escapeHtml(name)}">
          <button
            type="button"
            class="liquidation-move-btn"
            data-liquidation-move="up"
            data-liquidation-idx="${cfg.liquidationIdx}"
            aria-label="Move ${escapeHtml(name)} up"
            ${options.moveUpDisabled ? "disabled" : ""}
          >↑</button>
          <button
            type="button"
            class="liquidation-move-btn"
            data-liquidation-move="down"
            data-liquidation-idx="${cfg.liquidationIdx}"
            aria-label="Move ${escapeHtml(name)} down"
            ${options.moveDownDisabled ? "disabled" : ""}
          >↓</button>
        </div>
      ` : `<span class="liquidation-reorder-placeholder" aria-hidden="true"></span>`;
  return `
      <li class="liquidation-item ${isSellable ? "" : "is-static"}" data-liquidation-idx="${cfg.liquidationIdx}">
        ${rankHtml}
        <span class="liquidation-name">${escapeHtml(name)}</span>
        <span class="liquidation-value">${escapeHtml(valueText)}</span>
        ${reorderControls}
        <button
          type="button"
          class="liquidation-toggle ${isSellable ? "is-on" : "is-off"}"
          role="switch"
          aria-checked="${isSellable ? "true" : "false"}"
          aria-label="${escapeHtml(name)}: liquidation ${isSellable ? "enabled" : "disabled"}"
          data-liquidation-action="${action}"
          data-liquidation-idx="${cfg.liquidationIdx}"
        >
          <span class="liquidation-toggle-label">Liquidate</span>
          <span class="liquidation-toggle-track" aria-hidden="true">
            <span class="liquidation-toggle-thumb"></span>
          </span>
        </button>
      </li>
    `;
}

function renderPropertyLiquidationOrderControl(): string {
  const active = activePropertyConfigs(fieldState);
  if (active.length === 0) return "";
  const { sellable, excluded } = buildPropertyLiquidationBuckets(fieldState, active, uiState.manualPropertyLiquidationOrder);
  const sellableRows = sellable.map((cfg, idx) => renderLiquidationRow(cfg, idx + 1, "exclude", {
    moveUpDisabled: idx === 0,
    moveDownDisabled: idx === sellable.length - 1
  })).join("");
  const excludedRows = excluded.map((cfg) => renderLiquidationRow(cfg, null, "include")).join("");
  const sellableContent = sellableRows || `<div class="liquidation-empty">No assets will be liquidated.</div>`;
  const excludedContent = excludedRows || `<div class="liquidation-empty">All active assets are currently sellable.</div>`;
  return `
    <div class="liquidation-reorder" data-liquidation-reorder="true">
      <div class="liquidation-title">Asset liquidation order</div>
      <small class="liquidation-help">Use the arrows to reorder sellable assets. Turn Liquidate off for assets you would never liquidate.</small>
      <div class="liquidation-section" data-liquidation-zone="sellable">
        ${sellableRows ? `<ul class="liquidation-list">${sellableContent}</ul>` : sellableContent}
      </div>
      <div class="liquidation-section" data-liquidation-zone="never-sell">
        ${excludedRows ? `<ul class="liquidation-list liquidation-list--excluded">${excludedContent}</ul>` : excludedContent}
      </div>
    </div>
  `;
}

function applyFinerDefaultsIfNeeded(): void {
  for (const [fieldId, val] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS) as Array<[FieldId, number | null]>) {
    const current = fieldState[fieldId];
    if (isBlank(current) && val !== null && val !== undefined) {
      fieldState[fieldId] = applyFieldNumericConstraint(fieldId, Number(val));
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
      fieldState[def.fieldId] = null;
    }
    resetLivingExpensesHelperState();

    for (const def of INPUT_DEFINITIONS) {
      const cell = def.cell;
      if (!(cell in incoming)) continue;
      const nextRaw = incoming[cell];
      if (nextRaw === null || nextRaw === undefined || String(nextRaw).trim() === "") {
        fieldState[def.fieldId] = null;
        continue;
      }
      if (def.type === "text") {
        fieldState[def.fieldId] = String(nextRaw);
      } else {
        const n = Number(nextRaw);
        fieldState[def.fieldId] = Number.isFinite(n) ? applyFieldNumericConstraint(def.fieldId, n) : null;
      }
    }

    for (const [fieldId, value] of Object.entries(SAMPLE_DATA_NUMERIC_OVERRIDES) as Array<[FieldId, number]>) {
      fieldState[fieldId] = applyFieldNumericConstraint(fieldId, value);
    }

    syncVisibleRuntimeGroupsFromState();
    uiState.manualPropertyLiquidationOrder = hasExplicitPropertyLiquidationPreferences(fieldState);

    const fromPayload = Number(payload.early_retirement_age);
    if (Number.isFinite(fromPayload) && fromPayload >= 18) {
      uiState.earlyRetirementAge = Math.round(fromPayload);
    } else {
      const statutory = getStatutoryAge();
      if (statutory !== null) {
        uiState.earlyRetirementAge = statutory;
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
    fieldState[def.fieldId] = null;
  }
  resetLivingExpensesHelperState();
  validationRevealAll = false;
  clearTouchedFields();
  clearAllAttemptedFieldMessages();
  applyFinerDefaultsIfNeeded();
  syncVisibleRuntimeGroupsFromState();
  uiState.manualPropertyLiquidationOrder = false;
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
  for (const fieldId of FINER_DETAILS_FIELD_IDS) {
    fieldState[fieldId] = null;
  }
  validationRevealAll = false;
  clearTouchedFields(FINER_DETAILS_FIELD_IDS);
  clearAllAttemptedFieldMessages();
  uiState.manualPropertyLiquidationOrder = false;
  setRetireCheckMessage(null);
  renderInputs();
  queueRecalc();
}

function loadFinerDetailsDefaults(): void {
  for (const fieldId of FINER_DETAILS_FIELD_IDS) {
    fieldState[fieldId] = null;
  }
  for (const [fieldId, value] of Object.entries(FINER_DETAILS_COL_C_DEFAULTS) as Array<[FieldId, RawInputValue]>) {
    fieldState[fieldId] = value;
  }
  validationRevealAll = false;
  clearTouchedFields(FINER_DETAILS_FIELD_IDS);
  clearAllAttemptedFieldMessages();
  uiState.manualPropertyLiquidationOrder = false;
  setRetireCheckMessage(null);
  renderInputs();
  queueRecalc();
}

function renderInputs(): void {
  const cursorState = capturePanelCursorState();
  visibleDependents = expandVisibleGroupCount(visibleDependents, dependentFieldSets);
  visibleProperties = expandVisibleGroupCount(visibleProperties, propertyFieldSets);
  visibleAssetsOfValue = expandVisibleGroupCount(visibleAssetsOfValue, assetOfValueFieldSets);
  if (anyValue(fieldState, incomeEvent3Fields)) visibleIncomeEvents = Math.max(visibleIncomeEvents, 3);
  else if (anyValue(fieldState, incomeEvent2Fields)) visibleIncomeEvents = Math.max(visibleIncomeEvents, 2);
  if (anyValue(fieldState, expenseEvent3Fields)) visibleExpenseEvents = Math.max(visibleExpenseEvents, 3);
  else if (anyValue(fieldState, expenseEvent2Fields)) visibleExpenseEvents = Math.max(visibleExpenseEvents, 2);
  visibleStockMarketCrashes = expandVisibleGroupCount(visibleStockMarketCrashes, stockMarketCrashFieldSets);
  const appendedOrder = syncManualPropertyOrderForNewProperties(
    fieldState,
    previousActivePropertyIndices,
    uiState.manualPropertyLiquidationOrder
  );
  if (appendedOrder.length > 0) {
    for (const update of appendedOrder) {
      fieldState[update.fieldId] = update.value;
    }
    queueRecalc();
  }
  previousActivePropertyIndices = new Set(activePropertyConfigs(fieldState).map((group) => group.liquidationIdx));
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
    if (title === "FINER DETAILS") {
      return `
        <section class="input-section ${sectionClass}">
          <div class="section-header-row">
            <button type="button" class="section-toggle" data-section="${title}">${open ? `Hide ${title}` : title}</button>
            <div class="finer-default-actions section-header-actions">
              <button type="button" class="quickstart-clear-btn" id="clear-finer-defaults-btn">Clear Data</button>
              <button type="button" class="quickstart-load-btn" id="load-finer-defaults-btn">Load Defaults</button>
            </div>
          </div>
          ${open ? controlsHtml : ""}
        </section>
      `;
    }
    return `<section class="input-section ${sectionClass}"><button type="button" class="section-toggle" data-section="${title}">${open ? `Hide ${title}` : title}</button>${open ? controlsHtml : ""}</section>`;
  };

  const getSubgroupSummary = (sub: string): string => {
    const dependentGroup = DEPENDENT_RUNTIME_GROUPS.find((group) => group.label === sub);
    if (dependentGroup) {
      const value = fieldState[dependentGroup.nameField];
      return typeof value === "string" ? value.trim() : "";
    }
    const propertyGroup = PROPERTY_RUNTIME_GROUPS.find((group) => group.fallbackName === sub);
    if (propertyGroup) {
      const value = fieldState[propertyGroup.nameField];
      return typeof value === "string" ? value.trim() : "";
    }
    const assetOfValueGroup = ASSET_OF_VALUE_RUNTIME_GROUPS.find((group) => group.fallbackName === sub);
    if (assetOfValueGroup) {
      const value = fieldState[assetOfValueGroup.nameField];
      return typeof value === "string" ? value.trim() : "";
    }
    return "";
  };

  const controls = (defs: InputDefinition[]) => {
    const orderedDefs = getOrderedDefinitions(defs);
    let html = "";
    let prevTop = "";
    let prevMid = "";
    let prevSub = "";
    let liquidationRendered = false;
    let subgroupCardOpen = false;

    const closeSubgroupCard = () => {
      if (!subgroupCardOpen) return;
      html += `</div>`;
      subgroupCardOpen = false;
    };

    for (const def of orderedDefs) {
      if (!fieldVisible(fieldState, def.fieldId, {
        visibleDependents,
        visibleProperties,
        visibleAssetsOfValue,
        visibleIncomeEvents,
        visibleExpenseEvents,
        visibleStockMarketCrashes
      })) continue;
      if (PROPERTY_LIQUIDATION_CELLS.has(def.fieldId)) {
        if (!liquidationRendered) {
          closeSubgroupCard();
          const controlHtml = renderPropertyLiquidationOrderControl();
          if (controlHtml) {
            html += controlHtml;
          }
          liquidationRendered = true;
        }
        continue;
      }
      const tail = getDynamicGroupTail(def, fieldState).map((s) => s.trim()).filter((s) => s.length > 0);
      if (tail.length === 0) {
        closeSubgroupCard();
        prevTop = "";
        prevMid = "";
        prevSub = "";
      } else {
        const top = tail[0] ?? "";
        const mid = tail.length > 2 ? (tail[1] ?? "") : "";
        const sub = tail.length > 2 ? tail.slice(2).join(" > ") : tail.slice(1).join(" > ");
        if (top && top !== prevTop) {
          closeSubgroupCard();
          const suppressTopHeading = top.toLowerCase() === "other post-retirement income";
          if (!suppressTopHeading) {
            html += `<h3 class="group-top">${top}</h3>`;
          }
          prevTop = top;
          prevMid = "";
          prevSub = "";
        }
        if (mid && mid !== prevMid) {
          closeSubgroupCard();
          html += `<h4 class="group-mid">${mid}</h4>`;
          prevMid = mid;
          prevSub = "";
        }
        if (sub && sub !== prevSub) {
          closeSubgroupCard();
          const summary = getSubgroupSummary(sub);
          html += `
            <div class="group-item-card">
              <div class="group-item-card-header">
                <h4 class="group-sub">${sub}</h4>
                ${summary ? `<span class="group-item-card-summary">${escapeHtml(summary)}</span>` : ""}
              </div>
          `;
          subgroupCardOpen = true;
          prevSub = sub;
        }
      }
      const label = getDynamicFieldLabel(def, fieldState);
      html += def.fieldId === LIVING_EXPENSES_FIELD_ID
        ? renderLivingExpensesField(def, label)
        : renderStandardFieldControl(def, label);

      const dependentGroup = DEPENDENT_RUNTIME_GROUPS.find((group) => group.yearsField === def.fieldId);
      if (
        dependentGroup
        && dependentGroup.idx < DEPENDENT_RUNTIME_GROUPS.length - 1
        && visibleDependents < dependentGroup.idx + 2
        && !isBlank(fieldState[dependentGroup.nameField])
      ) {
        html += `<button type="button" class="add-dependent-btn" data-next-dependent="${dependentGroup.idx + 2}">Add another dependent</button>`;
      }
      const propertyGroup = PROPERTY_RUNTIME_GROUPS.find((group) => group.annualCostsField === def.fieldId);
      if (
        propertyGroup
        && propertyGroup.idx < PROPERTY_RUNTIME_GROUPS.length - 1
        && visibleProperties < propertyGroup.idx + 2
        && !isBlank(fieldState[propertyGroup.nameField])
      ) {
        html += `<button type="button" class="add-property-btn" data-next-property="${propertyGroup.idx + 2}">Add another property</button>`;
      }
      const assetOfValueGroup = ASSET_OF_VALUE_RUNTIME_GROUPS.find((group) => group.appreciationRateField === def.fieldId);
      if (
        assetOfValueGroup
        && assetOfValueGroup.idx < ASSET_OF_VALUE_RUNTIME_GROUPS.length - 1
        && visibleAssetsOfValue < assetOfValueGroup.idx + 2
        && !isBlank(fieldState[assetOfValueGroup.nameField])
      ) {
        html += `<button type="button" class="add-asset-btn" data-next-asset="${assetOfValueGroup.idx + 2}">Add another asset</button>`;
      }
      if (def.fieldId === INCOME_EVENT_RUNTIME_GROUPS[0].yearField && visibleIncomeEvents < 2 && !isBlank(fieldState[INCOME_EVENT_RUNTIME_GROUPS[0].nameField])) {
        html += `<button type="button" class="add-event-btn" data-next-income-event="2">Add another income event</button>`;
      }
      if (def.fieldId === INCOME_EVENT_RUNTIME_GROUPS[1].yearField && visibleIncomeEvents < 3 && !isBlank(fieldState[INCOME_EVENT_RUNTIME_GROUPS[1].nameField])) {
        html += `<button type="button" class="add-event-btn" data-next-income-event="3">Add another income event</button>`;
      }
      if (def.fieldId === EXPENSE_EVENT_RUNTIME_GROUPS[0].yearField && visibleExpenseEvents < 2 && !isBlank(fieldState[EXPENSE_EVENT_RUNTIME_GROUPS[0].nameField])) {
        html += `<button type="button" class="add-event-btn" data-next-expense-event="2">Add another expense event</button>`;
      }
      if (def.fieldId === EXPENSE_EVENT_RUNTIME_GROUPS[1].yearField && visibleExpenseEvents < 3 && !isBlank(fieldState[EXPENSE_EVENT_RUNTIME_GROUPS[1].nameField])) {
        html += `<button type="button" class="add-event-btn" data-next-expense-event="3">Add another expense event</button>`;
      }
      const stockMarketCrashGroup = STOCK_MARKET_CRASH_RUNTIME_GROUPS.find((group) => group.recoveryField === def.fieldId);
      if (
        stockMarketCrashGroup
        && stockMarketCrashGroup.idx < STOCK_MARKET_CRASH_RUNTIME_GROUPS.length - 1
        && visibleStockMarketCrashes < stockMarketCrashGroup.idx + 2
        && !isBlank(fieldState[stockMarketCrashGroup.yearField])
      ) {
        html += `<button type="button" class="add-stock-market-crash-btn" data-next-stock-market-crash="${stockMarketCrashGroup.idx + 2}">Add another stock market crash</button>`;
      }
    }
    closeSubgroupCard();
    return html;
  };

  const quickHtml = controls(grouped["QUICK START"]);
  const deeperHtml = controls(grouped["DEEPER DIVE"]);
  const finerHtml = controls(grouped["FINER DETAILS"]);
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
    block("FINER DETAILS", sectionState.finerOpen, true, finerHtml, "section-finer-details");

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

  inputsPanel.querySelectorAll<HTMLButtonElement>("[data-living-expenses-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMode = btn.dataset.livingExpensesMode;
      if (nextMode === "expanded") {
        setLivingExpensesMode(livingExpensesMode === "expanded" ? "single" : "expanded");
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>("button[data-toggle-field-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const fieldId = btn.dataset.toggleFieldId as FieldId | undefined;
      const nextValue = btn.dataset.toggleOption;
      if (!fieldId || !DOWNSIZING_MODE_OPTIONS.includes(nextValue as typeof DOWNSIZING_MODE_OPTIONS[number])) return;

      markFieldTouched(fieldId);
      if (getDownsizingModeValue(fieldState[fieldId]) === nextValue) {
        focusRenderedField(fieldId);
        return;
      }

      fieldState[fieldId] = nextValue;
      const pruned = pruneInactiveFieldState(fieldState);
      for (const key of Object.keys(pruned) as Array<FieldId>) {
        fieldState[key] = pruned[key];
      }
      setRetireCheckMessage(null);
      queueRecalc();
      renderInputs();
      focusRenderedField(fieldId);
    });
  });

  inputsPanel.querySelectorAll<HTMLInputElement>("input[data-living-expense-category]").forEach((el) => {
    el.addEventListener("input", () => {
      const categoryId = el.dataset.livingExpenseCategory as LivingExpenseCategoryId | undefined;
      if (!categoryId) return;
      const sanitized = sanitizeNumericText(el.value, "number", false);
      if (sanitized !== el.value) el.value = sanitized;
      const nextValue = parseNumberInput(el.value, false);
      livingExpenseCategoryValues[categoryId] = nextValue === null ? null : Math.max(0, nextValue);
      markFieldTouched(LIVING_EXPENSES_FIELD_ID);
      syncLivingExpensesFieldFromExpandedMode();
      syncRenderedLivingExpensesDerivedTotal();
      setRetireCheckMessage(null);
      queueRecalc();
    });

    el.addEventListener("focus", () => {
      const categoryId = el.dataset.livingExpenseCategory as LivingExpenseCategoryId | undefined;
      if (!categoryId) return;
      const current = livingExpenseCategoryValues[categoryId];
      el.value = current === null ? "" : String(current);
    });

    el.addEventListener("blur", () => {
      const categoryId = el.dataset.livingExpenseCategory as LivingExpenseCategoryId | undefined;
      if (!categoryId) return;
      el.value = formatFieldValue(LIVING_EXPENSES_DEF, livingExpenseCategoryValues[categoryId]);
      syncRenderedLivingExpensesDerivedTotal();
    });
  });

  inputsPanel.querySelectorAll<HTMLInputElement>("input[data-field-id]").forEach((el) => {
    el.addEventListener("keydown", (ev) => {
      const fieldId = el.dataset.fieldId as FieldId;
      if ((ev.key === "ArrowUp" || ev.key === "ArrowDown") && Number.isFinite(STEPPER_CONFIG[fieldId])) {
        ev.preventDefault();
        applyStepperDelta(fieldId, ev.key === "ArrowUp" ? 1 : -1);
        return;
      }
      if (ev.key !== "Tab") return;
      if (STRUCTURAL_RERENDER_CELLS.has(fieldId)) {
        pendingFocusFieldId = getAdjacentVisibleFieldId(fieldId, ev.shiftKey);
      }
    });

    el.addEventListener("input", () => {
      const fieldId = el.dataset.fieldId as FieldId;
      markFieldTouched(fieldId);
      if (fieldId === RUNTIME_FIELDS.currentAge || fieldId === RUNTIME_FIELDS.statutoryRetirementAge) {
        clearAgeConstraintAttemptMessages();
      }
      const def = INPUT_DEFINITION_BY_FIELD_ID[fieldId];
      const prevValue = fieldState[fieldId];
      const allowNegative = fieldAllowsNegative(fieldId);
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
        nextValue = applyFieldNumericConstraint(fieldId, nextValue as number | null);
      }

      if (isOutOfRangeLiquidationRank(fieldId, nextValue) || isDuplicateLiquidationRank(fieldState, fieldId, nextValue)) {
        el.value = prevValue === null || prevValue === undefined ? "" : String(prevValue);
        return;
      }

      if (def.type === "text") {
        fieldState[fieldId] = nextValue as string;
      } else {
        fieldState[fieldId] = nextValue as number | null;
      }
      if (fieldId === LIVING_EXPENSES_FIELD_ID && livingExpensesMode === "single") {
        livingExpenseCategoryValues = createEmptyLivingExpenseCategoryValues();
      }
      setRetireCheckMessage(null);
      if (fieldId === RUNTIME_FIELDS.statutoryRetirementAge) {
        const statutory = getStatutoryAge();
        if (statutory !== null) {
          uiState.earlyRetirementAge = statutory;
          spinner.value = String(statutory);
        }
        syncEarlyRetirementControl(true);
      }
      if (fieldId === RUNTIME_FIELDS.currentAge) {
        enforceLiveUntilAgeConstraint(true);
      }
      queueRecalc();
      // For numeric dependency-driver fields, defer UI structural rerender to blur
      // to avoid caret reset behavior in number inputs.
      const rerenderNow = shouldRerenderOnInput(fieldId, prevValue, nextValue);
      if (rerenderNow) {
        renderInputs();
      }
    });
    el.addEventListener("focus", () => {
      const fieldId = el.dataset.fieldId as FieldId;
      const def = INPUT_DEFINITION_BY_FIELD_ID[fieldId];
      const current = fieldState[fieldId];
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
      const fieldId = el.dataset.fieldId as FieldId;
      markFieldTouched(fieldId);
      if (fieldId === RUNTIME_FIELDS.currentAge || fieldId === RUNTIME_FIELDS.statutoryRetirementAge) {
        clearAgeConstraintAttemptMessages();
      }
      const def = INPUT_DEFINITION_BY_FIELD_ID[fieldId];
      if (def.type !== "text") {
        const current = fieldState[fieldId];
        const numericCurrent = typeof current === "number" && Number.isFinite(current) ? current : null;
        const constrained = applyFieldNumericConstraint(fieldId, numericCurrent);
        if (constrained !== numericCurrent) {
          fieldState[fieldId] = constrained;
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
      if (fieldId === RUNTIME_FIELDS.currentAge && fieldState[RUNTIME_FIELDS.currentAge] !== null && fieldState[RUNTIME_FIELDS.currentAge] !== undefined) {
        const age = Number(fieldState[RUNTIME_FIELDS.currentAge]);
        if (Number.isFinite(age)) {
          fieldState[RUNTIME_FIELDS.currentAge] = Math.max(18, Math.min(100, Math.round(age)));
          enforceLiveUntilAgeConstraint(true);
          queueRecalc();
        }
      }
      if (def.type === "percent" || def.type === "integer" || def.type === "number") {
        el.value = formatFieldValue(def, fieldState[fieldId]);
      }
      if (def.type === "text") {
        if (STRUCTURAL_RERENDER_CELLS.has(fieldId) || changedByPrune) {
          const next = ev.relatedTarget as HTMLElement | null;
          const nextFieldId = next?.getAttribute?.("data-field-id");
          renderInputs();
          restorePendingOrRelatedFocus(nextFieldId ?? null);
        }
        return;
      }
      if (STRUCTURAL_RERENDER_CELLS.has(fieldId) || changedByPrune) {
        const next = ev.relatedTarget as HTMLElement | null;
        const nextFieldId = next?.getAttribute?.("data-field-id");
        renderInputs();
        restorePendingOrRelatedFocus(nextFieldId ?? null);
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".field-step-btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      stopStepperHold();
      const fieldId = btn.dataset.fieldId as FieldId;
      if (!fieldId) return;
      const dir = Number(btn.dataset.stepDir);
      if (!Number.isFinite(dir) || (dir !== -1 && dir !== 1)) return;
      applyStepperDelta(fieldId, dir);
      stepperHoldTimeout = window.setTimeout(() => {
        stepperHoldInterval = window.setInterval(() => applyStepperDelta(fieldId, dir), 80);
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
        visibleDependents = Math.max(visibleDependents, Math.min(DEPENDENT_RUNTIME_GROUPS.length, next));
        renderInputs();
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".add-property-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.nextProperty);
      if (Number.isFinite(next)) {
        visibleProperties = Math.max(visibleProperties, Math.min(PROPERTY_RUNTIME_GROUPS.length, next));
        renderInputs();
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".add-asset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.nextAsset);
      if (Number.isFinite(next)) {
        visibleAssetsOfValue = Math.max(visibleAssetsOfValue, Math.min(ASSET_OF_VALUE_RUNTIME_GROUPS.length, next));
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

  inputsPanel.querySelectorAll<HTMLButtonElement>(".add-stock-market-crash-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.nextStockMarketCrash);
      if (Number.isFinite(next)) {
        visibleStockMarketCrashes = Math.max(visibleStockMarketCrashes, Math.min(STOCK_MARKET_CRASH_RUNTIME_GROUPS.length, next));
        renderInputs();
      }
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".liquidation-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const propertyIdx = Number(btn.dataset.liquidationIdx);
      if (!Number.isFinite(propertyIdx)) return;
      const active = activePropertyConfigs(fieldState);
      const target = active.find((group) => group.liquidationIdx === propertyIdx);
      if (!target) return;

      const { sellable } = buildPropertyLiquidationBuckets(fieldState, active, uiState.manualPropertyLiquidationOrder);
      const action = btn.dataset.liquidationAction;
      if (action === "exclude") {
        persistPropertyLiquidationOrder(sellable.filter((group) => group.liquidationIdx !== propertyIdx), active);
      } else if (action === "include" && !sellable.some((group) => group.liquidationIdx === propertyIdx)) {
        const nextOrder = [...sellable];
        const targetValue = asNumber(fieldState[target.valueField]);
        const insertAt = nextOrder.findIndex((group) => {
          const groupValue = asNumber(fieldState[group.valueField]);
          return groupValue > targetValue || (groupValue === targetValue && group.liquidationIdx > target.liquidationIdx);
        });
        if (insertAt < 0) nextOrder.push(target);
        else nextOrder.splice(insertAt, 0, target);
        persistPropertyLiquidationOrder(nextOrder, active);
      } else {
        return;
      }

      pendingLiquidationControl = { propertyIdx, control: "toggle", pulse: true };
      setRetireCheckMessage(null);
      queueRecalc();
      renderInputs();
    });
  });

  inputsPanel.querySelectorAll<HTMLButtonElement>(".liquidation-move-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const propertyIdx = Number(btn.dataset.liquidationIdx);
      const direction = btn.dataset.liquidationMove;
      if (!Number.isFinite(propertyIdx) || (direction !== "up" && direction !== "down")) return;

      const active = activePropertyConfigs(fieldState);
      const { sellable: order } = buildPropertyLiquidationBuckets(fieldState, active, uiState.manualPropertyLiquidationOrder);
      const fromPos = order.findIndex((cfg) => cfg.liquidationIdx === propertyIdx);
      if (fromPos < 0) return;
      const toPos = direction === "up" ? fromPos - 1 : fromPos + 1;
      if (toPos < 0 || toPos >= order.length) return;

      const [moved] = order.splice(fromPos, 1);
      order.splice(toPos, 0, moved);

      pendingLiquidationControl = { propertyIdx, control: direction, pulse: true };
      persistPropertyLiquidationOrder(order, active);
      setRetireCheckMessage(null);
      queueRecalc();
      renderInputs();
    });
  });

  restorePanelCursorState(cursorState);
  restorePendingLiquidationControl();
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

    const { width: canvasWidth, height: canvasHeight } = getCanvasDisplaySize(canvas);
    const pad = readChartPadMetrics(canvas);
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    const plotLeft = pad.l;
    const plotRight = canvasWidth - pad.r;
    const plotTop = pad.t;
    const plotBottom = canvasHeight - pad.b;
    if (cx < plotLeft || cx > plotRight || cy < plotTop || cy > plotBottom) {
      clearChartHoverDelay(canvas);
      if ((chartHoverIndex.get(canvas) ?? null) !== null) {
        chartHoverIndex.set(canvas, null);
        drawChart(canvas, data.ages, data.seriesPrimary, data.seriesComparison, {
          zeroLineAlert: data.zeroLineAlert
        });
      }
      hideChartTooltip(canvas);
      return;
    }

    const maxIndex = Math.max(0, data.ages.length - 1);
    const ratio = maxIndex === 0 ? 0 : (cx - plotLeft) / Math.max(1, plotRight - plotLeft);
    const idx = Math.max(0, Math.min(maxIndex, Math.round(ratio * maxIndex)));
    if ((chartHoverIndex.get(canvas) ?? null) !== idx) {
      chartHoverIndex.set(canvas, idx);
      drawChart(canvas, data.ages, data.seriesPrimary, data.seriesComparison, {
        hoverIdx: idx,
        zeroLineAlert: data.zeroLineAlert
      });
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
      drawChart(canvas, data.ages, data.seriesPrimary, data.seriesComparison, {
        zeroLineAlert: data.zeroLineAlert
      });
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
  options: {
    hoverIdx?: number | null;
    zeroLineAlert?: boolean;
    leftPad?: number;
  } = {}
): void {
  const metrics = prepareCanvas(canvas);
  if (!metrics) return;
  const { ctx, width: w, height: h, dpr } = metrics;
  const hoverIdx = options.hoverIdx ?? null;
  const zeroLineAlert = options.zeroLineAlert ?? false;

  const basePad = CHART_PAD;
  const allY = [...a, ...b];
  const rawMinY = Math.min(...allY);
  const rawMaxY = Math.max(...allY);
  const axisHasMeaningfulRange = Math.abs(rawMaxY - rawMinY) > 1e-6 || Math.abs(rawMaxY) > 1e-6 || Math.abs(rawMinY) > 1e-6;

  const axisLabelFont = '500 13px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const axisPrefixFont = '500 12px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const axisPrefixGap = 4;
  const axisLineGap = 8;
  const axisOuterMargin = 10;
  const tickMetrics = computeYAxisTickValues(rawMinY, rawMaxY);
  const { axisUnit, axisDecimals, values: yTickValues } = tickMetrics;
  const pad: ChartPadMetrics = {
    ...basePad,
    l: Math.max(CHART_MIN_LEFT_PAD, options.leftPad ?? computeChartLeftPad(canvas, a, b, axisLabelFont, axisPrefixFont, axisPrefixGap, axisLineGap, axisOuterMargin))
  };
  canvas.dataset.plotPadLeft = String(pad.l);

  const minY = yTickValues[0] ?? rawMinY;
  const maxY = yTickValues[yTickValues.length - 1] ?? rawMaxY;
  const ySpan = maxY - minY || 1;
  const xp = (i: number) => pad.l + (i / Math.max(1, x.length - 1)) * (w - pad.l - pad.r);
  const yp = (v: number) => h - pad.b - ((v - minY) / ySpan) * (h - pad.t - pad.b);
  const axisLeftX = alignToDevicePixel(pad.l, dpr, 1.1);
  const axisBottomY = alignToDevicePixel(h - pad.b, dpr, 1.1);
  const plotRightX = alignToDevicePixel(w - pad.r, dpr, 1.1);
  const plotTopY = alignToDevicePixel(pad.t, dpr, 1.1);
  const yAxisLabelX = alignTextCoordinate(pad.l - axisLineGap, dpr);
  const xAxisLabelY = alignTextCoordinate(h - 8, dpr);

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

  if (yTickValues.length > 0) {
    for (const yv of yTickValues) {
      const yy = alignToDevicePixel(yp(yv), dpr);
      if (Math.abs(yv) < ((maxY - minY) / Math.max(1, yTickValues.length - 1)) * 0.001) continue;
      ctx.strokeStyle = "rgba(100, 116, 139, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(axisLeftX, yy);
      ctx.lineTo(plotRightX, yy);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "#c8d3df";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(axisLeftX, axisBottomY);
  ctx.lineTo(plotRightX, axisBottomY);
  ctx.moveTo(axisLeftX, plotTopY);
  ctx.lineTo(axisLeftX, axisBottomY);
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
    const hoverX = alignToDevicePixel(xp(hoverIdx), dpr, 1.1);
    ctx.save();
    ctx.strokeStyle = "rgba(71, 85, 105, 0.34)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(hoverX, plotTopY);
    ctx.lineTo(hoverX, axisBottomY);
    ctx.stroke();
    ctx.restore();
  }

  if (rawMinY < 0 && rawMaxY > 0) {
    const zeroLineWidth = zeroLineAlert ? 1.28 : 1.6;
    const y0 = alignToDevicePixel(yp(0), dpr, zeroLineWidth);
    ctx.save();
    ctx.strokeStyle = zeroLineAlert ? "#dc2626" : "#334155";
    ctx.lineWidth = zeroLineWidth;
    ctx.setLineDash([]);
    if (zeroLineAlert) {
      ctx.shadowColor = "rgba(220, 38, 38, 0.25)";
      ctx.shadowBlur = 2;
    }
    ctx.beginPath();
    ctx.moveTo(axisLeftX, y0);
    ctx.lineTo(alignToDevicePixel(w - pad.r, dpr, zeroLineWidth), y0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.font = axisLabelFont;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  if (yTickValues.length > 0) {
    for (const yv of yTickValues) {
      const yy = alignTextCoordinate(yp(yv), dpr);
      const { prefix, amount } = formatAxisCurrencyParts(yv, axisUnit, axisDecimals);
      ctx.font = axisLabelFont;
      const amountWidth = ctx.measureText(amount).width;
      ctx.fillStyle = "#1f2937";
      ctx.fillText(amount, yAxisLabelX, yy);
      ctx.font = axisPrefixFont;
      ctx.fillStyle = "#475569";
      ctx.fillText(prefix, yAxisLabelX - amountWidth - axisPrefixGap, yy);
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
      const tickX = alignToDevicePixel(xx, dpr);
      ctx.strokeStyle = "#cfd8e3";
      ctx.beginPath();
      ctx.moveTo(tickX, axisBottomY);
      const isMajorTick = (age - startAge) % majorTickStep === 0;
      ctx.lineTo(tickX, alignToDevicePixel((h - pad.b) + (isMajorTick ? 5 : 3), dpr));
      ctx.stroke();
      if (!isMajorTick) continue;
      ctx.fillStyle = "#1f2937";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(age), alignTextCoordinate(xx, dpr), xAxisLabelY);
    }
  }
}

function scheduleChartResizeRecalc(): void {
  if (chartResizeFrame !== null) window.cancelAnimationFrame(chartResizeFrame);
  chartResizeFrame = window.requestAnimationFrame(() => {
    chartResizeFrame = null;
    recalc();
  });
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
  latestRunResult = result;
  renderValidationState(result.validationMessages);
  const visibleValidationMessages = getVisibleValidationMessages(result.validationMessages);
  const hasBlockingErrors = hasProjectionBlockingValidation(result.validationMessages);
  const hasVisibleBlockingErrors = hasProjectionBlockingValidation(visibleValidationMessages);
  const statutory = getStatutoryAge();
  applyRetireCheckReadiness(result.validationMessages, statutory);
  if (hasBlockingErrors) {
    setChartLegendsVisible(false);
    cashLegendA.textContent = "Retire at early age";
    cashLegendB.textContent = statutory === null ? "Retire at statutory age" : `Retire at ${statutory}`;
    nwLegendA.textContent = "Retire at early age";
    nwLegendB.textContent = statutory === null ? "Retire at statutory age" : `Retire at ${statutory}`;
    cashCanvas.dataset.zeroLineAlert = "false";
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
    for (const button of [projectionScenarioEarlyButton]) {
      button.textContent = "Early";
    }
    for (const button of [projectionScenarioNormButton]) {
      button.textContent = statutory === null ? "Statutory" : `Statutory ${statutory}`;
    }
    if (projectionHasMounted) {
      renderCashflowPage(null, chartLines);
      renderNetworthPage(null, chartLines);
    }
    return;
  }

  const contextByYear = buildChartContextByYear(result);
  const earlyLabel = spinner.value.trim() === "" ? "Retire at early age" : `Retire at ${uiState.earlyRetirementAge}`;
  const statutoryLabel = statutory === null ? "Retire at statutory age" : `Retire at ${statutory}`;
  const activeCashSeries = cashflowScenario === "early"
    ? result.outputs.cashSeriesEarly
    : result.outputs.cashSeriesNorm;
  const cashZeroLineAlert = activeCashSeries.some((value) => value < 0);
  const axisLabelFont = '500 13px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const axisPrefixFont = '500 12px "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const axisPrefixGap = 4;
  const axisLineGap = 8;
  const axisOuterMargin = 10;
  const sharedChartLeftPad = Math.max(
    computeChartLeftPad(cashCanvas, result.outputs.cashSeriesEarly, result.outputs.cashSeriesNorm, axisLabelFont, axisPrefixFont, axisPrefixGap, axisLineGap, axisOuterMargin),
    computeChartLeftPad(nwCanvas, result.outputs.netWorthSeriesEarly, result.outputs.netWorthSeriesNorm, axisLabelFont, axisPrefixFont, axisPrefixGap, axisLineGap, axisOuterMargin)
  );
  setChartLegendsVisible(true);
  cashLegendA.textContent = earlyLabel;
  cashLegendB.textContent = statutoryLabel;
  nwLegendA.textContent = earlyLabel;
  nwLegendB.textContent = statutoryLabel;
  for (const button of [projectionScenarioEarlyButton]) {
    button.textContent = `Early ${uiState.earlyRetirementAge}`;
  }
  for (const button of [projectionScenarioNormButton]) {
    button.textContent = statutory === null ? "Statutory" : `Statutory ${statutory}`;
  }
  drawChart(
    cashCanvas,
    result.outputs.ages,
    result.outputs.cashSeriesEarly,
    result.outputs.cashSeriesNorm,
    { zeroLineAlert: cashZeroLineAlert, leftPad: sharedChartLeftPad }
  );
  cashCanvas.dataset.zeroLineAlert = cashZeroLineAlert ? "true" : "false";
  chartHoverData.set(cashCanvas, {
    ages: result.outputs.ages,
    years: result.outputs.years,
    seriesPrimary: result.outputs.cashSeriesEarly,
    seriesComparison: result.outputs.cashSeriesNorm,
    zeroLineAlert: cashZeroLineAlert,
    retireNowAge: uiState.earlyRetirementAge,
    statutoryAge: statutory,
    metricLabel: "Cash",
    contextByYear
  });
  drawChart(
    nwCanvas,
    result.outputs.ages,
    result.outputs.netWorthSeriesEarly,
    result.outputs.netWorthSeriesNorm,
    { zeroLineAlert: false, leftPad: sharedChartLeftPad }
  );
  chartHoverData.set(nwCanvas, {
    ages: result.outputs.ages,
    years: result.outputs.years,
    seriesPrimary: result.outputs.netWorthSeriesEarly,
    seriesComparison: result.outputs.netWorthSeriesNorm,
    zeroLineAlert: false,
    retireNowAge: uiState.earlyRetirementAge,
    statutoryAge: statutory,
    metricLabel: "Net worth",
    contextByYear
  });
  renderMilestoneTimeline(result);
  if (projectionHasMounted) {
    renderCashflowPage(result);
    renderNetworthPage(result);
  }
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

openCashflowButton.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

openNetworthButton.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

openCashflowButton.addEventListener("click", () => {
  openCashflowButton.blur();
  openCashflowSection();
});

openNetworthButton.addEventListener("click", () => {
  openNetworthButton.blur();
  openNetworthSection();
});

function setProjectionTab(nextTab: ProjectionSectionKey): void {
  if (projectionActiveTab === nextTab) return;
  if (projectionSectionOpen) {
    if (projectionActiveTab === "cashflow") {
      pendingCashflowScrollAnchor = captureProjectionScrollContext("cashflow");
    } else {
      pendingNetworthScrollAnchor = captureProjectionScrollContext("networth");
    }
  }
  projectionActiveTab = nextTab;
  syncProjectionSectionVisibility();
  restoreProjectionScrollAnchor(
    nextTab,
    nextTab === "cashflow" ? pendingCashflowScrollAnchor : pendingNetworthScrollAnchor
  );
}

function setProjectionScenario(nextScenario: "early" | "norm"): void {
  if (cashflowScenario === nextScenario) return;
  pendingCashflowScrollAnchor = captureProjectionScrollContext("cashflow");
  pendingNetworthScrollAnchor = captureProjectionScrollContext("networth");
  cashflowScenario = nextScenario;
  recalc();
}

projectionTabCashflowButton.addEventListener("click", () => {
  setProjectionTab("cashflow");
});

projectionTabNetworthButton.addEventListener("click", () => {
  setProjectionTab("networth");
});

projectionScenarioEarlyButton.addEventListener("click", () => {
  setProjectionScenario("early");
});

projectionScenarioNormButton.addEventListener("click", () => {
  setProjectionScenario("norm");
});

function updateActiveProjectionExpansion(mode: "expanded" | "collapsed"): void {
  if (projectionActiveTab === "cashflow") {
    pendingCashflowScrollAnchor = captureProjectionScrollContext("cashflow");
    resetCashflowExpandedGroups(mode);
  } else {
    pendingNetworthScrollAnchor = captureProjectionScrollContext("networth");
    resetNetworthExpandedGroups(mode);
  }
  recalc();
}

projectionExpandAllButton.addEventListener("click", () => {
  updateActiveProjectionExpansion("expanded");
});

projectionCollapseAllButton.addEventListener("click", () => {
  updateActiveProjectionExpansion("collapsed");
});

projectionSectionCollapseButton.addEventListener("click", () => {
  closeProjectionSection();
});

function handleProjectionToggleClick(
  event: Event,
  sectionKey: ProjectionSectionKey,
  expandedGroups: Set<string>
): void {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const toggle = target.closest<HTMLElement>("[data-projection-toggle]");
  if (!toggle) return;
  const groupId = toggle.dataset.projectionToggle;
  if (!groupId) return;
  if (sectionKey === "cashflow") {
    pendingCashflowScrollAnchor = captureProjectionScrollAnchor(sectionKey, groupId);
  } else {
    pendingNetworthScrollAnchor = captureProjectionScrollAnchor(sectionKey, groupId);
  }
  if (expandedGroups.has(groupId)) expandedGroups.delete(groupId);
  else expandedGroups.add(groupId);
  recalc();
}

cashflowTablePanel.addEventListener("click", (event) => {
  handleProjectionToggleClick(event, "cashflow", cashflowExpandedGroups);
});

networthTablePanel.addEventListener("click", (event) => {
  handleProjectionToggleClick(event, "networth", networthExpandedGroups);
});

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
  const positiveMessage = currentAge !== null && canRetAge === currentAge
    ? "Yes! You can retire now!"
    : `Not quite, but you can retire at ${canRetAge}`;
  setRetireCheckMessage(positiveMessage, "positive");
  queueRecalc();
});

setupChartHover(cashCanvas);
setupChartHover(nwCanvas);

if (typeof ResizeObserver !== "undefined") {
  const chartResizeObserver = new ResizeObserver((entries) => {
    if (entries.some((entry) => entry.contentRect.width > 0 && entry.contentRect.height > 0)) {
      scheduleChartResizeRecalc();
    }
  });
  chartResizeObserver.observe(cashCanvas);
  chartResizeObserver.observe(nwCanvas);
}

resetCashflowExpandedGroups("collapsed");
resetNetworthExpandedGroups("collapsed");
syncProjectionSectionVisibility();
renderInputs();
recalc();
