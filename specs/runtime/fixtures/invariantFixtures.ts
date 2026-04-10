import { createEmptyFieldState } from "../../../src/model/inputSchema";
import {
  createSampleDataFieldState,
  SAMPLE_DATA_EARLY_RETIREMENT_AGE,
  SAMPLE_DATA_PROJECTION_MONTH_OVERRIDE
} from "../../../src/model/sampleData";
import { FieldState, ModelUiState } from "../../../src/model/types";
import {
  ASSET_OF_VALUE_RUNTIME_GROUPS,
  DEPENDENT_RUNTIME_GROUPS,
  DOWNSIZING_FIELDS,
  EXPENSE_EVENT_RUNTIME_GROUPS,
  HOME_FIELDS,
  INCOME_EVENT_RUNTIME_GROUPS,
  OTHER_LOAN_FIELDS,
  OTHER_WORK_FIELDS,
  POST_RETIREMENT_INCOME_FIELDS,
  PROPERTY_RUNTIME_GROUPS,
  RUNTIME_FIELDS,
  STOCK_MARKET_CRASH_RUNTIME_GROUPS
} from "../../../src/ui/runtimeFields";

export interface InvariantFixture {
  name: string;
  fields: FieldState;
  uiState: ModelUiState;
}

const CURRENT_YEAR = new Date().getFullYear();

function baseUiState(earlyRetirementAge: number, projectionMonthOverride = 1, manualPropertyLiquidationOrder = false): ModelUiState {
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
  fields[RUNTIME_FIELDS.currentAge] = 48;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 72_000;
  fields[RUNTIME_FIELDS.cashBalance] = 35_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 140_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 500;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 65;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 18_000;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 40_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 90;
  fields[RUNTIME_FIELDS.generalInflation] = 0.02;
  fields[RUNTIME_FIELDS.propertyAnnualAppreciation] = 0.03;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0.01;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0.05;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0.02;
  fields[RUNTIME_FIELDS.rentalIncomeAnnualIncrease] = 0.02;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 500;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 10_000;
  fields[RUNTIME_FIELDS.legacyAmount] = 100_000;
  fields[RUNTIME_FIELDS.stockSellingCostRate] = 0.01;
  fields[RUNTIME_FIELDS.propertyDisposalCostRate] = 0.08;
  fields[RUNTIME_FIELDS.otherAssetDisposalCostRate] = 0.05;
  return fields;
}

function buildPlannedSaleLoansFields(): FieldState {
  const fields = baseFields();

  fields[HOME_FIELDS.homeValue] = 380_000;
  fields[HOME_FIELDS.mortgageBalance] = 150_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.035;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 1_100;

  fields[OTHER_WORK_FIELDS.income] = 6_000;
  fields[OTHER_WORK_FIELDS.untilAge] = 60;

  fields[OTHER_LOAN_FIELDS.balance] = 12_000;
  fields[OTHER_LOAN_FIELDS.interestRateAnnual] = 0.05;
  fields[OTHER_LOAN_FIELDS.monthlyRepayment] = 300;

  fields[POST_RETIREMENT_INCOME_FIELDS.amount] = 4_000;
  fields[POST_RETIREMENT_INCOME_FIELDS.fromAge] = 66;
  fields[POST_RETIREMENT_INCOME_FIELDS.toAge] = 72;

  fields[DEPENDENT_RUNTIME_GROUPS[0].nameField] = "Sam";
  fields[DEPENDENT_RUNTIME_GROUPS[0].annualCostField] = 5_000;
  fields[DEPENDENT_RUNTIME_GROUPS[0].yearsField] = 4;

  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Harbour Flat";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 220_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].annualCostsField] = 2_400;
  fields[PROPERTY_RUNTIME_GROUPS[0].rentalIncomeField] = 10_800;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanBalanceField] = 60_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanRateField] = 0.04;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanRepaymentField] = 550;
  fields[PROPERTY_RUNTIME_GROUPS[0].plannedSellYearField] = CURRENT_YEAR + 4;

  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Boat";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].valueField] = 90_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField] = -0.02;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField] = 15_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField] = 0.05;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRepaymentField] = 250;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].plannedSellYearField] = CURRENT_YEAR + 3;

  fields[INCOME_EVENT_RUNTIME_GROUPS[0].nameField] = "Bonus";
  fields[INCOME_EVENT_RUNTIME_GROUPS[0].amountField] = 20_000;
  fields[INCOME_EVENT_RUNTIME_GROUPS[0].yearField] = CURRENT_YEAR + 2;

  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].nameField] = "Wedding";
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].amountField] = 12_000;
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].yearField] = CURRENT_YEAR + 3;

  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = CURRENT_YEAR + 2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.2;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 2;

  return fields;
}

