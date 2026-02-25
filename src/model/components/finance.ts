export function safePow(base: number, exp: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(exp)) return 0;
  return Math.pow(base, exp);
}

// Excel-like FV(rate, nper, pmt, pv) with end-of-period payments (type=0).
export function fv(rate: number, nper: number, pmt: number, pv: number): number {
  if (rate === 0) return -(pv + pmt * nper);
  const v = Math.pow(1 + rate, nper);
  return -(pv * v + pmt * (v - 1) / rate);
}

export function yearlyLoanPayment(monthsRemaining: number, monthlyRepayment: number, yearIndex: number): number {
  const paidBefore = Math.max(0, yearIndex * 12);
  const remainingAtYearStart = Math.max(0, monthsRemaining - paidBefore);
  const monthsPaidThisYear = Math.min(12, remainingAtYearStart);
  return monthsPaidThisYear * monthlyRepayment;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
