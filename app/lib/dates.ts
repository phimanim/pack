import { DateTime } from "luxon";

// Server (Node) and browser can have different default locales, which breaks
// hydration. Always format with an explicit locale, matching <html lang="en">
// and app/lib/money.ts.
const LOCALE = "en";

/** Calendar date (yyyy-MM-dd ISO string or DateTime) as DATE_MED, e.g. "Oct 22, 2026". */
export function formatDate(value: string | DateTime): string {
  const dt =
    typeof value === "string"
      ? DateTime.fromISO(value, { zone: "utc" })
      : value;
  return dt.setLocale(LOCALE).toLocaleString(DateTime.DATE_MED);
}

/** Month key (yyyy-MM) as e.g. "Oct 2026". */
export function formatMonth(month: string): string {
  return DateTime.fromFormat(month, "yyyy-MM", { zone: "utc" })
    .setLocale(LOCALE)
    .toFormat("LLL yyyy");
}
