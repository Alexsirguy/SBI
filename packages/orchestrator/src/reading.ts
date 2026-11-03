import type { Lesson } from "@sbi/contracts";
import { isSpanish } from "@sbi/safety";
import type { LessonCheck } from "./checks";

function syllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  const groups = cleaned.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

// Vowel groups, split where two strong vowels meet (hiato: "le-er"); accents mark strong too.
function syllablesEs(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, "");
  const groups = cleaned.match(/[aeiouáéíóúü]+/g) ?? [];
  const strong = /[aeoáéíóú]/;
  let count = 0;
  for (const group of groups) {
    count += 1;
    for (let index = 1; index < group.length; index += 1) {
      if (strong.test(group[index - 1] ?? "") && strong.test(group[index] ?? "")) count += 1;
    }
  }
  return Math.max(1, count);
}

/** Reading ease over section text, higher is easier: Flesch, or Fernández-Huerta for Spanish. */
export function readingEase(text: string, locale?: string): number {
  if (isSpanish(locale)) {
    const sentences = text.split(/[.!?¡¿]+/).filter((part) => part.trim().length > 0);
    const words = text.split(/\s+/).filter((part) => /[\p{L}\d]/u.test(part));
    if (sentences.length === 0 || words.length === 0) return 100;
    const per100 = (100 * words.reduce((sum, word) => sum + syllablesEs(word), 0)) / words.length;
    return 206.84 - 0.6 * per100 - 1.02 * (words.length / sentences.length);
  }
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 0);
  const words = text.split(/\s+/).filter((part) => part.length > 0);
  if (sentences.length === 0 || words.length === 0) return 100;
  const perSentence = words.length / sentences.length;
  const perWord = words.reduce((total, word) => total + syllables(word), 0) / words.length;
  return 206.835 - 1.015 * perSentence - 84.6 * perWord;
}

// Technical sets no ceiling: complexity is allowed there, not required.
const FLOOR: Record<Lesson["readingLevel"], number> = { simple: 55, plain: 30, technical: -1000 };

// Steps, task prompts and feedback are read by the learner too; ". " keeps each its own sentence.
function lessonProse(lesson: Lesson): string {
  return [
    ...lesson.sections.flatMap((section) => [
      section.text,
      ...(section.steps ?? []).map((step) => step.text),
    ]),
    ...lesson.tasks.flatMap((task) => [task.prompt, ...task.feedback]),
  ].join(". ");
}

export const readingLevelCheck: LessonCheck = {
  name: "reading-level",
  async run(lesson) {
    const ease = readingEase(lessonProse(lesson), lesson.locale);
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
