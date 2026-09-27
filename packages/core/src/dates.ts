export const DEFAULT_TIMEZONE = "Africa/Douala";

/** Calendar date (YYYY-MM-DD) of `instant` in the given IANA timezone. */
export function localDate(instant: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      instant,
    );
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  }
}

/** Whole days from calendar date `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Calendar date `n` days after `date` (YYYY-MM-DD); negative `n` goes back. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Days until the exam, or null if unknown. Negative once the exam date has passed. */
export function daysUntil(examDate: string | null, now: Date, timeZone: string = DEFAULT_TIMEZONE): number | null {
  if (!examDate) return null;
  return daysBetween(localDate(now, timeZone), examDate.slice(0, 10));
}
