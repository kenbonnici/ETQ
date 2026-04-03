import { FIELD_ID_TO_CELL, FieldId, InputCell } from "../model/fieldRegistry";

export type InputType = "number" | "integer" | "percent" | "text";

export interface InputDefinition {
  row: number;
  fieldId: FieldId;
  cell: InputCell;
  label: string;
  section: string;
  groupPath: string;
  groupTail: string[];
  tooltip: string;
  uiNote: string;
  sampleValue: string;
  type: InputType;
}

type AuthoredInputDefinition = Omit<InputDefinition, "cell">;

export const INPUT_SECTION_ORDER = [
  "Basics",
  "Income",
  "Housing",
  "Retirement Income",
  "Savings & Investments",
  "Investment Properties",
  "Other Assets",
  "Family",
  "Debt",
  "Major Future Events",
  "Advanced Assumptions"
] as const;

const AUTHORED_INPUT_DEFINITIONS: AuthoredInputDefinition[] = [
  {
    row: 4,
    fieldId: "profile.currentAge",
    label: "Your age",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Must be entered",
    uiNote: "",
    sampleValue: "48",
    type: "integer"
  },
  {
    row: 6,
    fieldId: "income.employment.netAnnual",
    label: "Main income",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Annual net of tax income from employment or self-employment.",
    uiNote: "",
    sampleValue: "80000",
    type: "number"
  },
  {
    row: 8,
    fieldId: "assets.cash.totalBalance",
    label: "Total cash balances",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Current and savings accounts, bonds, and term deposits",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 10,
    fieldId: "assets.equities.marketValue",
    label: "Stock market investments",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Current market value of equity portfolio",
    uiNote: "",
    sampleValue: "30000",
    type: "number"
  },
  {
    row: 12,
    fieldId: "housing.01Residence.marketValue",
    label: "Home value",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Current market value or leave blank if not a home owner",
    uiNote: "",
    sampleValue: "600000",
    type: "number"
  },
  {
    row: 15,
    fieldId: "housing.01Residence.mortgage.balance",
    label: "Balance",
    section: "QUICK START",
    groupPath: "QUICK START > Home loan (mortgage)",
    groupTail: ["Home loan (mortgage)"],
    tooltip: "Leave blank if no mortgage",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 16,
    fieldId: "housing.01Residence.mortgage.interestRateAnnual",
    label: "Interest rate",
    section: "QUICK START",
    groupPath: "QUICK START > Home loan (mortgage)",
    groupTail: ["Home loan (mortgage)"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 17,
    fieldId: "housing.01Residence.mortgage.monthlyRepayment",
    label: "Monthly repayment",
    section: "QUICK START",
    groupPath: "QUICK START > Home loan (mortgage)",
    groupTail: ["Home loan (mortgage)"],
    tooltip: "",
    uiNote: "",
    sampleValue: "800",
    type: "number"
  },
  {
    row: 19,
    fieldId: "retirement.statutoryAge",
    label: "Statutory retirement age",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Age at which pension starts",
    uiNote: "",
    sampleValue: "65",
    type: "integer"
  },
  {
    row: 21,
    fieldId: "retirement.statePension.netAnnualAtStart",
    label: "Expected annual amount",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Net annual state pension entitlement",
    uiNote: "",
    sampleValue: "16000",
    type: "number"
  },
  {
    row: 23,
    fieldId: "housing.rentAnnual",
    label: "Home monthly rent",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "Monthly rent if not a home owner",
    uiNote: "show only if not a home owner (B12=\"\")",
    sampleValue: "",
    type: "number"
  },
  {
    row: 25,
    fieldId: "spending.livingExpenses.annual",
    label: "Annual living expenses",
    section: "QUICK START",
    groupPath: "QUICK START",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 33,
    fieldId: "dependents.01.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 1",
    groupTail: ["Dependents", "Dependent 1"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "John",
    type: "text"
  },
  {
    row: 34,
    fieldId: "dependents.01.annualCost",
    label: "Annual cost",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 1",
    groupTail: ["Dependents", "Dependent 1"],
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2000",
    type: "number"
  },
  {
    row: 35,
    fieldId: "dependents.01.supportYearsRemaining",
    label: "Years to support",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 1",
    groupTail: ["Dependents", "Dependent 1"],
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 38,
    fieldId: "dependents.02.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 2",
    groupTail: ["Dependents", "Dependent 2"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Jack",
    type: "text"
  },
  {
    row: 39,
    fieldId: "dependents.02.annualCost",
    label: "Annual cost",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 2",
    groupTail: ["Dependents", "Dependent 2"],
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 40,
    fieldId: "dependents.02.supportYearsRemaining",
    label: "Years to support",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 2",
    groupTail: ["Dependents", "Dependent 2"],
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "5",
    type: "integer"
  },
  {
    row: 43,
    fieldId: "dependents.03.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 3",
    groupTail: ["Dependents", "Dependent 3"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Bill",
    type: "text"
  },
  {
    row: 44,
    fieldId: "dependents.03.annualCost",
    label: "Annual cost",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 3",
    groupTail: ["Dependents", "Dependent 3"],
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "4000",
    type: "number"
  },
  {
    row: 45,
    fieldId: "dependents.03.supportYearsRemaining",
    label: "Years to support",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 3",
    groupTail: ["Dependents", "Dependent 3"],
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2",
    type: "integer"
  },
  {
    row: 48,
    fieldId: "dependents.04.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 4",
    groupTail: ["Dependents", "Dependent 4"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Stephen",
    type: "text"
  },
  {
    row: 49,
    fieldId: "dependents.04.annualCost",
    label: "Annual cost",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 4",
    groupTail: ["Dependents", "Dependent 4"],
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2500",
    type: "number"
  },
  {
    row: 50,
    fieldId: "dependents.04.supportYearsRemaining",
    label: "Years to support",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 4",
    groupTail: ["Dependents", "Dependent 4"],
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 53,
    fieldId: "dependents.05.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 5",
    groupTail: ["Dependents", "Dependent 5"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Jane",
    type: "text"
  },
  {
    row: 54,
    fieldId: "dependents.05.annualCost",
    label: "Annual cost",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 5",
    groupTail: ["Dependents", "Dependent 5"],
    tooltip: "Food, education, healthcare,\netc.",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "2860",
    type: "number"
  },
  {
    row: 55,
    fieldId: "dependents.05.supportYearsRemaining",
    label: "Years to support",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Dependents > Dependent 5",
    groupTail: ["Dependents", "Dependent 5"],
    tooltip: "",
    uiNote: "Hide until user enters dependent name",
    sampleValue: "6",
    type: "integer"
  },
  {
    row: 60,
    fieldId: "properties.01.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 1",
    groupTail: ["Investment Properties ", "Property 1"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Sliema",
    type: "text"
  },
  {
    row: 61,
    fieldId: "properties.01.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 1",
    groupTail: ["Investment Properties ", "Property 1"],
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "300000",
    type: "number"
  },
  {
    row: 62,
    fieldId: "properties.01.annualOperatingCost",
    label: "Annual costs",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 1",
    groupTail: ["Investment Properties ", "Property 1"],
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "5000",
    type: "number"
  },
  {
    row: 65,
    fieldId: "properties.02.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 2",
    groupTail: ["Investment Properties ", "Property 2"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Gzira",
    type: "text"
  },
  {
    row: 66,
    fieldId: "properties.02.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 2",
    groupTail: ["Investment Properties ", "Property 2"],
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "150000",
    type: "number"
  },
  {
    row: 67,
    fieldId: "properties.02.annualOperatingCost",
    label: "Annual costs",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 2",
    groupTail: ["Investment Properties ", "Property 2"],
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "2000",
    type: "number"
  },
  {
    row: 70,
    fieldId: "properties.03.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 3",
    groupTail: ["Investment Properties ", "Property 3"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Qormi",
    type: "text"
  },
  {
    row: 71,
    fieldId: "properties.03.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 3",
    groupTail: ["Investment Properties ", "Property 3"],
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "220000",
    type: "number"
  },
  {
    row: 72,
    fieldId: "properties.03.annualOperatingCost",
    label: "Annual costs",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 3",
    groupTail: ["Investment Properties ", "Property 3"],
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "1200",
    type: "number"
  },
  {
    row: 75,
    fieldId: "properties.04.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 4",
    groupTail: ["Investment Properties ", "Property 4"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Gudja",
    type: "text"
  },
  {
    row: 76,
    fieldId: "properties.04.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 4",
    groupTail: ["Investment Properties ", "Property 4"],
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "80000",
    type: "number"
  },
  {
    row: 77,
    fieldId: "properties.04.annualOperatingCost",
    label: "Annual costs",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 4",
    groupTail: ["Investment Properties ", "Property 4"],
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 80,
    fieldId: "properties.05.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 5",
    groupTail: ["Investment Properties ", "Property 5"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Marsa",
    type: "text"
  },
  {
    row: 81,
    fieldId: "properties.05.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 5",
    groupTail: ["Investment Properties ", "Property 5"],
    tooltip: "",
    uiNote: "Hide until user enters property name",
    sampleValue: "120000",
    type: "number"
  },
  {
    row: 82,
    fieldId: "properties.05.annualOperatingCost",
    label: "Annual costs",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Investment Properties  > Property 5",
    groupTail: ["Investment Properties ", "Property 5"],
    tooltip: "Repairs, maintenance, etc.",
    uiNote: "Hide until user enters property name",
    sampleValue: "800",
    type: "number"
  },
  {
    row: 87,
    fieldId: "assetsOfValue.01.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 1",
    groupTail: ["Other Assets of Value", "Asset 1"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Jewelry",
    type: "text"
  },
  {
    row: 88,
    fieldId: "assetsOfValue.01.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 1",
    groupTail: ["Other Assets of Value", "Asset 1"],
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 89,
    fieldId: "assetsOfValue.01.appreciationRateAnnual",
    label: "Annual value change",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 1",
    groupTail: ["Other Assets of Value", "Asset 1"],
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 92,
    fieldId: "assetsOfValue.02.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 2",
    groupTail: ["Other Assets of Value", "Asset 2"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Car",
    type: "text"
  },
  {
    row: 93,
    fieldId: "assetsOfValue.02.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 2",
    groupTail: ["Other Assets of Value", "Asset 2"],
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "40000",
    type: "number"
  },
  {
    row: 94,
    fieldId: "assetsOfValue.02.appreciationRateAnnual",
    label: "Annual value change",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 2",
    groupTail: ["Other Assets of Value", "Asset 2"],
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "-0.05",
    type: "percent"
  },
  {
    row: 97,
    fieldId: "assetsOfValue.03.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 3",
    groupTail: ["Other Assets of Value", "Asset 3"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Painting",
    type: "text"
  },
  {
    row: 98,
    fieldId: "assetsOfValue.03.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 3",
    groupTail: ["Other Assets of Value", "Asset 3"],
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "20000",
    type: "number"
  },
  {
    row: 99,
    fieldId: "assetsOfValue.03.appreciationRateAnnual",
    label: "Annual value change",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 3",
    groupTail: ["Other Assets of Value", "Asset 3"],
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 102,
    fieldId: "assetsOfValue.04.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 4",
    groupTail: ["Other Assets of Value", "Asset 4"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Boat",
    type: "text"
  },
  {
    row: 103,
    fieldId: "assetsOfValue.04.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 4",
    groupTail: ["Other Assets of Value", "Asset 4"],
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "180000",
    type: "number"
  },
  {
    row: 104,
    fieldId: "assetsOfValue.04.appreciationRateAnnual",
    label: "Annual value change",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 4",
    groupTail: ["Other Assets of Value", "Asset 4"],
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "-0.05",
    type: "percent"
  },
  {
    row: 107,
    fieldId: "assetsOfValue.05.displayName",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 5",
    groupTail: ["Other Assets of Value", "Asset 5"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Antiques",
    type: "text"
  },
  {
    row: 108,
    fieldId: "assetsOfValue.05.marketValue",
    label: "Market value",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 5",
    groupTail: ["Other Assets of Value", "Asset 5"],
    tooltip: "",
    uiNote: "Hide until user enters asset name",
    sampleValue: "82000",
    type: "number"
  },
  {
    row: 109,
    fieldId: "assetsOfValue.05.appreciationRateAnnual",
    label: "Annual value change",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other Assets of Value > Asset 5",
    groupTail: ["Other Assets of Value", "Asset 5"],
    tooltip: "Positive if asset value grows, negative if asset depreciates",
    uiNote: "Hide until user enters asset name",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 113,
    fieldId: "properties.01.rentalIncomeNetAnnual",
    label: "Rental income: Sliema",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "12000",
    type: "number"
  },
  {
    row: 114,
    fieldId: "properties.02.rentalIncomeNetAnnual",
    label: "Rental income: Gzira",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "10000",
    type: "number"
  },
  {
    row: 115,
    fieldId: "properties.03.rentalIncomeNetAnnual",
    label: "Rental income: Qormi",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "8000",
    type: "number"
  },
  {
    row: 116,
    fieldId: "properties.04.rentalIncomeNetAnnual",
    label: "Rental income: Gudja",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "5000",
    type: "number"
  },
  {
    row: 117,
    fieldId: "properties.05.rentalIncomeNetAnnual",
    label: "Rental income: Marsa",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "Net annual after all costs and tax",
    uiNote: "Show with property name only if name was entered",
    sampleValue: "6500",
    type: "number"
  },
  {
    row: 119,
    fieldId: "income.otherWork.netAnnual",
    label: "Annual amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "Net annual income from consulting, freelance, or other part-time work. Leave blank if none.",
    uiNote: "",
    sampleValue: "2000",
    type: "number"
  },
  {
    row: 120,
    fieldId: "income.otherWork.endAge",
    label: "Continue other work until age",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Other income",
    groupTail: ["Other income"],
    tooltip: "",
    uiNote: "Show only if other work income entered",
    sampleValue: "58",
    type: "integer"
  },
  {
    row: 124,
    fieldId: "debts.creditCards.balance",
    label: "Credit card balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans",
    groupTail: ["Loans"],
    tooltip: "Combined balance on all cards. Assumed cleared in Year 1. Leave blank if none.",
    uiNote: "",
    sampleValue: "1000",
    type: "number"
  },
  {
    row: 127,
    fieldId: "properties.01.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Sliema Property",
    groupTail: ["Loans", "Sliema Property"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 128,
    fieldId: "properties.01.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Sliema Property",
    groupTail: ["Loans", "Sliema Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 129,
    fieldId: "properties.01.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Sliema Property",
    groupTail: ["Loans", "Sliema Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "500",
    type: "number"
  },
  {
    row: 132,
    fieldId: "properties.02.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Gzira Property",
    groupTail: ["Loans", "Gzira Property"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "8500",
    type: "number"
  },
  {
    row: 133,
    fieldId: "properties.02.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Gzira Property",
    groupTail: ["Loans", "Gzira Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 134,
    fieldId: "properties.02.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Gzira Property",
    groupTail: ["Loans", "Gzira Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "200",
    type: "number"
  },
  {
    row: 137,
    fieldId: "properties.03.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Qormi Property",
    groupTail: ["Loans", "Qormi Property"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "15000",
    type: "number"
  },
  {
    row: 138,
    fieldId: "properties.03.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Qormi Property",
    groupTail: ["Loans", "Qormi Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.05",
    type: "percent"
  },
  {
    row: 139,
    fieldId: "properties.03.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Qormi Property",
    groupTail: ["Loans", "Qormi Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "250",
    type: "number"
  },
  {
    row: 142,
    fieldId: "properties.04.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Gudja Property",
    groupTail: ["Loans", "Gudja Property"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "4680",
    type: "number"
  },
  {
    row: 143,
    fieldId: "properties.04.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Gudja Property",
    groupTail: ["Loans", "Gudja Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 144,
    fieldId: "properties.04.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Gudja Property",
    groupTail: ["Loans", "Gudja Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "80",
    type: "number"
  },
  {
    row: 147,
    fieldId: "properties.05.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Marsa Property",
    groupTail: ["Loans", "Marsa Property"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "9524",
    type: "number"
  },
  {
    row: 148,
    fieldId: "properties.05.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Marsa Property",
    groupTail: ["Loans", "Marsa Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 149,
    fieldId: "properties.05.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Marsa Property",
    groupTail: ["Loans", "Marsa Property"],
    tooltip: "",
    uiNote: "",
    sampleValue: "120",
    type: "number"
  },
  {
    row: 152,
    fieldId: "assetsOfValue.01.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Jewelry",
    groupTail: ["Loans", "Jewelry"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "2500",
    type: "number"
  },
  {
    row: 153,
    fieldId: "assetsOfValue.01.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Jewelry",
    groupTail: ["Loans", "Jewelry"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 154,
    fieldId: "assetsOfValue.01.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Jewelry",
    groupTail: ["Loans", "Jewelry"],
    tooltip: "",
    uiNote: "",
    sampleValue: "75",
    type: "number"
  },
  {
    row: 157,
    fieldId: "assetsOfValue.02.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Car",
    groupTail: ["Loans", "Car"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "6000",
    type: "number"
  },
  {
    row: 158,
    fieldId: "assetsOfValue.02.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Car",
    groupTail: ["Loans", "Car"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 159,
    fieldId: "assetsOfValue.02.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Car",
    groupTail: ["Loans", "Car"],
    tooltip: "",
    uiNote: "",
    sampleValue: "86",
    type: "number"
  },
  {
    row: 162,
    fieldId: "assetsOfValue.03.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Painting",
    groupTail: ["Loans", "Painting"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "7500",
    type: "number"
  },
  {
    row: 163,
    fieldId: "assetsOfValue.03.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Painting",
    groupTail: ["Loans", "Painting"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.05",
    type: "percent"
  },
  {
    row: 164,
    fieldId: "assetsOfValue.03.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Painting",
    groupTail: ["Loans", "Painting"],
    tooltip: "",
    uiNote: "",
    sampleValue: "125",
    type: "number"
  },
  {
    row: 167,
    fieldId: "assetsOfValue.04.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Boat",
    groupTail: ["Loans", "Boat"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "40000",
    type: "number"
  },
  {
    row: 168,
    fieldId: "assetsOfValue.04.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Boat",
    groupTail: ["Loans", "Boat"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.06",
    type: "percent"
  },
  {
    row: 169,
    fieldId: "assetsOfValue.04.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Boat",
    groupTail: ["Loans", "Boat"],
    tooltip: "",
    uiNote: "",
    sampleValue: "624",
    type: "number"
  },
  {
    row: 172,
    fieldId: "assetsOfValue.05.loan.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Antiques",
    groupTail: ["Loans", "Antiques"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "3800",
    type: "number"
  },
  {
    row: 173,
    fieldId: "assetsOfValue.05.loan.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Antiques",
    groupTail: ["Loans", "Antiques"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 174,
    fieldId: "assetsOfValue.05.loan.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Antiques",
    groupTail: ["Loans", "Antiques"],
    tooltip: "",
    uiNote: "",
    sampleValue: "110",
    type: "number"
  },
  {
    row: 177,
    fieldId: "debts.other.balance",
    label: "Balance",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Other loan",
    groupTail: ["Loans", "Other loan"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "4000",
    type: "number"
  },
  {
    row: 178,
    fieldId: "debts.other.interestRateAnnual",
    label: "Interest rate",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Other loan",
    groupTail: ["Loans", "Other loan"],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.06",
    type: "percent"
  },
  {
    row: 179,
    fieldId: "debts.other.monthlyRepayment",
    label: "Monthly repayment",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Loans > Other loan",
    groupTail: ["Loans", "Other loan"],
    tooltip: "",
    uiNote: "",
    sampleValue: "50",
    type: "number"
  },
  {
    row: 184,
    fieldId: "cashflowEvents.income.01.name",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 1",
    groupTail: ["Major life income events", "Income Event 1"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Inheritance",
    type: "text"
  },
  {
    row: 185,
    fieldId: "cashflowEvents.income.01.amount",
    label: "Amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 1",
    groupTail: ["Major life income events", "Income Event 1"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 186,
    fieldId: "cashflowEvents.income.01.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 1",
    groupTail: ["Major life income events", "Income Event 1"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2035",
    type: "integer"
  },
  {
    row: 189,
    fieldId: "cashflowEvents.income.02.name",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 2",
    groupTail: ["Major life income events", "Income Event 2"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Sell Painting",
    type: "text"
  },
  {
    row: 190,
    fieldId: "cashflowEvents.income.02.amount",
    label: "Amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 2",
    groupTail: ["Major life income events", "Income Event 2"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "10000",
    type: "number"
  },
  {
    row: 191,
    fieldId: "cashflowEvents.income.02.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 2",
    groupTail: ["Major life income events", "Income Event 2"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2029",
    type: "integer"
  },
  {
    row: 194,
    fieldId: "cashflowEvents.income.03.name",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 3",
    groupTail: ["Major life income events", "Income Event 3"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Sell Jewels",
    type: "text"
  },
  {
    row: 195,
    fieldId: "cashflowEvents.income.03.amount",
    label: "Amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 3",
    groupTail: ["Major life income events", "Income Event 3"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "5000",
    type: "number"
  },
  {
    row: 196,
    fieldId: "cashflowEvents.income.03.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life income events > Income Event 3",
    groupTail: ["Major life income events", "Income Event 3"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2032",
    type: "integer"
  },
  {
    row: 201,
    fieldId: "cashflowEvents.expense.01.name",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 1",
    groupTail: ["Major life expense events", "Expense Event 1"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "Wedding",
    type: "text"
  },
  {
    row: 202,
    fieldId: "cashflowEvents.expense.01.amount",
    label: "Amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 1",
    groupTail: ["Major life expense events", "Expense Event 1"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "40000",
    type: "number"
  },
  {
    row: 203,
    fieldId: "cashflowEvents.expense.01.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 1",
    groupTail: ["Major life expense events", "Expense Event 1"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2036",
    type: "integer"
  },
  {
    row: 206,
    fieldId: "cashflowEvents.expense.02.name",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 2",
    groupTail: ["Major life expense events", "Expense Event 2"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "New Car",
    type: "text"
  },
  {
    row: 207,
    fieldId: "cashflowEvents.expense.02.amount",
    label: "Amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 2",
    groupTail: ["Major life expense events", "Expense Event 2"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "35000",
    type: "number"
  },
  {
    row: 208,
    fieldId: "cashflowEvents.expense.02.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 2",
    groupTail: ["Major life expense events", "Expense Event 2"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2029",
    type: "integer"
  },
  {
    row: 211,
    fieldId: "cashflowEvents.expense.03.name",
    label: "Name",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 3",
    groupTail: ["Major life expense events", "Expense Event 3"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "New AC",
    type: "text"
  },
  {
    row: 212,
    fieldId: "cashflowEvents.expense.03.amount",
    label: "Amount",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 3",
    groupTail: ["Major life expense events", "Expense Event 3"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "15000",
    type: "number"
  },
  {
    row: 213,
    fieldId: "cashflowEvents.expense.03.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Major life expense events > Expense Event 3",
    groupTail: ["Major life expense events", "Expense Event 3"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2034",
    type: "integer"
  },
  {
    row: 217,
    fieldId: "housing.downsize.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Home downsizing",
    groupTail: ["Home downsizing"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "2030",
    type: "integer"
  },
  {
    row: 219,
    fieldId: "housing.downsize.newHomeMode",
    label: "Buy or rent after downsizing?",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Home downsizing",
    groupTail: ["Home downsizing"],
    tooltip: "",
    uiNote: "Show only after a downsizing year is entered",
    sampleValue: "Buy",
    type: "text"
  },
  {
    row: 221,
    fieldId: "housing.downsize.newHomePurchaseCost",
    label: "New home cost",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Home downsizing",
    groupTail: ["Home downsizing"],
    tooltip: "At today's prices, including agency, tax, legal fees, moving, improvements etc.",
    uiNote: "Show only when downsizing to buy",
    sampleValue: "250000",
    type: "number"
  },
  {
    row: 223,
    fieldId: "housing.downsize.newRentAnnual",
    label: "New home monthly rent",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Home downsizing",
    groupTail: ["Home downsizing"],
    tooltip: "",
    uiNote: "Show only when downsizing to rent",
    sampleValue: "",
    type: "number"
  },
  {
    row: 228,
    fieldId: "stockMarketCrashes.01.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 1",
    groupTail: ["Stock market crash scenarios", "Crash 1"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 229,
    fieldId: "stockMarketCrashes.01.dropPercentage",
    label: "% drop",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 1",
    groupTail: ["Stock market crash scenarios", "Crash 1"],
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.15",
    type: "percent"
  },
  {
    row: 230,
    fieldId: "stockMarketCrashes.01.recoveryYears",
    label: "Recovery years",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 1",
    groupTail: ["Stock market crash scenarios", "Crash 1"],
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "1",
    type: "integer"
  },
  {
    row: 233,
    fieldId: "stockMarketCrashes.02.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 2",
    groupTail: ["Stock market crash scenarios", "Crash 2"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 234,
    fieldId: "stockMarketCrashes.02.dropPercentage",
    label: "% drop",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 2",
    groupTail: ["Stock market crash scenarios", "Crash 2"],
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.2",
    type: "percent"
  },
  {
    row: 235,
    fieldId: "stockMarketCrashes.02.recoveryYears",
    label: "Recovery years",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 2",
    groupTail: ["Stock market crash scenarios", "Crash 2"],
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 238,
    fieldId: "stockMarketCrashes.03.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 3",
    groupTail: ["Stock market crash scenarios", "Crash 3"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 239,
    fieldId: "stockMarketCrashes.03.dropPercentage",
    label: "% drop",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 3",
    groupTail: ["Stock market crash scenarios", "Crash 3"],
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.08",
    type: "percent"
  },
  {
    row: 240,
    fieldId: "stockMarketCrashes.03.recoveryYears",
    label: "Recovery years",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 3",
    groupTail: ["Stock market crash scenarios", "Crash 3"],
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "5",
    type: "integer"
  },
  {
    row: 243,
    fieldId: "stockMarketCrashes.04.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 4",
    groupTail: ["Stock market crash scenarios", "Crash 4"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "2042",
    type: "integer"
  },
  {
    row: 244,
    fieldId: "stockMarketCrashes.04.dropPercentage",
    label: "% drop",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 4",
    groupTail: ["Stock market crash scenarios", "Crash 4"],
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.18",
    type: "percent"
  },
  {
    row: 245,
    fieldId: "stockMarketCrashes.04.recoveryYears",
    label: "Recovery years",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 4",
    groupTail: ["Stock market crash scenarios", "Crash 4"],
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 248,
    fieldId: "stockMarketCrashes.05.year",
    label: "Year",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 5",
    groupTail: ["Stock market crash scenarios", "Crash 5"],
    tooltip: "Leave blank if none",
    uiNote: "",
    sampleValue: "",
    type: "integer"
  },
  {
    row: 249,
    fieldId: "stockMarketCrashes.05.dropPercentage",
    label: "% drop",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 5",
    groupTail: ["Stock market crash scenarios", "Crash 5"],
    tooltip: "Min 5%, max 90%",
    uiNote: "Hide until user enters crash year",
    sampleValue: "0.28",
    type: "percent"
  },
  {
    row: 250,
    fieldId: "stockMarketCrashes.05.recoveryYears",
    label: "Recovery years",
    section: "DEEPER DIVE",
    groupPath: "DEEPER DIVE > Stock market crash scenarios > Crash 5",
    groupTail: ["Stock market crash scenarios", "Crash 5"],
    tooltip: "Years for market to recover to the previous high just before crash",
    uiNote: "Hide until user enters crash year",
    sampleValue: "2",
    type: "integer"
  },
  {
    row: 254,
    fieldId: "planning.lifeExpectancyAge",
    label: "Life expectancy",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "85",
    type: "integer"
  },
  {
    row: 257,
    fieldId: "spending.adjustments.pre65.deltaRate",
    label: "From now to 65",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Spending adjustment (at today's euros)",
    groupTail: ["Spending adjustment (at today's euros)"],
    tooltip: "More / less than current",
    uiNote: "",
    sampleValue: "0",
    type: "percent"
  },
  {
    row: 258,
    fieldId: "spending.adjustments.age66To75.deltaRate",
    label: "From 66 to 75",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Spending adjustment (at today's euros)",
    groupTail: ["Spending adjustment (at today's euros)"],
    tooltip: "More / less than current",
    uiNote: "",
    sampleValue: "-0.1",
    type: "percent"
  },
  {
    row: 259,
    fieldId: "spending.adjustments.age76Plus.deltaRate",
    label: "From age 76",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Spending adjustment (at today's euros)",
    groupTail: ["Spending adjustment (at today's euros)"],
    tooltip: "More / less than current",
    uiNote: "",
    sampleValue: "-0.2",
    type: "percent"
  },
  {
    row: 261,
    fieldId: "income.postRetirementSupplement.annual",
    label: "Annual amount",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Other post-retirement income",
    groupTail: ["Other post-retirement income"],
    tooltip: "Enter 0 or leave blank if none",
    uiNote: "",
    sampleValue: "12000",
    type: "number"
  },
  {
    row: 262,
    fieldId: "income.postRetirementSupplement.startAge",
    label: "From age",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Other post-retirement income",
    groupTail: ["Other post-retirement income"],
    tooltip: "",
    uiNote: "Only show if value > 0 is entered above",
    sampleValue: "58",
    type: "integer"
  },
  {
    row: 263,
    fieldId: "income.postRetirementSupplement.endAge",
    label: "To age",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Other post-retirement income",
    groupTail: ["Other post-retirement income"],
    tooltip: "",
    uiNote: "Only show if value > 0 is entered above",
    sampleValue: "69",
    type: "integer"
  },
  {
    row: 265,
    fieldId: "assumptions.generalInflationRateAnnual",
    label: "General inflation",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "2.5000000000000001E-2",
    type: "percent"
  },
  {
    row: 267,
    fieldId: "assumptions.propertyAppreciationRateAnnual",
    label: "Property growth",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 269,
    fieldId: "assumptions.cashYieldRateAnnual",
    label: "Cash interest rate",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "2.5000000000000001E-2",
    type: "percent"
  },
  {
    row: 271,
    fieldId: "assumptions.equityReturnRateAnnual",
    label: "Stock market return",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.08",
    type: "percent"
  },
  {
    row: 273,
    fieldId: "assumptions.salaryGrowthRateAnnual",
    label: "Main income growth",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 275,
    fieldId: "assumptions.rentalIncomeGrowthRateAnnual",
    label: "Rental income growth",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "",
    uiNote: "",
    sampleValue: "0.03",
    type: "percent"
  },
  {
    row: 277,
    fieldId: "retirement.earlyPensionReductionPerYear",
    label: "Early retirement reduction",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "Reduction in annual pension for each year retired early",
    uiNote: "",
    sampleValue: "300",
    type: "number"
  },
  {
    row: 279,
    fieldId: "liquidity.minimumCashBuffer",
    label: "Cash buffer at any time",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "Emergency reserve",
    uiNote: "",
    sampleValue: "50000",
    type: "number"
  },
  {
    row: 281,
    fieldId: "planning.legacyAmount",
    label: "Legacy amount",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "Wealth to preserve for your heirs",
    uiNote: "",
    sampleValue: "0",
    type: "number"
  },
  {
    row: 283,
    fieldId: "liquidation.stockSellingCostRate",
    label: "Stock market selling costs",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "Tax, broker, and other fees",
    uiNote: "",
    sampleValue: "0.05",
    type: "percent"
  },
  {
    row: 285,
    fieldId: "liquidation.propertyDisposalCostRate",
    label: "Property disposal costs",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "Agency, tax, and legal fees",
    uiNote: "",
    sampleValue: "0.15",
    type: "percent"
  },
  {
    row: 287,
    fieldId: "liquidation.otherAssetDisposalCostRate",
    label: "Other assets disposal costs",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS",
    groupTail: [],
    tooltip: "Agency, tax, and other fees",
    uiNote: "",
    sampleValue: "0.02",
    type: "percent"
  },
  {
    row: 290,
    fieldId: "properties.01.liquidationPriority",
    label: "Sliema",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "0 = would never sell",
    uiNote: "",
    sampleValue: "10",
    type: "integer"
  },
  {
    row: 291,
    fieldId: "properties.02.liquidationPriority",
    label: "Gzira",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "7",
    type: "integer"
  },
  {
    row: 292,
    fieldId: "properties.03.liquidationPriority",
    label: "Qormi",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "9",
    type: "integer"
  },
  {
    row: 293,
    fieldId: "properties.04.liquidationPriority",
    label: "Gudja",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "4",
    type: "integer"
  },
  {
    row: 294,
    fieldId: "properties.05.liquidationPriority",
    label: "Marsa",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "6",
    type: "integer"
  },
  {
    row: 295,
    fieldId: "assetsOfValue.01.liquidationPriority",
    label: "Jewelry",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "3",
    type: "integer"
  },
  {
    row: 296,
    fieldId: "assetsOfValue.02.liquidationPriority",
    label: "Car",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "2",
    type: "integer"
  },
  {
    row: 297,
    fieldId: "assetsOfValue.03.liquidationPriority",
    label: "Painting",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "1",
    type: "integer"
  },
  {
    row: 298,
    fieldId: "assetsOfValue.04.liquidationPriority",
    label: "Boat",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
    tooltip: "",
    uiNote: "",
    sampleValue: "8",
    type: "integer"
  },
  {
    row: 299,
    fieldId: "assetsOfValue.05.liquidationPriority",
    label: "Antiques",
    section: "FINER DETAILS",
    groupPath: "FINER DETAILS > Asset liquidation order",
    groupTail: ["Asset liquidation order"],
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
  "income.otherWork.netAnnual": "Annual amount",
  "income.otherWork.endAge": "Ends at age",
  "housing.downsize.newHomeMode": "Buy or rent after downsizing?",
  "income.postRetirementSupplement.annual": "Annual amount",
  "retirement.earlyPensionReductionPerYear": "Early retirement reduction",
  "liquidity.minimumCashBuffer": "Minimum cash reserve",
  "planning.legacyAmount": "Amount you want to leave behind",
  "assets.cash.totalBalance": "Cash balance",
  "assets.equities.marketValue": "Investment value",
  "debts.creditCards.balance": "Credit card balance",
  "liquidation.stockSellingCostRate": "Stocks",
  "liquidation.propertyDisposalCostRate": "Properties",
  "liquidation.otherAssetDisposalCostRate": "Other assets"
};

const TOOLTIP_OVERRIDES: Partial<Record<FieldId, string>> = {
  "income.employment.netAnnual": "Annual net of tax income from employment or self-employment.",
  "housing.01Residence.marketValue": "Current market value or leave blank if not a home owner",
  "income.otherWork.netAnnual": "Net annual income from consulting, freelance, or other part-time work. Leave blank if none.",
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
  if (fieldId === "profile.currentAge" || fieldId === "planning.lifeExpectancyAge") {
    return { section: "Basics", groupTail: [] };
  }
  if (fieldId === "spending.livingExpenses.annual") {
    return { section: "Basics", groupTail: [] };
  }
  if (fieldId === "liquidity.minimumCashBuffer" || fieldId === "planning.legacyAmount") {
    return { section: "Basics", groupTail: ["Goals"] };
  }

  if (fieldId === "income.employment.netAnnual") {
    return { section: "Income", groupTail: [] };
  }
  if (fieldId.startsWith("income.otherWork.")) {
    return { section: "Income", groupTail: ["Side income"] };
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
    fieldId === "housing.01Residence.marketValue"
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
  ) {
    return { section: "Retirement Income", groupTail: ["State pension"] };
  }
  if (fieldId.startsWith("income.postRetirementSupplement.")) {
    return { section: "Retirement Income", groupTail: ["Other retirement income"] };
  }

  if (fieldId === "assets.cash.totalBalance" || fieldId === "assets.equities.marketValue") {
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
    return { section: "Family", groupTail: ["People you support", slot] };
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
    fieldId === "spending.adjustments.pre65.deltaRate"
    || fieldId === "spending.adjustments.age66To75.deltaRate"
    || fieldId === "spending.adjustments.age76Plus.deltaRate"
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
  if (fieldId === "retirement.earlyPensionReductionPerYear") {
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

function remapInputDefinition(def: AuthoredInputDefinition): AuthoredInputDefinition {
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

export const INPUT_DEFINITIONS: InputDefinition[] = AUTHORED_INPUT_DEFINITIONS.map(remapInputDefinition).map((def) => ({
  ...def,
  cell: FIELD_ID_TO_CELL[def.fieldId]
}));
