export { createDatabase, type Database, type DatabaseHandle, type LockResult } from "./client";
export { runMigrations } from "./migrate";
export { createRepositories, type Repositories } from "./repositories";
export type {
  LessonFeedbackRepository,
  StoredLessonFeedback,
} from "./repositories/lesson-feedback";
export type {
  AccountRepository,
  AccountTokenRepository,
  NewAccount,
  SessionRepository,
  StoredAccount,
  TokenPurpose,
} from "./repositories/accounts";
export type { SavedLessonRepository, StoredSavedLesson } from "./repositories/saved-lessons";
export type { CoverageRepository } from "./repositories/coverage";
export type {
  ClassChanges,
  ClassRepository,
  NewClass,
  StoredClass,
  StoredClassControls,
  StoredClassLesson,
} from "./repositories/classes";
