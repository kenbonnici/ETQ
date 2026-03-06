import { readFileSync } from "node:fs";
import { runModel } from "./model";
import { rawInputsToFieldState } from "./model/excelAdapter";
import type { RawInputs } from "./model/types";

type LiveExtract = {
  early: number;
  raw: Record<string, unknown>;
  exp: {
    ages: number[];
    cashE: number[];
    cashN: number[];
    nwE: number[];
    nwN: number[];
  };
};

const input = JSON.parse(readFileSync("/tmp/etq_live_extract.json", "utf8")) as LiveExtract;
const outputs = runModel(rawInputsToFieldState(input.raw as RawInputs), {
  deeperDiveOpen: true,
  finerDetailsOpen: true,
  earlyRetirementAge: input.early
}).outputs;

const fmt = (n: number) => n.toFixed(0);

console.log(`| Year | Age | Excel Cash Early | Engine Cash Early | Δ Cash Early | Excel NW Early | Engine NW Early | Δ NW Early | Excel Cash Norm | Engine Cash Norm | Δ Cash Norm | Excel NW Norm | Engine NW Norm | Δ NW Norm |`);
console.log(`|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);

for (let i = 0; i < input.exp.ages.length; i += 1) {
  const year = 2027 + i;
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

  console.log(
    `| ${year} | ${age} | ${fmt(xCashE)} | ${fmt(mCashE)} | ${fmt(dCashE)} | ${fmt(xNwE)} | ${fmt(mNwE)} | ${fmt(dNwE)} | ${fmt(xCashN)} | ${fmt(mCashN)} | ${fmt(dCashN)} | ${fmt(xNwN)} | ${fmt(mNwN)} | ${fmt(dNwN)} |`
  );
}
