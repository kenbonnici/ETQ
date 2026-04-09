import { readFileSync } from "node:fs";
import { runModel } from "./model";
import { rawInputsToFieldState } from "./model/excelAdapter";
import type { RawInputs } from "./model/types";

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

const input = JSON.parse(readFileSync("/tmp/etq_live_extract.json", "utf8")) as LiveExtract;
const outputs = runModel(rawInputsToFieldState(input.raw as RawInputs), {
  majorFutureEventsOpen: true,
  advancedAssumptionsOpen: true,
  earlyRetirementAge: input.early,
  manualPropertyLiquidationOrder: false,
  projectionMonthOverride: input.projection_month_override ?? null
}).outputs;

const fmt = (n: number) => n.toFixed(2);

const header = [
  "Year",
  "Age",
  "Excel Cash Early",
  "Engine Cash Early",
  "Delta Cash Early",
  "Excel Net Worth Early",
  "Engine Net Worth Early",
  "Delta Net Worth Early",
  "Excel Cash Norm",
  "Engine Cash Norm",
  "Delta Cash Norm",
  "Excel Net Worth Norm",
  "Engine Net Worth Norm",
  "Delta Net Worth Norm"
];

console.log(header.join(","));

for (let i = 0; i < input.exp.ages.length; i += 1) {
  const year = input.exp.years[i];
  const age = input.exp.ages[i];

  const xCashE = input.exp.cashE[i];
  const mCashE = outputs.cashSeriesEarly[i];
  const dCashE = mCashE - xCashE;

  const xNwE = input.exp.nwE[i];
  const mNwE = outputs.netWorthSeriesEarly[i];
  const dNwE = mNwE - xNwE;

  const xCashN = input.exp.cashN[i];
  const mCashN = outputs.cashSeriesNorm[i];
  const dCashN = mCashN - xCashN;

  const xNwN = input.exp.nwN[i];
  const mNwN = outputs.netWorthSeriesNorm[i];
  const dNwN = mNwN - xNwN;

  const row = [
    String(year),
    String(age),
    fmt(xCashE),
    fmt(mCashE),
    fmt(dCashE),
    fmt(xNwE),
    fmt(mNwE),
    fmt(dNwE),
    fmt(xCashN),
    fmt(mCashN),
    fmt(dCashN),
    fmt(xNwN),
    fmt(mNwN),
    fmt(dNwN)
  ];

  console.log(row.join(","));
}
