export interface MiniChartSeries {
  values: number[];
  color: string;
  fill?: string;
  lineWidth?: number;
  label?: string;
}

export interface MiniChartOptions {
  currentAge: number;
  ages: number[];
  series: MiniChartSeries[];
  tooltipHost?: HTMLElement;
}

interface ChartLayout {
  padL: number; padR: number; padT: number; padB: number;
  plotW: number; plotH: number;
  minVal: number; maxVal: number;
  xFor: (i: number) => number;
  yFor: (v: number) => number;
}

const CHART_TOOLTIP_HANDLER = Symbol.for("ob.chartTooltipHandler");
const CHART_LAYOUT_KEY = Symbol.for("ob.chartLayout");

interface CanvasWithMeta extends HTMLCanvasElement {
  [CHART_TOOLTIP_HANDLER]?: (ev: MouseEvent | { type: "leave" }) => void;
  [CHART_LAYOUT_KEY]?: { layout: ChartLayout; opts: MiniChartOptions };
}

function formatCurrency(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(Math.round(v));
  return `${sign}€${abs.toLocaleString("en-IE")}`;
}

function ensureTooltip(host: HTMLElement): HTMLElement {
  let tip = host.querySelector<HTMLElement>(".ob-chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "ob-chart-tooltip";
    tip.setAttribute("role", "presentation");
    host.style.position = host.style.position || "relative";
    host.appendChild(tip);
  }
  return tip;
}

export function drawMiniChart(canvas: HTMLCanvasElement, opts: MiniChartOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth === 0 || cssHeight === 0) return;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padL = 12;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const plotW = cssWidth - padL - padR;
  const plotH = cssHeight - padT - padB;

  if (opts.series.length === 0 || opts.ages.length === 0) return;

  let maxVal = 0;
  let minVal = 0;
  for (const s of opts.series) {
    for (const v of s.values) {
      if (Number.isFinite(v)) {
        if (v > maxVal) maxVal = v;
        if (v < minVal) minVal = v;
      }
    }
  }
  if (maxVal === minVal) { maxVal = minVal + 1; }
  const range = maxVal - minVal;

  const nPoints = opts.ages.length;
  const xFor = (i: number): number =>
    padL + (nPoints <= 1 ? plotW / 2 : (plotW * i) / (nPoints - 1));
  const yFor = (v: number): number =>
    padT + plotH - ((v - minVal) / range) * plotH;

  // Zero line
  if (minVal < 0 && maxVal > 0) {
    ctx.strokeStyle = "#e3d9c4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zeroY = yFor(0);
    ctx.moveTo(padL, zeroY);
    ctx.lineTo(padL + plotW, zeroY);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#e3d9c4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();
  }

  // Series (draw fills first, then lines)
  for (const s of opts.series) {
    if (!s.fill) continue;
    ctx.beginPath();
    ctx.moveTo(xFor(0), padT + plotH);
    for (let i = 0; i < s.values.length && i < nPoints; i += 1) {
      ctx.lineTo(xFor(i), yFor(s.values[i]));
    }
    ctx.lineTo(xFor(Math.min(s.values.length, nPoints) - 1), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = s.fill;
    ctx.fill();
  }
  for (const s of opts.series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth ?? 1.5;
    ctx.beginPath();
    for (let i = 0; i < s.values.length && i < nPoints; i += 1) {
      const x = xFor(i);
      const y = yFor(s.values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // X-axis age ticks: every 5 years from current age
  ctx.fillStyle = "#7d8a90";
  ctx.font = '10px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i < opts.ages.length; i += 1) {
    const age = opts.ages[i];
    if (age % 5 !== 0) continue;
    if (age < opts.currentAge) continue;
    const x = xFor(i);
    ctx.fillText(String(age), x, padT + plotH + 6);
  }

  const meta: CanvasWithMeta = canvas as CanvasWithMeta;
  meta[CHART_LAYOUT_KEY] = {
    layout: { padL, padR, padT, padB, plotW, plotH, minVal, maxVal, xFor, yFor },
    opts
  };

  if (opts.tooltipHost) {
    attachTooltip(meta, opts.tooltipHost);
  }
}

function attachTooltip(canvas: CanvasWithMeta, host: HTMLElement): void {
  const tip = ensureTooltip(host);
  tip.style.display = "none";

  // Detach any prior handler before re-binding so stale closures don't fire.
  const prior = canvas[CHART_TOOLTIP_HANDLER];
  if (prior) {
    canvas.removeEventListener("mousemove", prior as EventListener);
    canvas.removeEventListener("mouseleave", prior as EventListener);
  }

  const handler = (ev: MouseEvent | { type: "leave" }): void => {
    if ((ev as { type: string }).type === "leave" || (ev as { type: string }).type === "mouseleave") {
      tip.style.display = "none";
      return;
    }
    const meta = canvas[CHART_LAYOUT_KEY];
    if (!meta) return;
    const { layout, opts } = meta;
    const rect = canvas.getBoundingClientRect();
    const me = ev as MouseEvent;
    const x = me.clientX - rect.left;
    const y = me.clientY - rect.top;
    if (x < layout.padL || x > layout.padL + layout.plotW || y < layout.padT || y > layout.padT + layout.plotH) {
      tip.style.display = "none";
      return;
    }
    const n = opts.ages.length;
    if (n === 0) return;
    const ratio = (x - layout.padL) / Math.max(1, layout.plotW);
    const i = Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
    const age = opts.ages[i];
    const lines: string[] = [`Age ${age}`];
    for (const s of opts.series) {
      const v = s.values[i];
      const lbl = s.label ?? "value";
      lines.push(`${lbl}: ${formatCurrency(Number(v))}`);
    }
    tip.innerHTML = lines.map((l, idx) => `<span class="ob-chart-tooltip-line${idx===0?" is-head":""}">${l}</span>`).join("");
    tip.style.display = "block";
    const tipWidth = tip.offsetWidth || 120;
    const hostRect = host.getBoundingClientRect();
    let left = (rect.left - hostRect.left) + x + 12;
    if (left + tipWidth > hostRect.width - 4) left = (rect.left - hostRect.left) + x - tipWidth - 12;
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${(rect.top - hostRect.top) + Math.max(layout.padT, y - 18)}px`;
  };

  canvas.addEventListener("mousemove", handler as EventListener);
  canvas.addEventListener("mouseleave", () => handler({ type: "leave" }) as void);
  canvas[CHART_TOOLTIP_HANDLER] = handler;
}
