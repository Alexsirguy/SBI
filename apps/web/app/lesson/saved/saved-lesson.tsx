"use client";

import { Button, StatusLine } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useRemoveSavedLesson } from "../../account/use-saved-lessons";
import { api } from "../../api";
import { ApiRequestError } from "../../api-client";
import { INTL_LOCALE } from "../../i18n/locales";
import { useLocale, useT } from "../../i18n/provider";
import { SourceList } from "../citations";
import { LessonFeedback } from "../feedback";
import { useLessonExperiment } from "../lesson-experiment";
import { LessonNotice } from "../lesson-reader";
import { LessonRail } from "../lesson-rail";
import { useErrorText } from "../lesson-t";
import { PracticeProvider } from "../practice";
import { VisualFrame } from "../visual-frame";
import { useAccount } from "../../account/use-account";
import { AddToClass } from "../../teach/add-to-class";
import { useClasses } from "../../teach/use-classes";
import { ShareLesson } from "./share-lesson";

/** A saved lesson exactly as it was saved: nothing is regenerated, so it never changes (#103). */
export function SavedLesson() {
  const t = useT("lesson");
  const locale = useLocale();
  const errorText = useErrorText();
  const router = useRouter();
  const params = useSearchParams();
  const lessonId = params.get("id") ?? "";
  // Set by the edit page, so the teacher hears their edits were saved and where they went.
  const edited = params.get("edited");
  const teachT = useT("teach");
  const account = useAccount();
  const educator = !!useClasses(!!account.data).data?.educator;
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
        <StatusLine>{t("openingSaved")}</StatusLine>
      </main>
    );
  }
  // A failed refetch keeps the old data, which could be another account's lesson; never show it.
  if (!data || opened.isError) {
    return (
      <main id="main" className="lesson">
        <h1>{t("savedLesson")}</h1>
        <p role="alert">{errorText(opened.error?.message)}</p>
        <p>
          <Link href="/account/lessons">{t("backToSaved")}</Link>
        </p>
      </main>
    );
  }
  const { lesson, sources, visuals, savedAt } = data;
  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        <Link href="/account/lessons" className="lesson-head__change">
          {t("allSaved")}
        </Link>
        <p className="topic-chip">{t("savedLesson")}</p>
        <h1>{lesson.title}</h1>
        <p className="provenance">
          {t("savedProvenance", {
            date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(
              new Date(savedAt),
            ),
          })}{" "}
          <Button
            variant="quiet"
            size="small"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(lesson.lessonId, { onSuccess: () => router.push("/account/lessons") })
            }
          >
            {t("removeFromSaved")}
          </Button>
        </p>
        {remove.error ? <p role="alert">{errorText(remove.error.message)}</p> : null}
        <AddToClass lessonId={lesson.lessonId} version={lesson.version} />
        {educator ? (
          <Link href={`/lesson/saved/edit?id=${lesson.lessonId}`} className="save-lesson">
            {teachT("editLesson")}
          </Link>
        ) : null}
        {edited !== null ? (
          <p role="status">
            {edited === "0"
              ? teachT("editSaved")
              : edited === "1"
                ? teachT("editSavedOne")
                : teachT("editSavedMany", { count: edited })}
          </p>
        ) : null}
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
