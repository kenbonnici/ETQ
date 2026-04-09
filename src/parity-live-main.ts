import { readFileSync } from "node:fs";
import { runModel } from "./model";
import { rawInputsToFieldState } from "./model/excelAdapter";
import type { RawInputs } from "./model/types";

const parsedTolerance = Number(process.env.LIVE_PARITY_TOLERANCE ?? "0.01");
const LIVE_PARITY_TOLERANCE = Number.isFinite(parsedTolerance) ? parsedTolerance : 0.01;

type LiveExtract = {
  early: number;
  projection_month_override?: number | null;
  raw: Record<string, unknown>;
  exp: {
    years: number[];
    ages: number[];
    cashE: number[];
    cashN: number[];
    nwE: number[];
    nwN: number[];
  };
};

function maxAbsIndex(values: number[]): number {
  let idx = 0;
  let best = -1;
  for (let i = 0; i < values.length; i += 1) {
    const v = Math.abs(values[i]);
    if (v > best) {
      best = v;
      idx = i;
    }
  }
  return idx;
}

function findAgeIndex(ages: number[], age: number): number {
  return ages.findIndex((x) => x === age);
}

const input = JSON.parse(readFileSync("/tmp/etq_live_extract.json", "utf8")) as LiveExtract;
const model = runModel(rawInputsToFieldState(input.raw as RawInputs), {
  majorFutureEventsOpen: true,
  advancedAssumptionsOpen: true,
  earlyRetirementAge: input.early,
  manualPropertyLiquidationOrder: false,
  projectionMonthOverride: input.projection_month_override ?? null
}).outputs;

const dCashE = model.cashSeriesEarly.map((v, i) => v - input.exp.cashE[i]);
const dNwE = model.netWorthSeriesEarly.map((v, i) => v - input.exp.nwE[i]);
const dCashN = model.cashSeriesNorm.map((v, i) => v - input.exp.cashN[i]);
const dNwN = model.netWorthSeriesNorm.map((v, i) => v - input.exp.nwN[i]);

const maxCashE = maxAbsIndex(dCashE);
const maxNwE = maxAbsIndex(dNwE);
const maxCashN = maxAbsIndex(dCashN);
const maxNwN = maxAbsIndex(dNwN);

const age85 = findAgeIndex(input.exp.ages, 85);
const age95 = findAgeIndex(input.exp.ages, 95);

function lineForIndex(label: string, i: number, deltas: number[]) {
  if (i < 0) return `${label}: n/a`;
  return `${label}: idx=${i} year=${input.exp.years[i]} age=${input.exp.ages[i]} delta=${deltas[i].toFixed(2)}`;
}

const maxAbsDelta = Math.max(
  Math.abs(dCashE[maxCashE] ?? 0),
  Math.abs(dNwE[maxNwE] ?? 0),
  Math.abs(dCashN[maxCashN] ?? 0),
  Math.abs(dNwN[maxNwN] ?? 0)
);
const liveParityPass = maxAbsDelta <= LIVE_PARITY_TOLERANCE;

console.log(`Live workbook parity summary (early age=${input.early})`);
console.log(`Tolerance: ${LIVE_PARITY_TOLERANCE.toFixed(2)}`);
console.log(lineForIndex("Age 85 cash early", age85, dCashE));
console.log(lineForIndex("Age 85 net worth early", age85, dNwE));
console.log(lineForIndex("Age 95 cash early", age95, dCashE));
console.log(lineForIndex("Age 95 net worth early", age95, dNwE));
console.log(lineForIndex("Age 95 cash norm", age95, dCashN));
console.log(lineForIndex("Age 95 net worth norm", age95, dNwN));
console.log(lineForIndex("Max |dCashE|", maxCashE, dCashE));
console.log(lineForIndex("Max |dNwE|", maxNwE, dNwE));
console.log(lineForIndex("Max |dCashN|", maxCashN, dCashN));
console.log(lineForIndex("Max |dNwN|", maxNwN, dNwN));
console.log(`Overall live parity: ${liveParityPass ? "PASS" : "FAIL"} (max abs delta ${maxAbsDelta.toFixed(2)})`);

if (!liveParityPass) {
  process.exitCode = 1;
}
