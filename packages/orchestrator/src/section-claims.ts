import type { Lesson } from "@sbi/contracts";

/** The claims a section rests on; apply's challenges carry its citations, so its text need not. */
export function sectionClaimIds(lesson: Lesson, section: Lesson["sections"][number]): string[] {
  if (section.module !== "apply") return section.claimIds;
  const tasks = lesson.tasks.filter((task) => task.module === "apply");
  return [...new Set([...section.claimIds, ...tasks.flatMap((task) => task.claimIds)])];
}
