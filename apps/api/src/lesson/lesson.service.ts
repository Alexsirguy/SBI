import { HttpStatus, Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  Lesson,
  LessonProgress,
  LessonVisuals,
  type LessonSources,
  QuickAnswer,
  newId,
  type Claim,
  type LessonRequest,
} from "@sbi/contracts";
import {
  createCitationResolver,
  type EvidenceRepositories,
  type GatheredEvidence,
  type GatherEvent,
  type GatherOptions,
  type InquiryInput,
} from "@sbi/evidence";
import { LlmError, type LlmProvider } from "@sbi/llm";
import {
  buildIntentSignature,
  citationCheck,
  createContradictionCheck,
  createEntailmentCheck,
  createEvidenceCheck,
  createPublisher,
  createReuseMatcher,
  generateDraft,
  generateModelClaims,
  LESSON_DRAFT_PROMPT_VERSION,
  misconceptionCheck,
  readingLevelCheck,
  repairable,
  reviseSections,
  runLessonChecks,
  runWithFallback,
  schemaCheck,
  type CheckReport,
  type PublishAudit,
  type LessonRepository,
  type ReviewAuditLog,
  type RightsGate,
  type TaxonomyLessonLookup,
} from "@sbi/orchestrator";
import { sourcedFacts, type Taxonomy } from "@sbi/taxonomy";
import {
  LESSON_EVIDENCE,
  LESSON_GATHERER,
  LESSON_RIGHTS,
  VISUAL_MAKER,
  LESSON_LLM,
  LESSON_REVIEW_AUDIT,
  LESSONS,
  TAXONOMY,
} from "../tokens";
import { createEventQueue } from "./event-queue";
import { resolveSubject } from "./subject";
import type { VisualMaker } from "../visuals/visual-maker";
import { lessonSources } from "./sources";
import { UserFacingException } from "../common/user-facing.exception";

const UNAVAILABLE = "Lesson generation is unavailable right now. Try again later.";
const UNKNOWN_CATEGORY = "Unknown category.";
const NO_COVERAGE = "No lesson coverage for this category yet.";
const NO_EVIDENCE =
  "We could not find trusted sources for this question yet. Try asking it another way.";
// Enough to teach from first principles without an unbounded draft prompt.
const MAX_LESSON_CLAIMS = 30;
const HELD = "A reviewer needs to check this lesson before we can show it. Try again later.";

// Policy versions come from E8; one stable value keeps reuse matching exact until then.
export const LESSON_POLICY_VERSION = "1";

// Topics the E4 gate flagged as high risk; the client cannot lower them. Each carries the
// safety notice shown first with its lesson (ADR 0010). TODO(#67) server-side classifier.
const SAFETY_NOTICES: Readonly<Record<string, string>> = {
  "object.medicine-tablets":
    "Medicines: this lesson explains how medicines work in general, not how to use one. Never take or give a medicine because of this lesson; follow the label or a doctor or pharmacist. If someone may have taken too much, call your local poison control centre or emergency number.",
  "object.cleaning-products":
    "Cleaning products: this lesson explains the chemistry only. Never mix cleaning products or use one in a way its label does not say; some mixtures release toxic gas. If someone swallows or breathes one in, call your local poison control centre or emergency number.",
  "category.household-chemicals":
    "Household chemicals: this lesson explains the chemistry only. Never mix, taste or handle chemicals because of it; follow the label. If someone swallows or breathes one in, call your local poison control centre or emergency number.",
  "object.electrical-socket":
    "Electricity: this lesson explains the science only. Never put anything into a socket or open a plug, socket or appliance; mains electricity can kill. If someone gets a shock, switch off the power before touching them and call your local emergency number.",
  "object.mushroom":
    "Wild mushrooms: this lesson explains the biology only and cannot tell you whether a mushroom is safe. Never eat or taste a wild mushroom because of a photo or this lesson; some are deadly. If someone may have eaten one, call your local poison control centre or emergency number.",
};

export function safetyNoticeFor(entry: { id: string; parentId?: string }): string | undefined {
  return SAFETY_NOTICES[entry.id] ?? SAFETY_NOTICES[entry.parentId ?? ""];
}

const SAFETY_ORDER = ["low", "medium", "high"] as const;

export function effectiveSafetyClass(
  requested: LessonRequest["safetyClass"],
  entry: { id: string; parentId?: string },
): LessonRequest["safetyClass"] {
  const floor = safetyNoticeFor(entry) ? "high" : "low";
  return SAFETY_ORDER.indexOf(requested) >= SAFETY_ORDER.indexOf(floor) ? requested : floor;
}

