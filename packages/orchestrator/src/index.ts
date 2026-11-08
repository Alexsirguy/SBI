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
  HIGH_RISK_DRAFT_RULE,
  LESSON_DRAFT_PROMPT,
  LESSON_DRAFT_PROMPT_VERSION,
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
  type SectionFinding,
  type LessonCheck,
} from "./checks";
export { readingEase, readingLevelCheck } from "./reading";
export { safeActivityCheck } from "./safe-activities";
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
  GENERIC_SAFETY_NOTICE,
  RightsBlockedError,
  routeLesson,
  transitionLesson,
  type PublishAudit,
  type PublishAuditSink,
  type ReviewAuditLog,
  type RouteOptions,
  type Publisher,
  type ReviewStatus,
  type RightsDecision,
  type RightsGate,
  type RouteDecision,
  MODEL_KNOWLEDGE_DISCLAIMER,
} from "./publish";
export {
  generateModelClaims,
  MODEL_KNOWLEDGE_PROMPT_VERSION,
  type ModelKnowledgeInput,
} from "./model-knowledge";
export {
  runWithFallback,
  type FallbackQuery,
  type GenerationAttempt,
  type PipelineOutcome,
} from "./pipeline";
export { repairable, REVISE_PROMPT_VERSION, reviseSections, sectionsToRevise } from "./repair";
export {
  QUESTION_SUGGEST_PROMPT_VERSION,
  suggestQuestions,
  type QuestionSuggestionInput,
} from "./questions";
export { editLesson, LessonEditError } from "./edit";
export { NotShareableError, redactContact, shareLesson } from "./share";
export { relatedConcepts, type ConceptNode, type RelatedSuggestion } from "./related";
