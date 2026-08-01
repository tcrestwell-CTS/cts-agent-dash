import { generateSlots } from "@/lib/scheduling";
import { describe, expect, it } from "vitest";
describe("slots", () => {
  it("generates 30 min slots in agent tz and skips busy", () => {
    const from = new Date("2026-08-03T12:00:00Z"); // Mon 8am ET
    const slots = generateSlots({
      windows: [{ day_of_week: 1, start_time: "09:00", end_time: "11:00", slot_minutes: 30, buffer_minutes: 0 }],
      busy: [{ starts_at: "2026-08-03T14:00:00Z", ends_at: "2026-08-03T14:30:00Z" }],
      timeZone: "America/New_York",
      days: 1,
      minLeadMinutes: 0,
      from,
    });
    expect(slots.map(s => s.start.toISOString())).toEqual([
      "2026-08-03T13:00:00.000Z","2026-08-03T13:30:00.000Z","2026-08-03T14:30:00.000Z",
    ]);
  });
});
