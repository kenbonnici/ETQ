import { EffectiveInputs, ProjectionPoint, ScenarioOutputs } from "../types";
import { buildTimeline } from "../timeline";
import { fv, safePow, yearlyLoanPayment, clamp } from "../components/finance";

interface ScenarioConfig {
  retirementAge: number;
}

type FirstReqMode = "negate" | "raw" | "base_ref";

interface StageSeries {
  bfwd: number[];
  disposal: number[];
  growth: number[];
  cfwd: number[];
  disposalCosts: number[];
  netProceeds: number[];
}

interface PropertyStageSeries extends StageSeries {
  rentalForegone: number[];
  annualCostSaved: number[];
  loanRepayment: number[];
}

function nperMonths(balance: number, annualRate: number, monthlyRepayment: number): number {
  if (!(balance > 0 && monthlyRepayment > 0)) return 0;
  if (!(annualRate > 0)) {
    return balance / monthlyRepayment;
  }
  const monthlyRate = annualRate / 12;
  if (monthlyRepayment <= balance * monthlyRate) {
    // Payment does not cover monthly interest (or exactly equals it):
    // horizon is effectively unbounded, so yearly payments continue indefinitely.
    return Number.POSITIVE_INFINITY;
  }
  const ratio = monthlyRepayment / (monthlyRepayment - balance * monthlyRate);
  if (ratio <= 0) return Number.POSITIVE_INFINITY;
  return Math.log(ratio) / Math.log(1 + monthlyRate);
}

function inflationFactor(inf: number, idx: number): number {
  return safePow(1 + inf, idx);
}

function computePensionReduction(inputs: EffectiveInputs, earlyRetirementAge: number): number {
  const yearsEarly = Math.max(0, inputs.statutoryRetirementAge - earlyRetirementAge);
  return yearsEarly * inputs.pensionReductionPerYearEarly;
}

function propertyOrder(priority: number[], currentValues: number[]): number[] {
  const hasAnyPositive = priority.some((p) => p > 0);
  if (hasAnyPositive) {
    return [0, 1, 2]
      .filter((i) => priority[i] > 0)
      .sort((a, b) => priority[a] - priority[b]);
  }

  const indexed = [0, 1, 2].map((i) => ({ i, v: currentValues[i] }));
  indexed.sort((a, b) => a.v - b.v);
  return indexed.map((x) => x.i);
}

