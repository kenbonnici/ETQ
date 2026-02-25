import "./app.css";
import { runModel } from "./model";
import { FINER_DETAILS_COL_C_DEFAULTS } from "./model/inputSchema";
import { InputDefinition, INPUT_DEFINITIONS } from "./ui/inputDefinitions";
import { ModelUiState, RawInputs } from "./model/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root.");

const textCells = new Set(["B33", "B38", "B43", "B50", "B55", "B60", "B100", "B105", "B110", "B117", "B122", "B127"]);
const deeperCells = new Set(INPUT_DEFINITIONS.filter((d) => d.section === "DEEPER DIVE").map((d) => d.cell));
const finerCells = new Set(INPUT_DEFINITIONS.filter((d) => d.section === "FINER DETAILS").map((d) => d.cell));

const rawInputs: RawInputs = {};
for (const def of INPUT_DEFINITIONS) rawInputs[def.cell as keyof RawInputs] = null;

let uiState: ModelUiState = {
  deeperDiveOpen: false,
  finerDetailsOpen: false,
  earlyRetirementAge: 18
};

let debounceHandle: number | null = null;
let pendingFocusCell: string | null = null;

app.innerHTML = `
  <main class="layout">
    <section class="left" id="inputs-panel"></section>
    <section class="right">
      <header class="retirement-control">
        <label for="early-ret-age">Early retirement age</label>
        <div class="retirement-stepper">
          <button id="early-ret-down" class="step-btn" type="button" aria-label="Decrease early retirement age">-</button>
          <input id="early-ret-age" type="number" min="18" max="100" step="1" value="" inputmode="numeric" pattern="[0-9]*" />
          <button id="early-ret-up" class="step-btn" type="button" aria-label="Increase early retirement age">+</button>
        </div>
      </header>
      <article class="chart-card">
        <h2>Cash</h2>
        <canvas id="cash-chart" width="920" height="300"></canvas>
      </article>
      <article class="chart-card">
        <h2>Net Worth</h2>
        <canvas id="nw-chart" width="920" height="300"></canvas>
      </article>
    </section>
  </main>
`;

const inputsPanel = document.getElementById("inputs-panel") as HTMLDivElement;
const spinner = document.getElementById("early-ret-age") as HTMLInputElement;
const spinnerDown = document.getElementById("early-ret-down") as HTMLButtonElement;
const spinnerUp = document.getElementById("early-ret-up") as HTMLButtonElement;
const cashCanvas = document.getElementById("cash-chart") as HTMLCanvasElement;
const nwCanvas = document.getElementById("nw-chart") as HTMLCanvasElement;

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

function syncEarlyRetirementControl(defaultIfEmpty: boolean): void {
  const statutory = getStatutoryAge();
  spinner.min = "18";
  if (statutory === null) {
    spinner.max = "100";
    spinner.disabled = true;
    spinner.value = "";
    updateEarlyRetirementButtons(null);
    return;
  }

  spinner.disabled = false;
  spinner.max = String(statutory);
  const raw = spinner.value.trim();
  if (defaultIfEmpty && raw === "") {
    uiState.earlyRetirementAge = statutory;
    spinner.value = String(statutory);
    updateEarlyRetirementButtons(statutory);
    return;
  }
  if (raw === "") {
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

function sectionHasValues(cells: Set<string>): boolean {
  for (const c of cells) {
    const v = rawInputs[c as keyof RawInputs];
    if (!isBlank(v)) return true;
  }
  return false;
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

function clearSection(cells: Set<string>): void {
  for (const cell of cells) {
    rawInputs[cell as keyof RawInputs] = null;
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
      if (String(cell) === "B19") {
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
  const pad = { l: 50, r: 20, t: 30, b: 30 };
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

  const formatKLabel = (value: number): string => {
    const k = value / 1000;
    const absK = Math.abs(k);
    if (Number.isInteger(k) || absK >= 100) return `${Math.round(k).toLocaleString("en-US")}k`;
    if (absK >= 10) return `${Number(k.toFixed(1)).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
    return `${Number(k.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k`;
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

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#d0d7de";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, h - pad.b);
  ctx.lineTo(w - pad.r, h - pad.b);
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, h - pad.b);
  ctx.stroke();

  const xp = (i: number) => pad.l + (i / Math.max(1, x.length - 1)) * (w - pad.l - pad.r);
  const yp = (v: number) => h - pad.b - ((v - minY) / ySpan) * (h - pad.t - pad.b);

  const plot = (series: number[], color: string, dash: number[] = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
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
  plot(a, "#0ea5e9");
  plot(b, "#f97316", [6, 4]);

  if (rawMinY < 0 && rawMaxY > 0) {
    const y0 = yp(0);
    ctx.save();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, y0);
    ctx.lineTo(w - pad.r, y0);
    ctx.stroke();
    ctx.restore();
  }

  ctx.font = "12px sans-serif";
  const drawLegendItem = (xPos: number, yPos: number, color: string, text: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    if (color === "#f97316") ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xPos, yPos - 4);
    ctx.lineTo(xPos + 18, yPos - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#111827";
    ctx.fillText(text, xPos + 24, yPos);
  };
  const legendY = 14;
  const gap = 20;
  const itemAWidth = 24 + ctx.measureText(labelA).width;
  const itemBWidth = 24 + ctx.measureText(labelB).width;
  const totalLegendWidth = itemAWidth + gap + itemBWidth;
  const legendStartX = Math.max(pad.l + 120, w - pad.r - totalLegendWidth);
  drawLegendItem(legendStartX, legendY, "#0ea5e9", labelA);
  drawLegendItem(legendStartX + itemAWidth + gap, legendY, "#f97316", labelB);

  if (axisHasMeaningfulRange) {
    for (let yv = yMinTick; yv <= yMaxTick + 0.5; yv += tickStep) {
      const yy = yp(yv);
      ctx.fillStyle = "#6b7280";
      ctx.fillText(formatKLabel(yv), 4, yy + 4);
    }
  }

  if (x.length > 0) {
    const startAge = Math.round(x[0]);
    for (let i = 0; i < x.length; i += 1) {
      const age = Math.round(x[i]);
      if ((age - startAge) % 2 !== 0) continue;
      const xx = xp(i);
      ctx.strokeStyle = "#d0d7de";
      ctx.beginPath();
      ctx.moveTo(xx, h - pad.b);
      ctx.lineTo(xx, h - pad.b + 4);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
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
  queueRecalc();
});

spinnerDown.addEventListener("click", () => adjustEarlyRetirementAge(-1));
spinnerUp.addEventListener("click", () => adjustEarlyRetirementAge(1));

renderInputs();
recalc();