function buildForcedLiquidationFields(propertyFirst: boolean): FieldState {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 50;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 0;
  fields[RUNTIME_FIELDS.cashBalance] = 0;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 0;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 0;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 51;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 0;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 10_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 53;
  fields[RUNTIME_FIELDS.propertyAnnualAppreciation] = 0;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0;
  fields[RUNTIME_FIELDS.rentalIncomeAnnualIncrease] = 0;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 0;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 0;
  fields[RUNTIME_FIELDS.legacyAmount] = 0;
  fields[RUNTIME_FIELDS.stockSellingCostRate] = 0;
  fields[RUNTIME_FIELDS.propertyDisposalCostRate] = 0.1;
  fields[RUNTIME_FIELDS.otherAssetDisposalCostRate] = 0.05;

  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Forced Property";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 200_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].annualCostsField] = 0;
  fields[PROPERTY_RUNTIME_GROUPS[0].rentalIncomeField] = 0;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanBalanceField] = 50_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanRateField] = 0;
  fields[PROPERTY_RUNTIME_GROUPS[0].loanRepaymentField] = 1;
  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = propertyFirst ? 1 : 2;

  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Forced Asset";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].valueField] = 100_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField] = 0;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanBalanceField] = 20_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRateField] = 0;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].loanRepaymentField] = 1;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].liquidationRankField] = propertyFirst ? 2 : 1;

  return fields;
}

function buildDownsizingBuyFields(): FieldState {
  const fields = baseFields();
  fields[HOME_FIELDS.homeValue] = 500_000;
  fields[HOME_FIELDS.mortgageBalance] = 90_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.03;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 750;
  fields[DOWNSIZING_FIELDS.year] = CURRENT_YEAR + 5;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "BUY";
  fields[DOWNSIZING_FIELDS.newHomePurchaseCost] = 260_000;
  return fields;
}

function buildDownsizingRentFields(): FieldState {
  const fields = baseFields();
  fields[HOME_FIELDS.homeValue] = 460_000;
  fields[HOME_FIELDS.mortgageBalance] = 70_000;
  fields[HOME_FIELDS.mortgageInterestRateAnnual] = 0.03;
  fields[HOME_FIELDS.mortgageMonthlyRepayment] = 650;
  fields[DOWNSIZING_FIELDS.year] = CURRENT_YEAR + 4;
  fields[DOWNSIZING_FIELDS.newHomeMode] = "RENT";
  fields[DOWNSIZING_FIELDS.newRentAnnual] = 18_000;
  return fields;
}

function buildStockCrashRecoveryFields(): FieldState {
  const fields = baseFields();
  fields[RUNTIME_FIELDS.cashBalance] = 20_000;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 350_000;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 0;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 5_000;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].yearField] = CURRENT_YEAR + 1;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].dropField] = 0.35;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[0].recoveryField] = 3;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].yearField] = CURRENT_YEAR + 7;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].dropField] = 0.15;
  fields[STOCK_MARKET_CRASH_RUNTIME_GROUPS[1].recoveryField] = 2;
  return fields;
}

function buildEventsAndDependentsFields(): FieldState {
  const fields = baseFields();
  fields[DEPENDENT_RUNTIME_GROUPS[0].nameField] = "Chris";
  fields[DEPENDENT_RUNTIME_GROUPS[0].annualCostField] = 6_000;
  fields[DEPENDENT_RUNTIME_GROUPS[0].yearsField] = 6;
  fields[DEPENDENT_RUNTIME_GROUPS[1].nameField] = "Alex";
  fields[DEPENDENT_RUNTIME_GROUPS[1].annualCostField] = 3_500;
  fields[DEPENDENT_RUNTIME_GROUPS[1].yearsField] = 3;

  fields[INCOME_EVENT_RUNTIME_GROUPS[0].nameField] = "Inheritance";
  fields[INCOME_EVENT_RUNTIME_GROUPS[0].amountField] = 45_000;
  fields[INCOME_EVENT_RUNTIME_GROUPS[0].yearField] = CURRENT_YEAR + 3;
  fields[INCOME_EVENT_RUNTIME_GROUPS[1].nameField] = "Business Sale";
  fields[INCOME_EVENT_RUNTIME_GROUPS[1].amountField] = 80_000;
  fields[INCOME_EVENT_RUNTIME_GROUPS[1].yearField] = CURRENT_YEAR + 10;

  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].nameField] = "University";
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].amountField] = 30_000;
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[0].yearField] = CURRENT_YEAR + 2;
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[1].nameField] = "Medical";
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[1].amountField] = 18_000;
  fields[EXPENSE_EVENT_RUNTIME_GROUPS[1].yearField] = CURRENT_YEAR + 6;

  return fields;
}

