"use client";

import type { ApiResponse } from "@sbi/contracts";
import type { Alignment, Curriculum } from "@sbi/taxonomy/curriculum";
import { useEffect, useId, useState } from "react";
import { useT } from "../i18n/provider";
import {
  CURRICULUM_CHOICES,
  readCurriculum,
  writeCurriculum,
  type CurriculumChoice,
  type CurriculumPref,
} from "./curriculum-pref";

interface Loaded {
  curriculum: Curriculum;
  levels: readonly string[];
  alignments: Alignment[];
}

type Linked = ApiResponse<"lessonTopics">["links"];

const CHOICE_KEY = { none: "curriculumOff", us: "curriculumUs", ng: "curriculumNg" } as const;
// The notices each framework's terms ask for wherever its name or codes appear (ADR 0029).
const NOTICE_KEYS = {
  us: ["curriculumNoticeNgss", "curriculumNoticeCcss"],
  ng: ["curriculumNoticeNerdc"],
} as const;

/** Standards this lesson teaches in the learner's chosen curriculum (#114). */
export function CurriculumLinks({
  concepts,
  lessonId,
}: {
  concepts: readonly string[];
  /** Saved lessons have stored links; a topic lesson's own topic comes first (#422). */
  lessonId?: string;
}) {
  const t = useT("lesson");
  const id = useId();
  // Only drawn once a lesson has streamed in, so reading device storage here can't break hydration.
  const [pref, setPref] = useState<CurriculumPref>(() => readCurriculum());
  const [loaded, setLoaded] = useState<Loaded>();
  const [linked, setLinked] = useState<{ lessonId: string; links: Linked }>();

  const { curriculum, level } = pref;
  const conceptList = concepts.join("\n");
  useEffect(() => {
    if (curriculum === "none") return;
    let live = true;
    // Loaded on demand so learners who never choose a curriculum don't download the standards.
    void import("@sbi/taxonomy/curriculum").then(({ alignmentsFor, CURRICULA }) => {
      if (!live) return;
      const known = CURRICULA[curriculum].levels;
      setLoaded({
        curriculum,
        levels: known,
        alignments: alignmentsFor(conceptList.split("\n"), curriculum, {
          level: level && known.includes(level) ? level : undefined,
        }),
      });
    });
    return () => {
      live = false;
    };
  }, [curriculum, level, conceptList]);

  useEffect(() => {
    if (curriculum === "none" || !lessonId) return;
    let live = true;
    // Lazily, like the standards, and a failed lookup just leaves the matched links.
    void import("../api")
      .then(({ api }) => api("lessonTopics", { lessonId }))
      .then((result) => live && setLinked({ lessonId, links: result.links }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [curriculum, lessonId]);

  const choose = (next: CurriculumPref) => {
    setPref(next);
    writeCurriculum(next);
  };
  const ready = loaded?.curriculum === curriculum ? loaded : undefined;
  const exact =
    linked?.lessonId === lessonId
      ? (linked?.links ?? []).filter(
          ({ link, topic }) =>
            link === "exact" &&
            topic.curriculum === curriculum &&
            (!level || topic.level === level),
        )
      : [];
  const madeFor = new Set(exact.map(({ topic }) => topic.code));
  const matched = ready?.alignments.filter(({ standard }) => !madeFor.has(standard.code)) ?? [];

  return (
    <section aria-labelledby={`${id}-heading`} className="curriculum-links">
      <h2 id={`${id}-heading`}>{t("curriculumHeading")}</h2>
      <div className="curriculum-links__controls">
        <label>
          {t("curriculumChoose")}
          <select
            value={curriculum}
            onChange={(event) =>
              choose({ curriculum: event.currentTarget.value as CurriculumChoice })
            }
          >
            {CURRICULUM_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {t(CHOICE_KEY[choice])}
              </option>
            ))}
          </select>
        </label>
        {ready ? (
          <label>
            {t("curriculumLevel")}
            <select
              value={level ?? ""}
              onChange={(event) =>
                choose({ curriculum, level: event.currentTarget.value || undefined })
              }
            >
              <option value="">{t("curriculumAllLevels")}</option>
              {ready.levels.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {curriculum === "none" ? null : !ready ? (
        <p role="status">{t("curriculumLoading")}</p>
      ) : exact.length + matched.length === 0 ? (
        <p>{t("curriculumNone")}</p>
      ) : (
        <ul>
          {exact.map(({ topic }) => (
            <li key={topic.code}>
              <code>{topic.code}</code>
              <span>{topic.title}</span>
              <span className="curriculum-links__meta">
                {topic.level} · {t("curriculumMadeFor")}
              </span>
            </li>
          ))}
          {matched.map(({ standard, match }) => (
            <li key={standard.code}>
              <code>{standard.code}</code>
              <span>{standard.title}</span>
              <span className="curriculum-links__meta">
                {standard.level}
                {match === "partial" ? ` · ${t("curriculumPartial")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {curriculum === "none" ? null : (
        <>
          <p className="curriculum-links__note">{t("curriculumNote")}</p>
          {NOTICE_KEYS[curriculum].map((key) => (
            <p key={key} className="curriculum-links__note">
              {t(key)}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
