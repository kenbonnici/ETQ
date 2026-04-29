export const DEFAULT_CURRENCY = "EUR";

export const TOP_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" }
] as const;

export type SupportedCurrencyCode = (typeof TOP_CURRENCIES)[number]["code"];

export function isSupportedCurrency(code: unknown): code is SupportedCurrencyCode {
  return typeof code === "string" && TOP_CURRENCIES.some((currency) => currency.code === code);
}

export function currencySymbolFor(code: unknown): string {
  return TOP_CURRENCIES.find((currency) => currency.code === code)?.symbol ?? "€";
}

export function formatCurrencyAmount(
  value: number | null | undefined,
  code: unknown,
  locale = "en-IE"
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${currencySymbolFor(code)}${Math.round(value).toLocaleString(locale)}`;
}
