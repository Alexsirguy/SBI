import { type LessonModule, MERRILL_MODULES } from "@sbi/contracts";

/** The eight modules of lessons drafted before ADR 0017, in reader order (ADR 0011). */
export const LEGACY_MODULES = [
  "what-youre-seeing",
  "short-answer",
  "first-principles",
  "how-parts-work",
  "try-an-idea",
  "history",
  "check-thinking",
  "go-further",
] as const satisfies readonly LessonModule[];

/** New lessons follow Merrill's First Principles, so the steps shown while writing are these. */
export const MODULES: readonly LessonModule[] = MERRILL_MODULES;

export const MODULE_LABELS: Record<LessonModule, string> = {
  "what-youre-seeing": "What you're seeing",
  "short-answer": "The short answer",
  "first-principles": "From first principles",
  "how-parts-work": "How the parts work",
  "try-an-idea": "Try an idea",
  history: "History",
  "check-thinking": "Check your thinking",
  "go-further": "Go further",
  problem: "The problem",
  activate: "What you already know",
  demonstrate: "Watch it work",
  apply: "Your turn",
  integrate: "Take it with you",
};
