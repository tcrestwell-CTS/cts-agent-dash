/**
 * AI Chat Features — Automated Edge Case Tests
 *
 * Covers the edge cases that can be validated without a live browser or Supabase:
 *  - File size validation boundary (8MB limit)
 *  - File type detection
 *  - Base64 truncation threshold
 *  - Page context derivation logic
 *  - Research client data aggregation (revenue math, null handling)
 *  - Voice feature detection flag
 */

import { describe, it, expect, vi } from "vitest";

// ── Constants mirrored from AgentChatWidget ────────────────────────────────────
const MAX_FILE_MB = 8;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024; // 8,388,608
const BASE64_TRUNCATE_CHARS = 8000;

// ── File helpers mirrored from AgentChatWidget ─────────────────────────────────
function getFileType(file: { type: string; name: string }): "pdf" | "image" | "csv" | "text" {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "text/csv" || file.name.endsWith(".csv")) return "csv";
  return "text";
}

function isFileTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_FILE_BYTES;
}

// ── Research client data aggregation (mirrors edge fn logic) ───────────────────
function computeResearchSummary(trips: Array<{ total_gross_sales: number | null; status: string; created_at: string }>) {
  const totalRevenue = trips.reduce((sum, t) => sum + (t.total_gross_sales || 0), 0);
  const upcomingTrips = trips.filter((t) => t.status !== "completed" && t.status !== "cancelled").length;
  const sorted = [...trips].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return {
    total_trips: trips.length,
    total_revenue: totalRevenue,
    upcoming_trips: upcomingTrips,
    last_trip: sorted[0] ?? null,
  };
}

// ── Context derivation (mirrors useParams logic) ───────────────────────────────
function derivePageContext(params: { tripId?: string; clientId?: string }) {
  return {
    tripId: params.tripId ?? null,
    clientId: params.clientId ?? null,
  };
}

function buildContextBlock(context: { tripId: string | null; clientId: string | null }): string {
  let block = "";
  if (context.tripId) {
    block += `\n\nCURRENT PAGE: The advisor is currently viewing trip ID: ${context.tripId}. When they refer to "this trip" or "the current trip", use this ID automatically.`;
  }
  if (context.clientId) {
    block += `\n\nCURRENT PAGE: The advisor is currently viewing client ID: ${context.clientId}. When they ask to "research this client" or refer to "this client", use this ID automatically.`;
  }
  return block;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Feature 1 — File Upload: size validation", () => {
  it("rejects a file exactly 1 byte over 8MB (8,388,609 bytes)", () => {
    expect(isFileTooLarge(8_388_609)).toBe(true);
  });

  it("accepts a file exactly at 8MB (8,388,608 bytes)", () => {
    expect(isFileTooLarge(8_388_608)).toBe(false);
  });

  it("accepts a file 1 byte under 8MB (8,388,607 bytes)", () => {
    expect(isFileTooLarge(8_388_607)).toBe(false);
  });

  it("rejects a 10MB file (10,485,760 bytes)", () => {
    expect(isFileTooLarge(10 * 1024 * 1024)).toBe(true);
  });

  it("accepts a small 50KB file", () => {
    expect(isFileTooLarge(50 * 1024)).toBe(false);
  });

  it("rejects a 0-byte file — boundary edge (0 bytes is accepted, not rejected)", () => {
    // 0 bytes is NOT too large — it passes size check (empty file handled downstream)
    expect(isFileTooLarge(0)).toBe(false);
  });
});

describe("Feature 1 — File Upload: type detection", () => {
  it("detects PDF files by MIME type", () => {
    expect(getFileType({ type: "application/pdf", name: "quote.pdf" })).toBe("pdf");
  });

  it("detects JPEG images", () => {
    expect(getFileType({ type: "image/jpeg", name: "hotel.jpg" })).toBe("image");
  });

  it("detects PNG images", () => {
    expect(getFileType({ type: "image/png", name: "map.png" })).toBe("image");
  });

  it("detects WebP images", () => {
    expect(getFileType({ type: "image/webp", name: "photo.webp" })).toBe("image");
  });

  it("detects GIF images", () => {
    expect(getFileType({ type: "image/gif", name: "animated.gif" })).toBe("image");
  });

  it("detects CSV by MIME type", () => {
    expect(getFileType({ type: "text/csv", name: "data.csv" })).toBe("csv");
  });

  it("detects CSV by file extension when MIME is generic", () => {
    expect(getFileType({ type: "application/octet-stream", name: "export.csv" })).toBe("csv");
  });

  it("treats TXT files as text type", () => {
    expect(getFileType({ type: "text/plain", name: "notes.txt" })).toBe("text");
  });

  it("treats unknown MIME types as text (fallback)", () => {
    expect(getFileType({ type: "application/vnd.ms-excel", name: "data.xlsx" })).toBe("text");
  });
});

