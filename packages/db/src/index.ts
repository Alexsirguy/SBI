export { createDatabase, type Database, type DatabaseHandle, type LockResult } from "./client";
export { runMigrations } from "./migrate";
export { createRepositories, type Repositories } from "./repositories";
export type {
  LessonFeedbackRepository,
  StoredLessonFeedback,
} from "./repositories/lesson-feedback";
