export { createLessonInvalidator, isReusable, type LessonInvalidator } from "./invalidation";
export type { LessonRepository, TaxonomyLessonLookup } from "./lesson-repository";
export { buildIntentSignature, type IntentInput } from "./intent";
export {
  createReuseMatcher,
  type ReuseAudit,
  type ReuseAuditSink,
  type ReuseHit,
  type ReuseMatcher,
  type ReuseQuery,
} from "./reuse";
export {
  createDraftPromptRegistry,
  generateDraft,
  LESSON_DRAFT_PROMPT,
  REUSE_MATCH_DIMENSIONS,
  type DraftDeps,
  type DraftInput,
} from "./draft";
export {
  citationCheck,
  misconceptionCheck,
  runLessonChecks,
  schemaCheck,
  type CheckReport,
  type CheckResult,
  type LessonCheck,
} from "./checks";
export { readingEase, readingLevelCheck } from "./reading";
export {
  CONTRADICTION_PROMPT_VERSION,
  createContradictionCheck,
  createEntailmentCheck,
  judgeEntailment,
  type EntailmentVerdict,
  ENTAILMENT_PROMPT_VERSION,
} from "./entailment";
export { createEvidenceCheck, type EvidenceCheckDeps } from "./evidence-check";
export {
  createMemoryReviewAuditLog,
  createPublisher,
  RightsBlockedError,
  routeLesson,
  transitionLesson,
  type PublishAudit,
  type PublishAuditSink,
  type ReviewAuditLog,
  type Publisher,
  type ReviewStatus,
  type RightsDecision,
  type RightsGate,
  type RouteDecision,
} from "./publish";
export {
  runWithFallback,
  type FallbackQuery,
  type GenerationAttempt,
  type PipelineOutcome,
} from "./pipeline";
export {
  gateQuickAnswer,
  generateQuickAnswer,
  QUICK_ANSWER_PROMPT,
  withShortAnswer,
  type QuickAnswerDraft,
  type QuickAnswerGate,
  type QuickAnswerInput,
  type QuickGateDeps,
} from "./quick-answer";
