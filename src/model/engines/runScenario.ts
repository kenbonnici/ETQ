import { EffectiveInputs, ProjectionPoint, ScenarioOutputs } from "../types";
import { buildTimeline } from "../timeline";
import { fv, safePow, yearlyLoanPayment, clamp } from "../components/finance";

interface ScenarioConfig {
  retirementAge: number;
}

interface PropertyState {
  sold: boolean;
}

function nperMonths(balance: number, annualRate: number, monthlyRepayment: number): number {
  if (!(balance > 0 && annualRate > 0 && monthlyRepayment > 0)) return 0;
  const monthlyRate = annualRate / 12;
  const ratio = monthlyRepayment / (monthlyRepayment - balance * monthlyRate);
  if (ratio <= 0) return 0;
  return Math.log(ratio) / Math.log(1 + monthlyRate);
}

function inflationFactor(inf: number, idx: number): number {
  return safePow(1 + inf, idx);
}

function computePensionReduction(inputs: EffectiveInputs, earlyRetirementAge: number): number {
  const yearsEarly = Math.max(0, inputs.statutoryRetirementAge - earlyRetirementAge);
  return yearsEarly * inputs.pensionReductionPerYearEarly;
}

function liquidateStocksIfNeeded(
  cash: number,
  buffer: number,
  stockValue: number,
  sellCost: number
): { cash: number; stockValue: number } {
  if (cash >= buffer || stockValue <= 0) return { cash, stockValue };
  const neededNet = buffer - cash;
  const netRate = 1 - sellCost;
  if (netRate <= 0) return { cash, stockValue };

  const grossRequired = neededNet / netRate;
  const grossSold = clamp(grossRequired, 0, stockValue);
  const netProceeds = grossSold * netRate;

  return {
    cash: cash + netProceeds,
    stockValue: stockValue - grossSold
  };
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

function liquidatePropertiesIfNeeded(
  cash: number,
  buffer: number,
  propertyValues: number[],
  propertyLoans: number[],
  soldState: PropertyState[],
  disposalCost: number,
  priority: number[]
): { cash: number; soldState: PropertyState[]; propertyValues: number[]; propertyLoans: number[] } {
  if (cash >= buffer) return { cash, soldState, propertyValues, propertyLoans };

  const order = propertyOrder(priority, propertyValues);
  const nextSold = soldState.map((x) => ({ ...x }));
  const nextValues = [...propertyValues];
  const nextLoans = [...propertyLoans];
  let nextCash = cash;

  for (const i of order) {
    if (nextCash >= buffer) break;
    if (nextSold[i]) continue;
    if (nextValues[i] <= 0) continue;

    const gross = nextValues[i];
    const saleProceeds = gross * (1 - disposalCost);
    const loanPayoff = Math.max(0, nextLoans[i]);
    const netCash = saleProceeds - loanPayoff;

    nextCash += netCash;
    nextSold[i] = { sold: true };
    nextValues[i] = 0;
    nextLoans[i] = 0;
  }

  return {
    cash: nextCash,
    soldState: nextSold,
    propertyValues: nextValues,
    propertyLoans: nextLoans
  };
}

export function runScenario(inputs: EffectiveInputs, config: ScenarioConfig): ScenarioOutputs {
  const timeline = buildTimeline(inputs.ageNow, inputs.liveUntilAge);
  const points: ProjectionPoint[] = [];

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

  let cashBase = inputs.cashBalance;
  let cashAdjustment = 0;
  let stocks = inputs.stocksBalance;
  let homeValue = inputs.homeValue;

  let homeLoan = inputs.homeLoanBalance;
  let otherLoan = inputs.otherLoanBalance;
  let propertyLoanBalances = inputs.properties.map((p) => p.loanBalance);

  let sold: PropertyState[] = inputs.properties.map(() => ({ sold: false }));

  for (let idx = 0; idx < timeline.ages.length; idx += 1) {
    const age = timeline.ages[idx];
    const year = timeline.years[idx];
    const infFactor = inflationFactor(inputs.inflation, idx);

    const salary = age < Math.min(inputs.statutoryRetirementAge, config.retirementAge)
      ? inputs.netIncomeAnnual * safePow(1 + inputs.salaryGrowth, idx)
      : 0;

    const otherWork = age <= inputs.otherWorkUntilAge ? inputs.otherWorkIncomeAnnual * infFactor : 0;

    let rental = 0;
    for (let p = 0; p < inputs.properties.length; p += 1) {
      if (!sold[p].sold) {
        rental += inputs.properties[p].rentalIncome * safePow(1 + inputs.rentalIncomeGrowth, idx);
      }
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

    const incomeWithoutInterest = salary + otherWork + rental + adjustedPension + postRetIncome + incomeEvents;

    let expenses = inputs.livingExpensesAnnual * infFactor;
    if (age <= 65) expenses += inputs.spendAdjustTo65 * inputs.livingExpensesAnnual * infFactor;
    if (age > 65 && age <= 75) expenses += inputs.spendAdjust66To75 * inputs.livingExpensesAnnual * infFactor;
    if (age > 75) expenses += inputs.spendAdjustFrom76 * inputs.livingExpensesAnnual * infFactor;

    if (inputs.homeValue === 0) {
      expenses += inputs.housingRentAnnual * infFactor;
    }

    for (const d of inputs.dependents) {
      if (!d.name) continue;
      if (idx < d.yearsToSupport) expenses += d.annualCost * infFactor;
    }

    for (let p = 0; p < inputs.properties.length; p += 1) {
      if (!sold[p].sold) expenses += inputs.properties[p].annualCosts * infFactor;
    }

    // Year-1 credit card clearance.
    if (idx === 0) expenses += inputs.creditCardBalance;

    expenses += yearlyLoanPayment(homeMonthsTotal, inputs.homeLoanRepaymentMonthly, idx);

    for (let p = 0; p < inputs.properties.length; p += 1) {
      if (sold[p].sold) continue;
      const repayment = inputs.properties[p].loanRepaymentMonthly;
      expenses += yearlyLoanPayment(propertyMonthsTotals[p], repayment, idx);
    }

    expenses += yearlyLoanPayment(otherLoanMonthsTotal, inputs.otherLoanRepaymentMonthly, idx);

    const expenseEvents = inputs.expenseEvents.reduce((sum, e) => {
      if (!e.name || e.amount === 0) return sum;
      return sum + (e.year === year ? e.amount * infFactor : 0);
    }, 0);
    expenses += expenseEvents;

    const preInterestCashBase = cashBase + incomeWithoutInterest - expenses;
    const interest = Math.max(((cashBase + preInterestCashBase) / 2) * inputs.cashRate, 0);
    const closingCashBase = preInterestCashBase + interest;
    let closingCash = closingCashBase + cashAdjustment;

    // Grow assets/liabilities for year-end state.
    // Note: stock liquidation is applied before growth to match Excel ordering.
    homeValue = homeValue > 0 ? homeValue * (1 + inputs.propertyAppreciation) : 0;

    let propertyValues = inputs.properties.map((p, i) => {
      if (sold[i].sold) return 0;
      return p.value * safePow(1 + inputs.propertyAppreciation, idx + 1);
    });

    homeLoan = Math.max(
      fv(inputs.homeLoanRate / 12, (idx + 1) * 12, inputs.homeLoanRepaymentMonthly, -inputs.homeLoanBalance),
      0
    );

    propertyLoanBalances = inputs.properties.map((p, i) => {
      if (sold[i].sold) return 0;
      return Math.max(
        fv(p.loanRate / 12, (idx + 1) * 12, p.loanRepaymentMonthly, -p.loanBalance),
        0
      );
    });

    otherLoan = Math.max(
      fv(inputs.otherLoanRate / 12, (idx + 1) * 12, inputs.otherLoanRepaymentMonthly, -inputs.otherLoanBalance),
      0
    );

    // Liquidations to satisfy buffer rule.
    const stockCashBefore = closingCash;
    ({ cash: closingCash, stockValue: stocks } = liquidateStocksIfNeeded(
      closingCash,
      inputs.cashBuffer,
      stocks,
      inputs.stockSellingCosts
    ));
    const stockCashDelta = closingCash - stockCashBefore;

    stocks = stocks * (1 + inputs.stockReturn);

    const propertyCashBefore = closingCash;
    ({
      cash: closingCash,
      soldState: sold,
      propertyValues: propertyValues,
      propertyLoans: propertyLoanBalances
    } = liquidatePropertiesIfNeeded(
      closingCash,
      inputs.cashBuffer,
      propertyValues,
      propertyLoanBalances,
      sold,
      inputs.propertyDisposalCosts,
      inputs.liquidationPriority
    ));
    const propertyCashDelta = closingCash - propertyCashBefore;

    cashAdjustment += stockCashDelta + propertyCashDelta;
    cashBase = closingCashBase;

    const netWorth =
      closingCash +
      homeValue +
      propertyValues.reduce((a, b) => a + b, 0) +
      stocks -
      homeLoan -
      propertyLoanBalances.reduce((a, b) => a + b, 0) -
      otherLoan;

    points.push({
      yearIndex: idx,
      year,
      age,
      cash: closingCash,
      netWorth
    });
  }

  return {
    points,
    cashSeries: points.map((p) => p.cash),
    netWorthSeries: points.map((p) => p.netWorth)
  };
}
