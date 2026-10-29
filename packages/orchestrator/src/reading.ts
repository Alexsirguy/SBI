import type { Lesson } from "@sbi/contracts";
import type { LessonCheck } from "./checks";

function syllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  const groups = cleaned.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch reading ease over section text; higher is easier to read. */
export function readingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 0);
  const words = text.split(/\s+/).filter((part) => part.length > 0);
  if (sentences.length === 0 || words.length === 0) return 100;
  const perSentence = words.length / sentences.length;
  const perWord = words.reduce((total, word) => total + syllables(word), 0) / words.length;
  return 206.835 - 1.015 * perSentence - 84.6 * perWord;
}

// Technical sets no ceiling: complexity is allowed there, not required.
const FLOOR: Record<Lesson["readingLevel"], number> = { simple: 55, plain: 30, technical: -1000 };

export const readingLevelCheck: LessonCheck = {
  name: "reading-level",
  async run(lesson) {
    const ease = readingEase(lesson.sections.map((section) => section.text).join(" "));
    if (ease >= FLOOR[lesson.readingLevel]) {
      return { name: readingLevelCheck.name, passed: true, details: [] };
    }
    return {
      name: readingLevelCheck.name,
      passed: false,
      details: [
        `Reading ease ${Math.round(ease)} is below the ${lesson.readingLevel} floor of ${FLOOR[lesson.readingLevel]}`,
      ],
    };
  },
};
