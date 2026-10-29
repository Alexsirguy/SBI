import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  Lesson,
  LessonVisuals,
  QuickAnswer,
  newId,
  type Claim,
  type LessonRequest,
} from "@sbi/contracts";
import { createCitationResolver, type EvidenceRepositories } from "@sbi/evidence";
import { type LlmProvider } from "@sbi/llm";
import {
  buildIntentSignature,
  citationCheck,
  createContradictionCheck,
  createEntailmentCheck,
  createEvidenceCheck,
  createPublisher,
  createReuseMatcher,
  generateDraft,
  misconceptionCheck,
  readingLevelCheck,
  runLessonChecks,
  runWithFallback,
  schemaCheck,
  type CheckReport,
  type LessonRepository,
  type RightsGate,
  type TaxonomyLessonLookup,
} from "@sbi/orchestrator";
import { sourcedFacts, type Taxonomy } from "@sbi/taxonomy";
import { LESSON_EVIDENCE, LESSON_LLM, LESSONS, TAXONOMY } from "../tokens";
import { UserFacingException } from "../common/user-facing.exception";

const UNAVAILABLE = "Lesson generation is unavailable right now. Try again later.";
const UNKNOWN_CATEGORY = "Unknown category.";
const NO_COVERAGE = "No lesson coverage for this category yet.";
const HELD = "A reviewer needs to check this lesson before we can show it. Try again later.";

// Policy versions come from E8; one stable value keeps reuse matching exact until then.
export const LESSON_POLICY_VERSION = "1";

// Topics the E4 gate flagged as unsafe to teach without review; the client cannot lower them.
// TODO(#67) replace with the server-side safety classifier.
const HIGH_RISK_ENTRIES = new Set([
  "category.household-chemicals",
  "object.electrical-socket",
  "object.mushroom",
]);

const SAFETY_ORDER = ["low", "medium", "high"] as const;

export function effectiveSafetyClass(
  requested: LessonRequest["safetyClass"],
  entry: { id: string; parentId?: string },
): LessonRequest["safetyClass"] {
  const floor =
    HIGH_RISK_ENTRIES.has(entry.id) || HIGH_RISK_ENTRIES.has(entry.parentId ?? "") ? "high" : "low";
  return SAFETY_ORDER.indexOf(requested) >= SAFETY_ORDER.indexOf(floor) ? requested : floor;
}

// Drafts carry no visuals yet; any visual needs the rights register before it is served.
// TODO(#72) check visual assets against the rights register.
const VISUAL_RIGHTS: RightsGate = {
  check: async (lesson) =>
    lesson.visuals.length === 0
      ? { cleared: true }
      : { cleared: false, reason: "visual rights are not checked yet" },
};

export type LessonStreamEvent =
  | { type: "quick-answer"; data: QuickAnswer }
  | { type: "lesson"; data: Lesson }
  | { type: "visuals"; data: LessonVisuals };

