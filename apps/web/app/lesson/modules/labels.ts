import { type LessonModule, MERRILL_MODULES } from "@sbi/contracts";
import type { LessonKey } from "../lesson-t";

/** New lessons follow Merrill's First Principles, so the steps shown while writing are these. */
export const MODULES: readonly LessonModule[] = MERRILL_MODULES;

/** Each module's name in the `lesson` messages. */
export const MODULE_LABEL_KEYS: Record<LessonModule, LessonKey> = {
  "what-youre-seeing": "moduleWhatYoureSeeing",
  "short-answer": "moduleShortAnswer",
  "first-principles": "moduleFirstPrinciples",
  "how-parts-work": "moduleHowPartsWork",
  "try-an-idea": "moduleTryAnIdea",
  history: "moduleHistory",
  "check-thinking": "moduleCheckThinking",
  "go-further": "moduleGoFurther",
  problem: "moduleProblem",
  activate: "moduleActivate",
  demonstrate: "moduleDemonstrate",
  apply: "moduleApply",
  integrate: "moduleIntegrate",
};
