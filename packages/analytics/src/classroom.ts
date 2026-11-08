/** The only things a class summary counts (ADR 0027); none of them names or follows a pupil. */
export const CLASS_METRICS = [
  "lesson_opened",
  "check_answered",
  "check_correct",
  "visual_used",
] as const;
export type ClassMetric = (typeof CLASS_METRICS)[number];

/** Any count below this is shown as "fewer than 5", so no one pupil can be picked out. */
export const CLASS_MIN_COUNT = 5;

/** How many weeks of counts a class keeps before the retention pass deletes them. */
export const CLASS_ACTIVITY_WEEKS = 52;

export interface ClassActivityCount {
  /** ISO week, e.g. "2026-W45". */
  week: string;
  metric: ClassMetric;
  count: number;
}

/** A shown count, or null where it is hidden. */
export type Cell = number | null;

export interface ClassSummaryTable {
  weeks: { week: string; counts: Record<ClassMetric, Cell> }[];
  totals: Record<ClassMetric, Cell>;
  minCount: number;
}

/** The ISO 8601 week a moment falls in, in UTC: weeks start on Monday. */
export function isoWeek(at: Date): string {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  // Thursday decides the year, so the days around New Year land in the right week.
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The ISO week `weeks` weeks before `at`. */
export function weeksBefore(at: Date, weeks: number): string {
  return isoWeek(new Date(at.getTime() - weeks * 7 * 86_400_000));
}

const empty = (): Record<ClassMetric, number> =>
  Object.fromEntries(CLASS_METRICS.map((metric) => [metric, 0])) as Record<ClassMetric, number>;

// Small counts are hidden, plus a second cell where a shown total would give a hidden one away.
/** Weekly counts for one class, safe to show its teacher. */
export function summariseClass(rows: readonly ClassActivityCount[]): ClassSummaryTable {
  const byWeek = new Map<string, Record<ClassMetric, number>>();
  for (const row of rows) {
    const counts = byWeek.get(row.week) ?? empty();
    counts[row.metric] += row.count;
    byWeek.set(row.week, counts);
  }
  const weeks = [...byWeek.keys()].sort().reverse();
  const hidden = new Set<string>();
  const totals = {} as Record<ClassMetric, Cell>;

  for (const metric of CLASS_METRICS) {
    const column = weeks.map((week) => ({ week, count: byWeek.get(week)?.[metric] ?? 0 }));
    const total = column.reduce((sum, cell) => sum + cell.count, 0);
    // A zero gives nothing away, so it is shown; small non-zero counts are not.
    const small = column.filter((cell) => cell.count > 0 && cell.count < CLASS_MIN_COUNT);
    for (const cell of small) hidden.add(`${cell.week}|${metric}`);
    const totalShown = total === 0 || total >= CLASS_MIN_COUNT;
    if (totalShown && small.length === 1) {
      const next = column
        .filter((cell) => cell.count > 0 && !hidden.has(`${cell.week}|${metric}`))
        .sort((a, b) => a.count - b.count)[0];
      if (next) hidden.add(`${next.week}|${metric}`);
      // With nothing else to hide, the total itself would reveal the one small cell.
      totals[metric] = next ? total : null;
    } else {
      totals[metric] = totalShown ? total : null;
    }
  }

  return {
    minCount: CLASS_MIN_COUNT,
    totals,
    weeks: weeks.map((week) => {
      const counts = byWeek.get(week) ?? empty();
      return {
        counts: Object.fromEntries(
          CLASS_METRICS.map((metric) => [
            metric,
            hidden.has(`${week}|${metric}`) ? null : counts[metric],
          ]),
        ) as Record<ClassMetric, Cell>,
        week,
      };
    }),
  };
}