function slug(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "concept";
  let candidate = base;
  for (let suffix = 2; taken.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
  taken.add(candidate);
  return candidate;
}

// A held lesson is not served; the failure path then offers a fallback or a retry.
function heldForReview(report: CheckReport, reasons: string[]): CheckReport {
  return {
    ...report,
    passed: false,
    results: [...report.results, { name: "review", passed: false, details: reasons }],
  };
}

@Injectable()
export class LessonService {
  constructor(
    @Inject(LESSON_LLM) private readonly provider: LlmProvider | null,
    @Inject(TAXONOMY) private readonly taxonomy: Taxonomy,
    @Inject(LESSONS) private readonly lessons: LessonRepository & TaxonomyLessonLookup,
    @Inject(LESSON_EVIDENCE) private readonly evidence: EvidenceRepositories,
  ) {}

  // Events leave as their stage completes, so the answer streams before the heavier payloads.
  async *streamLesson(request: LessonRequest): AsyncGenerator<LessonStreamEvent> {
    const provider = this.provider;
    if (!provider) throw new UserFacingException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
    const entry = this.taxonomy.get(request.taxonomyId);
    if (!entry) throw new UserFacingException(UNKNOWN_CATEGORY, HttpStatus.NOT_FOUND);
    const taken = new Set<string>();
    const concepts = this.taxonomy
      .concepts(request.taxonomyId)
      .map((label) => ({ conceptId: slug(label, taken), label, prerequisites: [] as string[] }));
    if (concepts.length === 0) throw new UserFacingException(NO_COVERAGE, HttpStatus.NOT_FOUND);
    const safetyClass = effectiveSafetyClass(request.safetyClass, entry);
    const stored = await this.evidence.claims.getMany(
      entry.facts.flatMap((fact) => (fact.claimId ? [fact.claimId] : [])),
    );
    const byId = new Map(stored.map((claim) => [claim.claimId, claim]));
    const usable: Claim[] = [];
    for (const fact of sourcedFacts(entry, (id) => byId.get(id)?.status)) {
      const claim = fact.claimId ? byId.get(fact.claimId) : undefined;
      if (claim) usable.push(claim);
    }
    if (usable.length === 0) throw new UserFacingException(NO_COVERAGE, HttpStatus.NOT_FOUND);

    const conceptIds = concepts.map((concept) => concept.conceptId);
    const intent = {
      question: request.question,
      taxonomyId: request.taxonomyId,
      conceptIds,
      audience: request.audience,
      readingLevel: request.readingLevel,
      locale: request.locale,
      safetyScope: safetyClass,
    };
    const hit = await createReuseMatcher(this.lessons).match({
      intent,
      assumptions: request.assumptions,
      policyVersion: LESSON_POLICY_VERSION,
      fresh: request.fresh,
    });
    const intentSignature = buildIntentSignature(intent);
    let lesson: Lesson;
    let kind: QuickAnswer["kind"];
    if (hit) {
      lesson = hit.lesson;
      kind = "cached";
    } else {
      let held = false;
      const outcome = await runWithFallback(
        this.lessons,
        async () => {
          const draft = await generateDraft(
            {
              intentSignature,
              question: request.question,
              taxonomyId: request.taxonomyId,
              locale: request.locale,
              audience: [request.audience],
              readingLevel: request.readingLevel,
              safetyClass,
              concepts,
              claims: usable,
              evidenceSnapshotId: newId(),
              policyVersion: LESSON_POLICY_VERSION,
            },
            { provider },
          );
          const { lesson: checked, report } = await runLessonChecks(draft, [
            schemaCheck,
            citationCheck,
            misconceptionCheck,
            readingLevelCheck,
            createEvidenceCheck({
              resolver: createCitationResolver(this.evidence),
              sources: (ids) => this.evidence.sources.getMany(ids),
            }),
            createEntailmentCheck(provider),
            createContradictionCheck(provider),
          ]);
          // High-risk, low-confidence, failed or rights-blocked lessons wait for a reviewer.
          const routed = await createPublisher({ rights: VISUAL_RIGHTS }).route(checked, report);
          await this.lessons.save(routed.lesson);
          if (routed.decision.action === "approve") return { lesson: routed.lesson, report };
          held = true;
          return { lesson: routed.lesson, report: heldForReview(report, routed.decision.reasons) };
        },
        {
          taxonomyIds: [request.taxonomyId, ...(entry.parentId ? [entry.parentId] : [])],
          locale: request.locale,
          audience: request.audience,
          safetyClass,
          policyVersion: LESSON_POLICY_VERSION,
        },
      );
      if (outcome.kind === "retry") {
        throw new UserFacingException(held ? HELD : outcome.reason, HttpStatus.SERVICE_UNAVAILABLE);
      }
      lesson = outcome.lesson;
      kind = outcome.kind;
    }

    const validated = Lesson.parse(lesson);
    const short = validated.sections.find((section) => section.module === "short-answer");
    yield {
      type: "quick-answer",
      data: QuickAnswer.parse({
        kind,
        lessonId: validated.lessonId,
        version: validated.version,
        title: validated.title,
        summary: validated.summary,
        shortAnswer: short?.text ?? validated.summary,
        reviewStatus: validated.reviewStatus,
        note:
          kind === "fallback"
            ? "Fresh generation failed; showing a related cached lesson."
            : undefined,
      }),
    };
    yield { type: "lesson", data: validated };
    yield {
      type: "visuals",
      data: LessonVisuals.parse({ lessonId: validated.lessonId, visuals: validated.visuals }),
    };
  }
}
