import type { CurriculumRepository, StoredTopic, TopicLink } from "@sbi/db";
import { curriculumCatalogue } from "@sbi/taxonomy/curriculum";

/** The repo's catalogue in memory, as the migrate step would load it. */
export function fakeCurriculum() {
  const catalogue = curriculumCatalogue();
  const retired = new Map<string, Date>();
  const links = new Map<string, { topicCode: string; link: TopicLink }[]>();
  const stored = (topic: (typeof catalogue.topics)[number]): StoredTopic => ({
    concepts: topic.concepts,
    curriculumId: topic.curriculum,
    frameworkId: topic.framework,
    goals: topic.goals,
    level: topic.level,
    retiredAt: retired.get(topic.code) ?? null,
    sourceUrl: topic.sourceUrl ?? null,
    subjectId: topic.subject,
    theme: topic.theme ?? null,
    title: topic.title,
    topicCode: topic.code,
  });
  const current = () => catalogue.topics.filter((topic) => !retired.has(topic.code));

  const repository: CurriculumRepository = {
    sync: async () => ({ retired: 0, topics: catalogue.topics.length }),
    curricula: async () =>
      catalogue.curricula.map((item) => ({
        curriculumId: item.id,
        frameworks: [...item.frameworks],
        label: item.label,
        levels: [...item.levels],
        subjects: catalogue.subjects
          .filter((subject) => subject.curriculum === item.id)
          .map((subject) => ({
            curriculumId: subject.curriculum,
            frameworkId: subject.framework,
            levels: [...subject.levels],
            name: subject.name,
            subjectId: subject.id,
            topicCount: current().filter((topic) => topic.subject === subject.id).length,
          })),
      })),
    topics: async ({ curriculumId, subjectId, level }) =>
      current()
        .filter(
          (topic) =>
            topic.curriculum === curriculumId &&
            (!subjectId || topic.subject === subjectId) &&
            (!level || topic.level === level),
        )
        .map(stored),
    topic: async (code) => {
      const found = catalogue.topics.find((topic) => topic.code === code);
      return found && stored(found);
    },
    linkLesson: async (lessonId, added) => {
      const list = links.get(lessonId) ?? [];
      for (const item of added) {
        const existing = list.find((entry) => entry.topicCode === item.topicCode);
        if (!existing) list.push({ ...item });
        else if (existing.link !== "exact") existing.link = item.link;
      }
      links.set(lessonId, list);
    },
    lessonTopics: async (lessonId) => links.get(lessonId) ?? [],
  };
  return { links, repository, retired };
}