function zeroSeries(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function cumulative(series: number[]): number[] {
  const out = zeroSeries(series.length);
  let acc = 0;
  for (let i = 0; i < series.length; i += 1) {
    acc += series[i];
    out[i] = acc;
  }
  return out;
}

function sumAt(arrays: number[][], idx: number): number {
  let s = 0;
  for (const arr of arrays) s += arr[idx];
  return s;
}

function computeLiquidationRequired(
  basis: number[],
  firstMode: FirstReqMode,
  firstBaseRef: number[] | null = null
): number[] {
  const n = basis.length;
  const req = zeroSeries(n);
  if (n === 0) return req;

  if (firstMode === "negate") {
    req[0] = basis[0] < 0 ? -basis[0] : 0;
  } else if (firstMode === "raw") {
    req[0] = basis[0] < 0 ? basis[0] : 0;
  } else {
    const ref = firstBaseRef ?? basis;
    req[0] = basis[0] < 0 ? ref[0] : 0;
  }

  for (let i = 1; i < n; i += 1) {
    let prior = 0;
    for (let j = 0; j < i; j += 1) prior += req[j];
    const v = basis[i] + prior;
    req[i] = v < 0 ? -v : 0;
  }
  return req;
}

function stageTrigger(req: number[], t: number): boolean {
  if (req.length === 0) return false;
  if (t === 0) {
    const next = req.length > 1 ? req[1] : 0;
    return req[0] + next > 0;
  }
  if (t < req.length - 1) return req[t + 1] > 0;
  return req[t] > 0;
}

function computeStockStage(
  required: number[],
  stockBaseSeries: number[],
  stockReturn: number,
  stockDisposalCost: number
): StageSeries {
  const n = required.length;
  const bfwd = zeroSeries(n);
  const disposal = zeroSeries(n);
  const growth = zeroSeries(n);
  const cfwd = zeroSeries(n);
  const disposalCosts = zeroSeries(n);
  const netProceeds = zeroSeries(n);

  const netRate = 1 - stockDisposalCost;

  for (let i = 0; i < n; i += 1) {
    bfwd[i] = i === 0 ? stockBaseSeries[i] : cfwd[i - 1];

    const grossRequired = netRate > 0 ? required[i] / netRate : 0;
    const grossSold = clamp(grossRequired, 0, bfwd[i]);
    disposal[i] = -grossSold;

    growth[i] = i === 0 ? 0 : (bfwd[i] + disposal[i]) * stockReturn;
    cfwd[i] = bfwd[i] + disposal[i] + growth[i];

    disposalCosts[i] = disposal[i] * stockDisposalCost;
    netProceeds[i] = -disposal[i] + disposalCosts[i];
  }

  return { bfwd, disposal, growth, cfwd, disposalCosts, netProceeds };
}

function computePropertyStage(
  required: number[],
  baseValueSeries: number[],
  rentalSeries: number[],
  annualCostSeries: number[],
  loanBalanceSeries: number[],
  propertyAppreciation: number,
  propertyDisposalCost: number
): PropertyStageSeries {
  const n = required.length;
  const bfwd = zeroSeries(n);
  const disposal = zeroSeries(n);
  const growth = zeroSeries(n);
  const cfwd = zeroSeries(n);
  const disposalCosts = zeroSeries(n);
  const rentalForegone = zeroSeries(n);
  const annualCostSaved = zeroSeries(n);
  const loanRepayment = zeroSeries(n);
  const netProceeds = zeroSeries(n);

  const EPS = 1e-9;

  for (let i = 0; i < n; i += 1) {
    bfwd[i] = i === 0 ? baseValueSeries[i] : cfwd[i - 1];

    disposal[i] = stageTrigger(required, i) ? -bfwd[i] : 0;
    growth[i] = i === 0 ? 0 : (bfwd[i] + disposal[i]) * propertyAppreciation;
    cfwd[i] = bfwd[i] + disposal[i] + growth[i];

    disposalCosts[i] = disposal[i] * propertyDisposalCost;
    rentalForegone[i] = Math.abs(bfwd[i]) <= EPS ? -rentalSeries[i] : 0;
    annualCostSaved[i] = Math.abs(bfwd[i]) <= EPS ? annualCostSeries[i] : 0;
    loanRepayment[i] = bfwd[i] > EPS && Math.abs(cfwd[i]) <= EPS ? -loanBalanceSeries[i] : 0;

    netProceeds[i] =
      -disposal[i] +
      disposalCosts[i] +
      rentalForegone[i] +
      annualCostSaved[i] +
      loanRepayment[i];
  }

  return {
    bfwd,
    disposal,
    growth,
    cfwd,
    disposalCosts,
    rentalForegone,
    annualCostSaved,
    loanRepayment,
    netProceeds
  };
}

function stagePropertyOrder(priority: number[], currentValues: number[]): number[] {
  const hasAnyPositive = priority.some((p) => p > 0);
  if (!hasAnyPositive) return propertyOrder(priority, currentValues).slice(0, 3);

  const byRank = [-1, -1, -1];
  for (let i = 0; i < 3; i += 1) {
    const rank = Math.trunc(priority[i]);
    if (rank >= 1 && rank <= 3 && byRank[rank - 1] === -1) {
      byRank[rank - 1] = i;
    }
  }
  return byRank;
}

export function runScenario(inputs: EffectiveInputs, config: ScenarioConfig): ScenarioOutputs {
  const timeline = buildTimeline(inputs.ageNow, inputs.liveUntilAge);
  const n = timeline.ages.length;

  const pensionReduction = computePensionReduction(inputs, config.retirementAge);

  // Excel repayment schedules are based on fixed initial NPER horizons.
  const homeMonthsTotal = nperMonths(
    inputs.homeLoanBalance,
    inputs.homeLoanRate,
    inputs.homeLoanRepaymentMonthly
  );
  const propertyMonthsTotals = inputs.properties.map((p) =>
    nperMonths(p.loanBalance, p.loanRate, p.loanRepaymentMonthly)
  );
  const otherLoanMonthsTotal = nperMonths(
    inputs.otherLoanBalance,
    inputs.otherLoanRate,
    inputs.otherLoanRepaymentMonthly
  );

  const cashBaseSeries = zeroSeries(n); // Row 53
  const homeValueSeries = zeroSeries(n); // Row 54
  const stockBaseSeries = zeroSeries(n); // Row 59
  const homeLoanSeries = zeroSeries(n); // Row 60
  const otherLoanSeries = zeroSeries(n); // Row 65

  const propertyValueSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 56..58
  const propertyLoanSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 62..64
  const propertyRentalSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 8..10
  const propertyAnnualCostSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 34..36

  let cashBfwd = inputs.cashBalance; // Row 49 start

  for (let idx = 0; idx < n; idx += 1) {
    const age = timeline.ages[idx];
    const year = timeline.years[idx];
    const infFactor = inflationFactor(inputs.inflation, idx);

    const salary =
      age < Math.min(inputs.statutoryRetirementAge, config.retirementAge)
        ? inputs.netIncomeAnnual * safePow(1 + inputs.salaryGrowth, idx)
        : 0;

    const otherWork = age <= inputs.otherWorkUntilAge ? inputs.otherWorkIncomeAnnual * infFactor : 0;

    let rental = 0;
    for (let p = 0; p < inputs.properties.length; p += 1) {
      const r = inputs.properties[p].rentalIncome * safePow(1 + inputs.rentalIncomeGrowth, idx);
      propertyRentalSeries[p][idx] = r;
      rental += r;
    }

    const basePension = age >= inputs.statutoryRetirementAge ? inputs.pensionAnnual * infFactor : 0;
    const adjustedPension = Math.max(0, basePension - pensionReduction * infFactor);

    const postRetIncome =
      age >= inputs.postRetIncomeFromAge && age <= inputs.postRetIncomeToAge
        ? inputs.postRetIncomeAnnual * infFactor
        : 0;

    const incomeEvents = inputs.incomeEvents.reduce((sum, e) => {
      if (!e.name || e.amount === 0) return sum;
      return sum + (e.year === year ? e.amount * infFactor : 0);
    }, 0);

    const inflowsBeforeInterest = salary + otherWork + rental + adjustedPension + postRetIncome + incomeEvents;

    let outflows = inputs.livingExpensesAnnual * infFactor;
    if (age <= 65) outflows += inputs.spendAdjustTo65 * inputs.livingExpensesAnnual * infFactor;
    if (age > 65 && age <= 75) outflows += inputs.spendAdjust66To75 * inputs.livingExpensesAnnual * infFactor;
    if (age > 75) outflows += inputs.spendAdjustFrom76 * inputs.livingExpensesAnnual * infFactor;

    outflows += inputs.housingRentAnnual * infFactor;

    for (const d of inputs.dependents) {
      if (!d.name) continue;
      if (idx < d.yearsToSupport) outflows += d.annualCost * infFactor;
    }

    for (let p = 0; p < inputs.properties.length; p += 1) {
      const c = inputs.properties[p].annualCosts * infFactor;
      propertyAnnualCostSeries[p][idx] = c;
      outflows += c;
    }

    // Year-1 credit card clearance.
    if (idx === 0) outflows += inputs.creditCardBalance;

    outflows += yearlyLoanPayment(homeMonthsTotal, inputs.homeLoanRepaymentMonthly, idx);
    for (let p = 0; p < inputs.properties.length; p += 1) {
      outflows += yearlyLoanPayment(propertyMonthsTotals[p], inputs.properties[p].loanRepaymentMonthly, idx);
    }
    outflows += yearlyLoanPayment(otherLoanMonthsTotal, inputs.otherLoanRepaymentMonthly, idx);

    const expenseEvents = inputs.expenseEvents.reduce((sum, e) => {
      if (!e.name || e.amount === 0) return sum;
      return sum + (e.year === year ? e.amount * infFactor : 0);
    }, 0);
    outflows += expenseEvents;

    const preInterestCash = cashBfwd + inflowsBeforeInterest - outflows;
    const interest = Math.max(((cashBfwd + preInterestCash) / 2) * inputs.cashRate, 0);
    const cashCfwd = preInterestCash + interest;

    cashBaseSeries[idx] = cashCfwd;
    cashBfwd = cashCfwd;

    homeValueSeries[idx] =
      inputs.homeValue > 0 ? inputs.homeValue * safePow(1 + inputs.propertyAppreciation, idx + 1) : 0;
    stockBaseSeries[idx] = inputs.stocksBalance * safePow(1 + inputs.stockReturn, idx + 1);

    for (let p = 0; p < inputs.properties.length; p += 1) {
      propertyValueSeries[p][idx] =
        inputs.properties[p].value * safePow(1 + inputs.propertyAppreciation, idx + 1);
      propertyLoanSeries[p][idx] = Math.max(
        fv(
          inputs.properties[p].loanRate / 12,
          (idx + 1) * 12,
          inputs.properties[p].loanRepaymentMonthly,
          -inputs.properties[p].loanBalance
        ),
        0
      );
    }

    homeLoanSeries[idx] = Math.max(
      fv(inputs.homeLoanRate / 12, (idx + 1) * 12, inputs.homeLoanRepaymentMonthly, -inputs.homeLoanBalance),
      0
    );
    otherLoanSeries[idx] = Math.max(
      fv(inputs.otherLoanRate / 12, (idx + 1) * 12, inputs.otherLoanRepaymentMonthly, -inputs.otherLoanBalance),
      0
    );
  }

  // Liquidation system (rows 68..134).
  const row68 = cashBaseSeries.map((v) => v - inputs.cashBuffer);
  const row69 = computeLiquidationRequired(row68, "negate");

  const stockStage = computeStockStage(
    row69,
    stockBaseSeries,
    inputs.stockReturn,
    inputs.stockSellingCosts
  ); // rows 74..79

  const row81 = row68.map((v, i) => v + cumulative(stockStage.netProceeds)[i]);
  const row82 = computeLiquidationRequired(row81, "raw");

  const order = stagePropertyOrder(
    inputs.liquidationPriority,
    inputs.properties.map((p) => p.value)
  );

  const stageSeriesForProperty = (propIdx: number, series: number[][]): number[] =>
    propIdx >= 0 ? series[propIdx] : zeroSeries(n);

  const stage1 = computePropertyStage(
    row82,
    stageSeriesForProperty(order[0], propertyValueSeries),
    stageSeriesForProperty(order[0], propertyRentalSeries),
    stageSeriesForProperty(order[0], propertyAnnualCostSeries),
    stageSeriesForProperty(order[0], propertyLoanSeries),
    inputs.propertyAppreciation,
    inputs.propertyDisposalCosts
  ); // rows 85..93

  const row95 = row81.map((v, i) => v + cumulative(stage1.netProceeds)[i]);
  const row96 = row95.map(
    (v, i) => Math.max(v + inputs.cashBuffer, 0) - Math.max(row81[i] + inputs.cashBuffer, 0)
  );
  const row97 = row96.map((v) => v * inputs.cashRate);
  const row98 = row95.map((v, i) => v + cumulative(row97)[i]);
  const row99 = computeLiquidationRequired(row98, "base_ref", row95);

  const stage2 = computePropertyStage(
    row99,
    stageSeriesForProperty(order[1], propertyValueSeries),
    stageSeriesForProperty(order[1], propertyRentalSeries),
    stageSeriesForProperty(order[1], propertyAnnualCostSeries),
    stageSeriesForProperty(order[1], propertyLoanSeries),
    inputs.propertyAppreciation,
    inputs.propertyDisposalCosts
  ); // rows 102..110

  const row112 = row98.map((v, i) => v + cumulative(stage2.netProceeds)[i]);
  const row113 = row112.map(
    (v, i) => Math.max(v + inputs.cashBuffer, 0) - Math.max(row98[i] + inputs.cashBuffer, 0)
  );
  const row114 = row113.map((v) => v * inputs.cashRate);
  const row115 = row112.map((v, i) => v + cumulative(row114)[i]);
  const row116 = computeLiquidationRequired(row115, "raw");

  const stage3 = computePropertyStage(
    row116,
    stageSeriesForProperty(order[2], propertyValueSeries),
    stageSeriesForProperty(order[2], propertyRentalSeries),
    stageSeriesForProperty(order[2], propertyAnnualCostSeries),
    stageSeriesForProperty(order[2], propertyLoanSeries),
    inputs.propertyAppreciation,
    inputs.propertyDisposalCosts
  ); // rows 119..127

  const row129 = row115.map((v, i) => v + cumulative(stage3.netProceeds)[i]);
  const row130 = row129.map(
    (v, i) => Math.max(v + inputs.cashBuffer, 0) - Math.max(row115[i] + inputs.cashBuffer, 0)
  );
  const row131 = row130.map((v) => v * inputs.cashRate);
  const row132 = row129.map((v, i) => v + cumulative(row131)[i]);
  const finalCashSeries = row132.map((v) => v + inputs.cashBuffer); // row134 / row201

  // Adjusted net worth (rows 138..172 / row202).
  const adjustedPropertyValues = propertyValueSeries.map((s) => [...s]);
  const adjustedPropertyLoans = propertyLoanSeries.map((s) => [...s]);

  const stageDisposals = [stage1.disposal, stage2.disposal, stage3.disposal];
  const stageLoanRepayments = [stage1.loanRepayment, stage2.loanRepayment, stage3.loanRepayment];
  const EPS = 1e-9;

  for (let s = 0; s < 3; s += 1) {
    const propIdx = order[s];
    if (propIdx < 0) continue;

    const cumDisp = cumulative(stageDisposals[s]);
    const cumLoanRepay = cumulative(stageLoanRepayments[s]);

    for (let i = 0; i < n; i += 1) {
      if (Math.abs(cumDisp[i]) > EPS) adjustedPropertyValues[propIdx][i] = 0;
      if (Math.abs(cumLoanRepay[i]) > EPS) adjustedPropertyLoans[propIdx][i] = 0;
    }
  }

  const points: ProjectionPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const year = timeline.years[i];
    const age = timeline.ages[i];

    const netWorth =
      finalCashSeries[i] +
      homeValueSeries[i] +
      sumAt(adjustedPropertyValues, i) +
      stockStage.cfwd[i] -
      homeLoanSeries[i] -
      sumAt(adjustedPropertyLoans, i) -
      otherLoanSeries[i];

    points.push({
      yearIndex: i,
      year,
      age,
      cash: finalCashSeries[i],
      netWorth
    });
  }

  return {
    points,
    cashSeries: points.map((p) => p.cash),
    netWorthSeries: points.map((p) => p.netWorth)
  };
}
