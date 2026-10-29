export { createLessonInvalidator, isReusable, type LessonInvalidator } from "./invalidation";
export type { LessonRepository } from "./lesson-repository";
export {
  createReuseMatcher,
  type ReuseAudit,
  type ReuseAuditSink,
  type ReuseHit,
  type ReuseMatcher,
  type ReuseQuery,
} from "./reuse";
export { buildIntentSignature, type IntentInput } from "./intent";
