import { describe, it, expect } from "vitest";
import { toLocalDay, todayIn, dayNumber, daysBetween, isValidTimezone } from "./days";

describe("isValidTimezone", () => {
  it("accepts valid IANA timezones", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Pacific/Auckland")).toBe(true);
  });

  it("rejects invalid timezones", () => {
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("Not/A/Timezone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });
});

describe("toLocalDay", () => {
  it("converts UTC instant to local day — the assignment worked example", () => {
    // Check-in A: 2026-03-10T14:30Z → local 2026-03-10 20:00 (Asia/Kolkata)
    expect(toLocalDay(new Date("2026-03-10T14:30:00Z"), "Asia/Kolkata")).toBe("2026-03-10");

    // Check-in B: 2026-03-11T10:30Z → local 2026-03-11 16:00
    expect(toLocalDay(new Date("2026-03-11T10:30:00Z"), "Asia/Kolkata")).toBe("2026-03-11");

    // Check-in C: 2026-03-11T21:30Z → local 2026-03-12 03:00 (next day!)
    expect(toLocalDay(new Date("2026-03-11T21:30:00Z"), "Asia/Kolkata")).toBe("2026-03-12");

    // Check-in D: 2026-03-12T17:30Z → local 2026-03-12 23:00 (same day as C)
    expect(toLocalDay(new Date("2026-03-12T17:30:00Z"), "Asia/Kolkata")).toBe("2026-03-12");
  });

  it("same UTC instant gives different local days across timezones", () => {
    const instant = new Date("2026-08-15T02:00:00Z");

    // UTC: Aug 15
    expect(toLocalDay(instant, "UTC")).toBe("2026-08-15");

    // Asia/Kolkata (UTC+5:30): 07:30 → Aug 15
    expect(toLocalDay(instant, "Asia/Kolkata")).toBe("2026-08-15");

    // America/New_York (UTC-4 EDT): 22:00 prev day → Aug 14
    expect(toLocalDay(instant, "America/New_York")).toBe("2026-08-14");

    // Pacific/Kiritimati (UTC+14): 16:00 → Aug 15
    expect(toLocalDay(instant, "Pacific/Kiritimati")).toBe("2026-08-15");

    // Pacific/Midway (UTC-11): 15:00 prev day → Aug 14
    expect(toLocalDay(instant, "Pacific/Midway")).toBe("2026-08-14");
  });

  it("handles DST boundary — America/New_York fall back", () => {
    // 2026-11-01 DST ends in US. Clocks fall back at 2:00 AM EDT → 1:00 AM EST
    // 05:30 UTC = 01:30 EDT (before fall back) → local day Nov 1
    const beforeFallback = new Date("2026-11-01T05:30:00Z");
    expect(toLocalDay(beforeFallback, "America/New_York")).toBe("2026-11-01");

    // 07:30 UTC = 02:30 EST (after fall back) → still Nov 1
    const afterFallback = new Date("2026-11-01T07:30:00Z");
    expect(toLocalDay(afterFallback, "America/New_York")).toBe("2026-11-01");
  });

  it("handles DST boundary — America/New_York spring forward", () => {
    // 2026-03-08 DST starts in US. Clocks spring forward at 2:00 AM EST → 3:00 AM EDT
    // 06:30 UTC = 01:30 EST (before spring forward) → local day Mar 8
    const beforeSpring = new Date("2026-03-08T06:30:00Z");
    expect(toLocalDay(beforeSpring, "America/New_York")).toBe("2026-03-08");

    // 08:30 UTC = 04:30 EDT (after spring forward) → still Mar 8
    const afterSpring = new Date("2026-03-08T08:30:00Z");
    expect(toLocalDay(afterSpring, "America/New_York")).toBe("2026-03-08");
  });

  it("handles midnight edge case", () => {
    // Just before midnight in Kolkata: 18:29:59 UTC = 23:59:59 IST → Mar 10
    expect(toLocalDay(new Date("2026-03-10T18:29:59Z"), "Asia/Kolkata")).toBe("2026-03-10");

    // Just after midnight in Kolkata: 18:30:00 UTC = 00:00:00 IST next day → Mar 11
    expect(toLocalDay(new Date("2026-03-10T18:30:00Z"), "Asia/Kolkata")).toBe("2026-03-11");
  });

  it("UTC timezone returns the UTC date", () => {
    expect(toLocalDay(new Date("2026-06-15T23:59:59Z"), "UTC")).toBe("2026-06-15");
    expect(toLocalDay(new Date("2026-06-15T00:00:00Z"), "UTC")).toBe("2026-06-15");
    expect(toLocalDay(new Date("2026-06-14T23:59:59Z"), "UTC")).toBe("2026-06-14");
  });
});

describe("todayIn", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const result = todayIn("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches toLocalDay with a fresh Date", () => {
    const now = new Date();
    expect(todayIn("Asia/Kolkata")).toBe(toLocalDay(now, "Asia/Kolkata"));
  });
});

describe("dayNumber", () => {
  it("returns a deterministic number for a date string", () => {
    const n = dayNumber("2026-03-10");
    expect(typeof n).toBe("number");
    expect(Number.isInteger(n)).toBe(true);
  });

  it("later dates produce larger numbers", () => {
    expect(dayNumber("2026-03-11")).toBeGreaterThan(dayNumber("2026-03-10"));
  });
});

describe("daysBetween", () => {
  it("returns 0 for same day", () => {
    expect(daysBetween("2026-03-10", "2026-03-10")).toBe(0);
  });

  it("returns positive for b after a", () => {
    expect(daysBetween("2026-03-10", "2026-03-11")).toBe(1);
    expect(daysBetween("2026-03-10", "2026-03-17")).toBe(7);
  });

  it("returns negative for b before a", () => {
    expect(daysBetween("2026-03-11", "2026-03-10")).toBe(-1);
  });

  it("handles month boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
  });

  it("handles year boundaries", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });

  it("handles large gaps", () => {
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
  });
});
