import { createEmptyFieldState } from "../../../src/model/inputSchema";
import { FieldState, ModelUiState } from "../../../src/model/types";
import {
  ASSET_OF_VALUE_RUNTIME_GROUPS,
  DOWNSIZING_FIELDS,
  HOME_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS,
  STOCK_MARKET_CRASH_RUNTIME_GROUPS
} from "../../../src/ui/runtimeFields";
import { GOLDEN_REFERENCE_YEAR } from "./shared";

export interface GoldenPersona {
  name: string;
  description: string;
  fields: FieldState;
  uiState: ModelUiState;
}

function baseUiState(
  earlyRetirementAge: number,
  projectionMonthOverride = 1,
  manualPropertyLiquidationOrder = false
): ModelUiState {
  return {
    majorFutureEventsOpen: true,
    advancedAssumptionsOpen: true,
    earlyRetirementAge,
    manualPropertyLiquidationOrder,
    projectionMonthOverride,
    debugMode: "test"
  };
}

function baseFields(): FieldState {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.generalInflation] = 0.0225;
  fields[RUNTIME_FIELDS.propertyAnnualAppreciation] = 0.025;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0.02;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.06;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0.025;
  fields[RUNTIME_FIELDS.rentalIncomeAnnualIncrease] = 0.02;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 500;
  fields[RUNTIME_FIELDS.stockSellingCostRate] = 0.01;
  fields[RUNTIME_FIELDS.propertyDisposalCostRate] = 0.08;
  fields[RUNTIME_FIELDS.otherAssetDisposalCostRate] = 0.04;
  return fields;
}

function buildYoungSaverProrated(): GoldenPersona {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.currentAge] = 29;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 42_000;
  fields[RUNTIME_FIELDS.cashBalance] = 30_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 18_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 350;
  fields[HOME_FIELDS.housingRentAnnual] = 1_200;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 67;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 14_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 28_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 92;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 8_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 75_000;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0.03;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0.018;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.065;

  return {
    name: "youngSaverProrated",
    description: "Early-career renter with modest assets and a September projection start to lock in first-year prorating drift coverage.",
    fields,
    uiState: baseUiState(55, 9)
  };
}

function buildMidCareerHomeowner(): GoldenPersona {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.currentAge] = 45;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 82_000;
  fields[RUNTIME_FIELDS.cashBalance] = 55_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 95_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 700;
  fields[HOME_FIELDS.homeValue] = 420_000;
  fields[HOME_FIELDS.mortgageBalance] = 180_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.034;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 1_200;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 66;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 22_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 44_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 90;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 20_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 200_000;

  return {
    name: "midCareerHomeowner",
    description: "Typical homeowner path with mortgage, growing savings, and a conventional retirement horizon.",
    fields,
    uiState: baseUiState(58)
  };
}

function buildNearRetireeRentalsPlannedSales(): GoldenPersona {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.currentAge] = 60;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 18_000;
  fields[RUNTIME_FIELDS.cashBalance] = 25_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 35_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 0;
  fields[HOME_FIELDS.homeValue] = 380_000;
  fields[HOME_FIELDS.mortgageBalance] = 80_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.03;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 900;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 66;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 28_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 48_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 88;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 10_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 100_000;
  fields[OTHER_WORK_FIELDS.income] = 12_000;
  fields[OTHER_WORK_FIELDS.untilAge] = 63;
  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 6_000;
  fields[POST_RETIREMENT_INCOME_FIELDS.fromAge] = 67;
  fields[POST_RETIREMENT_INCOME_FIELDS.toAge] = 74;

  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Harbour Flat";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 240_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].annualCostsField] = 3_200;
  fields[PROPERTY_RUNTIME_GROUPS[0].rentalIncomeField] = 11_500;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanBalanceField] = 55_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanRateField] = 0.04;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanRepaymentField] = 540;
  fields[PROPERTY_RUNTIME_GROUPS[0].plannedSellYearField] = GOLDEN_REFERENCE_YEAR + 2;

  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "Valletta Loft";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 190_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].annualCostsField] = 2_100;
  fields[PROPERTY_RUNTIME_GROUPS[1].rentalIncomeField] = 9_400;
  fields[PROPERTY_RUNTIME_GROUPS[1].loanBalanceField] = 28_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].loanRateField] = 0.035;
  fields[PROPERTY_RUNTIME_GROUPS[1].loanRepaymentField] = 330;
  fields[PROPERTY_RUNTIME_GROUPS[1].plannedSellYearField] = GOLDEN_REFERENCE_YEAR + 5;

  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Boat";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].valueField] = 70_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField] = -0.03;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField] = 12_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField] = 0.05;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRepaymentField] = 260;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].plannedSellYearField] = GOLDEN_REFERENCE_YEAR + 3;

  return {
    name: "nearRetireeRentalsPlannedSales",
    description: "Near-retiree with rental properties and scheduled disposals that should trigger multi-year loan-payoff and liquidation interactions.",
    fields,
    uiState: baseUiState(61)
  };
}

