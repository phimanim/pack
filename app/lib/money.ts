// Money convention: integer minor units (e.g. cents) + ISO 4217 currency code.
// Reused by coffee bags and (later) entries.

import type { Extraction } from "~/db/schema";

export const defaultCurrency = "EUR";

// Intl.NumberFormat accepts any well-formed code ("EUT"), so check against the
// list of real ISO 4217 currencies instead.
const currencyCodes = new Set(Intl.supportedValuesOf("currency"));

export function isCurrencyCode(value: string): boolean {
  return currencyCodes.has(value);
}

// Grams of coffee per cup, by extraction. Extractions without a dose are left
// out of per-cup bag costs.
export const doseGrams: Partial<Record<Extraction, number>> = {
  filter: 15,
  espresso: 6,
};

/** Bag price share for one cup of `dose` grams, in minor units. */
export function cupCostMinor(
  bagMinor: number,
  bagGrams: number,
  dose: number,
): number {
  return (bagMinor * dose) / bagGrams;
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
