export interface ProjectionTiming {
  currentYear: number;
  currentMonth: number;
  monthsRemaining: number;
  monthOffset: number;
  proRate: number;
}

export function clampProjectionMonth(month: number | null | undefined): number | null {
  if (!Number.isFinite(month)) return null;
  const rounded = Math.round(month as number);
  if (rounded < 1 || rounded > 12) return null;
  return rounded;
}

export function resolveProjectionTiming(
  nowDate: Date = new Date(),
  projectionMonthOverride: number | null | undefined = null
): ProjectionTiming {
  const currentYear = nowDate.getFullYear();
  const currentMonth = clampProjectionMonth(projectionMonthOverride) ?? (nowDate.getMonth() + 1);
  const monthsRemaining = 13 - currentMonth;

  return {
    currentYear,
    currentMonth,
    monthsRemaining,
    monthOffset: monthsRemaining - 12,
    proRate: monthsRemaining / 12
  };
}
