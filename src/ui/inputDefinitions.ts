import { FieldId } from "../model/fieldRegistry";

export type InputType = "number" | "integer" | "percent" | "text";

export interface InputDefinition {
  row: number;
  fieldId: FieldId;
  label: string;
  section: string;
  groupPath: string;
  groupTail: string[];
  tooltip: string;
  uiNote: string;
  sampleValue: string;
  type: InputType;
}

type AuthoredInputDefinition = Omit<InputDefinition, "section" | "groupPath" | "groupTail">;

export const INPUT_SECTION_ORDER = [
  "Basics",
  "Income & Expenses",
  "Housing",
  "Retirement Income",
  "Savings & Investments",
  "Investment Properties",
  "Other Assets",
  "Family Support",
  "Debt",
  "Major Future Events",
  "Advanced Assumptions"
] as const;

const AUTHORED_INPUT_DEFINITIONS: AuthoredInputDefinition[] = [
  {
    row: 4,
    fieldId: "profile.currentAge",
    label: "Your age",
    tooltip: "Must be entered",
    uiNote: "",
    sampleValue: "48",
    type: "integer"
  },
  {
    row: 5,
    fieldId: "partner.profile.currentAge",
    label: "Partner age",
    tooltip: "",
    uiNote: "Show only if partner is included",
    sampleValue: "46",
    type: "integer"
  },
  {
    row: 6,
    fieldId: "income.employment.netAnnual",
    label: "Main income",
    tooltip: "Annual net of tax income from employment or self-employment.",
    uiNote: "",
    sampleValue: "80000",
    type: "number"
  },
  {
    row: 7,
    fieldId: "partner.income.employment.netAnnual",
    label: "Partner income",
    tooltip: "",
    uiNote: "Show only if partner is included",
    sampleValue: "45000",
    type: "number"
  },
  {
    row: 8,
    fieldId: "assets.cash.totalBalance",
    label: "Total cash balances",
    tooltip: "Current and savings accounts, bonds, and term deposits",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 10,
    fieldId: "assets.equities.marketValue",
    label: "Stock market investments",
    tooltip: "Current market value of equity portfolio",
    uiNote: "",
    sampleValue: "30000",
    type: "number"
  },
  {
    row: 11,
    fieldId: "assets.equities.monthlyContribution",
    label: "Monthly stock contribution",
    tooltip: "Fixed monthly amount invested into stocks from now until retirement",
    uiNote: "",
    sampleValue: "350",
    type: "number"
  },
  {
    row: 12,
    fieldId: "housing.status",
    label: "Do you own or rent your home?",
    tooltip: "",
    uiNote: "",
    sampleValue: "",
    type: "text"
  },
  {
    row: 13,
    fieldId: "housing.01Residence.marketValue",
    label: "Home value",
    tooltip: "Current market value of your home",
    uiNote: "",
    sampleValue: "600000",
    type: "number"
  },
  {
    row: 16,
    fieldId: "housing.01Residence.mortgage.balance",
    label: "Balance",
    tooltip: "Leave blank if no mortgage",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 17,
    fieldId: "housing.01Residence.mortgage.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 18,
    fieldId: "housing.01Residence.mortgage.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "800",
    type: "number"
  },
  {
    row: 20,
    fieldId: "retirement.statutoryAge",
    label: "Statutory retirement age",
    tooltip: "Age at which pension starts",
    uiNote: "",
    sampleValue: "65",
    type: "integer"
  },
  {
    row: 22,
    fieldId: "retirement.statePension.netAnnualAtStart",
    label: "Expected annual amount",
    tooltip: "Net annual pension entitlement",
    uiNote: "",
    sampleValue: "16000",
    type: "number"
  },
  {
    row: 23,
    fieldId: "partner.retirement.statePension.netAnnualAtStart",
    label: "Partner pension",
    tooltip: "",
    uiNote: "Show only if partner is included",
    sampleValue: "14000",
    type: "number"
  },
  {
    row: 24,
    fieldId: "housing.rentAnnual",
    label: "Home monthly rent",
    tooltip: "Current monthly rent",
    uiNote: "",
    sampleValue: "",
    type: "number"
  },
  {
    row: 26,
    fieldId: "spending.livingExpenses.annual",
    label: "Annual living expenses",
    tooltip: "",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 27,
    fieldId: "partner.include",
    label: "Include partner",
    tooltip: "",
    uiNote: "",
    sampleValue: "",
    type: "text"
  },
  {
    row: 28,
    fieldId: "partner.retirement.alsoRetiresEarly",
    label: "Partner retires early",
    tooltip: "",
    uiNote: "Show only if partner is included",
    sampleValue: "",
    type: "text"
  },
  {
    row: 34,
    fieldId: "dependents.01.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "John",
    type: "text"
  },
  {
    row: 35,
    fieldId: "dependents.01.annualCost",
    label: "Annual cost",
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2000",
    type: "number"
  },
  {
    row: 36,
    fieldId: "dependents.01.supportYearsRemaining",
    label: "Years to support",
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 39,
    fieldId: "dependents.02.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Jack",
    type: "text"
  },
  {
    row: 40,
    fieldId: "dependents.02.annualCost",
    label: "Annual cost",
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 41,
    fieldId: "dependents.02.supportYearsRemaining",
    label: "Years to support",
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "5",
    type: "integer"
  },
  {
    row: 44,
    fieldId: "dependents.03.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Bill",
    type: "text"
  },
  {
    row: 45,
    fieldId: "dependents.03.annualCost",
    label: "Annual cost",
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "4000",
    type: "number"
  },
  {
    row: 46,
    fieldId: "dependents.03.supportYearsRemaining",
    label: "Years to support",
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2",
    type: "integer"
  },
  {
    row: 49,
    fieldId: "dependents.04.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Stephen",
    type: "text"
  },
  {
    row: 50,
    fieldId: "dependents.04.annualCost",
    label: "Annual cost",
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2500",
    type: "number"
  },
  {
    row: 51,
    fieldId: "dependents.04.supportYearsRemaining",
    label: "Years to support",
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 54,
    fieldId: "dependents.05.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Jane",
    type: "text"
  },
  {
    row: 55,
    fieldId: "dependents.05.annualCost",
    label: "Annual cost",
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2860",
    type: "number"
  },
  {
    row: 56,
    fieldId: "dependents.05.supportYearsRemaining",
    label: "Years to support",
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "6",
    type: "integer"
  },
  {
    row: 61,
    fieldId: "properties.01.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Sliema",
    type: "text"
  },
  {
    row: 62,
    fieldId: "properties.01.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "300000",
    type: "number"
  },
  {
    row: 63,
    fieldId: "properties.01.annualOperatingCost",
    label: "Annual costs",
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "5000",
    type: "number"
  },
  {
    row: 66,
    fieldId: "properties.02.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Gzira",
    type: "text"
  },
  {
    row: 67,
    fieldId: "properties.02.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "150000",
    type: "number"
  },
  {
    row: 68,
    fieldId: "properties.02.annualOperatingCost",
    label: "Annual costs",
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "2000",
    type: "number"
  },
  {
    row: 71,
    fieldId: "properties.03.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Qormi",
    type: "text"
  },
  {
    row: 72,
    fieldId: "properties.03.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "220000",
    type: "number"
  },
  {
    row: 73,
    fieldId: "properties.03.annualOperatingCost",
    label: "Annual costs",
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "1200",
    type: "number"
  },
  {
    row: 76,
    fieldId: "properties.04.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Gudja",
    type: "text"
  },
  {
    row: 77,
    fieldId: "properties.04.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "80000",
    type: "number"
  },
  {
    row: 78,
    fieldId: "properties.04.annualOperatingCost",
    label: "Annual costs",
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 81,
    fieldId: "properties.05.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Marsa",
    type: "text"
  },
  {
    row: 82,
    fieldId: "properties.05.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "120000",
    type: "number"
  },
  {
    row: 83,
    fieldId: "properties.05.annualOperatingCost",
    label: "Annual costs",
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "800",
    type: "number"
  },
  {
    row: 88,
    fieldId: "assetsOfValue.01.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Jewelry",
    type: "text"
  },
  {
    row: 89,
    fieldId: "assetsOfValue.01.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 90,
    fieldId: "assetsOfValue.01.appreciationRateAnnual",
    label: "Annual value change",
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 91,
    fieldId: "assetsOfValue.01.annualCosts",
    label: "Annual Costs",
    tooltip: "Annual costs specifically related to this asset",
    uiNote: "Hide until user enters asset name",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 93,
    fieldId: "assetsOfValue.02.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Car",
    type: "text"
  },
  {
    row: 94,
    fieldId: "assetsOfValue.02.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "40000",
    type: "number"
  },
  {
    row: 95,
    fieldId: "assetsOfValue.02.appreciationRateAnnual",
    label: "Annual value change",
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "-0.05",
    type: "percent"
  },
  {
    row: 96,
    fieldId: "assetsOfValue.02.annualCosts",
    label: "Annual Costs",
    tooltip: "Annual costs specifically related to this asset",
    uiNote: "Hide until user enters asset name",
    sampleValue: "3000",
    type: "number"
  },
  {
    row: 98,
    fieldId: "assetsOfValue.03.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Painting",
    type: "text"
  },
  {
    row: 99,
    fieldId: "assetsOfValue.03.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "20000",
    type: "number"
  },
  {
    row: 100,
    fieldId: "assetsOfValue.03.appreciationRateAnnual",
    label: "Annual value change",
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 101,
    fieldId: "assetsOfValue.03.annualCosts",
    label: "Annual Costs",
    tooltip: "Annual costs specifically related to this asset",
    uiNote: "Hide until user enters asset name",
    sampleValue: "500",
    type: "number"
  },
  {
    row: 103,
    fieldId: "assetsOfValue.04.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Boat",
    type: "text"
  },
  {
    row: 104,
    fieldId: "assetsOfValue.04.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "180000",
    type: "number"
  },
  {
    row: 105,
    fieldId: "assetsOfValue.04.appreciationRateAnnual",
    label: "Annual value change",
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "-0.05",
    type: "percent"
  },
  {
    row: 106,
    fieldId: "assetsOfValue.04.annualCosts",
    label: "Annual Costs",
    tooltip: "Annual costs specifically related to this asset",
    uiNote: "Hide until user enters asset name",
    sampleValue: "4000",
    type: "number"
  },
  {
    row: 108,
    fieldId: "assetsOfValue.05.displayName",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Antiques",
    type: "text"
  },
  {
    row: 109,
    fieldId: "assetsOfValue.05.marketValue",
    label: "Market value",
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "82000",
    type: "number"
  },
  {
    row: 110,
    fieldId: "assetsOfValue.05.appreciationRateAnnual",
    label: "Annual value change",
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 111,
    fieldId: "assetsOfValue.05.annualCosts",
    label: "Annual Costs",
    tooltip: "Annual costs specifically related to this asset",
    uiNote: "Hide until user enters asset name",
    sampleValue: "1200",
    type: "number"
  },
  {
    row: 114,
    fieldId: "properties.01.rentalIncomeNetAnnual",
    label: "Rental income: Sliema",
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "12000",
    type: "number"
  },
  {
    row: 115,
    fieldId: "properties.02.rentalIncomeNetAnnual",
    label: "Rental income: Gzira",
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "10000",
    type: "number"
  },
  {
    row: 116,
    fieldId: "properties.03.rentalIncomeNetAnnual",
    label: "Rental income: Qormi",
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "8000",
    type: "number"
  },
  {
    row: 117,
    fieldId: "properties.04.rentalIncomeNetAnnual",
    label: "Rental income: Gudja",
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "5000",
    type: "number"
  },
  {
    row: 118,
    fieldId: "properties.05.rentalIncomeNetAnnual",
    label: "Rental income: Marsa",
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "6500",
    type: "number"
  },
  {
    row: 120,
    fieldId: "income.otherWork.netAnnual",
    label: "Annual amount",
    tooltip: "Net annual income from consulting, freelance, or other part-time work. Leave blank if none.",
    uiNote: "",
    sampleValue: "2000",
    type: "number"
  },
  {
    row: 121,
    fieldId: "income.otherWork.endAge",
    label: "Continue other work until age",
    tooltip: "",
    uiNote: "Show only if other work income entered",
    sampleValue: "58",
    type: "integer"
  },
  {
    row: 125,
    fieldId: "debts.creditCards.balance",
    label: "Credit card balance",
    tooltip: "Combined balance on all cards. Assumed cleared in Year 1. Leave blank if none.",
    uiNote: "",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 128,
    fieldId: "properties.01.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 129,
    fieldId: "properties.01.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 130,
    fieldId: "properties.01.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "500",
    type: "number"
  },
  {
    row: 133,
    fieldId: "properties.02.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "8500",
    type: "number"
  },
  {
    row: 134,
    fieldId: "properties.02.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 135,
    fieldId: "properties.02.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "200",
    type: "number"
  },
  {
    row: 138,
    fieldId: "properties.03.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "15000",
    type: "number"
  },
  {
    row: 139,
    fieldId: "properties.03.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.05",
    type: "percent"
  },
  {
    row: 140,
    fieldId: "properties.03.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "250",
    type: "number"
  },
  {
    row: 143,
    fieldId: "properties.04.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "4680",
    type: "number"
  },
  {
    row: 144,
    fieldId: "properties.04.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 145,
    fieldId: "properties.04.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "80",
    type: "number"
  },
  {
    row: 148,
    fieldId: "properties.05.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "9524",
    type: "number"
  },
  {
    row: 149,
    fieldId: "properties.05.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 150,
    fieldId: "properties.05.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "120",
    type: "number"
  },
  {
    row: 153,
    fieldId: "assetsOfValue.01.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "2500",
    type: "number"
  },
  {
    row: 154,
    fieldId: "assetsOfValue.01.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 155,
    fieldId: "assetsOfValue.01.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "75",
    type: "number"
  },
  {
    row: 158,
    fieldId: "assetsOfValue.02.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "6000",
    type: "number"
  },
  {
    row: 159,
    fieldId: "assetsOfValue.02.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 160,
    fieldId: "assetsOfValue.02.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "86",
    type: "number"
  },
  {
    row: 163,
    fieldId: "assetsOfValue.03.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "7500",
    type: "number"
  },
  {
    row: 164,
    fieldId: "assetsOfValue.03.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.05",
    type: "percent"
  },
  {
    row: 165,
    fieldId: "assetsOfValue.03.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "125",
    type: "number"
  },
  {
    row: 168,
    fieldId: "assetsOfValue.04.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "40000",
    type: "number"
  },
  {
    row: 169,
    fieldId: "assetsOfValue.04.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.06",
    type: "percent"
  },
  {
    row: 170,
    fieldId: "assetsOfValue.04.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "624",
    type: "number"
  },
  {
    row: 173,
    fieldId: "assetsOfValue.05.loan.balance",
    label: "Balance",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "3800",
    type: "number"
  },
  {
    row: 174,
    fieldId: "assetsOfValue.05.loan.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 175,
    fieldId: "assetsOfValue.05.loan.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "110",
    type: "number"
  },
  {
    row: 178,
    fieldId: "debts.other.balance",
    label: "Balance",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "4000",
    type: "number"
  },
  {
    row: 179,
    fieldId: "debts.other.interestRateAnnual",
    label: "Interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.06",
    type: "percent"
  },
  {
    row: 180,
    fieldId: "debts.other.monthlyRepayment",
    label: "Monthly repayment",
    tooltip: "",
    uiNote: "",
    sampleValue: "50",
    type: "number"
  },
  {
    row: 185,
    fieldId: "cashflowEvents.income.01.name",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Inheritance",
    type: "text"
  },
  {
    row: 186,
    fieldId: "cashflowEvents.income.01.amount",
    label: "Amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 187,
    fieldId: "cashflowEvents.income.01.year",
    label: "Year",
    tooltip: "",
    uiNote: "",
    sampleValue: "2035",
    type: "integer"
  },
  {
    row: 190,
    fieldId: "cashflowEvents.income.02.name",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Sell Painting",
    type: "text"
  },
  {
    row: 191,
    fieldId: "cashflowEvents.income.02.amount",
    label: "Amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "10000",
    type: "number"
  },
  {
    row: 192,
    fieldId: "cashflowEvents.income.02.year",
    label: "Year",
    tooltip: "",
    uiNote: "",
    sampleValue: "2029",
    type: "integer"
  },
  {
    row: 195,
    fieldId: "cashflowEvents.income.03.name",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Sell Jewels",
    type: "text"
  },
  {
    row: 196,
    fieldId: "cashflowEvents.income.03.amount",
    label: "Amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "5000",
    type: "number"
  },
  {
    row: 197,
    fieldId: "cashflowEvents.income.03.year",
    label: "Year",
    tooltip: "",
    uiNote: "",
    sampleValue: "2032",
    type: "integer"
  },
  {
    row: 202,
    fieldId: "cashflowEvents.expense.01.name",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Wedding",
    type: "text"
  },
  {
    row: 203,
    fieldId: "cashflowEvents.expense.01.amount",
    label: "Amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "40000",
    type: "number"
  },
  {
    row: 204,
    fieldId: "cashflowEvents.expense.01.year",
    label: "Year",
    tooltip: "",
    uiNote: "",
    sampleValue: "2036",
    type: "integer"
  },
  {
    row: 207,
    fieldId: "cashflowEvents.expense.02.name",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "New Car",
    type: "text"
  },
  {
    row: 208,
    fieldId: "cashflowEvents.expense.02.amount",
    label: "Amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "35000",
    type: "number"
  },
  {
    row: 209,
    fieldId: "cashflowEvents.expense.02.year",
    label: "Year",
    tooltip: "",
    uiNote: "",
    sampleValue: "2029",
    type: "integer"
  },
  {
    row: 212,
    fieldId: "cashflowEvents.expense.03.name",
    label: "Name",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "New AC",
    type: "text"
  },
  {
    row: 213,
    fieldId: "cashflowEvents.expense.03.amount",
    label: "Amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "15000",
    type: "number"
  },
  {
    row: 214,
    fieldId: "cashflowEvents.expense.03.year",
    label: "Year",
    tooltip: "",
    uiNote: "",
    sampleValue: "2034",
    type: "integer"
  },
  {
    row: 218,
    fieldId: "housing.downsize.year",
    label: "Year",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "2030",
    type: "integer"
  },
  {
    row: 220,
    fieldId: "housing.downsize.newHomeMode",
    label: "Buy or rent after downsizing?",
    tooltip: "",
    uiNote: "Show only after a downsizing year is entered",
    sampleValue: "Buy",
    type: "text"
  },
  {
    row: 222,
    fieldId: "housing.downsize.newHomePurchaseCost",
    label: "New home cost",
    tooltip: "At today's prices, including agency, tax, legal fees, moving, improvements etc.",
    uiNote: "Show only when downsizing to buy",
    sampleValue: "250000",
    type: "number"
  },
  {
    row: 224,
    fieldId: "housing.downsize.newRentAnnual",
    label: "New home monthly rent",
    tooltip: "",
    uiNote: "Show only when downsizing to rent",
    sampleValue: "",
    type: "number"
  },
  {
    row: 229,
    fieldId: "stockMarketCrashes.01.year",
    label: "Year",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 230,
    fieldId: "stockMarketCrashes.01.dropPercentage",
    label: "% drop",
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.15",
    type: "percent"
  },
  {
    row: 231,
    fieldId: "stockMarketCrashes.01.recoveryYears",
    label: "Recovery years",
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "1",
    type: "integer"
  },
  {
    row: 234,
    fieldId: "stockMarketCrashes.02.year",
    label: "Year",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 235,
    fieldId: "stockMarketCrashes.02.dropPercentage",
    label: "% drop",
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.2",
    type: "percent"
  },
  {
    row: 236,
    fieldId: "stockMarketCrashes.02.recoveryYears",
    label: "Recovery years",
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 239,
    fieldId: "stockMarketCrashes.03.year",
    label: "Year",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 240,
    fieldId: "stockMarketCrashes.03.dropPercentage",
    label: "% drop",
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.08",
    type: "percent"
  },
  {
    row: 241,
    fieldId: "stockMarketCrashes.03.recoveryYears",
    label: "Recovery years",
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "5",
    type: "integer"
  },
  {
    row: 244,
    fieldId: "stockMarketCrashes.04.year",
    label: "Year",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "2042",
    type: "integer"
  },
  {
    row: 245,
    fieldId: "stockMarketCrashes.04.dropPercentage",
    label: "% drop",
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.18",
    type: "percent"
  },
  {
    row: 246,
    fieldId: "stockMarketCrashes.04.recoveryYears",
    label: "Recovery years",
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 249,
    fieldId: "stockMarketCrashes.05.year",
    label: "Year",
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 250,
    fieldId: "stockMarketCrashes.05.dropPercentage",
    label: "% drop",
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.28",
    type: "percent"
  },
  {
    row: 251,
    fieldId: "stockMarketCrashes.05.recoveryYears",
    label: "Recovery years",
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "2",
    type: "integer"
  },
  {
    row: 255,
    fieldId: "planning.lifeExpectancyAge",
    label: "Life expectancy",
    tooltip: "",
    uiNote: "",
    sampleValue: "85",
    type: "integer"
  },
  {
    row: 256,
    fieldId: "spending.adjustments.firstBracket.endAge",
    label: "First bracket end age",
    tooltip: "",
    uiNote: "",
    sampleValue: "65",
    type: "integer"
  },
  {
    row: 257,
    fieldId: "spending.adjustments.secondBracket.endAge",
    label: "Second bracket end age",
    tooltip: "",
    uiNote: "",
    sampleValue: "75",
    type: "integer"
  },
  {
    row: 258,
    fieldId: "spending.adjustments.firstBracket.deltaRate",
    label: "From now to 65",
    tooltip: "More / less than current",
    uiNote: "",
    sampleValue: "0",
    type: "percent"
  },
  {
    row: 259,
    fieldId: "spending.adjustments.secondBracket.deltaRate",
    label: "From 66 to 75",
    tooltip: "More / less than current",
    uiNote: "",
    sampleValue: "-0.1",
    type: "percent"
  },
  {
    row: 260,
    fieldId: "spending.adjustments.finalBracket.deltaRate",
    label: "From age 76",
    tooltip: "More / less than current",
    uiNote: "",
    sampleValue: "-0.2",
    type: "percent"
  },
  {
    row: 262,
    fieldId: "income.postRetirementSupplement.annual",
    label: "Annual amount",
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "12000",
    type: "number"
  },
  {
    row: 263,
    fieldId: "income.postRetirementSupplement.startAge",
    label: "From age",
    tooltip: "",
    uiNote: "Only show if value > 0 is entered above",
    sampleValue: "58",
    type: "integer"
  },
  {
    row: 264,
    fieldId: "income.postRetirementSupplement.endAge",
    label: "To age",
    tooltip: "",
    uiNote: "Only show if value > 0 is entered above",
    sampleValue: "69",
    type: "integer"
  },
  {
    row: 266,
    fieldId: "assumptions.generalInflationRateAnnual",
    label: "General inflation",
    tooltip: "",
    uiNote: "",
    sampleValue: "2.5000000000000001E-2",
    type: "percent"
  },
  {
    row: 268,
    fieldId: "assumptions.propertyAppreciationRateAnnual",
    label: "Property growth",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 270,
    fieldId: "assumptions.cashYieldRateAnnual",
    label: "Cash interest rate",
    tooltip: "",
    uiNote: "",
    sampleValue: "2.5000000000000001E-2",
    type: "percent"
  },
  {
    row: 272,
    fieldId: "assumptions.equityReturnRateAnnual",
    label: "Stock market return",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.08",
    type: "percent"
  },
  {
    row: 274,
    fieldId: "assumptions.salaryGrowthRateAnnual",
    label: "Main income growth",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 276,
    fieldId: "assumptions.rentalIncomeGrowthRateAnnual",
    label: "Rental income growth",
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 278,
    fieldId: "retirement.earlyPensionReductionPerYear",
    label: "Early retirement reduction",
    tooltip: "Reduction in annual pension for each year retired early",
    uiNote: "",
    sampleValue: "300",
    type: "number"
  },
  {
    row: 279,
    fieldId: "partner.retirement.earlyPensionReductionPerYear",
    label: "Partner reduction",
    tooltip: "",
    uiNote: "Show only if partner retires early",
    sampleValue: "300",
    type: "number"
  },
  {
    row: 280,
    fieldId: "liquidity.minimumCashBuffer",
    label: "Cash buffer at any time",
    tooltip: "Emergency reserve",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 282,
    fieldId: "planning.legacyAmount",
    label: "Legacy amount",
    tooltip: "Wealth to preserve for your heirs",
    uiNote: "",
    sampleValue: "0",
    type: "number"
  },
  {
    row: 284,
    fieldId: "liquidation.stockSellingCostRate",
    label: "Stock market selling costs",
    tooltip: "Tax, broker, and other fees",
    uiNote: "",
    sampleValue: "0.05",
    type: "percent"
  },
  {
    row: 286,
    fieldId: "liquidation.propertyDisposalCostRate",
    label: "Property disposal costs",
    tooltip: "Agency, tax, and legal fees",
    uiNote: "",
    sampleValue: "0.15",
    type: "percent"
  },
  {
    row: 288,
    fieldId: "liquidation.otherAssetDisposalCostRate",
    label: "Other assets disposal costs",
    tooltip: "Agency, tax, and other fees",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 291,
    fieldId: "properties.01.liquidationPriority",
    label: "Sliema",
    tooltip: "0 = would never sell",
    uiNote: "",
    sampleValue: "10",
    type: "integer"
  },
  {
    row: 292,
    fieldId: "properties.02.liquidationPriority",
    label: "Gzira",
    tooltip: "",
    uiNote: "",
    sampleValue: "7",
    type: "integer"
  },
  {
    row: 293,
    fieldId: "properties.03.liquidationPriority",
    label: "Qormi",
    tooltip: "",
    uiNote: "",
    sampleValue: "9",
    type: "integer"
  },
  {
    row: 294,
    fieldId: "properties.04.liquidationPriority",
    label: "Gudja",
    tooltip: "",
    uiNote: "",
    sampleValue: "4",
    type: "integer"
  },
  {
    row: 295,
    fieldId: "properties.05.liquidationPriority",
    label: "Marsa",
    tooltip: "",
    uiNote: "",
    sampleValue: "6",
    type: "integer"
  },
  {
    row: 296,
    fieldId: "assetsOfValue.01.liquidationPriority",
    label: "Jewelry",
    tooltip: "",
    uiNote: "",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 297,
    fieldId: "assetsOfValue.02.liquidationPriority",
    label: "Car",
    tooltip: "",
    uiNote: "",
    sampleValue: "2",
    type: "integer"
  },
  {
    row: 298,
    fieldId: "assetsOfValue.03.liquidationPriority",
    label: "Painting",
    tooltip: "",
    uiNote: "",
    sampleValue: "1",
    type: "integer"
  },
  {
    row: 299,
    fieldId: "assetsOfValue.04.liquidationPriority",
    label: "Boat",
    tooltip: "",
    uiNote: "",
    sampleValue: "8",
    type: "integer"
  },
  {
    row: 300,
    fieldId: "assetsOfValue.05.liquidationPriority",
    label: "Antiques",
    tooltip: "",
    uiNote: "",
    sampleValue: "5",
    type: "integer"
  }
];

