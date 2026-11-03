import { isSpanish } from "@sbi/safety";

/**
 * The instruction that makes the model write for the learner's language. Empty for English,
 * so English prompts (and the prompt versions reuse matches on) stay exactly as they were.
 */
export function languageRule(locale: string | undefined): string {
  if (!isSpanish(locale)) return "";
  return "Language: write every learner-facing word (title, summary, objectives, headings, sections, steps, challenges, feedback, experiment labels, claims and questions) in Spanish (español), using tú. Keep ids, enum values and JSON keys exactly as specified, in English.";
}