function buildManualLiquidationOrderFields(): FieldState {
  const fields = createEmptyFieldState();
  fields[RUNTIME_FIELDS.currentAge] = 50;
  fields[RUNTIME_FIELDS.currentNetIncomeAnnual] = 0;
  fields[RUNTIME_FIELDS.cashBalance] = 0;
  fields[RUNTIME_FIELDS.stockMarketInvestments] = 0;
  fields[RUNTIME_FIELDS.stockContributionMonthly] = 0;
  fields[RUNTIME_FIELDS.statutoryRetirementAge] = 51;
  fields[RUNTIME_FIELDS.annualPensionAtRetirement] = 0;
  fields[RUNTIME_FIELDS.annualLivingExpenses] = 220_000;
  fields[RUNTIME_FIELDS.lifeExpectancyAge] = 53;
  fields[RUNTIME_FIELDS.propertyAnnualAppreciation] = 0;
  fields[RUNTIME_FIELDS.cashInterestRate] = 0;
  fields[RUNTIME_FIELDS.stockMarketReturn] = 0;
  fields[RUNTIME_FIELDS.salaryAnnualGrowthRate] = 0;
  fields[RUNTIME_FIELDS.rentalIncomeAnnualIncrease] = 0;
  fields[RUNTIME_FIELDS.pensionReductionPerYearEarly] = 0;
  fields[RUNTIME_FIELDS.minimumCashBuffer] = 0;
  fields[RUNTIME_FIELDS.legacyAmount] = 0;
  fields[RUNTIME_FIELDS.stockSellingCostRate] = 0;
  fields[RUNTIME_FIELDS.propertyDisposalCostRate] = 0.08;
  fields[RUNTIME_FIELDS.otherAssetDisposalCostRate] = 0.05;
  fields[PROPERTY_RUNTIME_GROUPS[0].nameField] = "Alpha";
  fields[PROPERTY_RUNTIME_GROUPS[0].valueField] = 300_000;
  fields[PROPERTY_RUNTIME_GROUPS[0].annualCostsField] = 0;
  fields[PROPERTY_RUNTIME_GROUPS[0].liquidationRankField] = 2;

  fields[PROPERTY_RUNTIME_GROUPS[1].nameField] = "Beta";
  fields[PROPERTY_RUNTIME_GROUPS[1].valueField] = 180_000;
  fields[PROPERTY_RUNTIME_GROUPS[1].annualCostsField] = 0;
  fields[PROPERTY_RUNTIME_GROUPS[1].liquidationRankField] = 1;

  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].nameField] = "Car";
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].valueField] = 40_000;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].appreciationRateField] = -0.03;
  fields[ASSET_OF_VALUE_RUNTIME_GROUPS[0].liquidationRankField] = 3;

  return fields;
}

export const INVARIANT_FIXTURES: InvariantFixture[] = [
  {
    name: "sampleDataScenario",
    fields: createSampleDataFieldState(),
    uiState: {
      majorFutureEventsOpen: true,
      advancedAssumptionsOpen: true,
      earlyRetirementAge: SAMPLE_DATA_EARLY_RETIREMENT_AGE,
      manualPropertyLiquidationOrder: false,
      projectionMonthOverride: SAMPLE_DATA_PROJECTION_MONTH_OVERRIDE,
      debugMode: "test"
    }
  },
  {
    name: "plannedSalesWithLoans",
    fields: buildPlannedSaleLoansFields(),
    uiState: baseUiState(60)
  },
  {
    name: "forcedPropertyFirst",
    fields: buildForcedLiquidationFields(true),
    uiState: baseUiState(51, 1, true)
  },
  {
    name: "forcedAssetFirst",
    fields: buildForcedLiquidationFields(false),
    uiState: baseUiState(51, 1, true)
  },
  {
    name: "downsizingBuy",
    fields: buildDownsizingBuyFields(),
    uiState: baseUiState(60)
  },
  {
    name: "downsizingRent",
    fields: buildDownsizingRentFields(),
    uiState: baseUiState(60)
  },
  {
    name: "stockCrashRecovery",
    fields: buildStockCrashRecoveryFields(),
    uiState: baseUiState(63)
  },
  {
    name: "eventsAndDependents",
    fields: buildEventsAndDependentsFields(),
    uiState: baseUiState(61)
  },
  {
    name: "manualLiquidationOrder",
    fields: buildManualLiquidationOrderFields(),
    uiState: baseUiState(51, 1, true)
  }
];
