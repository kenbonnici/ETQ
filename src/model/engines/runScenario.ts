import { EffectiveInputs, NamedProjectionSeries, ProjectionPoint, ScenarioOutputs } from "../types";
import { buildTimeline } from "../timeline";
import { fv, safePow, yearlyLoanPayment, clamp } from "../components/finance";
import { ProjectionTiming } from "../projectionTiming";

interface ScenarioConfig {
  retirementAge: number;
}

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

function firstYearFactor(timing: ProjectionTiming, idx: number): number {
  return idx === 0 ? timing.proRate : 1;
}

function assetGrowthExponent(timing: ProjectionTiming, idx: number): number {
  return idx + timing.proRate;
}

function computePensionReduction(inputs: EffectiveInputs, earlyRetirementAge: number): number {
  const yearsEarly = Math.max(0, inputs.statutoryRetirementAge - earlyRetirementAge);
  return yearsEarly * inputs.pensionReductionPerYearEarly;
}

function propertyOrder(_priority: number[], currentValues: number[]): number[] {
  const indexed = currentValues.map((v, i) => ({ i, v }));
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

function computeLiquidationRequired(basis: number[]): number[] {
  const n = basis.length;
  const req = zeroSeries(n);
  if (n === 0) return req;

  req[0] = basis[0] < 0 ? -basis[0] : 0;

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
  if (!hasAnyPositive) return propertyOrder(priority, currentValues);

  const byRank = currentValues.map(() => -1);
  for (let i = 0; i < currentValues.length; i += 1) {
    const rank = Math.trunc(priority[i]);
    if (rank >= 1 && rank <= currentValues.length && byRank[rank - 1] === -1) {
      byRank[rank - 1] = i;
    }
  }
  return byRank;
}

export function runScenario(inputs: EffectiveInputs, config: ScenarioConfig, timing: ProjectionTiming): ScenarioOutputs {
  const timeline = buildTimeline(inputs.ageNow, inputs.liveUntilAge, timing.currentYear);
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
  const salarySeries = zeroSeries(n);
  const otherWorkSeries = zeroSeries(n);
  const statutoryPensionSeries = zeroSeries(n);
  const postRetIncomeSeries = zeroSeries(n);
  const livingExpensesSeries = zeroSeries(n);
  const housingRentSeries = zeroSeries(n);
  const creditCardClearanceSeries = zeroSeries(n);
  const homeLoanRepaymentSeries = zeroSeries(n);
  const otherLoanRepaymentSeries = zeroSeries(n);
  const propertyLoanRepaymentSeries = inputs.properties.map(() => zeroSeries(n));
  const dependentCostSeries = inputs.dependents.map(() => zeroSeries(n));
  const incomeEventSeries = inputs.incomeEvents.map(() => zeroSeries(n));
  const expenseEventSeries = inputs.expenseEvents.map(() => zeroSeries(n));
  const baseInterestSeries = zeroSeries(n);

  let cashBfwd = inputs.cashBalance; // Row 49 start

  for (let idx = 0; idx < n; idx += 1) {
    const age = timeline.ages[idx];
    const year = timeline.years[idx];
    const infFactor = inflationFactor(inputs.inflation, idx);
    const proRate = firstYearFactor(timing, idx);

    const salary =
      age < Math.min(inputs.statutoryRetirementAge, config.retirementAge)
        ? inputs.netIncomeAnnual * safePow(1 + inputs.salaryGrowth, idx) * proRate
        : 0;
    salarySeries[idx] = salary;

    const otherWork = age <= inputs.otherWorkUntilAge ? inputs.otherWorkIncomeAnnual * infFactor * proRate : 0;
    otherWorkSeries[idx] = otherWork;

    let rental = 0;
    for (let p = 0; p < inputs.properties.length; p += 1) {
      const r = inputs.properties[p].rentalIncome * timing.proRate * safePow(1 + inputs.rentalIncomeGrowth, idx);
      propertyRentalSeries[p][idx] = r;
      rental += r;
    }

    const basePension = age >= inputs.statutoryRetirementAge ? inputs.pensionAnnual * infFactor * proRate : 0;
    const adjustedPension = Math.max(0, basePension - pensionReduction * infFactor * proRate);
    statutoryPensionSeries[idx] = adjustedPension;

    const postRetIncome =
      age >= inputs.postRetIncomeFromAge && age <= inputs.postRetIncomeToAge
        ? inputs.postRetIncomeAnnual * infFactor * proRate
        : 0;
    postRetIncomeSeries[idx] = postRetIncome;

    let incomeEvents = 0;
    for (let e = 0; e < inputs.incomeEvents.length; e += 1) {
      const event = inputs.incomeEvents[e];
      if (!event.name || event.amount === 0) continue;
      const value = event.year === year ? event.amount * infFactor : 0;
      incomeEventSeries[e][idx] = value;
      incomeEvents += value;
    }

    const inflowsBeforeInterest = salary + otherWork + rental + adjustedPension + postRetIncome + incomeEvents;

    const livingExpenseBase = inputs.livingExpensesAnnual * infFactor * proRate;
    let livingExpense = livingExpenseBase;
    if (age <= 65) livingExpense += inputs.spendAdjustTo65 * livingExpenseBase;
    if (age > 65 && age <= 75) livingExpense += inputs.spendAdjust66To75 * livingExpenseBase;
    if (age > 75) livingExpense += inputs.spendAdjustFrom76 * livingExpenseBase;
    livingExpensesSeries[idx] = livingExpense;

    let outflows = livingExpense;
    const housingRent = inputs.housingRentAnnual * infFactor * proRate;
    housingRentSeries[idx] = housingRent;
    outflows += housingRent;

    for (let d = 0; d < inputs.dependents.length; d += 1) {
      const dependent = inputs.dependents[d];
      if (!dependent.name) continue;
      const cost = idx < dependent.yearsToSupport ? dependent.annualCost * infFactor * proRate : 0;
      dependentCostSeries[d][idx] = cost;
      outflows += cost;
    }

    for (let p = 0; p < inputs.properties.length; p += 1) {
      const c = inputs.properties[p].annualCosts * infFactor * proRate;
      propertyAnnualCostSeries[p][idx] = c;
      outflows += c;
    }

    // Year-1 credit card clearance.
    const creditCardClearance = idx === 0 ? inputs.creditCardBalance : 0;
    creditCardClearanceSeries[idx] = creditCardClearance;
    outflows += creditCardClearance;

    const homeLoanRepayment = yearlyLoanPayment(
      homeMonthsTotal,
      inputs.homeLoanRepaymentMonthly,
      idx,
      timing.monthsRemaining,
      timing.monthOffset
    );
    homeLoanRepaymentSeries[idx] = homeLoanRepayment;
    outflows += homeLoanRepayment;
    for (let p = 0; p < inputs.properties.length; p += 1) {
      const repayment = yearlyLoanPayment(
        propertyMonthsTotals[p],
        inputs.properties[p].loanRepaymentMonthly,
        idx,
        timing.monthsRemaining,
        timing.monthOffset
      );
      outflows += repayment;
      propertyLoanSeries[p][idx] = Math.max(
        fv(
          inputs.properties[p].loanRate / 12,
          (idx + 1) * 12 + timing.monthOffset,
          inputs.properties[p].loanRepaymentMonthly,
          -inputs.properties[p].loanBalance
        ),
        0
      );
      propertyLoanRepaymentSeries[p][idx] = repayment;
    }
    const otherLoanRepayment = yearlyLoanPayment(
      otherLoanMonthsTotal,
      inputs.otherLoanRepaymentMonthly,
      idx,
      timing.monthsRemaining,
      timing.monthOffset
    );
    otherLoanRepaymentSeries[idx] = otherLoanRepayment;
    outflows += otherLoanRepayment;

    let expenseEvents = 0;
    for (let e = 0; e < inputs.expenseEvents.length; e += 1) {
      const event = inputs.expenseEvents[e];
      if (!event.name || event.amount === 0) continue;
      const value = event.year === year ? event.amount * infFactor : 0;
      expenseEventSeries[e][idx] = value;
      expenseEvents += value;
    }
    outflows += expenseEvents;

    const preInterestCash = cashBfwd + inflowsBeforeInterest - outflows;
    const interest = Math.max(((cashBfwd + preInterestCash) / 2) * inputs.cashRate, 0);
    baseInterestSeries[idx] = interest;
    const cashCfwd = preInterestCash + interest;

    cashBaseSeries[idx] = cashCfwd;
    cashBfwd = cashCfwd;

    homeValueSeries[idx] =
      inputs.homeValue > 0 ? inputs.homeValue * safePow(1 + inputs.propertyAppreciation, assetGrowthExponent(timing, idx)) : 0;
    stockBaseSeries[idx] = inputs.stocksBalance * safePow(1 + inputs.stockReturn, assetGrowthExponent(timing, idx));

    for (let p = 0; p < inputs.properties.length; p += 1) {
      propertyValueSeries[p][idx] =
        inputs.properties[p].value * safePow(1 + inputs.propertyAppreciation, assetGrowthExponent(timing, idx));
    }

    homeLoanSeries[idx] = Math.max(
      fv(
        inputs.homeLoanRate / 12,
        (idx + 1) * 12 + timing.monthOffset,
        inputs.homeLoanRepaymentMonthly,
        -inputs.homeLoanBalance
      ),
      0
    );
    otherLoanSeries[idx] = Math.max(
      fv(
        inputs.otherLoanRate / 12,
        (idx + 1) * 12 + timing.monthOffset,
        inputs.otherLoanRepaymentMonthly,
        -inputs.otherLoanBalance
      ),
      0
    );
  }

  // Liquidation system (rows 68..134).
  const row68 = cashBaseSeries.map((v) => v - inputs.cashBuffer);
  const row69 = computeLiquidationRequired(row68);

  const stockStage = computeStockStage(
    row69,
    stockBaseSeries,
    inputs.stockReturn,
    inputs.stockSellingCosts
  ); // rows 74..79

  const row81 = row68.map((v, i) => v + cumulative(stockStage.netProceeds)[i]);

  const order = stagePropertyOrder(
    inputs.liquidationPriority,
    inputs.properties.map((p) => p.value)
  );

  const stageSeriesForProperty = (propIdx: number, series: number[][]): number[] =>
    propIdx >= 0 ? series[propIdx] : zeroSeries(n);

  const propertyStages: PropertyStageSeries[] = [];
  const propertyExtraInterestSeries: number[][] = [];
  let cashAvailableAfterLiquidationStages = row81;

  for (let stageIdx = 0; stageIdx < order.length; stageIdx += 1) {
    const required = computeLiquidationRequired(cashAvailableAfterLiquidationStages);
    const propIdx = order[stageIdx];
    const stage = computePropertyStage(
      required,
      stageSeriesForProperty(propIdx, propertyValueSeries),
      stageSeriesForProperty(propIdx, propertyRentalSeries),
      stageSeriesForProperty(propIdx, propertyAnnualCostSeries),
      stageSeriesForProperty(propIdx, propertyLoanSeries),
      inputs.propertyAppreciation,
      inputs.propertyDisposalCosts
    );
    propertyStages.push(stage);

    const cashAfterProceeds = cashAvailableAfterLiquidationStages.map(
      (value, idx) => value + cumulative(stage.netProceeds)[idx]
    );
    const extraCash = cashAfterProceeds.map(
      (value, idx) => Math.max(value + inputs.cashBuffer, 0) - Math.max(cashAvailableAfterLiquidationStages[idx] + inputs.cashBuffer, 0)
    );
    const extraInterest = extraCash.map((value) => value * inputs.cashRate);
    propertyExtraInterestSeries.push(extraInterest);
    cashAvailableAfterLiquidationStages = cashAfterProceeds.map(
      (value, idx) => value + cumulative(extraInterest)[idx]
    );
  }

  const finalCashSeries = cashAvailableAfterLiquidationStages.map((v) => v + inputs.cashBuffer); // row180 / row213
  const totalInterestSeries = baseInterestSeries.map(
    (value, i) => value + propertyExtraInterestSeries.reduce((sum, series) => sum + series[i], 0)
  );
  const openingCashSeries = zeroSeries(n);
  const totalInflowsSeries = zeroSeries(n);
  const totalOutflowsSeries = zeroSeries(n);
  const netCashFlowSeries = zeroSeries(n);

  for (let i = 0; i < n; i += 1) {
    openingCashSeries[i] = i === 0 ? inputs.cashBalance : finalCashSeries[i - 1];
    totalInflowsSeries[i] =
      salarySeries[i] +
      otherWorkSeries[i] +
      sumAt(propertyRentalSeries, i) +
      statutoryPensionSeries[i] +
      postRetIncomeSeries[i] +
      sumAt(incomeEventSeries, i) +
      stockStage.netProceeds[i] +
      propertyStages.reduce((sum, stage) => sum + stage.netProceeds[i], 0);
    totalOutflowsSeries[i] =
      creditCardClearanceSeries[i] +
      homeLoanRepaymentSeries[i] +
      sumAt(propertyLoanRepaymentSeries, i) +
      otherLoanRepaymentSeries[i] +
      sumAt(dependentCostSeries, i) +
      housingRentSeries[i] +
      sumAt(propertyAnnualCostSeries, i) +
      livingExpensesSeries[i] +
      sumAt(expenseEventSeries, i);
    netCashFlowSeries[i] = totalInflowsSeries[i] - totalOutflowsSeries[i];
  }

  // Adjusted net worth (rows 138..172 / row202).
  const adjustedPropertyValues = propertyValueSeries.map((s) => [...s]);
  const adjustedPropertyLoans = propertyLoanSeries.map((s) => [...s]);

  const stageDisposals = propertyStages.map((stage) => stage.disposal);
  const stageLoanRepayments = propertyStages.map((stage) => stage.loanRepayment);
  const EPS = 1e-9;

  for (let s = 0; s < propertyStages.length; s += 1) {
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

  const milestoneHints: ScenarioOutputs["milestoneHints"] = [];
  for (let i = 0; i < n; i += 1) {
    if (Math.abs(stockStage.disposal[i]) <= EPS) continue;
    milestoneHints.push({
      year: timeline.years[i],
      age: timeline.ages[i],
      label: "Stock sale executed",
      amount: Math.abs(stockStage.disposal[i])
    });
  }

  const firstPayoffIndex = (series: number[]): number => {
    for (let i = 0; i < series.length; i += 1) {
      const curr = series[i];
      const prev = i === 0 ? Number.POSITIVE_INFINITY : series[i - 1];
      if (curr <= EPS && prev > EPS) return i;
    }
    return -1;
  };

  if (inputs.homeLoanBalance > EPS) {
    const idx = firstPayoffIndex(homeLoanSeries);
    if (idx >= 0) {
      milestoneHints.push({
        year: timeline.years[idx],
        age: timeline.ages[idx],
        label: "Home loan fully repaid"
      });
    }
  }

  if (inputs.otherLoanBalance > EPS) {
    const idx = firstPayoffIndex(otherLoanSeries);
    if (idx >= 0) {
      milestoneHints.push({
        year: timeline.years[idx],
        age: timeline.ages[idx],
        label: "Other loan fully repaid"
      });
    }
  }

  for (let p = 0; p < adjustedPropertyLoans.length; p += 1) {
    if (inputs.properties[p].loanBalance <= EPS) continue;
    const idx = firstPayoffIndex(adjustedPropertyLoans[p]);
    if (idx < 0) continue;
    const propertyName = inputs.properties[p].name.trim() || `Property ${p + 1}`;
    milestoneHints.push({
      year: timeline.years[idx],
      age: timeline.ages[idx],
      label: `${propertyName} loan fully repaid`
    });
  }

  const disposalStages = propertyStages.map((stage) => stage.disposal);
  for (let s = 0; s < disposalStages.length; s += 1) {
    const propIdx = order[s];
    if (propIdx < 0 || propIdx >= inputs.properties.length) continue;
    const disposal = disposalStages[s];
    const saleIdx = disposal.findIndex((value) => Math.abs(value) > EPS);
    if (saleIdx < 0) continue;
    const propertyName = inputs.properties[propIdx].name.trim() || `Property ${propIdx + 1}`;
    const saleTarget = /property/i.test(propertyName) ? propertyName : `${propertyName} Property`;
    milestoneHints.push({
      year: timeline.years[saleIdx],
      age: timeline.ages[saleIdx],
      label: `Sale of ${saleTarget}`,
      amount: Math.abs(disposal[saleIdx])
    });
  }

  const propertyStageByProperty = inputs.properties.map<PropertyStageSeries | null>(() => null);
  for (let stageIdx = 0; stageIdx < propertyStages.length; stageIdx += 1) {
    const propIdx = order[stageIdx];
    if (propIdx < 0 || propIdx >= propertyStageByProperty.length) continue;
    propertyStageByProperty[propIdx] = propertyStages[stageIdx];
  }

  const displayRentalIncomeByProperty = inputs.properties.map<NamedProjectionSeries>((property, idx) => {
    const stage = propertyStageByProperty[idx];
    const values = propertyRentalSeries[idx].map((value, yearIdx) => value + (stage?.rentalForegone[yearIdx] ?? 0));
    return {
      key: `rental-${idx}`,
      label: property.name.trim() || `Property ${idx + 1}`,
      values
    };
  });

  const displayPropertyCostsByProperty = inputs.properties.map<NamedProjectionSeries>((property, idx) => {
    const stage = propertyStageByProperty[idx];
    const values = propertyAnnualCostSeries[idx].map(
      (value, yearIdx) => value - (stage?.annualCostSaved[yearIdx] ?? 0)
    );
    return {
      key: `property-cost-${idx}`,
      label: property.name.trim() || `Property ${idx + 1}`,
      values
    };
  });

  const displayLiquidationsByProperty = inputs.properties.map<NamedProjectionSeries>((property, idx) => {
    const stage = propertyStageByProperty[idx];
    const values = stage
      ? stage.netProceeds.map(
          (value, yearIdx) => value - stage.rentalForegone[yearIdx] - stage.annualCostSaved[yearIdx]
        )
      : zeroSeries(n);
    return {
      key: `liquidation-property-${idx}`,
      label: property.name.trim() || `Property ${idx + 1}`,
      values
    };
  });

  const displayTotalInflowsSeries = zeroSeries(n);
  const displayTotalOutflowsSeries = zeroSeries(n);
  const displayNetCashFlowSeries = zeroSeries(n);
  for (let i = 0; i < n; i += 1) {
    displayTotalInflowsSeries[i] =
      salarySeries[i] +
      otherWorkSeries[i] +
      sumAt(displayRentalIncomeByProperty.map((row) => row.values), i) +
      statutoryPensionSeries[i] +
      postRetIncomeSeries[i] +
      sumAt(incomeEventSeries, i) +
      stockStage.netProceeds[i] +
      sumAt(displayLiquidationsByProperty.map((row) => row.values), i);
    displayTotalOutflowsSeries[i] =
      creditCardClearanceSeries[i] +
      homeLoanRepaymentSeries[i] +
      sumAt(propertyLoanRepaymentSeries, i) +
      otherLoanRepaymentSeries[i] +
      sumAt(dependentCostSeries, i) +
      housingRentSeries[i] +
      sumAt(displayPropertyCostsByProperty.map((row) => row.values), i) +
      livingExpensesSeries[i] +
      sumAt(expenseEventSeries, i);
    displayNetCashFlowSeries[i] = displayTotalInflowsSeries[i] - displayTotalOutflowsSeries[i];
  }

  return {
    points,
    cashSeries: points.map((p) => p.cash),
    netWorthSeries: points.map((p) => p.netWorth),
    retirementSuccessful: false,
    milestoneHints,
    cashFlow: {
      openingCash: openingCashSeries,
      employmentIncome: salarySeries,
      otherWorkIncome: otherWorkSeries,
      rentalIncomeByProperty: displayRentalIncomeByProperty,
      statutoryPension: statutoryPensionSeries,
      otherPostRetirementIncome: postRetIncomeSeries,
      incomeEvents: inputs.incomeEvents.map((event, idx) => ({
        key: `income-event-${idx}`,
        label: event.name.trim() || `Income event ${idx + 1}`,
        values: [...incomeEventSeries[idx]]
      })),
      liquidationsStocks: [...stockStage.netProceeds],
      liquidationsByProperty: displayLiquidationsByProperty,
      interestOnCash: totalInterestSeries,
      creditCardsCleared: creditCardClearanceSeries,
      homeLoanRepayment: homeLoanRepaymentSeries,
      propertyLoanRepayments: inputs.properties.map((property, idx) => ({
        key: `property-loan-${idx}`,
        label: property.name.trim() || `Property ${idx + 1}`,
        values: [...propertyLoanRepaymentSeries[idx]]
      })),
      otherLoanRepayment: otherLoanRepaymentSeries,
      dependentsCost: inputs.dependents.map((dependent, idx) => ({
        key: `dependent-${idx}`,
        label: dependent.name.trim() || `Dependent ${idx + 1}`,
        values: [...dependentCostSeries[idx]]
      })),
      housingRent: housingRentSeries,
      propertyCosts: displayPropertyCostsByProperty,
      livingExpenses: livingExpensesSeries,
      expenseEvents: inputs.expenseEvents.map((event, idx) => ({
        key: `expense-event-${idx}`,
        label: event.name.trim() || `Expense event ${idx + 1}`,
        values: [...expenseEventSeries[idx]]
      })),
      totalInflows: displayTotalInflowsSeries,
      totalOutflows: displayTotalOutflowsSeries,
      netCashFlow: displayNetCashFlowSeries,
      closingCash: finalCashSeries
    },
    netWorth: {
      cash: [...finalCashSeries],
      stockMarketEquity: [...stockStage.cfwd],
      properties: [
        {
          key: "property-home",
          label: "Home",
          values: [...homeValueSeries]
        },
        ...inputs.properties.map((property, idx) => ({
          key: `property-asset-${idx}`,
          label: property.name.trim() || `Property ${idx + 1}`,
          values: [...adjustedPropertyValues[idx]]
        }))
      ],
      loans: [
        {
          key: "loan-home",
          label: "Home loan",
          values: [...homeLoanSeries]
        },
        ...inputs.properties.map((property, idx) => ({
          key: `loan-property-${idx}`,
          label: `${property.name.trim() || `Property ${idx + 1}`} loan`,
          values: [...adjustedPropertyLoans[idx]]
        })),
        {
          key: "loan-other",
          label: "Other loan",
          values: [...otherLoanSeries]
        }
      ]
    }
  };
}
