import type { AudienceBand, Lesson } from "@sbi/contracts";

type ReadingLevel = Lesson["readingLevel"];
import type { StoredTopic } from "@sbi/db";
import type { LessonSubject } from "./subject";

// Typical ages: K–5 and P4–P6 under 11, grades 6–8 and JSS 11 to 14, high school and SSS 14 to 18.
const BANDS: readonly {
  levels: readonly string[];
  audience: AudienceBand;
  reading: ReadingLevel;
}[] = [
  { levels: ["K-2", "3-5", "P4-6"], audience: "child", reading: "simple" },
  { levels: ["6-8", "JSS1", "JSS2", "JSS3"], audience: "child", reading: "plain" },
  { levels: ["9-12", "SSS1", "SSS2", "SSS3"], audience: "teen", reading: "plain" },
];

/** The age band and reading level a topic's class calls for. */
export function topicAudience(level: string): {
  audience: AudienceBand;
  readingLevel: ReadingLevel;
} {
  const band = BANDS.find((item) => item.levels.includes(level));
  return band
    ? { audience: band.audience, readingLevel: band.reading }
    : { audience: "general", readingLevel: "plain" };
}

/** A topic stands in for a catalogue entry, with an id that names it and no stored facts. */
export function topicSubject(topic: StoredTopic): LessonSubject {
  return { facts: [], id: `topic.${topic.topicCode}`, label: topic.title };
}
