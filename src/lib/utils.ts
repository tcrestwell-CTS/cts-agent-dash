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
