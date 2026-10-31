import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
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
  gateQuickAnswer,
  generateQuickAnswer,
  generateDraft,
  generateModelClaims,
  misconceptionCheck,
  readingLevelCheck,
  repairable,
  reviseSections,
  runLessonChecks,
  runWithFallback,
  schemaCheck,
  withShortAnswer,
  type CheckReport,
  type PublishAudit,
  type QuickAnswerDraft,
  type QuickAnswerInput,
  type QuickGateDeps,
  type LessonRepository,
  type ReviewAuditLog,
  type RightsGate,
  type TaxonomyLessonLookup,
} from "@sbi/orchestrator";
import { sourcedFacts, type Taxonomy } from "@sbi/taxonomy";
import {
  LESSON_EVIDENCE,
  LESSON_GATHERER,
  LESSON_LLM,
  LESSON_REVIEW_AUDIT,
  LESSONS,
  TAXONOMY,
} from "../tokens";
import { createEventQueue } from "./event-queue";
import { resolveSubject } from "./subject";
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
const HELD_AFTER_ANSWER =
  "The short answer above is checked, but the full lesson needs a reviewer before we can show it.";
const LESSON_LATER =
  "The short answer above is checked, but the full lesson is not ready. Try again later.";

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

// Drafts carry no visuals yet; any visual needs the rights register before it is served.
// TODO(#72) check visual assets against the rights register.
const VISUAL_RIGHTS: RightsGate = {
  check: async (lesson) =>
    lesson.visuals.length === 0
      ? { cleared: true }
      : { cleared: false, reason: "visual rights are not checked yet" },
};

/** Gathers (or reuses) request-time evidence for a lesson; see gatherEvidence in @sbi/evidence. */
export type EvidenceGatherer = (
  input: InquiryInput & { taxonomyId: string },
  options: GatherOptions,
) => Promise<GatheredEvidence>;

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

const answerLogger = new Logger("QuickAnswer");

// A short answer that fails generation or its gate is skipped; the lesson's own one follows.
async function earlyAnswer(
  provider: LlmProvider,
  input: QuickAnswerInput & Omit<QuickGateDeps, "provider">,
): Promise<QuickAnswerDraft | undefined> {
  try {
    const answer = await generateQuickAnswer(input, { provider });
    const gate = await gateQuickAnswer(answer, { ...input, provider });
    if (!gate.passed) {
      answerLogger.log(
        `not streamed from ${input.claims.length} claims: ${gate.reasons.join("; ")}`,
      );
    }
    return gate.passed ? answer : undefined;
  } catch (error) {
    if (error instanceof LlmError) return undefined;
    throw error;
  }
}

const isTeachable = (claim: Claim) =>
  claim.status === "supported" || claim.status === "qualified" || claim.origin === "model";

// Research questions no teachable claim answers, plus history when none was found (ADR 0011).
function evidenceGaps(
  question: string,
  objectLabel: string,
  gathered: GatheredEvidence | undefined,
  usable: Claim[],
): string[] {
  const history = `How was the ${objectLabel.toLowerCase()} invented or discovered, and how did it develop?`;
  if (!gathered) return usable.length > 0 ? [history] : [question, history];
  const teachable = new Set(gathered.claims.filter(isTeachable).map((claim) => claim.claimId));
  const answered = (item: { claimIds: string[] }) => item.claimIds.some((id) => teachable.has(id));
  const questions = gathered.pack.questions ?? [];
  const gaps = questions.filter((item) => !answered(item)).map((item) => item.question);
  const hasHistory = questions.some((item) => item.discipline === "history" && answered(item));
  // With nothing to teach from at all, the learner's own question leads.
  const lead = teachable.size === 0 && usable.length === 0 && gaps.length === 0 ? [question] : [];
  return [...lead, ...gaps, ...(hasHistory ? [] : [history])];
}

// Model claims fill gaps but never crowd out checked evidence.
const MAX_MODEL_CLAIMS = 12;

