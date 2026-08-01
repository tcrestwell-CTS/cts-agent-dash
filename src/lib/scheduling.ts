/**
 * Slot math for the native agent scheduler.
 *
 * Availability is stored as a weekday + local start/end time in the agent's
 * booking timezone. To turn that into real instants we resolve the timezone's
 * UTC offset for each candidate day, so DST changes are handled correctly.
 */

export interface Window {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
}

export interface Busy {
  starts_at: string;
  ends_at: string;
}

export interface Slot {
  start: Date;
  end: Date;
}

/** Offset (in minutes) of `timeZone` from UTC at the given instant. */
function offsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUTC - date.getTime()) / 60000;
}

/** Build the instant for a wall-clock date/time in a named timezone. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month, day, hours, minutes);
  const guess = new Date(naive);
  const offset = offsetMinutes(guess, timeZone);
  return new Date(naive - offset * 60000);
}

/** Weekday (0=Sun) of an instant, in a named timezone. */
export function zonedWeekday(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Calendar date parts of an instant, in a named timezone. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

function parseTime(value: string): { h: number; m: number } {
  const [h, m] = value.split(":");
  return { h: Number(h), m: Number(m ?? 0) };
}

function overlaps(a: Slot, b: Busy): boolean {
  const bs = new Date(b.starts_at).getTime();
  const be = new Date(b.ends_at).getTime();
  return a.start.getTime() < be && a.end.getTime() > bs;
}

/**
 * Generate bookable slots for the next `days` days, excluding anything in the
 * past, inside a block, or already booked.
 */
export function generateSlots(opts: {
  windows: Window[];
  busy: Busy[];
  timeZone: string;
  days?: number;
  minLeadMinutes?: number;
  from?: Date;
}): Slot[] {
  const { windows, busy, timeZone } = opts;
  const days = opts.days ?? 21;
  const lead = opts.minLeadMinutes ?? 120;
  const now = opts.from ?? new Date();
  const earliest = now.getTime() + lead * 60000;
  const slots: Slot[] = [];

  for (let d = 0; d < days; d++) {
    const cursor = new Date(now.getTime() + d * 86400000);
    const weekday = zonedWeekday(cursor, timeZone);
    const { year, month, day } = zonedParts(cursor, timeZone);

    for (const w of windows.filter((x) => x.day_of_week === weekday)) {
      const start = parseTime(w.start_time);
      const end = parseTime(w.end_time);
      const windowStart = zonedTimeToUtc(year, month, day, start.h, start.m, timeZone);
      const windowEnd = zonedTimeToUtc(year, month, day, end.h, end.m, timeZone);
      const step = (w.slot_minutes + w.buffer_minutes) * 60000;
      const length = w.slot_minutes * 60000;

      for (let t = windowStart.getTime(); t + length <= windowEnd.getTime(); t += step) {
        const slot: Slot = { start: new Date(t), end: new Date(t + length) };
        if (t < earliest) continue;
        if (busy.some((b) => overlaps(slot, b))) continue;
        slots.push(slot);
      }
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}