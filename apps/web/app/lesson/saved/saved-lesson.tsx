"use client";

import { Button, StatusLine } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useRemoveSavedLesson } from "../../account/use-saved-lessons";
import { api } from "../../api";
import { ApiRequestError } from "../../api-client";
import { SourceList } from "../citations";
import { LessonFeedback } from "../feedback";
import { useLessonExperiment } from "../lesson-experiment";
import { LessonNotice } from "../lesson-reader";
import { LessonRail } from "../lesson-rail";
import { PracticeProvider } from "../practice";
import { VisualFrame } from "../visual-frame";
import { ShareLesson } from "./share-lesson";

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

/** A saved lesson exactly as it was saved: nothing is regenerated, so it never changes (#103). */
export function SavedLesson() {
  const router = useRouter();
  const lessonId = useSearchParams().get("id") ?? "";
  const opened = useQuery({
    queryFn: () => api("openSavedLesson", { lessonId }),
    queryKey: ["account", "saved-lesson", lessonId],
    retry: false,
  });
  const remove = useRemoveSavedLesson();
  const signedOut = opened.error instanceof ApiRequestError && opened.error.status === 401;
  const data = opened.data;
  const experiment = useLessonExperiment(data?.lesson, data?.visuals.visuals);

  useEffect(() => {
    if (signedOut) {
      router.replace(`/account/sign-in?next=${encodeURIComponent(`/lesson/saved?id=${lessonId}`)}`);
    }
  }, [signedOut, router, lessonId]);

  if (opened.isPending || signedOut) {
    return (
      <main id="main" className="lesson">
        <StatusLine>Opening your saved lesson…</StatusLine>
      </main>
    );
  }
  if (!data) {
    return (
      <main id="main" className="lesson">
        <h1>Saved lesson</h1>
        <p role="alert">{opened.error?.message}</p>
        <p>
          <Link href="/account/lessons">Back to saved lessons</Link>
        </p>
      </main>
    );
  }
  const { lesson, sources, visuals, savedAt } = data;
  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        <Link href="/account/lessons" className="lesson-head__change">
          All saved lessons
        </Link>
        <p className="topic-chip">Saved lesson</p>
        <h1>{lesson.title}</h1>
        <p className="provenance">
          You saved this version on {DATE.format(new Date(savedAt))}. It stays as it was, even if
          the lesson is updated later.{" "}
          <Button
            variant="quiet"
            size="small"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(lesson.lessonId, { onSuccess: () => router.push("/account/lessons") })
            }
          >
            Remove from saved
          </Button>
        </p>
        {remove.error ? <p role="alert">{remove.error.message}</p> : null}
      </header>
      <LessonNotice items={lesson.disclaimers ?? []} />
      <div className="lesson-body">
        <PracticeProvider experiment={experiment}>
          <LessonRail
            lesson={lesson}
            label={lesson.title}
            askQuestion={null}
            visuals={visuals.visuals}
            renderVisual={(visual) => <VisualFrame visual={visual} />}
          />
        </PracticeProvider>
        <SourceList sources={sources} lesson={lesson} />
        <ShareLesson lessonId={lesson.lessonId} />
        <LessonFeedback lessonId={lesson.lessonId} version={lesson.version} />
      </div>
    </main>
  );
}