function lessonClaims(facts: Claim[], gathered: Claim[], fromModel: Claim[] = []): Claim[] {
  const byId = new Map<string, Claim>();
  for (const claim of [...facts, ...gathered]) {
    if (isTeachable(claim) && !byId.has(claim.claimId)) byId.set(claim.claimId, claim);
  }
  // Take one claim per gap in turn, so the last gaps (history) are not crowded out by the first.
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

function freshAnswer(lessonId: string, answer: QuickAnswerDraft): QuickAnswer {
  return QuickAnswer.parse({
    kind: "fresh",
    lessonId,
    version: 1,
    shortAnswer: answer.text,
    claimIds: answer.claimIds,
    reviewStatus: "auto-validated",
  });
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
  ) {}

  // Events leave as their stage completes, so the answer streams before the heavier payloads.
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
    const hit = await createReuseMatcher(this.lessons).match({
      intent,
      assumptions: request.assumptions,
      policyVersion: LESSON_POLICY_VERSION,
      fresh: request.fresh,
    });
    const intentSignature = buildIntentSignature(intent);
    let lesson: Lesson;
    let kind: QuickAnswer["kind"];
    let answered = false;
    if (hit) {
      lesson = hit.lesson;
      kind = "cached";
    } else {
      let held = false;
      const record = (audit: PublishAudit) => this.reviewAudit.record(audit);
      const lessonId = newId();
      const resolver = createCitationResolver(this.evidence);
      const answerInput = {
        objectLabel: entry.label,
        question: request.question,
        audience: [request.audience],
        readingLevel: request.readingLevel,
        locale: request.locale,
        resolver,
        safetyClass,
      };

      // Evidence is gathered now; progress and the first checked answer stream as it arrives.
      const events = createEventQueue<LessonStreamEvent>();
      let early: QuickAnswerDraft | undefined;
      let answering: Promise<void> | undefined;
      const arrived: Claim[] = [];
      let triedWith = 0;
      // Early batches are often background; an attempt that cannot answer retries on newer claims.
      const tryEarlyAnswer = (claims: Claim[]) => {
        arrived.push(...claims);
        const ready = [...usable, ...arrived].filter(isTeachable);
        if (early || answering || ready.length === 0 || ready.length === triedWith) return;
        triedWith = ready.length;
        answering = earlyAnswer(provider, { ...answerInput, claims: ready }).then((answer) => {
          answering = undefined;
          if (!answer) return tryEarlyAnswer([]);
          early = answer;
          events.push({ type: "quick-answer", data: freshAnswer(lessonId, answer) });
        });
      };
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
          onEvent: (event) => {
            events.push({ type: "progress", data: progressOf(event) });
            if (event.type !== "planned") tryEarlyAnswer(event.claims);
          },
        },
      )
        .catch((error: unknown): GatheredEvidence | undefined => {
          // Facts or the model's own knowledge still carry a lesson when gathering fails outright.
          if (error instanceof LlmError) return undefined;
          throw error;
        })
        .finally(async () => {
          while (answering) await answering;
          events.close();
        });
      for await (const event of events) {
        if (event.type === "quick-answer") answered = true;
        yield event;
      }
      const gathered = await gathering;
      mark("gatheredMs");
      // Evidence gaps never hold a lesson back or change its shape; the model fills them, and the
      // lesson says so (ADR 0011).
      const gaps = evidenceGaps(request.question, entry.label, gathered, usable);
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
          lessonId,
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
      // No early attempt answered; one more try with the full set if it holds anything new.
      // Model-knowledge claims never pass the quick-answer gate, so only checked ones are tried.
      if (!early && checkedClaims.length > triedWith) {
        early = await earlyAnswer(provider, { ...answerInput, claims: checkedClaims });
        if (early) {
          answered = true;
          yield { type: "quick-answer", data: freshAnswer(lessonId, early) };
        }
      }
      let checkingStarted: (() => void) | undefined;
      const checking = new Promise<void>((resolve) => {
        checkingStarted = resolve;
      });
      const outcomePending = runWithFallback(
        this.lessons,
        async () => {
          const generated = await pendingDraft;
          const draft = early ? await withShortAnswer(generated, early, claims) : generated;
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
          const routed = await createPublisher({ rights: VISUAL_RIGHTS, onAudit: record }).route(
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
      // A different cached lesson must not follow a fresh answer, so the stream ends instead.
      if (answered && outcome.kind !== "fresh") {
        throw new UserFacingException(
          held ? HELD_AFTER_ANSWER : LESSON_LATER,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (outcome.kind === "retry") {
        throw new UserFacingException(held ? HELD : outcome.reason, HttpStatus.SERVICE_UNAVAILABLE);
      }
      lesson = outcome.lesson;
      kind = outcome.kind;
    }

    const validated = Lesson.parse(lesson);
    const short = validated.sections.find((section) => section.module === "short-answer");
    if (!answered) {
      yield {
        type: "quick-answer",
        data: QuickAnswer.parse({
          kind,
          lessonId: validated.lessonId,
          version: validated.version,
          title: validated.title,
          summary: validated.summary,
          shortAnswer: short?.text ?? validated.summary,
          claimIds: short?.claimIds ?? [],
          reviewStatus: validated.reviewStatus,
          disclaimers: validated.disclaimers,
          note:
            kind === "fallback"
              ? "Fresh generation failed; showing a related cached lesson."
              : undefined,
        }),
      };
    }
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
    yield {
      type: "visuals",
      data: LessonVisuals.parse({ lessonId: validated.lessonId, visuals: validated.visuals }),
    };
  }
}
