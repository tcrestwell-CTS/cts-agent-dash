import { differenceInCalendarDays } from "date-fns";
import { parseLocalDate } from "./utils";

type DayRangeOptions = {
  departDate?: string | null;
  returnDate?: string | null;
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();

const normalizeDayNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const normalized = Math.trunc(numeric);
  return normalized >= 1 ? normalized : null;
};

export function getTripDayCount({ departDate, returnDate }: DayRangeOptions): number | null {
  if (!departDate || !returnDate) return null;

  const start = parseLocalDate(departDate);
  const end = parseLocalDate(returnDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return Math.max(differenceInCalendarDays(end, start) + 1, 1);
}

export function filterToActiveItinerary<T extends { itinerary_id?: string | null }>(
  entries: T[],
  activeItineraryId?: string | null
): T[] {
  if (!activeItineraryId) return entries;

  return entries.some((entry) => entry.itinerary_id === activeItineraryId)
    ? entries.filter((entry) => entry.itinerary_id === activeItineraryId)
    : entries;
}

export function sanitizePublishedItinerary<T extends Record<string, any>>(
  items: T[],
  options: DayRangeOptions = {}
): T[] {
  const totalDays = getTripDayCount(options);
  const seen = new Set<string>();

  return items
    .map((item) => {
      const dayNumber = normalizeDayNumber(item.day_number);
      return dayNumber ? ({ ...item, day_number: dayNumber } as T) : null;
    })
    .filter((item): item is T => item !== null)
    .filter((item) => !totalDays || Number(item.day_number) <= totalDays)
    .sort(
      (a, b) =>
        Number(a.day_number) - Number(b.day_number) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .filter((item) => {
      const key = [
        item.day_number,
        normalizeText(item.title),
        normalizeText(item.description),
        normalizeText(item.location),
        normalizeText(item.start_time),
        normalizeText(item.end_time),
        normalizeText(item.category),
        normalizeText(item.option_block_id),
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function sanitizePublishedOptionBlocks<T extends Record<string, any>>(
  blocks: T[],
  options: DayRangeOptions = {}
): T[] {
  const totalDays = getTripDayCount(options);
  const seen = new Set<string>();

  return blocks
    .map((block) => {
      const dayNumber = normalizeDayNumber(block.day_number);
      return dayNumber ? ({ ...block, day_number: dayNumber } as T) : null;
    })
    .filter((block): block is T => block !== null)
    .filter((block) => !totalDays || Number(block.day_number) <= totalDays)
    .sort(
      (a, b) =>
        Number(a.day_number) - Number(b.day_number) ||
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
    )
    .filter((block) => {
      const key = [
        normalizeText(block.id),
        block.day_number,
        normalizeText(block.title),
        Number(block.sort_order ?? 0),
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}