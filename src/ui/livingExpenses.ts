export type LivingExpensesMode = "single" | "expanded";

export const LIVING_EXPENSE_CATEGORY_DEFINITIONS = [
  { id: "homeMaintenance", label: "Home maintenance" },
  { id: "utilities", label: "Utilities" },
  { id: "internetAndMobile", label: "Internet and mobile" },
  { id: "groceries", label: "Groceries" },
  { id: "householdConsumables", label: "Household consumables" },
  { id: "transportAndVehicleExpenses", label: "Transport and vehicle expenses" },
  { id: "insurance", label: "Insurance" },
  { id: "healthcare", label: "Healthcare" },
  { id: "clothing", label: "Clothing" },
  { id: "fitnessAndPersonalCare", label: "Fitness and personal care" },
  { id: "diningOutAndEntertainment", label: "Dining out and entertainment" },
  { id: "subscriptionsAndDigitalServices", label: "Subscriptions and digital services" },
  { id: "travelAndHolidays", label: "Travel and holidays" },
  { id: "hobbiesAndSports", label: "Hobbies and sports" },
  { id: "giftsDonationsAndFamilySupport", label: "Gifts, donations and family support" },
  { id: "miscellaneous", label: "Miscellaneous" }
] as const;

export type LivingExpenseCategoryId = (typeof LIVING_EXPENSE_CATEGORY_DEFINITIONS)[number]["id"];
export type LivingExpenseCategoryValues = Record<LivingExpenseCategoryId, number | null>;

export function createEmptyLivingExpenseCategoryValues(): LivingExpenseCategoryValues {
  return Object.fromEntries(
    LIVING_EXPENSE_CATEGORY_DEFINITIONS.map(({ id }) => [id, null])
  ) as LivingExpenseCategoryValues;
}

export function hasAnyLivingExpenseCategoryValue(values: LivingExpenseCategoryValues): boolean {
  return LIVING_EXPENSE_CATEGORY_DEFINITIONS.some(({ id }) => values[id] !== null);
}

export function sumLivingExpenseCategoryValues(values: LivingExpenseCategoryValues): number {
  return LIVING_EXPENSE_CATEGORY_DEFINITIONS.reduce((total, { id }) => total + (values[id] ?? 0), 0);
}

export function seedLivingExpenseCategoryValuesFromTotal(
  total: number,
  targetId: LivingExpenseCategoryId = "miscellaneous"
): LivingExpenseCategoryValues {
  const seeded = createEmptyLivingExpenseCategoryValues();
  seeded[targetId] = total > 0 ? total : null;
  return seeded;
}