const LABEL_OVERRIDES: Partial<Record<FieldId, string>> = {
  "income.employment.netAnnual": "Main income",
  "retirement.statutoryAge": "Start age",
  "retirement.statePension.netAnnualAtStart": "Expected annual amount",
  "housing.01Residence.marketValue": "Home value",
  "housing.rentAnnual": "Monthly rent",
  "spending.livingExpenses.annual": "Annual living expenses",
  "income.otherWork.netAnnual": "Side income",
  "income.otherWork.endAge": "Ends at age",
  "housing.downsize.newHomeMode": "Buy or rent after downsizing?",
  "income.postRetirementSupplement.annual": "Annual amount",
  "retirement.earlyPensionReductionPerYear": "Early retirement reduction",
  "liquidity.minimumCashBuffer": "Minimum cash reserve",
  "planning.legacyAmount": "Amount you want to leave behind",
  "assets.cash.totalBalance": "Cash balance",
  "assets.equities.marketValue": "Stock market investments",
  "assets.equities.monthlyContribution": "Monthly stock contribution",
  "debts.creditCards.balance": "Credit card balance",
  "liquidation.stockSellingCostRate": "Stocks",
  "liquidation.propertyDisposalCostRate": "Properties",
  "liquidation.otherAssetDisposalCostRate": "Other assets"
};

