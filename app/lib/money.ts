// Money convention: integer minor units (e.g. cents) + ISO 4217 currency code.
// Reused by coffee bags and (later) entries.

export const defaultCurrency = "EUR";

export function isCurrencyCode(value: string): boolean {
  if (!/^[A-Z]{3}$/.test(value)) return false;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: value });
    return true;
  } catch {
    return false;
  }
}

function minorDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

/** "12.50" -> 1250. Blank -> null. Invalid -> NaN. */
export function parseMoneyToMinor(
  value: FormDataEntryValue | null,
  currency: string,
): number | null {
  const s = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (s === "") return null;
  const digits = minorDigits(currency);
  if (!/^\d+(\.\d+)?$/.test(s)) return Number.NaN;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > digits) return Number.NaN;
  const minor = Number(whole + frac.padEnd(digits, "0"));
  return Number.isSafeInteger(minor) ? minor : Number.NaN;
}

/** 1250 -> "12.50" for form inputs. */
export function minorToInput(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

export function formatMinor(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    minor / 10 ** digits,
  );
}

/** Price per 100 g, formatted. */
export function formatPricePer100g(
  minor: number,
  currency: string,
  grams: number,
): string {
  const digits = minorDigits(currency);
  const per100 = (minor / 10 ** digits / grams) * 100;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(
    per100,
  );
}
