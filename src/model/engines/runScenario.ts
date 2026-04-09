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

interface LiquidationAssetDescriptor {
  kind: "property" | "assetOfValue";
  idx: number;
  name: string;
  fallbackLabel: string;
  valueSeries: number[];
  rentalSeries: number[];
  annualCostSeries: number[];
  loanSeries: number[];
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
      const plannedSellYear = inputs.properties[p].plannedSellYear;
      const heldThisYear = plannedSellYear === null || year <= plannedSellYear;
      const r = heldThisYear
        ? inputs.properties[p].rentalIncome * timing.proRate * safePow(1 + inputs.rentalIncomeGrowth, idx)
        : 0;
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
      const plannedSellYear = inputs.properties[p].plannedSellYear;
      const heldThisYear = plannedSellYear === null || year <= plannedSellYear;
      const c = heldThisYear ? inputs.properties[p].annualCosts * infFactor * proRate : 0;
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
      const plannedSellYear = inputs.properties[p].plannedSellYear;
      const heldThisYear = plannedSellYear === null || year <= plannedSellYear;
      const repayment = yearlyLoanPayment(
        propertyMonthsTotals[p],
        inputs.properties[p].loanRepaymentMonthly,
        idx,
        timing.monthsRemaining,
        timing.monthOffset
      );
      const effectiveRepayment = heldThisYear ? repayment : 0;
      outflows += effectiveRepayment;
      propertyLoanSeries[p][idx] = heldThisYear
        ? Math.max(
            fv(
              inputs.properties[p].loanRate / 12,
              (idx + 1) * 12 + timing.monthOffset,
              inputs.properties[p].loanRepaymentMonthly,
              -inputs.properties[p].loanBalance
            ),
            0
          )
        : 0;
      const loanPayoff = plannedSellYear !== null && year === plannedSellYear ? propertyLoanSeries[p][idx] : 0;
      propertyLoanRepaymentSeries[p][idx] = effectiveRepayment + loanPayoff;
      outflows += loanPayoff;
    }
    for (let a = 0; a < inputs.assetsOfValue.length; a += 1) {
      const plannedSellYear = inputs.assetsOfValue[a].plannedSellYear;
      const heldThisYear = plannedSellYear === null || year <= plannedSellYear;
      const repayment = yearlyLoanPayment(
        assetOfValueMonthsTotals[a],
        inputs.assetsOfValue[a].loanRepaymentMonthly,
        idx,
        timing.monthsRemaining,
        timing.monthOffset
      );
      const effectiveRepayment = heldThisYear ? repayment : 0;
      outflows += effectiveRepayment;
      assetOfValueLoanSeries[a][idx] = heldThisYear
        ? Math.max(
            fv(
              inputs.assetsOfValue[a].loanRate / 12,
              (idx + 1) * 12 + timing.monthOffset,
              inputs.assetsOfValue[a].loanRepaymentMonthly,
              -inputs.assetsOfValue[a].loanBalance
            ),
            0
          )
        : 0;
      const loanPayoff = plannedSellYear !== null && year === plannedSellYear ? assetOfValueLoanSeries[a][idx] : 0;
      assetOfValueLoanRepaymentSeries[a][idx] = effectiveRepayment + loanPayoff;
      outflows += loanPayoff;
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
      const plannedSellYear = inputs.properties[p].plannedSellYear;
      const heldThisYear = plannedSellYear === null || year <= plannedSellYear;
      propertyValueSeries[p][idx] = heldThisYear
        ? inputs.properties[p].value * safePow(1 + inputs.propertyAppreciation, assetGrowthExponent(timing, idx))
        : 0;
      scheduledPropertyLiquidationSeries[p][idx] = plannedSellYear !== null && year === plannedSellYear
        ? propertyValueSeries[p][idx] * (1 - inputs.propertyDisposalCosts)
        : 0;
    }
    for (let a = 0; a < inputs.assetsOfValue.length; a += 1) {
      const plannedSellYear = inputs.assetsOfValue[a].plannedSellYear;
      const heldThisYear = plannedSellYear === null || year <= plannedSellYear;
      assetOfValueValueSeries[a][idx] = heldThisYear
        ? inputs.assetsOfValue[a].value * safePow(1 + inputs.assetsOfValue[a].appreciationRate, assetGrowthExponent(timing, idx))
        : 0;
      scheduledAssetOfValueLiquidationSeries[a][idx] = plannedSellYear !== null && year === plannedSellYear
        ? assetOfValueValueSeries[a][idx] * (1 - inputs.otherAssetDisposalCosts)
        : 0;
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

    const scheduledLiquidationProceeds =
      sumAt(scheduledPropertyLiquidationSeries, idx) +
      sumAt(scheduledAssetOfValueLiquidationSeries, idx);
    const preInterestCash = cashBfwd + inflowsBeforeInterest + scheduledLiquidationProceeds - outflows;
    const interest = Math.max(((cashBfwd + preInterestCash) / 2) * inputs.cashRate, 0);
    baseInterestSeries[idx] = interest;
    const cashCfwd = preInterestCash + interest;

    cashBaseSeries[idx] = cashCfwd;
    cashBfwd = cashCfwd;
  }

  // Liquidation system (rows 68..134).
  const row68 = cashBaseSeries.map((v) => v - inputs.cashBuffer);
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
  ); // rows 74..79

  const row81 = row68.map((v, i) => v + cumulative(stockStage.netProceeds)[i]);

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
      appreciationRate: asset.appreciationRate,
      disposalCostRate: inputs.otherAssetDisposalCosts
    }))
  ];

  const order = stagePropertyOrder(
    inputs.liquidationPriority,
    [...inputs.properties.map((p) => p.value), ...inputs.assetsOfValue.map((asset) => asset.value)]
  );

  const liquidationStages: PropertyStageSeries[] = [];
  const liquidationStageAssets: Array<LiquidationAssetDescriptor | null> = [];
  const liquidationExtraInterestSeries: number[][] = [];
  let cashAvailableAfterLiquidationStages = row81;

  for (let stageIdx = 0; stageIdx < order.length; stageIdx += 1) {
    const required = computeLiquidationRequired(cashAvailableAfterLiquidationStages);
    const asset = order[stageIdx] >= 0 ? liquidationAssets[order[stageIdx]] : null;
    const stage = computePropertyStage(
      required,
      asset?.valueSeries ?? zeroSeries(n),
      asset?.rentalSeries ?? zeroSeries(n),
      asset?.annualCostSeries ?? zeroSeries(n),
      asset?.loanSeries ?? zeroSeries(n),
      asset?.appreciationRate ?? 0,
      asset?.disposalCostRate ?? 0
    );
    liquidationStages.push(stage);
    liquidationStageAssets.push(asset);

    const cashAfterProceeds = cashAvailableAfterLiquidationStages.map(
      (value, idx) => value + cumulative(stage.netProceeds)[idx]
    );
    const extraCash = cashAfterProceeds.map(
      (value, idx) => Math.max(value + inputs.cashBuffer, 0) - Math.max(cashAvailableAfterLiquidationStages[idx] + inputs.cashBuffer, 0)
    );
    const extraInterest = extraCash.map((value) => value * inputs.cashRate);
    liquidationExtraInterestSeries.push(extraInterest);
    cashAvailableAfterLiquidationStages = cashAfterProceeds.map(
      (value, idx) => value + cumulative(extraInterest)[idx]
    );
  }

  const finalCashSeries = cashAvailableAfterLiquidationStages.map((v) => v + inputs.cashBuffer); // row180 / row213
  const totalInterestSeries = baseInterestSeries.map(
    (value, i) => value + liquidationExtraInterestSeries.reduce((sum, series) => sum + series[i], 0)
  );
  const openingCashSeries = zeroSeries(n);
  const totalInflowsSeries = zeroSeries(n);
  const totalOutflowsSeries = zeroSeries(n);
  const netCashFlowSeries = zeroSeries(n);

  // Adjusted net worth (rows 138..172 / row202).
  const adjustedPropertyValues = propertyValueSeries.map((s) => [...s]);
  const adjustedPropertyLoans = propertyLoanSeries.map((s) => [...s]);
  const adjustedAssetOfValueValues = assetOfValueValueSeries.map((s) => [...s]);
  const adjustedAssetOfValueLoans = assetOfValueLoanSeries.map((s) => [...s]);

  for (let p = 0; p < inputs.properties.length; p += 1) {
    const plannedSellYear = inputs.properties[p].plannedSellYear;
    if (plannedSellYear === null) continue;
    const saleIdx = timeline.years.findIndex((year) => year === plannedSellYear);
    if (saleIdx < 0) continue;
    for (let i = saleIdx; i < n; i += 1) {
      adjustedPropertyValues[p][i] = 0;
      adjustedPropertyLoans[p][i] = 0;
    }
  }

  for (let a = 0; a < inputs.assetsOfValue.length; a += 1) {
    const plannedSellYear = inputs.assetsOfValue[a].plannedSellYear;
    if (plannedSellYear === null) continue;
    const saleIdx = timeline.years.findIndex((year) => year === plannedSellYear);
    if (saleIdx < 0) continue;
    for (let i = saleIdx; i < n; i += 1) {
      adjustedAssetOfValueValues[a][i] = 0;
      adjustedAssetOfValueLoans[a][i] = 0;
    }
  }

  const stageDisposals = liquidationStages.map((stage) => stage.disposal);
  const stageLoanRepayments = liquidationStages.map((stage) => stage.loanRepayment);
  const EPS = 1e-9;

  for (let s = 0; s < liquidationStages.length; s += 1) {
    const asset = liquidationStageAssets[s];
    if (!asset) continue;

    const cumDisp = cumulative(stageDisposals[s]);
    const cumLoanRepay = cumulative(stageLoanRepayments[s]);

    for (let i = 0; i < n; i += 1) {
      if (asset.kind === "property") {
        if (Math.abs(cumDisp[i]) > EPS) adjustedPropertyValues[asset.idx][i] = 0;
        if (Math.abs(cumLoanRepay[i]) > EPS) adjustedPropertyLoans[asset.idx][i] = 0;
      } else {
        if (Math.abs(cumDisp[i]) > EPS) adjustedAssetOfValueValues[asset.idx][i] = 0;
        if (Math.abs(cumLoanRepay[i]) > EPS) adjustedAssetOfValueLoans[asset.idx][i] = 0;
      }
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

  const disposalStages = liquidationStages.map((stage) => stage.disposal);
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

  for (let s = 0; s < disposalStages.length; s += 1) {
    const asset = liquidationStageAssets[s];
    if (!asset) continue;
    const disposal = disposalStages[s];
    const saleIdx = disposal.findIndex((value) => Math.abs(value) > EPS);
    if (saleIdx < 0) continue;
    const assetName = asset.name.trim() || asset.fallbackLabel;
    const saleTarget = asset.kind === "property" && !/property/i.test(assetName)
      ? `${assetName} Property`
      : assetName;
    milestoneHints.push({
      year: timeline.years[saleIdx],
      age: timeline.ages[saleIdx],
      label: `Sale of ${saleTarget}`,
      amount: Math.abs(disposal[saleIdx])
    });
  }

  const propertyStageByProperty = inputs.properties.map<PropertyStageSeries | null>(() => null);
  const assetOfValueStageByAsset = inputs.assetsOfValue.map<PropertyStageSeries | null>(() => null);
  const adjustedPropertyLoanRepaymentSeries = propertyLoanRepaymentSeries.map((series) => [...series]);
  const adjustedAssetOfValueLoanRepaymentSeries = assetOfValueLoanRepaymentSeries.map((series) => [...series]);
  for (let stageIdx = 0; stageIdx < liquidationStages.length; stageIdx += 1) {
    const asset = liquidationStageAssets[stageIdx];
    if (!asset) continue;
    const stage = liquidationStages[stageIdx];
    const saleIdx = stage.disposal.findIndex((value) => Math.abs(value) > EPS);
    if (asset.kind === "property") {
      if (asset.idx < propertyStageByProperty.length) propertyStageByProperty[asset.idx] = stage;
      if (asset.idx < adjustedPropertyLoanRepaymentSeries.length && saleIdx >= 0) {
        adjustedPropertyLoanRepaymentSeries[asset.idx][saleIdx] += Math.max(-stage.loanRepayment[saleIdx], 0);
        for (let i = saleIdx + 1; i < n; i += 1) adjustedPropertyLoanRepaymentSeries[asset.idx][i] = 0;
      }
    } else if (asset.idx < assetOfValueStageByAsset.length) {
      assetOfValueStageByAsset[asset.idx] = stage;
      if (asset.idx < adjustedAssetOfValueLoanRepaymentSeries.length && saleIdx >= 0) {
        adjustedAssetOfValueLoanRepaymentSeries[asset.idx][saleIdx] += Math.max(-stage.loanRepayment[saleIdx], 0);
        for (let i = saleIdx + 1; i < n; i += 1) adjustedAssetOfValueLoanRepaymentSeries[asset.idx][i] = 0;
      }
    }
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

  const displayLiquidationsByProperty = [
    ...inputs.properties.map<NamedProjectionSeries>((property, idx) => {
      const stage = propertyStageByProperty[idx];
      const stageValues = stage
        ? stage.netProceeds.map(
            (value, yearIdx) =>
              value - stage.rentalForegone[yearIdx] - stage.annualCostSaved[yearIdx] - stage.loanRepayment[yearIdx]
          )
        : zeroSeries(n);
      const values = stageValues.map((value, yearIdx) => value + scheduledPropertyLiquidationSeries[idx][yearIdx]);
      return {
        key: `liquidation-property-${idx}`,
        label: property.name.trim() || `Property ${idx + 1}`,
        values
      };
    }),
    ...inputs.assetsOfValue.map<NamedProjectionSeries>((asset, idx) => {
      const stage = assetOfValueStageByAsset[idx];
      const stageValues = stage
        ? stage.netProceeds.map(
            (value, yearIdx) =>
              value - stage.rentalForegone[yearIdx] - stage.annualCostSaved[yearIdx] - stage.loanRepayment[yearIdx]
          )
        : zeroSeries(n);
      const values = stageValues.map((value, yearIdx) => value + scheduledAssetOfValueLiquidationSeries[idx][yearIdx]);
      return {
        key: `liquidation-asset-of-value-${idx}`,
        label: asset.name.trim() || `Asset ${idx + 1}`,
        values
      };
    })
  ];

  const displayTotalInflowsSeries = zeroSeries(n);
  const displayTotalOutflowsSeries = zeroSeries(n);
  const displayNetCashFlowSeries = zeroSeries(n);
  for (let i = 0; i < n; i += 1) {
    openingCashSeries[i] = i === 0 ? inputs.cashBalance : finalCashSeries[i - 1];
    totalInflowsSeries[i] =
      salarySeries[i] +
      otherWorkSeries[i] +
      sumAt(propertyRentalSeries, i) +
      statutoryPensionSeries[i] +
      postRetIncomeSeries[i] +
      sumAt(incomeEventSeries, i) +
      downsizingHomeSaleSeries[i] +
      sumAt(scheduledPropertyLiquidationSeries, i) +
      sumAt(scheduledAssetOfValueLiquidationSeries, i) +
      stockStage.netProceeds[i] +
      liquidationStages.reduce((sum, stage) => sum + stage.netProceeds[i] - stage.loanRepayment[i], 0);
    totalOutflowsSeries[i] =
      creditCardClearanceSeries[i] +
      homeLoanRepaymentSeries[i] +
      sumAt(adjustedPropertyLoanRepaymentSeries, i) +
      sumAt(adjustedAssetOfValueLoanRepaymentSeries, i) +
      otherLoanRepaymentSeries[i] +
      sumAt(dependentCostSeries, i) +
      housingRentSeries[i] +
      downsizingHomePurchaseSeries[i] +
      sumAt(propertyAnnualCostSeries, i) +
      stockContributionSeries[i] +
      livingExpensesSeries[i] +
      sumAt(expenseEventSeries, i);
    netCashFlowSeries[i] = totalInflowsSeries[i] - totalOutflowsSeries[i];

    displayTotalInflowsSeries[i] =
      salarySeries[i] +
      otherWorkSeries[i] +
      sumAt(displayRentalIncomeByProperty.map((row) => row.values), i) +
      statutoryPensionSeries[i] +
      postRetIncomeSeries[i] +
      sumAt(incomeEventSeries, i) +
      downsizingHomeSaleSeries[i] +
      stockStage.netProceeds[i] +
      sumAt(displayLiquidationsByProperty.map((row) => row.values), i);
    displayTotalOutflowsSeries[i] =
      creditCardClearanceSeries[i] +
      homeLoanRepaymentSeries[i] +
      sumAt(adjustedPropertyLoanRepaymentSeries, i) +
      sumAt(adjustedAssetOfValueLoanRepaymentSeries, i) +
      otherLoanRepaymentSeries[i] +
      sumAt(dependentCostSeries, i) +
      housingRentSeries[i] +
      downsizingHomePurchaseSeries[i] +
      sumAt(displayPropertyCostsByProperty.map((row) => row.values), i) +
      stockContributionSeries[i] +
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
    }
  };
}