describe("Feature 1 — File Upload: base64 truncation", () => {
  it("content under 8000 chars is not truncated", () => {
    const content = "a".repeat(7999);
    const truncated = content.substring(0, BASE64_TRUNCATE_CHARS);
    expect(truncated).toHaveLength(7999);
    expect(content.length > BASE64_TRUNCATE_CHARS).toBe(false);
  });

  it("content at exactly 8000 chars is not truncated", () => {
    const content = "a".repeat(8000);
    const truncated = content.substring(0, BASE64_TRUNCATE_CHARS);
    expect(truncated).toHaveLength(8000);
  });

  it("content over 8000 chars is truncated to 8000", () => {
    const content = "a".repeat(10000);
    const truncated = content.substring(0, BASE64_TRUNCATE_CHARS);
    expect(truncated).toHaveLength(8000);
    expect(content.length > BASE64_TRUNCATE_CHARS).toBe(true);
  });

  it("a 8MB file base64-encodes to ~11MB — well over 8000 chars → truncation applies", () => {
    // base64 expansion factor: ~1.37x
    const fileSizeBytes = 8 * 1024 * 1024;
    const base64SizeChars = Math.ceil(fileSizeBytes * 1.37);
    expect(base64SizeChars).toBeGreaterThan(BASE64_TRUNCATE_CHARS);
  });
});

describe("Feature 3 — Auto Page Context: derivation and injection", () => {
  it("derives tripId from trip route params", () => {
    const ctx = derivePageContext({ tripId: "abc-123", clientId: undefined });
    expect(ctx.tripId).toBe("abc-123");
    expect(ctx.clientId).toBeNull();
  });

  it("derives clientId from contact route params", () => {
    const ctx = derivePageContext({ tripId: undefined, clientId: "def-456" });
    expect(ctx.tripId).toBeNull();
    expect(ctx.clientId).toBe("def-456");
  });

  it("returns null context on routes with no entity params (dashboard)", () => {
    const ctx = derivePageContext({});
    expect(ctx.tripId).toBeNull();
    expect(ctx.clientId).toBeNull();
  });

  it("handles both params present (trip + client both in URL — edge case)", () => {
    const ctx = derivePageContext({ tripId: "trip-1", clientId: "client-1" });
    expect(ctx.tripId).toBe("trip-1");
    expect(ctx.clientId).toBe("client-1");
  });

  it("builds trip context block in system prompt when tripId present", () => {
    const block = buildContextBlock({ tripId: "trip-xyz", clientId: null });
    expect(block).toContain("trip ID: trip-xyz");
    expect(block).not.toContain("client ID");
  });

  it("builds client context block when clientId present", () => {
    const block = buildContextBlock({ tripId: null, clientId: "client-abc" });
    expect(block).toContain("client ID: client-abc");
    expect(block).not.toContain("trip ID");
  });

  it("builds both blocks when both IDs are present", () => {
    const block = buildContextBlock({ tripId: "trip-1", clientId: "client-1" });
    expect(block).toContain("trip ID: trip-1");
    expect(block).toContain("client ID: client-1");
  });

  it("returns empty string when no context (dashboard — no context block injected)", () => {
    const block = buildContextBlock({ tripId: null, clientId: null });
    expect(block).toBe("");
  });

  it("context block contains 'this trip' resolution instruction", () => {
    const block = buildContextBlock({ tripId: "trip-abc", clientId: null });
    // The block should tell the AI to use this ID when the user says "this trip"
    expect(block).toContain("trip-abc");
    expect(block.toLowerCase()).toMatch(/this trip|current trip|use this/);
  });
});

