import type { CurriculumCatalogue } from "@sbi/taxonomy/curriculum";
import { and, asc, count, eq, isNull, notInArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { curricula, curriculumSubjects, curriculumTopics, lessonTopics } from "../schema";

export interface StoredFramework {
  id: string;
  name: string;
  source: string;
}

export interface StoredSubject {
  subjectId: string;
  curriculumId: string;
  frameworkId: string;
  name: string;
  levels: string[];
  topicCount: number;
}

export interface StoredCurriculum {
  curriculumId: string;
  label: string;
  levels: string[];
  frameworks: StoredFramework[];
  subjects: StoredSubject[];
}

export interface StoredTopic {
  topicCode: string;
  curriculumId: string;
  subjectId: string;
  frameworkId: string;
  level: string;
  theme: string | null;
  title: string;
  goals: string[];
  concepts: string[];
  sourceUrl: string | null;
  retiredAt: Date | null;
}

export type TopicLink = "exact" | "inferred";

export interface TopicFilter {
  curriculumId: string;
  subjectId?: string;
  level?: string;
}

export interface CurriculumRepository {
  /** Makes the tables match the catalogue; topics it no longer lists are retired, not deleted. */
  sync(catalogue: CurriculumCatalogue, at: Date): Promise<{ topics: number; retired: number }>;
  curricula(): Promise<StoredCurriculum[]>;
  /** Current topics, in the curriculum's level order and then teaching order. */
  topics(filter: TopicFilter): Promise<StoredTopic[]>;
  /** One topic by code, retired or not, so old links still resolve. */
  topic(topicCode: string): Promise<StoredTopic | undefined>;
  linkLesson(
    lessonId: string,
    links: { topicCode: string; link: TopicLink }[],
    at: Date,
  ): Promise<void>;
  lessonTopics(lessonId: string): Promise<{ topicCode: string; link: TopicLink }[]>;
}

type TopicRow = typeof curriculumTopics.$inferSelect;

const toTopic = (row: TopicRow): StoredTopic => ({
  concepts: row.concepts as string[],
  curriculumId: row.curriculumId,
  frameworkId: row.frameworkId,
  goals: row.goals as string[],
  level: row.level,
  retiredAt: row.retiredAt,
  sourceUrl: row.sourceUrl,
  subjectId: row.subjectId,
  theme: row.theme,
  title: row.title,
  topicCode: row.topicCode,
});

export function createCurriculumRepository(db: Database): CurriculumRepository {
  return {
    async sync(catalogue, at) {
      return db.transaction(async (tx) => {
        for (const item of catalogue.curricula) {
          const values = {
            frameworks: item.frameworks,
            label: item.label,
            levels: item.levels,
            syncedAt: at,
          };
          await tx
            .insert(curricula)
            .values({ curriculumId: item.id, ...values })
            .onDuplicateKeyUpdate({ set: values });
        }
        for (const subject of catalogue.subjects) {
          const values = {
            curriculumId: subject.curriculum,
            frameworkId: subject.framework,
            levels: subject.levels,
            name: subject.name,
            position: subject.position,
          };
          await tx
            .insert(curriculumSubjects)
            .values({ subjectId: subject.id, ...values })
            .onDuplicateKeyUpdate({ set: values });
        }
        for (const topic of catalogue.topics) {
          const values = {
            concepts: topic.concepts,
            curriculumId: topic.curriculum,
            frameworkId: topic.framework,
            goals: topic.goals,
            level: topic.level,
            position: topic.position,
            retiredAt: null,
            sourceUrl: topic.sourceUrl ?? null,
            subjectId: topic.subject,
            theme: topic.theme ?? null,
            title: topic.title,
          };
          await tx
            .insert(curriculumTopics)
            .values({ topicCode: topic.code, ...values })
            .onDuplicateKeyUpdate({ set: values });
        }
        const listed = catalogue.topics.map((topic) => topic.code);
        const [result] = await tx
          .update(curriculumTopics)
          .set({ retiredAt: at })
          .where(
            and(
              isNull(curriculumTopics.retiredAt),
              listed.length > 0 ? notInArray(curriculumTopics.topicCode, listed) : undefined,
            ),
          );
        return { retired: result.affectedRows, topics: listed.length };
      });
    },

    async curricula() {
      const [rows, subjects, counts] = await Promise.all([
        db.select().from(curricula).orderBy(asc(curricula.curriculumId)),
        db.select().from(curriculumSubjects).orderBy(asc(curriculumSubjects.position)),
        db
          .select({ subjectId: curriculumTopics.subjectId, topics: count() })
          .from(curriculumTopics)
          .where(isNull(curriculumTopics.retiredAt))
          .groupBy(curriculumTopics.subjectId),
      ]);
      const topicCount = new Map(counts.map((row) => [row.subjectId, row.topics]));
      return rows.map((row) => ({
        curriculumId: row.curriculumId,
        frameworks: row.frameworks as StoredFramework[],
        label: row.label,
        levels: row.levels as string[],
        subjects: subjects
          .filter((subject) => subject.curriculumId === row.curriculumId)
          .map((subject) => ({
            curriculumId: subject.curriculumId,
            frameworkId: subject.frameworkId,
            levels: subject.levels as string[],
            name: subject.name,
            subjectId: subject.subjectId,
            topicCount: topicCount.get(subject.subjectId) ?? 0,
          })),
      }));
    },

    async topics({ curriculumId, subjectId, level }) {
      const [owner] = await db
        .select({ levels: curricula.levels })
        .from(curricula)
        .where(eq(curricula.curriculumId, curriculumId));
      if (!owner) return [];
      const rows = await db
        .select({ topic: curriculumTopics, subjectPosition: curriculumSubjects.position })
        .from(curriculumTopics)
        .innerJoin(curriculumSubjects, eq(curriculumSubjects.subjectId, curriculumTopics.subjectId))
        .where(
          and(
            eq(curriculumTopics.curriculumId, curriculumId),
            isNull(curriculumTopics.retiredAt),
            subjectId ? eq(curriculumTopics.subjectId, subjectId) : undefined,
            level ? eq(curriculumTopics.level, level) : undefined,
          ),
        );
      const levels = owner.levels as string[];
      return rows
        .sort(
          (a, b) =>
            a.subjectPosition - b.subjectPosition ||
            levels.indexOf(a.topic.level) - levels.indexOf(b.topic.level) ||
            a.topic.position - b.topic.position,
        )
        .map((row) => toTopic(row.topic));
    },

    async topic(topicCode) {
      const [row] = await db
        .select()
        .from(curriculumTopics)
        .where(eq(curriculumTopics.topicCode, topicCode));
      return row && toTopic(row);
    },

    async linkLesson(lessonId, links, at) {
      for (const { topicCode, link } of links) {
        await db
          .insert(lessonTopics)
          .values({ lessonId, link, linkedAt: at, topicCode })
          // A lesson made for a topic stays an exact link even if the matcher finds it again.
          .onDuplicateKeyUpdate({
            set: {
              link: sql`IF(${lessonTopics.link} = 'exact', 'exact', VALUES(${lessonTopics.link}))`,
            },
          });
      }
    },

    async lessonTopics(lessonId) {
      const rows = await db
        .select({ link: lessonTopics.link, topicCode: lessonTopics.topicCode })
        .from(lessonTopics)
        .where(eq(lessonTopics.lessonId, lessonId))
        .orderBy(asc(lessonTopics.linkedAt));
      return rows.map((row) => ({ link: row.link as TopicLink, topicCode: row.topicCode }));
    },
  };
}