/** Evidence ready for this lesson, or undefined while it is gathered for later ones (ADR 0016). */
export type EvidenceGatherer = (
  input: InquiryInput & { taxonomyId: string },
  options: GatherOptions,
) => Promise<GatheredEvidence | undefined>;

export type LessonStreamEvent =
  | { type: "progress"; data: LessonProgress }
  | { type: "quick-answer"; data: QuickAnswer }
  | { type: "lesson"; data: Lesson }
  | { type: "sources"; data: LessonSources }
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

const isTeachable = (claim: Claim) =>
  claim.status === "supported" || claim.status === "qualified" || claim.origin === "model";

// Research questions no teachable claim answers (ADR 0011); history is no longer taught (ADR 0017).
function evidenceGaps(
  question: string,
  gathered: GatheredEvidence | undefined,
  usable: Claim[],
): string[] {
  if (!gathered) return usable.length > 0 ? [] : [question];
  const teachable = new Set(gathered.claims.filter(isTeachable).map((claim) => claim.claimId));
  const answered = (item: { claimIds: string[] }) => item.claimIds.some((id) => teachable.has(id));
  const questions = gathered.pack.questions ?? [];
  const gaps = questions.filter((item) => !answered(item)).map((item) => item.question);
  // With nothing to teach from at all, the learner's own question leads.
  const lead = teachable.size === 0 && usable.length === 0 && gaps.length === 0 ? [question] : [];
  return [...lead, ...gaps];
}

// Model claims fill gaps but never crowd out checked evidence.
const MAX_MODEL_CLAIMS = 12;

function lessonClaims(facts: Claim[], gathered: Claim[], fromModel: Claim[] = []): Claim[] {
  const byId = new Map<string, Claim>();
  for (const claim of [...facts, ...gathered]) {
    if (isTeachable(claim) && !byId.has(claim.claimId)) byId.set(claim.claimId, claim);
  }
  // Take one claim per gap in turn, so the last gaps are not crowded out by the first.
  const byGap = new Map<string, Claim[]>();
  for (const claim of fromModel) byGap.set(claim.scope, [...(byGap.get(claim.scope) ?? []), claim]);
  const model: Claim[] = [];
  for (let round = 0; model.length < Math.min(MAX_MODEL_CLAIMS, fromModel.length); round += 1) {
    for (const claims of byGap.values()) {
      const claim = claims[round];
      if (claim && model.length < MAX_MODEL_CLAIMS) model.push(claim);
    }
  }
  return [...[...byId.values()].slice(0, MAX_LESSON_CLAIMS - model.length), ...model];
}

