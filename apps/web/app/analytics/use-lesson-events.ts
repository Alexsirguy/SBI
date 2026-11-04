"use client";

import { elapsedBucket } from "@sbi/analytics";
import type { Lesson, QuickAnswer } from "@sbi/contracts";
import { useEffect, useRef } from "react";
import { sinceFunnelStart } from "./clock";
import { track } from "./track";

/** Time to value from the start of the capture, or from page load for a shared link. */
const elapsed = () => elapsedBucket(sinceFunnelStart() ?? performance.now());

/**
 * Sends the lesson's first content once per lesson, and each section once when half of it is
 * on screen, which is how far the learner actually read.
 */
export function useLessonEvents(answer: QuickAnswer | undefined, lesson: Lesson | undefined) {
  const firstSent = useRef(false);
  const lessonSent = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lesson && lessonSent.current !== lesson.lessonId) {
      lessonSent.current = lesson.lessonId;
      if (!firstSent.current) {
        firstSent.current = true;
        track("lesson_first_content", {
          lessonId: lesson.lessonId,
          version: lesson.version,
          kind: "lesson",
          elapsed: elapsed(),
        });
      }
    } else if (answer && !lesson && !firstSent.current) {
      firstSent.current = true;
      track("lesson_first_content", { kind: "quick-answer", elapsed: elapsed() });
    }
  }, [answer, lesson]);

  useEffect(() => {
    if (!lesson || typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sectionId = (entry.target as HTMLElement).dataset.sectionId;
          if (!entry.isIntersecting || !sectionId || seen.has(sectionId)) continue;
          seen.add(sectionId);
          observer.unobserve(entry.target);
          track("section_opened", {
            lessonId: lesson.lessonId,
            version: lesson.version,
            sectionId,
          });
        }
      },
      { threshold: 0.5 },
    );
    for (const element of document.querySelectorAll("[data-section-id]")) observer.observe(element);
    return () => observer.disconnect();
  }, [lesson]);
}
