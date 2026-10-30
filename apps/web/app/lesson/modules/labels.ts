import { LessonModule } from "@sbi/contracts";

/** Reader order and names; every lesson has all eight (ADR 0011). */
export const MODULES: readonly LessonModule[] = LessonModule.options;

export const MODULE_LABELS: Record<LessonModule, string> = {
  "what-youre-seeing": "What you're seeing",
  "short-answer": "The short answer",
  "first-principles": "From first principles",
  "how-parts-work": "How the parts work",
  "try-an-idea": "Try an idea",
  history: "History",
  "check-thinking": "Check your thinking",
  "go-further": "Go further",
};
