export interface MiniChartSeries {
  values: number[];
  color: string;
  fill?: string;
  lineWidth?: number;
}

export interface MiniChartOptions {
  currentAge: number;
  ages: number[];
  series: MiniChartSeries[];
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
}