const TOOLTIP_OVERRIDES: Partial<Record<FieldId, string>> = {
  "income.employment.netAnnual": "Annual net of tax income from employment or self-employment.",
  "housing.01Residence.marketValue": "Current market value of your home",
  "income.otherWork.netAnnual": "Net annual income from consulting, freelance, or other part-time work.",
  "income.otherWork.endAge": "Age which side income stops. Leave blank if it continues until retirement.",
  "retirement.statePension.netAnnualAtStart": "Net annual pension entitlement",
  "retirement.earlyPensionReductionPerYear": "Reduction in annual pension for each year retired early",
  "debts.creditCards.balance": "Combined balance on all cards. Assumed cleared in Year 1. Leave blank if none."
};

function buildGroupPath(section: string, groupTail: string[]): string {
  return groupTail.length > 0 ? `${section} > ${groupTail.join(" > ")}` : section;
}

function numberedLabel(segment: string | undefined, singular: string): string {
  const value = Number(segment);
  return Number.isFinite(value) && value > 0 ? `${singular} ${value}` : singular;
}

function deriveIntentGrouping(fieldId: FieldId): Pick<InputDefinition, "section" | "groupTail"> {
  if (
    fieldId === "profile.currentAge"
    || fieldId === "planning.lifeExpectancyAge"
  ) {
    return { section: "Basics", groupTail: [] };
  }
  if (
    fieldId === "partner.include"
    || fieldId === "partner.profile.currentAge"
    || fieldId === "partner.retirement.alsoRetiresEarly"
  ) {
    return { section: "Basics", groupTail: ["Partner"] };
  }
  if (fieldId === "spending.livingExpenses.annual") {
    return { section: "Income & Expenses", groupTail: ["Living expenses"] };
  }
  if (fieldId === "liquidity.minimumCashBuffer" || fieldId === "planning.legacyAmount") {
    return { section: "Basics", groupTail: ["Goals"] };
  }

  if (fieldId === "income.employment.netAnnual" || fieldId === "partner.income.employment.netAnnual") {
    return { section: "Income & Expenses", groupTail: ["Income"] };
  }
  if (fieldId.startsWith("income.otherWork.")) {
    return { section: "Income & Expenses", groupTail: ["Income"] };
  }

  if (fieldId.startsWith("properties.") && fieldId.includes(".loan.")) {
    const slot = numberedLabel(fieldId.split(".")[1], "Property");
    return { section: "Debt", groupTail: ["Investment property loans", slot] };
  }
  if (fieldId.startsWith("assetsOfValue.") && fieldId.includes(".loan.")) {
    const slot = numberedLabel(fieldId.split(".")[1], "Asset");
    return { section: "Debt", groupTail: ["Other asset loans", slot] };
  }

  if (
    fieldId === "housing.status"
    || fieldId === "housing.01Residence.marketValue"
    || fieldId === "housing.rentAnnual"
  ) {
    return { section: "Housing", groupTail: [] };
  }
  if (fieldId.startsWith("housing.01Residence.mortgage.")) {
    return { section: "Housing", groupTail: ["Mortgage"] };
  }
  if (fieldId.startsWith("housing.downsize.")) {
    return { section: "Housing", groupTail: ["Downsizing plan"] };
  }

  if (
    fieldId === "retirement.statutoryAge"
    || fieldId === "retirement.statePension.netAnnualAtStart"
    || fieldId === "partner.retirement.statePension.netAnnualAtStart"
  ) {
    return { section: "Retirement Income", groupTail: ["Pension"] };
  }
  if (fieldId.startsWith("income.postRetirementSupplement.")) {
    return { section: "Retirement Income", groupTail: ["Other retirement income"] };
  }

  if (
    fieldId === "assets.cash.totalBalance"
    || fieldId === "assets.equities.marketValue"
    || fieldId === "assets.equities.monthlyContribution"
  ) {
    return { section: "Savings & Investments", groupTail: [] };
  }

  if (fieldId.endsWith(".liquidationPriority")) {
    return { section: "Advanced Assumptions", groupTail: ["If money runs short, sell assets in this order"] };
  }

  if (fieldId.startsWith("properties.")) {
    const slot = numberedLabel(fieldId.split(".")[1], "Property");
    return { section: "Investment Properties", groupTail: ["Investment property", slot] };
  }
  if (fieldId.startsWith("assetsOfValue.")) {
    const slot = numberedLabel(fieldId.split(".")[1], "Asset");
    return { section: "Other Assets", groupTail: ["Other valuable assets", slot] };
  }

  if (fieldId.startsWith("dependents.")) {
    const slot = numberedLabel(fieldId.split(".")[1], "Dependent");
    return { section: "Family Support", groupTail: ["People you support", slot] };
  }

  if (fieldId === "debts.creditCards.balance") {
    return { section: "Debt", groupTail: [] };
  }
  if (fieldId.startsWith("debts.other.")) {
    return { section: "Debt", groupTail: ["Other loan"] };
  }

  if (fieldId.startsWith("cashflowEvents.income.")) {
    const slot = numberedLabel(fieldId.split(".")[2], "Income Event");
    return { section: "Major Future Events", groupTail: ["Future income events", slot] };
  }
  if (fieldId.startsWith("cashflowEvents.expense.")) {
    const slot = numberedLabel(fieldId.split(".")[2], "Expense Event");
    return { section: "Major Future Events", groupTail: ["Future expense events", slot] };
  }
  if (fieldId.startsWith("stockMarketCrashes.")) {
    const slot = numberedLabel(fieldId.split(".")[1], "Crash");
    return { section: "Major Future Events", groupTail: ["Stock market crash scenarios", slot] };
  }

  if (
    fieldId === "spending.adjustments.firstBracket.endAge"
    || fieldId === "spending.adjustments.secondBracket.endAge"
    || fieldId === "spending.adjustments.firstBracket.deltaRate"
    || fieldId === "spending.adjustments.secondBracket.deltaRate"
    || fieldId === "spending.adjustments.finalBracket.deltaRate"
  ) {
    return { section: "Advanced Assumptions", groupTail: ["Spending changes by age"] };
  }
  if (
    fieldId === "assumptions.generalInflationRateAnnual"
    || fieldId === "assumptions.propertyAppreciationRateAnnual"
    || fieldId === "assumptions.cashYieldRateAnnual"
    || fieldId === "assumptions.equityReturnRateAnnual"
    || fieldId === "assumptions.salaryGrowthRateAnnual"
    || fieldId === "assumptions.rentalIncomeGrowthRateAnnual"
  ) {
    return { section: "Advanced Assumptions", groupTail: ["Growth & inflation assumptions"] };
  }
  if (
    fieldId === "retirement.earlyPensionReductionPerYear"
    || fieldId === "partner.retirement.earlyPensionReductionPerYear"
  ) {
    return { section: "Advanced Assumptions", groupTail: [] };
  }
  if (
    fieldId === "liquidation.stockSellingCostRate"
    || fieldId === "liquidation.propertyDisposalCostRate"
    || fieldId === "liquidation.otherAssetDisposalCostRate"
  ) {
    return { section: "Advanced Assumptions", groupTail: ["Selling costs"] };
  }

  return { section: "Advanced Assumptions", groupTail: [] };
}

function remapInputDefinition(def: AuthoredInputDefinition): InputDefinition {
  const grouping = deriveIntentGrouping(def.fieldId);
  return {
    ...def,
    label: LABEL_OVERRIDES[def.fieldId] ?? def.label,
    tooltip: TOOLTIP_OVERRIDES[def.fieldId] ?? def.tooltip,
    section: grouping.section,
    groupTail: grouping.groupTail,
    groupPath: buildGroupPath(grouping.section, grouping.groupTail)
  };
}

export const INPUT_DEFINITIONS: InputDefinition[] = AUTHORED_INPUT_DEFINITIONS.map(remapInputDefinition);