function buildAggressiveEarlyRetiree(): GoldenPersona {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.currentAge] = 41;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 125_000;
  fields[RUNTIME_FIELDS.cashBalance] = 250_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 650_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 2_500;
  fields[HOME_FIELDS.housingRentAnnual] = 1_500;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 67;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 18_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 50_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 92;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 30_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 500_000;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.07;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0.0225;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 900;

  return {
    name: "aggressiveEarlyRetiree",
    description: "High-savings renter pushing an ambitious early-retirement date to exercise the early-age viability boundary and pension reduction math.",
    fields,
    uiState: baseUiState(44)
  };
}

function buildDownsizerBuy(): GoldenPersona {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.currentAge] = 57;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 58_000;
  fields[RUNTIME_FIELDS.cashBalance] = 40_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 120_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 300;
  fields[HOME_FIELDS.homeValue] = 780_000;
  fields[HOME_FIELDS.mortgageBalance] = 140_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.031;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 1_100;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 66;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 24_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 46_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 89;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 15_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 300_000;
  fields[DOWNSIZING_FIELDS.year] = GOLDEN_REFERENCE_YEAR + 6;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "BUY";
  fields[DOWNSIZING_FIELDS.newHomePurchaseCost] = 320_000;

  return {
    name: "downsizerBuy",
    description: "Homeowner planning to sell and buy a cheaper replacement home, covering downsizing sale proceeds and purchase timing.",
    fields,
    uiState: baseUiState(61)
  };
}

function buildDownsizerRentCrash(): GoldenPersona {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.currentAge] = 53;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 65_000;
  fields[RUNTIME_FIELDS.cashBalance] = 20_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 280_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 250;
  fields[HOME_FIELDS.homeValue] = 640_000;
  fields[HOME_FIELDS.mortgageBalance] = 160_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.032;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 1_150;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 66;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 21_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 42_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 90;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 12_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 180_000;
  fields[DOWNSIZING_FIELDS.year] = GOLDEN_REFERENCE_YEAR + 4;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "RENT";
  fields[DOWNSIZING_FIELDS.newRentAnnual] = 1_500;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = GOLDEN_REFERENCE_YEAR + 1;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.3;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].yearField] = GOLDEN_REFERENCE_YEAR + 8;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].dropField] = 0.15;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].recoveryField] = 3;

  return {
    name: "downsizerRentCrash",
    description: "Edge case combining a rent-after-downsizing path with multiple market crashes and recoveries to exercise both long-horizon branches.",
    fields,
    uiState: baseUiState(58)
  };
}

export const GOLDEN_PERSONAS: GoldenPersona[] = [
  buildYoungSaverProrated(),
  buildMidCareerHomeowner(),
  buildNearRetireeRentalsPlannedSales(),
  buildAggressiveEarlyRetiree(),
  buildDownsizerBuy(),
  buildDownsizerRentCrash()
];
