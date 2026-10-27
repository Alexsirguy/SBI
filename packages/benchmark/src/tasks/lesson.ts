import {
  Lesson,
  LessonModule,
  lessonContentHash,
  newId,
  type AudienceBand,
  type ReadingLevel,
} from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import { z } from "zod";
import type { SeedPrompt } from "../seed-set";

type ReadingLevelValue = z.infer<typeof ReadingLevel>;

export const LESSON_PROMPT_VERSION = "lesson-p0.1";

const DraftClaim = z.object({
  claimId: z.string(),
  text: z.string(),
  status: z.enum(["supported", "qualified", "disputed", "unsupported"]),
  confidence: z.enum(["high", "medium", "low"]),
  sourceIds: z.array(z.string()),
  uncertainty: z.string().nullable(),
});

export const LessonDraft = z.object({
  title: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()),
  misconceptionNotes: z.array(z.string()),
  concepts: z.array(z.object({ conceptId: z.string(), label: z.string() })),
  sections: z.array(
    z.object({ module: LessonModule, text: z.string(), claimIds: z.array(z.string()) }),
  ),
  claims: z.array(DraftClaim),
  sources: z.array(z.object({ sourceId: z.string(), title: z.string(), url: z.string() })),
});

export type LessonDraft = z.infer<typeof LessonDraft>;

const strictObject = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const strings = { type: "array", items: { type: "string" } };

export const LESSON_DRAFT_SCHEMA = strictObject({
  title: { type: "string" },
  summary: { type: "string" },
  learningObjectives: strings,
  misconceptionNotes: strings,
  concepts: {
    type: "array",
    items: strictObject({ conceptId: { type: "string" }, label: { type: "string" } }),
  },
  sections: {
    type: "array",
    items: strictObject({
      module: { type: "string", enum: LessonModule.options },
      text: { type: "string" },
      claimIds: strings,
    }),
  },
  claims: {
    type: "array",
    items: strictObject({
      claimId: { type: "string" },
      text: { type: "string" },
      status: { type: "string", enum: ["supported", "qualified", "disputed", "unsupported"] },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      sourceIds: strings,
      uncertainty: { type: ["string", "null"] },
    }),
  },
  sources: {
    type: "array",
    items: strictObject({
      sourceId: { type: "string" },
      title: { type: "string" },
      url: { type: "string" },
    }),
  },
});

const READING_LEVEL: Record<AudienceBand, ReadingLevelValue> = {
  child: "simple",
  teen: "plain",
  adult: "plain",
  general: "plain",
};

const SYSTEM_PROMPT = `You write short, accurate science lessons about everyday objects.
Write one section for each of these modules, in this order: ${LessonModule.options.join(", ")}.
"short-answer" answers the learner's question in 1-2 sentences. Later modules go deeper, step by step.
Every factual statement belongs to a claim. Each claim cites sourceIds from your sources list; use only real, well-known reference pages (encyclopedias, textbooks, institutions) whose URL you are confident exists.
If you are not sure a claim is supported, mark it "qualified" or "unsupported" and explain in uncertainty; otherwise set uncertainty to null.
The "history" section must cite at least one claim. If the question contains a misconception, correct it kindly and record it in misconceptionNotes.
Use ids made of letters, digits and dashes.`;

export function lessonMessages(prompt: SeedPrompt) {
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Object: ${prompt.label}\nLearner question: ${prompt.question}\nAudience: ${prompt.audience}, reading level ${READING_LEVEL[prompt.audience]}.`,
    },
  ];
}

export async function generateDraft(llm: LlmProvider, prompt: SeedPrompt) {
  const completion = await llm.complete({
    messages: lessonMessages(prompt),
    jsonSchema: { name: "LessonDraft", schema: LESSON_DRAFT_SCHEMA },
    maxTokens: 8000,
  });
  return { completion, draft: LessonDraft.parse(JSON.parse(completion.text)) };
}

/** Wraps a model draft in lesson metadata so it can be checked against the Lesson contract. */
export async function draftToLesson(
  draft: LessonDraft,
  prompt: SeedPrompt,
  meta: { provider: string; model: string; generatedAt: string },
): Promise<unknown> {
  // Models write readable ids; the contract wants UUIDs, so map each one consistently.
  const uuids = new Map<string, string>();
  const uuidFor = (id: string) => uuids.get(id) ?? uuids.set(id, newId()).get(id) ?? "";
  const lesson = {
    lessonId: newId(),
    version: 1,
    taxonomyId: prompt.taxonomyId,
    title: draft.title,
    locale: "en",
    audience: [prompt.audience],
    readingLevel: READING_LEVEL[prompt.audience],
    summary: draft.summary,
    learningObjectives: draft.learningObjectives,
    assumptions: [],
    concepts: draft.concepts.map((concept) => ({ ...concept, prerequisites: [] })),
    misconceptionNotes: draft.misconceptionNotes,
    sections: draft.sections.map((section, index) => ({
      sectionId: `s${index + 1}`,
      ...section,
      claimIds: section.claimIds.map(uuidFor),
    })),
    claims: draft.claims.map(({ uncertainty, claimId, sourceIds, ...claim }) => ({
      ...claim,
      claimId: uuidFor(claimId),
      sourceIds: sourceIds.map((id) => uuidFor(`source:${id}`)),
      scope: prompt.label,
      dependsOn: [],
      ...(uncertainty ? { uncertainty } : {}),
    })),
    visuals: [],
    safetyClass: "low",
    reviewStatus: "generated",
    reuse: {
      intentSignature: `${prompt.taxonomyId}:${prompt.id}`,
      cacheScope: "private",
      generatedAt: meta.generatedAt,
      evidenceSnapshotId: newId(),
      sourceFreshness: "unknown",
      modelVersion: meta.model,
      promptVersion: LESSON_PROMPT_VERSION,
      policyVersion: "p0",
      contentHash: "0".repeat(64),
    },
  };
  lesson.reuse.contentHash = await lessonContentHash(lesson as unknown as Lesson);
  return lesson;
}

export interface LessonScore {
  schemaValid: boolean;
  issues: string[];
  modulesCovered: number;
  allSourcesCited: boolean;
}

export function scoreLesson(draft: LessonDraft, lesson: unknown): LessonScore {
  const parsed = Lesson.safeParse(lesson);
  const sourceIds = new Set(draft.sources.map((source) => source.sourceId));
  return {
    schemaValid: parsed.success,
    issues: parsed.success ? [] : parsed.error.issues.slice(0, 5).map((issue) => issue.message),
    modulesCovered: new Set(draft.sections.map((section) => section.module)).size,
    allSourcesCited: draft.claims.every((claim) =>
      claim.sourceIds.every((id) => sourceIds.has(id)),
    ),
  };
}
