import type { Lesson } from "@sbi/contracts";
import { activityReason, findUnsafeActivities, safeActivityRulesApply } from "@sbi/safety";
import type { LessonCheck, SectionFinding } from "./checks";

// The sections that suggest something to do; the rest explain, and the experiment is on screen.
const ACTIVITY_MODULES = new Set<Lesson["sections"][number]["module"]>([
  "integrate",
  "try-an-idea",
  "go-further",
]);

/** Fails any section that asks a possible child to do something hazardous (spec §12, #68). */
export const safeActivityCheck: LessonCheck = {
  name: "safe-activities",
  async run(lesson) {
    if (!safeActivityRulesApply(lesson.audience)) {
      return { name: safeActivityCheck.name, passed: true, details: [] };
    }
    const sections: SectionFinding[] = lesson.sections
      .filter((section) => ACTIVITY_MODULES.has(section.module))
      .flatMap((section) => {
        const findings = findUnsafeActivities(section.text);
        if (findings.length === 0) return [];
        return [{ sectionId: section.sectionId, reason: findings.map(activityReason).join(" ") }];
      });
    return {
      name: safeActivityCheck.name,
      passed: sections.length === 0,
      details: sections.map((finding) => `${finding.sectionId}: ${finding.reason}`),
      sections,
    };
  },
};
