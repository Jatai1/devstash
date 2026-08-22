import { describe, expect, it } from "vitest";

import { formatLongDate, formatShortDate } from "@/lib/format";

describe("formatShortDate", () => {
  it("formats a Date as a short month and day", () => {
    expect(formatShortDate(new Date("2026-01-15T12:00:00Z"))).toBe("Jan 15");
  });

  it("accepts an ISO string as well as a Date", () => {
    // Prisma returns a `Date`, but the same helper renders dates that arrive as
    // strings, so both have to produce the same output.
    expect(formatShortDate("2026-01-15T12:00:00Z")).toBe("Jan 15");
  });

  it("reads the date in UTC rather than the runner's timezone", () => {
    // 02:00 UTC is still the previous day everywhere west of Greenwich. The
    // formatter is pinned to UTC precisely so the server and the browser cannot
    // disagree about which day a timestamp falls on, so this must say "Jan 16"
    // no matter what `TZ` the test process runs under.
    expect(formatShortDate("2026-01-16T02:00:00Z")).toBe("Jan 16");
  });
});

describe("formatLongDate", () => {
  it("carries the year, unlike the short form", () => {
    expect(formatLongDate("2026-01-15T12:00:00Z")).toBe("January 15, 2026");
  });

  it("is pinned to UTC too", () => {
    expect(formatLongDate("2026-01-16T02:00:00Z")).toBe("January 16, 2026");
  });
});
