"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "../api";
import { useT } from "../i18n/provider";
import { lessonHref } from "./lesson-request";
import type { LessonPrefs } from "./prefs";

/** Where to go next, from the concept graph; following one is counted to judge the list (#106). */
export function NextConcepts({
  lessonId,
  version,
  prefs,
}: {
  lessonId: string;
  version: number;
  prefs: LessonPrefs;
}) {
  const t = useT("lesson");
  const related = useQuery({
    queryFn: () => api("relatedLessons", { lessonId, version: String(version) }),
    queryKey: ["related", lessonId, version],
    // Nice to have: a failure hides the list rather than interrupting the lesson.
    retry: false,
  });
  const items = related.data?.related ?? [];
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="next-concepts" className="next-concepts">
      <h2 id="next-concepts">{t("nextConceptsHeading")}</h2>
      <ul>
        {items.map((item, rank) => (
          <li key={item.taxonomyId}>
            <Link
              href={lessonHref({ label: item.label, taxonomyId: item.taxonomyId }, { prefs })}
              onClick={() => {
                // Counting must never get in the learner's way, so failures are ignored.
                api("recordNextConcept", {
                  fromLessonId: lessonId,
                  rank,
                  toTaxonomyId: item.taxonomyId,
                }).catch(() => undefined);
              }}
            >
              {item.label}
            </Link>
            <span className="next-concepts__why">
              {item.via === "family"
                ? t("nextConceptsFamily")
                : t("nextConceptsShared", { concept: item.via })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
