import type { Lesson } from "@sbi/contracts";

export interface LessonRepository {
  save(lesson: Lesson): Promise<void>;
  get(lessonId: string, version: number): Promise<Lesson | undefined>;
  latest(lessonId: string): Promise<Lesson | undefined>;
  findByIntent(intentSignature: string): Promise<Lesson[]>;
}
