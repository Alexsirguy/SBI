import { describe, expect, it } from "vitest";
import {
  CLASS_METRICS,
  isoWeek,
  summariseClass,
  weeksBefore,
  type ClassActivityCount,
} from "./classroom";

const row = (week: string, metric: ClassActivityCount["metric"], count: number) => ({
  count,
  metric,
  week,
});

describe("isoWeek", () => {
  it("follows ISO 8601, including weeks that cross New Year", () => {
    expect(isoWeek(new Date("2026-11-08T12:00:00Z"))).toBe("2026-W45");
    expect(isoWeek(new Date("2026-11-09T00:00:00Z"))).toBe("2026-W46");
    expect(isoWeek(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(isoWeek(new Date("2025-12-29T12:00:00Z"))).toBe("2026-W01");
    expect(weeksBefore(new Date("2026-11-08T12:00:00Z"), 52)).toBe("2025-W45");
  });
});

describe("summariseClass", () => {
  it("shows counts of five or more, and zeros, newest week first", () => {
    const table = summariseClass([
      row("2026-W44", "lesson_opened", 12),
      row("2026-W45", "lesson_opened", 30),
      row("2026-W45", "check_answered", 25),
      row("2026-W45", "check_correct", 18),
    ]);
    expect(table.weeks.map((week) => week.week)).toEqual(["2026-W45", "2026-W44"]);
    expect(table.weeks[0]?.counts).toEqual({
      check_answered: 25,
      check_correct: 18,
      lesson_opened: 30,
      visual_used: 0,
    });
    expect(table.totals.lesson_opened).toBe(42);
    expect(table.minCount).toBe(5);
  });

  it("hides any count from 1 to 4", () => {
    const table = summariseClass([
      row("2026-W45", "check_correct", 3),
      row("2026-W44", "check_correct", 2),
      row("2026-W43", "check_correct", 9),
    ]);
    expect(table.weeks.map((week) => week.counts.check_correct)).toEqual([null, null, 9]);
  });

  it("hides a second cell when a shown total would give the only small one away", () => {
    const table = summariseClass([
      row("2026-W45", "check_correct", 2),
      row("2026-W44", "check_correct", 7),
      row("2026-W43", "check_correct", 20),
    ]);
    // Total 29 is shown, so W44 (the next smallest) is hidden too: 29 - 20 can't be split.
    expect(table.weeks.map((week) => week.counts.check_correct)).toEqual([null, null, 20]);
    expect(table.totals.check_correct).toBe(29);
  });

  it("hides the total when it is the only thing left that could reveal a small count", () => {
    const one = summariseClass([
      row("2026-W45", "lesson_opened", 2),
      row("2026-W44", "lesson_opened", 0),
    ]);
    expect(one.totals.lesson_opened).toBeNull();
    const lone = summariseClass([
      row("2026-W45", "lesson_opened", 9),
      row("2026-W44", "lesson_opened", 3),
    ]);
    expect(lone.weeks.map((week) => week.counts.lesson_opened)).toEqual([null, null]);
    expect(lone.totals.lesson_opened).toBe(12);
  });

  it("never puts a pupil, visit or time finer than a week in the table", () => {
    const table = summariseClass([row("2026-W45", "visual_used", 8)]);
    expect(Object.keys(table)).toEqual(["minCount", "totals", "weeks"]);
    expect(Object.keys(table.weeks[0] ?? {})).toEqual(["counts", "week"]);
    expect(Object.keys(table.weeks[0]?.counts ?? {})).toEqual([...CLASS_METRICS]);
  });
});
