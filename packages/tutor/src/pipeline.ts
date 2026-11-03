import { randomUUID } from "node:crypto";
import type { TutorTurn, VisualManifest } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { isSpanish, SAFETY_POLICY_VERSION, type RiskClassifier } from "@sbi/safety";
import { answerTurn, TUTOR_ANSWER_PROMPT_VERSION } from "./answer";
import { assessTurn } from "./assess";
import { policyContext, type TutorLesson, type TutorQuestion } from "./context";
import { retrieveClaims } from "./retrieve";
import { validateVisualAction } from "./show";
import { validateAnswer } from "./validate";

/** One retry covers malformed output, a stray citation, an overlong reply or a repeat question. */
const ATTEMPTS = 2;

const FALLBACK = {
  en: "I couldn't answer that well just now. Try asking it another way.",
  es: "Ahora mismo no he podido responder bien. Prueba a preguntarlo de otra forma.",
};

export interface TutorDeps {
  provider: LlmProvider;
  classify: RiskClassifier;
  now?: () => Date;
  newId?: () => string;
  signal?: AbortSignal;
}

/** Policy context, risk, retrieval, a constrained answer and validation, in that order. */
export async function runTutorTurn(
  deps: TutorDeps,
  input: {
    lesson: TutorLesson;
    question: TutorQuestion;
    history: readonly TutorTurn[];
    /** The lesson's experiment visual, so "watch this" can only move what it really offers. */
    manifest?: VisualManifest;
  },
): Promise<TutorTurn> {
  const { lesson, question } = input;
  const context = policyContext(lesson, question, input.history, input.manifest);
  const base = {
    sessionId: question.sessionId,
    turnId: (deps.newId ?? randomUUID)(),
    lessonId: lesson.lessonId,
    lessonVersion: lesson.version,
    userText: question.text,
    retentionClass: "session" as const,
    createdAt: (deps.now?.() ?? new Date()).toISOString(),
  };

  const assessment = await assessTurn(deps.classify, {
    subject: lesson.title,
    text: question.text,
    audience: question.audience,
    locale: question.locale,
  });
  if (assessment.decision === "policy") {
    return {
      ...base,
      retrievedClaimIds: [],
      response: {
        text: assessment.policy.message,
        citedClaimIds: [],
        kind: "policy",
        policy: assessment.policy,
      },
      safetyCategory: assessment.category,
      modelVersion: "safety-policy",
      promptVersion: SAFETY_POLICY_VERSION,
    };
  }

  const retrieved = retrieveClaims(context.claims, question.text, context.history);
  const retrievedClaimIds = retrieved.map((claim) => claim.claimId);
  const justClarified = context.history.at(-1)?.clarifying === true;
  let modelVersion = deps.provider.model;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const { draft, completion } = await answerTurn(
      deps.provider,
      context,
      question.text,
      retrieved,
      deps.signal,
    );
    modelVersion = completion.model;
    const checked = draft
      ? validateAnswer(draft, retrieved, { justClarified, audience: question.audience })
      : undefined;
    if (!draft || !checked?.ok) continue;
    const visualAction =
      checked.kind === "clarifying" ? undefined : validateVisualAction(draft.show, context.show);
    return {
      ...base,
      retrievedClaimIds,
      response: {
        text: checked.text,
        citedClaimIds: checked.citedClaimIds,
        kind: checked.kind,
        ...(visualAction ? { visualAction } : {}),
      },
      safetyCategory: assessment.category,
      modelVersion,
      promptVersion: TUTOR_ANSWER_PROMPT_VERSION,
    };
  }
  return {
    ...base,
    retrievedClaimIds,
    response: {
      text: isSpanish(question.locale) ? FALLBACK.es : FALLBACK.en,
      citedClaimIds: [],
      kind: "fallback",
    },
    safetyCategory: assessment.category,
    modelVersion,
    promptVersion: TUTOR_ANSWER_PROMPT_VERSION,
  };
}
