import { describe, it, expect } from "vitest";
import { computeStreaks } from "./streaks";

describe("computeStreaks", () => {
  describe("empty input", () => {
    it("returns 0,0 for empty list", () => {
      expect(computeStreaks([], "2026-03-15")).toEqual({ currentStreak: 0, longestStreak: 0 });
    });
  });

  describe("single check-in", () => {
    it("current=1 if checked in today", () => {
      expect(computeStreaks(["2026-03-15"], "2026-03-15")).toEqual({
        currentStreak: 1,
        longestStreak: 1,
      });
    });

    it("current=0 if checked in yesterday (streak alive)", () => {
      expect(computeStreaks(["2026-03-14"], "2026-03-15")).toEqual({
        currentStreak: 1,
        longestStreak: 1,
      });
    });

    it("current=0 if checked in 3 days ago (streak dead)", () => {
      expect(computeStreaks(["2026-03-12"], "2026-03-15")).toEqual({
        currentStreak: 0,
        longestStreak: 1,
      });
    });
  });

  describe("consecutive days", () => {
    it("5 consecutive days ending today", () => {
      const days = ["2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 5,
        longestStreak: 5,
      });
    });

    it("5 consecutive days ending yesterday", () => {
      const days = ["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 5,
        longestStreak: 5,
      });
    });

    it("streak alive even if today is not logged", () => {
      const days = ["2026-03-13", "2026-03-14"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 2,
        longestStreak: 2,
      });
    });
  });

  describe("gap in history", () => {
    it("current streak breaks at gap", () => {
      // days: 10, 11, gap at 12, 13, 14, 15
      const days = ["2026-03-10", "2026-03-11", "2026-03-13", "2026-03-14", "2026-03-15"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 3, // 13, 14, 15
        longestStreak: 3,
      });
    });

    it("longest streak found even if current is broken", () => {
      // two runs: 10-14 (5 days), then gap, then 16-17 (2 days)
      const days = [
        "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14",
        "2026-03-16", "2026-03-17",
      ];
      expect(computeStreaks(days, "2026-03-20")).toEqual({
        currentStreak: 0, // streak dead (last log was 3 days ago)
        longestStreak: 5, // the 10-14 run
      });
    });
  });

  describe("backfill scenarios", () => {
    it("backfilling a gap merges two runs into one", () => {
      // was: 10,11,  14,15 — gap at 12,13
      // fill 12, 13 — now 10-15 is one run of 6
      const before = ["2026-03-10", "2026-03-11", "2026-03-14", "2026-03-15"];
      expect(computeStreaks(before, "2026-03-15")).toEqual({
        currentStreak: 2,  // 14, 15
        longestStreak: 2,
      });

      const after = [
        "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13",
        "2026-03-14", "2026-03-15",
      ];
      expect(computeStreaks(after, "2026-03-15")).toEqual({
        currentStreak: 6,
        longestStreak: 6,
      });
    });

    it("backfilling into the past extends longest but not current", () => {
      // current run: 14, 15. Old isolated: 5, 6, 7.
      // After filling: longest = 3 (5-7), current = 2 (14-15)
      const days = ["2026-03-05", "2026-03-06", "2026-03-07", "2026-03-14", "2026-03-15"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 2,
        longestStreak: 3,
      });
    });
  });

  describe("unsorted / duplicate input", () => {
    it("handles unsorted days", () => {
      const days = ["2026-03-15", "2026-03-13", "2026-03-14", "2026-03-12"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 4,
        longestStreak: 4,
      });
    });

    it("deduplicates entries (defensive, should be prevented by DB)", () => {
      const days = ["2026-03-15", "2026-03-15", "2026-03-14"];
      expect(computeStreaks(days, "2026-03-15")).toEqual({
        currentStreak: 2,
        longestStreak: 2,
      });
    });
  });

  describe("the SOP worked example — Asia/Kolkata check-ins", () => {
    // A: 2026-03-10T14:30Z → local day 2026-03-10
    // B: 2026-03-11T10:30Z → local day 2026-03-11
    // C: 2026-03-11T21:30Z → local day 2026-03-12
    // D: 2026-03-12T17:30Z → local day 2026-03-12 (duplicate of C)
    // After A+B+C: streak = 3 (10, 11, 12)
    // D is duplicate → streak stays 3

    it("A only → streak 1", () => {
      expect(computeStreaks(["2026-03-10"], "2026-03-12")).toEqual({
        currentStreak: 0, // dead (last log was 2 days ago)
        longestStreak: 1,
      });
    });

    it("A+B → streak 2 (different local days despite 20h apart)", () => {
      expect(computeStreaks(["2026-03-10", "2026-03-11"], "2026-03-12")).toEqual({
        currentStreak: 2, // alive: ends yesterday, consecutive
        longestStreak: 2,
      });
    });

    it("A+B+C → streak 3 (20h apart but new local day)", () => {
      expect(computeStreaks(["2026-03-10", "2026-03-11", "2026-03-12"], "2026-03-12")).toEqual({
        currentStreak: 3,
        longestStreak: 3,
      });
    });

    it("A+B+C+D (duplicate filtered) → streak stays 3", () => {
      // D lands on same local day as C → after dedup, same as above
      expect(computeStreaks(["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-12"], "2026-03-12")).toEqual({
        currentStreak: 3,
        longestStreak: 3,
      });
    });
  });
});
