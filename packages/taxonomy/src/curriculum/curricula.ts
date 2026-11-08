import { NIGERIA_INFO, NIGERIA_STANDARDS } from "./nigeria";
import { conceptKey, type Curriculum, type CurriculumInfo, type Standard } from "./schema";
import { US_INFO, US_STANDARDS } from "./us";

/** Every curriculum a learner or class can choose, with its standards. */
export const CURRICULA: Readonly<
  Record<Curriculum, CurriculumInfo & { standards: readonly Standard[] }>
> = {
  us: { ...US_INFO, standards: US_STANDARDS },
  ng: { ...NIGERIA_INFO, standards: NIGERIA_STANDARDS },
};

export interface Alignment {
  standard: Standard;
  /** The lesson concept it matched. */
  conceptKey: string;
  /** "partial" when the lesson concept only contains the standard's, e.g. "static friction". */
  match: "exact" | "partial";
}

export interface AlignmentOptions {
  level?: string;
}

const containsKey = (key: string, inner: string) => `-${key}-`.includes(`-${inner}-`);

/** Standards in one curriculum that a lesson's concepts teach, in level order, each once. */
export function alignmentsFor(
  conceptLabels: readonly string[],
  curriculum: Curriculum,
  options: AlignmentOptions = {},
): Alignment[] {
  const { levels, standards } = CURRICULA[curriculum];
  const keys = [...new Set(conceptLabels.map(conceptKey).filter(Boolean))];
  const found = new Map<string, Alignment>();
  for (const standard of standards) {
    if (options.level && standard.level !== options.level) continue;
    const exact = keys.find((key) => standard.concepts.includes(key));
    // Free-subject lessons (ADR 0013) name concepts in their own words, so a contained key counts.
    const partial = exact
      ? undefined
      : keys.find((key) => standard.concepts.some((inner) => containsKey(key, inner)));
    const key = exact ?? partial;
    if (!key || found.has(standard.code)) continue;
    found.set(standard.code, { standard, conceptKey: key, match: exact ? "exact" : "partial" });
  }
  const rank = (level: string) => levels.indexOf(level);
  return [...found.values()].sort(
    (a, b) =>
      rank(a.standard.level) - rank(b.standard.level) ||
      Number(a.match === "partial") - Number(b.match === "partial") ||
      a.standard.code.localeCompare(b.standard.code),
  );
}