function progressOf(event: GatherEvent): LessonProgress {
  if (event.type === "planned") {
    return LessonProgress.parse({
      stage: "researching",
      message: `Researching ${event.questions.length} questions: ${event.questions
        .map((question) => question.question)
        .join(" ")}`.slice(0, 300),
    });
  }
  if (event.type === "reused") {
    return LessonProgress.parse({
      stage: "verified",
      message: "Using evidence checked for an earlier question.",
      claims: event.claims.length,
    });
  }
  return LessonProgress.parse({
    stage: "verified",
    message: `Checked ${event.claims.length} claims from trusted sources.`,
    claims: event.claims.length,
  });
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
  private readonly logger = new Logger("LessonService");

  constructor(
    @Inject(LESSON_LLM) private readonly provider: LlmProvider | null,
    @Inject(TAXONOMY) private readonly taxonomy: Taxonomy,
    @Inject(LESSONS) private readonly lessons: LessonRepository & TaxonomyLessonLookup,
    @Inject(LESSON_EVIDENCE) private readonly evidence: EvidenceRepositories,
    @Inject(LESSON_REVIEW_AUDIT) private readonly reviewAudit: ReviewAuditLog,
    @Inject(LESSON_GATHERER) private readonly gather: EvidenceGatherer,
    @Inject(LESSON_RIGHTS) private readonly rights: RightsGate,
    @Optional() @Inject(VISUAL_MAKER) private readonly makeVisual?: VisualMaker,
  ) {}

  // Events leave as their stage completes; the answer waits for the lesson, so the learner guesses
  // before anything gives it away (ADR 0017).
  async *streamLesson(request: LessonRequest): AsyncGenerator<LessonStreamEvent> {
    const provider = this.provider;
    if (!provider) throw new UserFacingException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
    // Milliseconds from the request to each stage, logged once so cold-lesson latency is visible.
    const started = performance.now();
    const timings: Record<string, number> = {};
    const mark = (stage: string) => (timings[stage] = Math.round(performance.now() - started));
    const entry = resolveSubject(request, this.taxonomy);
    if (!entry) throw new UserFacingException(UNKNOWN_CATEGORY, HttpStatus.NOT_FOUND);
    const taxonomyId = entry.id;
    const taken = new Set<string>();
    const concepts = (this.taxonomy.get(taxonomyId) ? this.taxonomy.concepts(taxonomyId) : []).map(
      (label) => ({ conceptId: slug(label, taken), label, prerequisites: [] as string[] }),
    );
    // Entries without taxonomy concepts are still teachable; the plan supplies the principles.
    if (concepts.length === 0) {
      concepts.push({ conceptId: slug(entry.label, taken), label: entry.label, prerequisites: [] });
    }
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

    const conceptIds = concepts.map((concept) => concept.conceptId);
    const intent = {
      question: request.question,
      taxonomyId,
      conceptIds,
      audience: request.audience,
      readingLevel: request.readingLevel,
      locale: request.locale,
      safetyScope: safetyClass,
    };
    const hit = await createReuseMatcher(this.lessons, undefined, this.rights).match({
      intent,
      assumptions: request.assumptions,
      policyVersion: LESSON_POLICY_VERSION,
      promptVersion: LESSON_DRAFT_PROMPT_VERSION,
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
      const record = (audit: PublishAudit) => this.reviewAudit.record(audit);
      const resolver = createCitationResolver(this.evidence);
      const events = createEventQueue<LessonStreamEvent>();
      const gathering = this.gather(
        {
          taxonomyId,
          objectLabel: entry.label,
          question: request.question,
          concepts: concepts.map((concept) => concept.label),
          audience: request.audience,
          readingLevel: request.readingLevel,
          safetyClass,
        },
        {
          onEvent: (event) => events.push({ type: "progress", data: progressOf(event) }),
        },
      )
        .catch((error: unknown): GatheredEvidence | undefined => {
          // Facts or the model's own knowledge still carry a lesson when gathering fails outright.
          if (error instanceof LlmError) return undefined;
          throw error;
        })
        .finally(() => events.close());
      for await (const event of events) yield event;
      const gathered = await gathering;
      mark("gatheredMs");
      // Evidence gaps never hold a lesson back or change its shape; the model fills them, and the
      // lesson says so (ADR 0011).
      const gaps = evidenceGaps(request.question, gathered, usable);
      const fromModel = await generateModelClaims(
        {
          objectLabel: entry.label,
          question: request.question,
          gaps,
          audience: request.audience,
          readingLevel: request.readingLevel,
          safetyClass,
        },
        { provider },
      ).catch((error: unknown) => {
        if (error instanceof LlmError) return [];
        throw error;
      });
      mark("modelKnowledgeMs");
      const claims = lessonClaims(usable, gathered?.claims ?? [], fromModel);
      if (claims.length === 0) {
        throw new UserFacingException(
          usable.length === 0 ? NO_EVIDENCE : NO_COVERAGE,
          HttpStatus.NOT_FOUND,
        );
      }
      const checkedClaims = claims.filter((claim) => claim.origin !== "model");
      yield {
        type: "progress",
        data: LessonProgress.parse({
          stage: "drafting",
          message:
            checkedClaims.length === claims.length
              ? `Writing the lesson from ${claims.length} checked claims.`
              : `Writing the lesson from ${checkedClaims.length} checked claims and ${claims.length - checkedClaims.length} from general knowledge.`,
          claims: claims.length,
        }),
      };

      const pendingDraft = generateDraft(
        {
          intentSignature,
          question: request.question,
          taxonomyId,
          locale: request.locale,
          audience: [request.audience],
          readingLevel: request.readingLevel,
          safetyClass,
          concepts,
          claims,
          evidenceSnapshotId: newId(),
          policyVersion: LESSON_POLICY_VERSION,
        },
        { provider },
      );
      // Awaited inside the attempt below; this only stops an early exit raising it unhandled.
      pendingDraft.catch(() => undefined);
      let checkingStarted: (() => void) | undefined;
      const checking = new Promise<void>((resolve) => {
        checkingStarted = resolve;
      });
      const outcomePending = runWithFallback(
        this.lessons,
        async () => {
          const draft = await pendingDraft;
          mark("draftedMs");
          checkingStarted?.();
          const checks = [
            schemaCheck,
            citationCheck,
            misconceptionCheck,
            readingLevelCheck,
            createEvidenceCheck({
              resolver,
              sources: (ids) => this.evidence.sources.getMany(ids),
            }),
            createEntailmentCheck(provider, { objectLabel: entry.label }),
            createContradictionCheck(provider),
          ];
          let { lesson: checked, report } = await runLessonChecks(draft, checks, {
            onAudit: record,
          });
          // Drafts often add true but uncited detail; one rewrite of just those sections, then
          // every check again, so a repair can never slip past the gate.
          if (!report.passed && repairable(report)) {
            // A failed rewrite leaves the draft as it was; its doubts are then disclosed (ADR 0011).
            const revised = await reviseSections(checked, report, {
              provider,
              objectLabel: entry.label,
            }).catch((error: unknown) => {
              if (error instanceof LlmError) return undefined;
              throw error;
            });
            if (revised) {
              ({ lesson: checked, report } = await runLessonChecks(revised, checks, {
                onAudit: record,
              }));
            }
          }
          // High-risk, low-confidence, failed or rights-blocked lessons wait for a reviewer.
          const routed = await createPublisher({ rights: this.rights, onAudit: record }).route(
            checked,
            report,
            { safetyNotice: safetyNoticeFor(entry) },
          );
          await this.lessons.save(routed.lesson);
          if (routed.decision.action === "approve") return { lesson: routed.lesson, report };
          // Doubts a disclaimer can describe are shown to the learner; the lesson still awaits review.
          if (routed.decision.action === "disclose") {
            return { lesson: routed.lesson, report, disclosed: true };
          }
          held = true;
          return { lesson: routed.lesson, report: heldForReview(report, routed.decision.reasons) };
        },
        {
          taxonomyIds: [taxonomyId, ...(entry.parentId ? [entry.parentId] : [])],
          locale: request.locale,
          audience: request.audience,
          safetyClass,
          policyVersion: LESSON_POLICY_VERSION,
          promptVersion: LESSON_DRAFT_PROMPT_VERSION,
        },
      );
      const firstDone = await Promise.race([checking.then(() => "checking"), outcomePending]);
      if (firstDone === "checking") {
        yield {
          type: "progress",
          data: LessonProgress.parse({
            stage: "checking",
            message: "Checking every section against its sources.",
          }),
        };
      }
      const outcome = await outcomePending;
      mark("checkedMs");
      this.logger.log(
        JSON.stringify({
          outcome: outcome.kind,
          ...timings,
          reusedPack: gathered?.reused ?? false,
          claims: claims.length,
          modelClaims: fromModel.length,
        }),
      );
      if (outcome.kind !== "fresh") {
        // Reasons name checks, fields and ids, never the learner's words.
        this.logger.warn(
          `Fresh lesson not served (${outcome.kind}): ${outcome.reason}${outcome.detail ? ` | ${outcome.detail.slice(0, 1500)}` : ""}`,
        );
      }
      if (outcome.kind === "retry") {
        throw new UserFacingException(held ? HELD : outcome.reason, HttpStatus.SERVICE_UNAVAILABLE);
      }
      lesson = outcome.lesson;
      kind = outcome.kind;
    }

    const validated = Lesson.parse(lesson);
    // A Merrill lesson has no short-answer section, so the summary stands in for it.
    yield {
      type: "quick-answer",
      data: QuickAnswer.parse({
        kind,
        lessonId: validated.lessonId,
        version: validated.version,
        title: validated.title,
        summary: validated.summary,
        shortAnswer: validated.summary,
        claimIds: [],
        reviewStatus: validated.reviewStatus,
        disclaimers: validated.disclaimers,
        note:
          kind === "fallback"
            ? "Fresh generation failed; showing a related cached lesson."
            : undefined,
      }),
    };
    yield { type: "lesson", data: validated };
    // After the text, so citation markers can name their sources without delaying the lesson.
    const sourceIds = [...new Set(validated.claims.flatMap((claim) => claim.sourceIds))];
    yield {
      type: "sources",
      data: lessonSources(
        validated,
        sourceIds.length > 0 ? await this.evidence.sources.getMany(sourceIds) : [],
      ),
    };
    // Last, because generating a visual can take a minute and the learner is already reading.
    const visuals = this.makeVisual ? await this.makeVisual(validated) : validated.visuals;
    yield {
      type: "visuals",
      data: LessonVisuals.parse({ lessonId: validated.lessonId, visuals }),
    };
  }
}
