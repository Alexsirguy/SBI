"use client";

import { elapsedBucket } from "@sbi/analytics";
import type { Lesson, QuickAnswer } from "@sbi/contracts";
import { useEffect, useRef } from "react";
import { markTiming, takeFunnelStart } from "./clock";
import { track } from "./track";

/**
 * Sends the lesson's first content once per lesson, and each section once when half of it is
 * on screen, which is how far the learner actually read.
 */
export function useLessonEvents(
  answer: QuickAnswer | undefined,
  lesson: Lesson | undefined,
  /** The lesson is complete and its experiment, if any, has drawn or given up. */
  interactive: boolean,
) {
  const firstSent = useRef(false);
  const lessonSent = useRef<string | undefined>(undefined);
  const interactiveSent = useRef(false);
  // Time to value runs from the capture that led here, or from page load for a link.
  const origin = useRef<number | null | undefined>(undefined);
  const sinceStart = () => {
    if (origin.current === undefined) origin.current = takeFunnelStart() ?? null;
    return origin.current === null ? performance.now() : Date.now() - origin.current;
  };

  useEffect(() => {
    if (!interactive || interactiveSent.current) return;
    interactiveSent.current = true;
    markTiming("interactive_ready", sinceStart());
  }, [interactive]);

  useEffect(() => {
    if (lesson && lessonSent.current !== lesson.lessonId) {
      lessonSent.current = lesson.lessonId;
      if (!firstSent.current) {
        firstSent.current = true;
        const ms = sinceStart();
        track("lesson_first_content", {
          lessonId: lesson.lessonId,
          version: lesson.version,
          kind: "lesson",
          elapsed: elapsedBucket(ms),
        });
        markTiming("first_readable_lesson", ms);
      }
    } else if (answer && !lesson && !firstSent.current) {
      firstSent.current = true;
      const ms = sinceStart();
      track("lesson_first_content", { kind: "quick-answer", elapsed: elapsedBucket(ms) });
      markTiming("first_readable_lesson", ms);
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
