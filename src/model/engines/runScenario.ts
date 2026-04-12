import {
  EffectiveInputs,
  NamedProjectionSeries,
  ProjectionPoint,
  ScenarioDebug,
  ScenarioLiquidationStageDebug,
  ScenarioOutputs
} from "../types";
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
  loanRepaymentSaved: number[];
}

interface LiquidationAssetDescriptor {
  kind: "property" | "assetOfValue";
  idx: number;
  name: string;
  fallbackLabel: string;
  valueSeries: number[];
  rentalSeries: number[];
  annualCostSeries: number[];
  loanSeries: number[];
  loanRepaymentSeries: number[];
  appreciationRate: number;
  disposalCostRate: number;
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

function stockGrowthRateForYear(inputs: EffectiveInputs, year: number): number {
  for (const crash of inputs.stockMarketCrashes) {
    if (!(crash.year > 0 && crash.dropPercentage > 0 && crash.recoveryYears > 0)) continue;
    if (year === crash.year) return -crash.dropPercentage;
    if (year > crash.year && year <= crash.year + crash.recoveryYears) {
      return safePow(1 / (1 - crash.dropPercentage), 1 / crash.recoveryYears) - 1;
    }
  }
  return inputs.stockReturn;
}

function propertyOrder(_priority: number[], currentValues: number[]): number[] {
  const indexed = currentValues.map((v, i) => ({ i, v }));
  indexed.sort((a, b) => a.v - b.v);
  return indexed.map((x) => x.i);
}

function zeroSeries(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function valueAtSaleYear(valueSeries: number[], saleIdx: number): number {
  if (saleIdx <= 0) return valueSeries[saleIdx] ?? 0;
  return valueSeries[saleIdx - 1] ?? valueSeries[saleIdx] ?? 0;
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
  if (t < req.length - 1) return req[t + 1] > 0;
  return req[t] > 0;
}

function computeStockStage(
  required: number[],
  initialStockBalance: number,
  stockContributionSeries: number[],
  stockGrowthRates: number[],
  timing: ProjectionTiming,
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
    const contribution = stockContributionSeries[i];
    bfwd[i] = i === 0 ? initialStockBalance + contribution : cfwd[i - 1] + contribution;

    const grossRequired = netRate > 0 ? required[i] / netRate : 0;
    const grossSold = clamp(grossRequired, 0, bfwd[i]);
    disposal[i] = -grossSold;

    const annualGrowthRate = stockGrowthRates[i] ?? 0;
    const fullPeriodGrowthRate =
      i === 0 ? safePow(1 + annualGrowthRate, timing.proRate) - 1 : annualGrowthRate;
    const contributionGrowthRate =
      i === 0 ? safePow(1 + annualGrowthRate, timing.proRate / 2) - 1 : safePow(1 + annualGrowthRate, 0.5) - 1;
    growth[i] =
      (bfwd[i] + disposal[i]) * fullPeriodGrowthRate
      + contribution * (contributionGrowthRate - fullPeriodGrowthRate);
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
  loanRepaymentSeries: number[],
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
  const loanRepaymentSaved = zeroSeries(n);
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
    loanRepaymentSaved[i] = Math.abs(bfwd[i]) <= EPS ? loanRepaymentSeries[i] : 0;

    netProceeds[i] =
      -disposal[i] +
      disposalCosts[i] +
      rentalForegone[i] +
      annualCostSaved[i] +
      loanRepayment[i] +
      loanRepaymentSaved[i];
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
    loanRepaymentSaved,
    netProceeds
  };
}

function stagePropertyOrder(priority: number[], currentValues: number[]): number[] {
  const hasAnyPositive = priority.some((p) => p > 0);
  if (!hasAnyPositive) return currentValues.map(() => -1);

  const byRank = currentValues.map(() => -1);
  for (let i = 0; i < currentValues.length; i += 1) {
    const rank = Math.trunc(priority[i]);
    if (rank >= 1 && rank <= currentValues.length && byRank[rank - 1] === -1) {
      byRank[rank - 1] = i;
    }
  }
  return byRank;
}

function buildScenarioDebug(
  inputs: EffectiveInputs,
  liquidationStages: ScenarioLiquidationStageDebug[],
  adjustedPropertyLoanRepaymentSeries: number[][],
  adjustedAssetOfValueLoanRepaymentSeries: number[][]
): ScenarioDebug {
  return {
    adjustedPropertyLoanRepayments: inputs.properties.map((property, idx) => ({
      key: `property-loan-${idx}`,
      label: property.name.trim() || `Property ${idx + 1}`,
      values: [...adjustedPropertyLoanRepaymentSeries[idx]]
    })),
    adjustedAssetOfValueLoanRepayments: inputs.assetsOfValue.map((asset, idx) => ({
      key: `asset-of-value-loan-${idx}`,
      label: asset.name.trim() || `Asset ${idx + 1}`,
      values: [...adjustedAssetOfValueLoanRepaymentSeries[idx]]
    })),
    liquidationStages: liquidationStages.map((stage) => ({
      assetKind: stage.assetKind,
      assetIndex: stage.assetIndex,
      assetLabel: stage.assetLabel,
      disposal: [...stage.disposal],
      disposalCosts: [...stage.disposalCosts],
      rentalForegone: [...stage.rentalForegone],
      annualCostSaved: [...stage.annualCostSaved],
      loanRepayment: [...stage.loanRepayment],
      netProceeds: [...stage.netProceeds]
    }))
  };
}

export function runScenario(
  inputs: EffectiveInputs,
  config: ScenarioConfig,
  timing: ProjectionTiming,
  includeDebug = false
): ScenarioOutputs {
  const timeline = buildTimeline(inputs.ageNow, inputs.liveUntilAge, timing.currentYear);
  const n = timeline.ages.length;

  const pensionReduction = computePensionReduction(inputs, config.retirementAge);

  // Repayment schedules are based on fixed initial NPER horizons.
  const homeMonthsTotal = nperMonths(
    inputs.homeLoanBalance,
    inputs.homeLoanRate,
    inputs.homeLoanRepaymentMonthly
  );
  const propertyMonthsTotals = inputs.properties.map((p) =>
    nperMonths(p.loanBalance, p.loanRate, p.loanRepaymentMonthly)
  );
  const assetOfValueMonthsTotals = inputs.assetsOfValue.map((asset) =>
    nperMonths(asset.loanBalance, asset.loanRate, asset.loanRepaymentMonthly)
  );
  const otherLoanMonthsTotal = nperMonths(
    inputs.otherLoanBalance,
    inputs.otherLoanRate,
    inputs.otherLoanRepaymentMonthly
  );

  const cashBaseSeries = zeroSeries(n); // Row 53
  const homeValueSeries = zeroSeries(n); // Row 54
  const homeLoanSeries = zeroSeries(n); // Row 60
  const otherLoanSeries = zeroSeries(n); // Row 65

  const propertyValueSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 56..58
  const propertyLoanSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 62..64
  const propertyRentalSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 8..10
  const propertyAnnualCostSeries = inputs.properties.map(() => zeroSeries(n)); // Rows 34..36
  const assetOfValueValueSeries = inputs.assetsOfValue.map(() => zeroSeries(n));
  const assetOfValueLoanSeries = inputs.assetsOfValue.map(() => zeroSeries(n));
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
  const assetOfValueLoanRepaymentSeries = inputs.assetsOfValue.map(() => zeroSeries(n));
  const scheduledPropertyLiquidationSeries = inputs.properties.map(() => zeroSeries(n));
  const scheduledAssetOfValueLiquidationSeries = inputs.assetsOfValue.map(() => zeroSeries(n));
  const dependentCostSeries = inputs.dependents.map(() => zeroSeries(n));
  const incomeEventSeries = inputs.incomeEvents.map(() => zeroSeries(n));
  const expenseEventSeries = inputs.expenseEvents.map(() => zeroSeries(n));
  const baseInterestSeries = zeroSeries(n);
  const downsizingHomeSaleSeries = zeroSeries(n);
  const downsizingHomePurchaseSeries = zeroSeries(n);
  const stockContributionSeries = zeroSeries(n);

  const downsizingMode = inputs.downsizingNewHomeMode.trim().toUpperCase();
  const hasDownsizing = inputs.downsizingYear > 0;
  const initialHomeValue = inputs.homeValue;
  const isInitialHomeowner = initialHomeValue > 0;

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
      const r = inputs.properties[p].rentalIncome * proRate * safePow(1 + inputs.rentalIncomeGrowth, idx);
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

    const downsizingActive = hasDownsizing && year >= inputs.downsizingYear;
    const downsizingThisYear = hasDownsizing && year === inputs.downsizingYear;
    const originalHomeValue =
      initialHomeValue > 0 ? initialHomeValue * safePow(1 + inputs.propertyAppreciation, assetGrowthExponent(timing, idx)) : 0;
    const downsizingHomeSale =
      downsizingThisYear && isInitialHomeowner
        ? originalHomeValue * (1 - inputs.propertyDisposalCosts)
        : 0;
    downsizingHomeSaleSeries[idx] = downsizingHomeSale;

    const inflowsBeforeInterest = salary + otherWork + rental + adjustedPension + postRetIncome + incomeEvents + downsizingHomeSale;

    const livingExpenseBase = inputs.livingExpensesAnnual * infFactor * proRate;
    let livingExpense = livingExpenseBase;
    if (age <= inputs.spendingAdjustmentAge1) livingExpense += inputs.spendAdjustFirstBracket * livingExpenseBase;
    if (age > inputs.spendingAdjustmentAge1 && age <= inputs.spendingAdjustmentAge2) {
      livingExpense += inputs.spendAdjustSecondBracket * livingExpenseBase;
    }
    if (age > inputs.spendingAdjustmentAge2) livingExpense += inputs.spendAdjustFinalBracket * livingExpenseBase;
    livingExpensesSeries[idx] = livingExpense;

    let outflows = livingExpense;
    const housingRent = downsizingActive
      ? (isInitialHomeowner && downsizingMode !== "RENT" ? 0 : inputs.downsizingNewRentAnnual * infFactor * proRate)
      : inputs.housingRentAnnual * infFactor * proRate;
    housingRentSeries[idx] = housingRent;
    outflows += housingRent;

    const stockContribution =
      age < config.retirementAge
        ? inputs.stocksContributionMonthly * (idx === 0 ? timing.monthsRemaining : 12)
        : 0;
    stockContributionSeries[idx] = stockContribution;
    outflows += stockContribution;

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
    const originalHomeLoanBalance = Math.max(
      fv(
        inputs.homeLoanRate / 12,
        (idx + 1) * 12 + timing.monthOffset,
        inputs.homeLoanRepaymentMonthly,
        -inputs.homeLoanBalance
      ),
      0
    );
    const downsizingLoanPayoff =
      downsizingThisYear && isInitialHomeowner && inputs.homeLoanBalance > 0
        ? originalHomeLoanBalance
        : 0;
    const scheduledHomeLoanRepayment = downsizingActive && isInitialHomeowner && !downsizingThisYear ? 0 : homeLoanRepayment;
    homeLoanRepaymentSeries[idx] = scheduledHomeLoanRepayment + downsizingLoanPayoff;
    outflows += homeLoanRepaymentSeries[idx];
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
    for (let a = 0; a < inputs.assetsOfValue.length; a += 1) {
      const repayment = yearlyLoanPayment(
        assetOfValueMonthsTotals[a],
        inputs.assetsOfValue[a].loanRepaymentMonthly,
        idx,
        timing.monthsRemaining,
        timing.monthOffset
      );
      outflows += repayment;
      assetOfValueLoanSeries[a][idx] = Math.max(
        fv(
          inputs.assetsOfValue[a].loanRate / 12,
          (idx + 1) * 12 + timing.monthOffset,
          inputs.assetsOfValue[a].loanRepaymentMonthly,
          -inputs.assetsOfValue[a].loanBalance
        ),
        0
      );
      assetOfValueLoanRepaymentSeries[a][idx] = repayment;
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

    const downsizingHomePurchase =
      downsizingThisYear && isInitialHomeowner && downsizingMode === "BUY"
        ? inputs.downsizingNewHomePurchaseCost * safePow(1 + inputs.propertyAppreciation, assetGrowthExponent(timing, idx))
        : 0;
    downsizingHomePurchaseSeries[idx] = downsizingHomePurchase;
    outflows += downsizingHomePurchase;

    if (downsizingActive) {
      if (isInitialHomeowner && downsizingMode === "BUY") {
        homeValueSeries[idx] = downsizingThisYear
          ? downsizingHomePurchaseSeries[idx]
          : homeValueSeries[idx - 1] * (1 + inputs.propertyAppreciation);
      } else {
        homeValueSeries[idx] = 0;
      }
    } else {
      homeValueSeries[idx] = originalHomeValue;
    }
    for (let p = 0; p < inputs.properties.length; p += 1) {
      propertyValueSeries[p][idx] =
        inputs.properties[p].value * safePow(1 + inputs.propertyAppreciation, assetGrowthExponent(timing, idx));
    }
    for (let a = 0; a < inputs.assetsOfValue.length; a += 1) {
      assetOfValueValueSeries[a][idx] =
        inputs.assetsOfValue[a].value * safePow(1 + inputs.assetsOfValue[a].appreciationRate, assetGrowthExponent(timing, idx));
    }

    homeLoanSeries[idx] = downsizingActive && isInitialHomeowner ? 0 : originalHomeLoanBalance;
    otherLoanSeries[idx] = Math.max(
      fv(
        inputs.otherLoanRate / 12,
        (idx + 1) * 12 + timing.monthOffset,
        inputs.otherLoanRepaymentMonthly,
        -inputs.otherLoanBalance
      ),
      0
    );

    const preInterestCash = cashBfwd + inflowsBeforeInterest - outflows;
    const interestRate = inputs.cashRate * firstYearFactor(timing, idx);
    const interest = Math.max(((cashBfwd + preInterestCash) / 2) * interestRate, 0);
    baseInterestSeries[idx] = interest;
    const cashCfwd = preInterestCash + interest;

    cashBaseSeries[idx] = cashCfwd;
    cashBfwd = cashCfwd;
  }

  // Liquidation system (rows 68..134).
  const EPS = 1e-9;

  const computeCashFlowRows = (stockLiquidations: number[]) => {
    const openingCash = zeroSeries(n);
    const totalInflows = zeroSeries(n);
    const totalOutflows = zeroSeries(n);
    const netCashFlow = zeroSeries(n);
    const interestOnCash = zeroSeries(n);
    const closingCash = zeroSeries(n);

    for (let i = 0; i < n; i += 1) {
      const opening = i === 0 ? inputs.cashBalance : closingCash[i - 1];
      const inflowsBeforeInterest =
        salarySeries[i] +
        otherWorkSeries[i] +
        sumAt(propertyRentalSeries, i) +
        statutoryPensionSeries[i] +
        postRetIncomeSeries[i] +
        sumAt(incomeEventSeries, i) +
        downsizingHomeSaleSeries[i] +
        sumAt(scheduledPropertyLiquidationSeries, i) +
        sumAt(scheduledAssetOfValueLiquidationSeries, i) +
        stockLiquidations[i];
      const outflows =
        creditCardClearanceSeries[i] +
        homeLoanRepaymentSeries[i] +
        sumAt(propertyLoanRepaymentSeries, i) +
        sumAt(assetOfValueLoanRepaymentSeries, i) +
        otherLoanRepaymentSeries[i] +
        sumAt(dependentCostSeries, i) +
        housingRentSeries[i] +
        downsizingHomePurchaseSeries[i] +
        sumAt(propertyAnnualCostSeries, i) +
        stockContributionSeries[i] +
        livingExpensesSeries[i] +
        sumAt(expenseEventSeries, i);
      const preInterestCash = opening + inflowsBeforeInterest - outflows;
      const interestRate = inputs.cashRate * firstYearFactor(timing, i);
      const interest = Math.max(((opening + preInterestCash) / 2) * interestRate, 0);

      openingCash[i] = opening;
      totalInflows[i] = inflowsBeforeInterest;
      totalOutflows[i] = outflows;
      netCashFlow[i] = inflowsBeforeInterest - outflows;
      interestOnCash[i] = interest;
      closingCash[i] = preInterestCash + interest;
    }

    return {
      openingCash,
      totalInflows,
      totalOutflows,
      netCashFlow,
      interestOnCash,
      closingCash
    };
  };

  const liquidationAssets: LiquidationAssetDescriptor[] = [
    ...inputs.properties.map((property, idx) => ({
      kind: "property" as const,
      idx,
      name: property.name,
      fallbackLabel: `Property ${idx + 1}`,
      valueSeries: propertyValueSeries[idx],
      rentalSeries: propertyRentalSeries[idx],
      annualCostSeries: propertyAnnualCostSeries[idx],
      loanSeries: propertyLoanSeries[idx],
      loanRepaymentSeries: propertyLoanRepaymentSeries[idx],
      appreciationRate: inputs.propertyAppreciation,
      disposalCostRate: inputs.propertyDisposalCosts
    })),
    ...inputs.assetsOfValue.map((asset, idx) => ({
      kind: "assetOfValue" as const,
      idx,
      name: asset.name,
      fallbackLabel: `Asset ${idx + 1}`,
      valueSeries: assetOfValueValueSeries[idx],
      rentalSeries: zeroSeries(n),
      annualCostSeries: zeroSeries(n),
      loanSeries: assetOfValueLoanSeries[idx],
      loanRepaymentSeries: assetOfValueLoanRepaymentSeries[idx],
      appreciationRate: asset.appreciationRate,
      disposalCostRate: inputs.otherAssetDisposalCosts
    }))
  ];

  const liquidationStageDebug: ScenarioLiquidationStageDebug[] = [];

  const applyResolvedSale = (asset: LiquidationAssetDescriptor, saleIdx: number): void => {
    if (saleIdx < 0 || saleIdx >= n) return;

    const valueAtSale = valueAtSaleYear(asset.valueSeries, saleIdx);
    if (Math.abs(valueAtSale) <= EPS) return;

    const disposal = zeroSeries(n);
    const disposalCosts = zeroSeries(n);
    const rentalForegone = zeroSeries(n);
    const annualCostSaved = zeroSeries(n);
    const loanRepayment = zeroSeries(n);
    const netProceeds = zeroSeries(n);

    const liquidationSeries =
      asset.kind === "property"
        ? scheduledPropertyLiquidationSeries[asset.idx]
        : scheduledAssetOfValueLiquidationSeries[asset.idx];
    const loanRepaymentSeries =
      asset.kind === "property"
        ? propertyLoanRepaymentSeries[asset.idx]
        : assetOfValueLoanRepaymentSeries[asset.idx];

    disposal[saleIdx] = -valueAtSale;
    disposalCosts[saleIdx] = disposal[saleIdx] * asset.disposalCostRate;
    liquidationSeries[saleIdx] += valueAtSale * (1 - asset.disposalCostRate);

    const payoff = asset.loanSeries[saleIdx];
    if (payoff > EPS) {
      loanRepaymentSeries[saleIdx] += payoff;
      loanRepayment[saleIdx] = -payoff;
    }
    netProceeds[saleIdx] = liquidationSeries[saleIdx] - payoff;

    for (let i = saleIdx + 1; i < n; i += 1) {
      if (asset.kind === "property") {
        const rentalValue = propertyRentalSeries[asset.idx][i];
        const annualCostValue = propertyAnnualCostSeries[asset.idx][i];
        if (Math.abs(rentalValue) > EPS) {
          rentalForegone[i] = -rentalValue;
          propertyRentalSeries[asset.idx][i] = 0;
        }
        if (Math.abs(annualCostValue) > EPS) {
          annualCostSaved[i] = annualCostValue;
          propertyAnnualCostSeries[asset.idx][i] = 0;
        }
        netProceeds[i] += rentalForegone[i] + annualCostSaved[i];
      }

      const scheduledRepayment = loanRepaymentSeries[i];
      if (Math.abs(scheduledRepayment) > EPS) {
        netProceeds[i] += scheduledRepayment;
        loanRepaymentSeries[i] = 0;
      }
    }

    for (let i = saleIdx; i < n; i += 1) {
      asset.valueSeries[i] = 0;
      asset.loanSeries[i] = 0;
    }

    liquidationStageDebug.push({
      assetKind: asset.kind,
      assetIndex: asset.idx,
      assetLabel: asset.name.trim() || asset.fallbackLabel,
      disposal,
      disposalCosts,
      rentalForegone,
      annualCostSaved,
      loanRepayment,
      netProceeds
    });
  };

  for (let p = 0; p < inputs.properties.length; p += 1) {
    const plannedSellYear = inputs.properties[p].plannedSellYear;
    if (plannedSellYear === null) continue;
    const saleIdx = timeline.years.findIndex((year) => year === plannedSellYear);
    if (saleIdx >= 0) applyResolvedSale(liquidationAssets[p], saleIdx);
  }

  for (let a = 0; a < inputs.assetsOfValue.length; a += 1) {
    const plannedSellYear = inputs.assetsOfValue[a].plannedSellYear;
    if (plannedSellYear === null) continue;
    const saleIdx = timeline.years.findIndex((year) => year === plannedSellYear);
    if (saleIdx >= 0) applyResolvedSale(liquidationAssets[inputs.properties.length + a], saleIdx);
  }

  const preStockCashRows = computeCashFlowRows(zeroSeries(n));
  const row68 = preStockCashRows.closingCash.map((value) => value - inputs.cashBuffer);
  const row69 = computeLiquidationRequired(row68);
  const stockGrowthRateSeries = timeline.years.map((year, idx) =>
    idx === 0 ? inputs.stockReturn : stockGrowthRateForYear(inputs, year)
  );
  const stockStage = computeStockStage(
    row69,
    inputs.stocksBalance,
    stockContributionSeries,
    stockGrowthRateSeries,
    timing,
    inputs.stockSellingCosts
  );

  const order = stagePropertyOrder(
    inputs.liquidationPriority,
    [...inputs.properties.map((p) => p.value), ...inputs.assetsOfValue.map((asset) => asset.value)]
  );

  let forcedBasis = computeCashFlowRows(stockStage.netProceeds).closingCash.map((value) => value - inputs.cashBuffer);
  for (let stageIdx = 0; stageIdx < order.length; stageIdx += 1) {
    const assetOrderIdx = order[stageIdx];
    if (assetOrderIdx < 0 || assetOrderIdx >= liquidationAssets.length) continue;

    const asset = liquidationAssets[assetOrderIdx];
    const plannedSellYear = asset.kind === "property"
      ? inputs.properties[asset.idx].plannedSellYear
      : inputs.assetsOfValue[asset.idx].plannedSellYear;
    if (plannedSellYear !== null) continue;

    const required = computeLiquidationRequired(forcedBasis);
    let saleIdx = -1;
    for (let i = 0; i < n; i += 1) {
      if (stageTrigger(required, i) && asset.valueSeries[i] > EPS) {
        saleIdx = i;
        break;
      }
    }
    if (saleIdx < 0) continue;

    applyResolvedSale(asset, saleIdx);
    forcedBasis = computeCashFlowRows(stockStage.netProceeds).closingCash.map((value) => value - inputs.cashBuffer);
  }

  const finalCashRows = computeCashFlowRows(stockStage.netProceeds);
  const openingCashSeries = finalCashRows.openingCash;
  const totalInterestSeries = finalCashRows.interestOnCash;
  const displayTotalInflowsSeries = finalCashRows.totalInflows;
  const displayTotalOutflowsSeries = finalCashRows.totalOutflows;
  const displayNetCashFlowSeries = finalCashRows.netCashFlow;
  const finalCashSeries = finalCashRows.closingCash;

  const adjustedPropertyValues = propertyValueSeries;
  const adjustedPropertyLoans = propertyLoanSeries;
  const adjustedAssetOfValueValues = assetOfValueValueSeries;
  const adjustedAssetOfValueLoans = assetOfValueLoanSeries;
  const adjustedPropertyLoanRepaymentSeries = propertyLoanRepaymentSeries;
  const adjustedAssetOfValueLoanRepaymentSeries = assetOfValueLoanRepaymentSeries;

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

  const firstNonZeroIndex = (series: number[]): number => {
    for (let i = 0; i < series.length; i += 1) {
      if (Math.abs(series[i]) > EPS) return i;
    }
    return -1;
  };

  const downsizingSaleIdx = firstNonZeroIndex(downsizingHomeSaleSeries);
  if (downsizingSaleIdx >= 0) {
    milestoneHints.push({
      year: timeline.years[downsizingSaleIdx],
      age: timeline.ages[downsizingSaleIdx],
      label: "Sell home",
      amount: downsizingHomeSaleSeries[downsizingSaleIdx]
    });
  }

  const downsizingPurchaseIdx = firstNonZeroIndex(downsizingHomePurchaseSeries);
  if (downsizingPurchaseIdx >= 0) {
    milestoneHints.push({
      year: timeline.years[downsizingPurchaseIdx],
      age: timeline.ages[downsizingPurchaseIdx],
      label: "Buy downsized home",
      amount: -downsizingHomePurchaseSeries[downsizingPurchaseIdx]
    });
  }

  if (hasDownsizing && (!isInitialHomeowner || downsizingMode === "RENT")) {
    const downsizingRentIdx = firstNonZeroIndex(housingRentSeries);
    if (downsizingRentIdx >= 0) {
      milestoneHints.push({
        year: timeline.years[downsizingRentIdx],
        age: timeline.ages[downsizingRentIdx],
        label: "New rent starts",
        amount: -housingRentSeries[downsizingRentIdx]
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

  for (let a = 0; a < adjustedAssetOfValueLoans.length; a += 1) {
    if (inputs.assetsOfValue[a].loanBalance <= EPS) continue;
    const idx = firstPayoffIndex(adjustedAssetOfValueLoans[a]);
    if (idx < 0) continue;
    const assetName = inputs.assetsOfValue[a].name.trim() || `Asset ${a + 1}`;
    milestoneHints.push({
      year: timeline.years[idx],
      age: timeline.ages[idx],
      label: `${assetName} loan fully repaid`
    });
  }

  for (let p = 0; p < scheduledPropertyLiquidationSeries.length; p += 1) {
    const saleIdx = scheduledPropertyLiquidationSeries[p].findIndex((value) => Math.abs(value) > EPS);
    if (saleIdx < 0) continue;
    const propertyName = inputs.properties[p].name.trim() || `Property ${p + 1}`;
    const saleTarget = /property/i.test(propertyName) ? propertyName : `${propertyName} Property`;
    milestoneHints.push({
      year: timeline.years[saleIdx],
      age: timeline.ages[saleIdx],
      label: `Sale of ${saleTarget}`,
      amount: scheduledPropertyLiquidationSeries[p][saleIdx]
    });
  }

  for (let a = 0; a < scheduledAssetOfValueLiquidationSeries.length; a += 1) {
    const saleIdx = scheduledAssetOfValueLiquidationSeries[a].findIndex((value) => Math.abs(value) > EPS);
    if (saleIdx < 0) continue;
    const assetName = inputs.assetsOfValue[a].name.trim() || `Asset ${a + 1}`;
    milestoneHints.push({
      year: timeline.years[saleIdx],
      age: timeline.ages[saleIdx],
      label: `Sale of ${assetName}`,
      amount: scheduledAssetOfValueLiquidationSeries[a][saleIdx]
    });
  }

  const displayRentalIncomeByProperty = inputs.properties.map<NamedProjectionSeries>((property, idx) => ({
    key: `rental-${idx}`,
    label: property.name.trim() || `Property ${idx + 1}`,
    values: [...propertyRentalSeries[idx]]
  }));

  const displayPropertyCostsByProperty = inputs.properties.map<NamedProjectionSeries>((property, idx) => ({
    key: `property-cost-${idx}`,
    label: property.name.trim() || `Property ${idx + 1}`,
    values: [...propertyAnnualCostSeries[idx]]
  }));

  const displayLiquidationsByProperty = [
    ...inputs.properties.map<NamedProjectionSeries>((property, idx) => ({
      key: `liquidation-property-${idx}`,
      label: property.name.trim() || `Property ${idx + 1}`,
      values: [...scheduledPropertyLiquidationSeries[idx]]
    })),
    ...inputs.assetsOfValue.map<NamedProjectionSeries>((asset, idx) => ({
      key: `liquidation-asset-of-value-${idx}`,
      label: asset.name.trim() || `Asset ${idx + 1}`,
      values: [...scheduledAssetOfValueLiquidationSeries[idx]]
    }))
  ];

  const points: ProjectionPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    const year = timeline.years[i];
    const age = timeline.ages[i];

    const netWorth =
      finalCashSeries[i] +
      homeValueSeries[i] +
      sumAt(adjustedPropertyValues, i) +
      sumAt(adjustedAssetOfValueValues, i) +
      stockStage.cfwd[i] -
      homeLoanSeries[i] -
      sumAt(adjustedPropertyLoans, i) -
      sumAt(adjustedAssetOfValueLoans, i) -
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
      downsizingHomeSale: downsizingHomeSaleSeries,
      creditCardsCleared: creditCardClearanceSeries,
      homeLoanRepayment: homeLoanRepaymentSeries,
      propertyLoanRepayments: [
        ...inputs.properties.map((property, idx) => ({
          key: `property-loan-${idx}`,
          label: property.name.trim() || `Property ${idx + 1}`,
          values: [...adjustedPropertyLoanRepaymentSeries[idx]]
        })),
        ...inputs.assetsOfValue.map((asset, idx) => ({
          key: `asset-of-value-loan-${idx}`,
          label: asset.name.trim() || `Asset ${idx + 1}`,
          values: [...adjustedAssetOfValueLoanRepaymentSeries[idx]]
        }))
      ],
      otherLoanRepayment: otherLoanRepaymentSeries,
      dependentsCost: inputs.dependents.map((dependent, idx) => ({
        key: `dependent-${idx}`,
        label: dependent.name.trim() || `Dependent ${idx + 1}`,
        values: [...dependentCostSeries[idx]]
      })),
      housingRent: housingRentSeries,
      downsizingHomePurchase: downsizingHomePurchaseSeries,
      propertyCosts: displayPropertyCostsByProperty,
      stockInvestmentContributions: stockContributionSeries,
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
        })),
        ...inputs.assetsOfValue.map((asset, idx) => ({
          key: `asset-of-value-${idx}`,
          label: asset.name.trim() || `Asset ${idx + 1}`,
          values: [...adjustedAssetOfValueValues[idx]]
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
        ...inputs.assetsOfValue.map((asset, idx) => ({
          key: `loan-asset-of-value-${idx}`,
          label: `${asset.name.trim() || `Asset ${idx + 1}`} loan`,
          values: [...adjustedAssetOfValueLoans[idx]]
        })),
        {
          key: "loan-other",
          label: "Other loan",
          values: [...otherLoanSeries]
        }
      ]
    },
    debug: includeDebug
      ? buildScenarioDebug(
          inputs,
          liquidationStageDebug,
          adjustedPropertyLoanRepaymentSeries,
          adjustedAssetOfValueLoanRepaymentSeries
        )
      : undefined
  };
}