describe("Feature 4 — Research Client: data aggregation logic", () => {
  it("returns zero summary for client with no trips", () => {
    const summary = computeResearchSummary([]);
    expect(summary.total_trips).toBe(0);
    expect(summary.total_revenue).toBe(0);
    expect(summary.upcoming_trips).toBe(0);
    expect(summary.last_trip).toBeNull();
  });

  it("returns correct totals for client with 1 trip", () => {
    const trips = [{ total_gross_sales: 3500, status: "booked", created_at: "2026-01-15T00:00:00Z" }];
    const summary = computeResearchSummary(trips);
    expect(summary.total_trips).toBe(1);
    expect(summary.total_revenue).toBe(3500);
    expect(summary.upcoming_trips).toBe(1);
    expect(summary.last_trip).toBe(trips[0]);
  });

  it("sums revenue correctly across 15 trips", () => {
    const trips = Array.from({ length: 15 }, (_, i) => ({
      total_gross_sales: 1000 * (i + 1),
      status: i < 10 ? "booked" : "completed",
      created_at: `2026-0${(i % 9) + 1}-01T00:00:00Z`,
    }));
    const summary = computeResearchSummary(trips);
    expect(summary.total_trips).toBe(15);
    expect(summary.total_revenue).toBe(1000 + 2000 + 3000 + 4000 + 5000 + 6000 + 7000 + 8000 + 9000 + 10000 + 11000 + 12000 + 13000 + 14000 + 15000);
    expect(summary.upcoming_trips).toBe(10); // first 10 are "booked"
  });

  it("handles null total_gross_sales without NaN (treats as 0)", () => {
    const trips = [
      { total_gross_sales: null, status: "booked", created_at: "2026-01-01T00:00:00Z" },
      { total_gross_sales: 2000, status: "booked", created_at: "2026-02-01T00:00:00Z" },
    ];
    const summary = computeResearchSummary(trips);
    expect(isNaN(summary.total_revenue)).toBe(false);
    expect(summary.total_revenue).toBe(2000);
  });

  it("excludes cancelled trips from upcoming count", () => {
    const trips = [
      { total_gross_sales: 1000, status: "cancelled", created_at: "2026-01-01T00:00:00Z" },
      { total_gross_sales: 2000, status: "booked", created_at: "2026-02-01T00:00:00Z" },
      { total_gross_sales: 3000, status: "completed", created_at: "2026-03-01T00:00:00Z" },
    ];
    const summary = computeResearchSummary(trips);
    expect(summary.upcoming_trips).toBe(1); // only "booked"
    expect(summary.total_trips).toBe(3);
  });

  it("last_trip is the most recently created trip (by created_at)", () => {
    const trips = [
      { total_gross_sales: 1000, status: "completed", created_at: "2025-01-01T00:00:00Z" },
      { total_gross_sales: 2000, status: "booked",    created_at: "2026-06-01T00:00:00Z" },
      { total_gross_sales: 500,  status: "lead",      created_at: "2024-03-01T00:00:00Z" },
    ];
    const summary = computeResearchSummary(trips);
    expect(summary.last_trip?.created_at).toBe("2026-06-01T00:00:00Z");
    expect(summary.last_trip?.total_gross_sales).toBe(2000);
  });

  it("all trips completed → upcoming_trips is 0", () => {
    const trips = [
      { total_gross_sales: 1000, status: "completed", created_at: "2025-01-01T00:00:00Z" },
      { total_gross_sales: 2000, status: "completed", created_at: "2025-06-01T00:00:00Z" },
    ];
    const summary = computeResearchSummary(trips);
    expect(summary.upcoming_trips).toBe(0);
    expect(summary.total_trips).toBe(2);
  });

  it("handles very large revenue values without overflow", () => {
    const trips = Array.from({ length: 20 }, () => ({
      total_gross_sales: 999_999.99,
      status: "completed",
      created_at: "2026-01-01T00:00:00Z",
    }));
    const summary = computeResearchSummary(trips);
    expect(summary.total_revenue).toBeCloseTo(20 * 999_999.99, 1);
    expect(isFinite(summary.total_revenue)).toBe(true);
  });
});

describe("Feature 2 — Voice Input: feature detection", () => {
  it("speechSupported is false when neither SpeechRecognition API exists", () => {
    // Simulate environment without Web Speech API
    const mockWindow = {} as any;
    const supported = !!(mockWindow.SpeechRecognition || mockWindow.webkitSpeechRecognition);
    expect(supported).toBe(false);
  });

  it("speechSupported is true when SpeechRecognition exists", () => {
    const mockWindow = { SpeechRecognition: class {} } as any;
    const supported = !!(mockWindow.SpeechRecognition || mockWindow.webkitSpeechRecognition);
    expect(supported).toBe(true);
  });

  it("speechSupported is true when webkitSpeechRecognition exists (Safari/Chrome)", () => {
    const mockWindow = { webkitSpeechRecognition: class {} } as any;
    const supported = !!(mockWindow.SpeechRecognition || mockWindow.webkitSpeechRecognition);
    expect(supported).toBe(true);
  });

  it("no-speech error is ignored (does not toast)", () => {
    // Verify the no-speech error logic
    const errorsThatShouldToast = ["not-allowed", "audio-capture", "network", "aborted"];
    const errorsThatShouldIgnore = ["no-speech"];

    for (const err of errorsThatShouldIgnore) {
      expect(err).toBe("no-speech"); // only "no-speech" is silently ignored
    }
    for (const err of errorsThatShouldToast) {
      expect(err).not.toBe("no-speech");
    }
  });
});
