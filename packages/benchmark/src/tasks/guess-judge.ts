import type { LlmProvider } from "@sbi/llm";
import { z } from "zod";
import type { LessonDraft } from "./lesson";

export const GUESS_JUDGE_PROMPT_VERSION = "guess-judge-p0.2";

const SYSTEM_PROMPT = `You review multiple-choice guesses in science lessons for learners aged 8 and up.
For each numbered guess, decide whether it fits. Wrong options are meant to be wrong; that is not a problem. It fits when both hold:
- every option is a possible answer to the question exactly as asked, even if wrong (if it asks what happens to a plunger, every option says what the plunger does);
- the marked answer is the correct one.
Set fits to false only if one of these fails, and give the problem in one short sentence; otherwise problem is null.`;

const Verdicts = z.object({
  verdicts: z.array(
    z.object({ index: z.int(), fits: z.boolean(), problem: z.string().nullable() }),
  ),
});

const VERDICTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "fits", "problem"],
        properties: {
          index: { type: "integer" },
          fits: { type: "boolean" },
          problem: { type: ["string", "null"] },
        },
      },
    },
  },
};

export interface GuessJudgement {
  checked: number;
  fits: number;
  problems: { step: string; question: string; problem: string }[];
}

/** Has a second model check that each guess's options answer its question, which schemas can't. */
export async function judgeGuesses(llm: LlmProvider, draft: LessonDraft): Promise<GuessJudgement> {
  const guessed = draft.steps.flatMap((step) =>
    step.guess ? [{ ...step, guess: step.guess }] : [],
  );
  if (!guessed.length) return { checked: 0, fits: 0, problems: [] };
  const listing = guessed
    .map(({ guess, ...step }, index) => {
      const options = guess.options.map((option, n) => `  ${n}. ${option}`).join("\n");
      return `Guess ${index}\nStep "${step.title}": ${step.text}\nQuestion: ${guess.question}\n${options}\nMarked answer: ${guess.answer}`;
    })
    .join("\n\n");
  const completion = await llm.complete({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: listing },
    ],
    jsonSchema: { name: "GuessVerdicts", schema: VERDICTS_SCHEMA },
    maxTokens: 4000,
  });
  const { verdicts } = Verdicts.parse(JSON.parse(completion.text));
  const problems = verdicts.flatMap((verdict) => {
    const step = guessed[verdict.index];
    return verdict.fits || !step
      ? []
      : [{ step: step.title, question: step.guess.question, problem: verdict.problem ?? "" }];
  });
  return { checked: guessed.length, fits: guessed.length - problems.length, problems };
}
