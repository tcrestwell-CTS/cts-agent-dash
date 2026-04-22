import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date-only string (e.g. "2026-04-25") as local midnight
 * instead of UTC midnight, preventing the off-by-one-day bug in
 * western timezones.  Full ISO strings pass through unchanged.
 */
export function parseLocalDate(dateStr: string): Date {
  // Date-only strings like "2026-04-25" → append T00:00:00 so the
  // Date constructor treats them as local time, not UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T00:00:00");
  }
  return new Date(dateStr);
}

/**
 * Format a Date as "YYYY-MM-DD" using *local* time, avoiding the
 * UTC-shift bug that `.toISOString().split("T")[0]` causes in
 * western timezones.
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
