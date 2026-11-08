import type { Curriculum } from "@sbi/taxonomy/curriculum";

export type CurriculumChoice = Curriculum | "none";

export interface CurriculumPref {
  curriculum: CurriculumChoice;
  level?: string;
}

export const CURRICULUM_CHOICES: readonly CurriculumChoice[] = ["none", "us", "ng"];
const KEY = "sbi.curriculum";
const NONE: CurriculumPref = { curriculum: "none" };

// Device only (local storage): the choice is never sent to the server, so nothing about it is stored.
export function readCurriculum(storage?: Pick<Storage, "getItem">): CurriculumPref {
  try {
    const raw = (storage ?? window.localStorage).getItem(KEY);
    if (!raw) return NONE;
    const value = JSON.parse(raw) as { curriculum?: unknown; level?: unknown };
    if (!CURRICULUM_CHOICES.includes(value.curriculum as CurriculumChoice)) return NONE;
    const curriculum = value.curriculum as CurriculumChoice;
    const level =
      typeof value.level === "string" && curriculum !== "none" ? value.level : undefined;
    return level ? { curriculum, level } : { curriculum };
  } catch {
    return NONE;
  }
}

export function writeCurriculum(pref: CurriculumPref, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? window.localStorage).setItem(KEY, JSON.stringify(pref));
  } catch {
    // Private browsing can refuse storage; the choice then lasts until the page closes.
  }
}
