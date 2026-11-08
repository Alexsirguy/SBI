"use client";

import { StatusLine } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "../../api";
import { useT } from "../../i18n/provider";
import { SourceList } from "../../lesson/citations";
import { CurriculumLinks } from "../../lesson/curriculum-links";
import { LessonFeedback } from "../../lesson/feedback";
import { useLessonExperiment } from "../../lesson/lesson-experiment";
import { LessonNotice } from "../../lesson/lesson-reader";
import { LessonRail } from "../../lesson/lesson-rail";
import { useErrorText } from "../../lesson/lesson-t";
import { PracticeProvider } from "../../lesson/practice";
import { VisualFrame } from "../../lesson/visual-frame";
import { readClass } from "../class-context";

/** A lesson the teacher added, exactly as they saved it; nothing is regenerated for the pupil. */
export function ClassLesson() {
  const t = useT("teach");
  const errorText = useErrorText();
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const lessonId = params.get("id") ?? "";
  const opened = useQuery({
    enabled: !!code && !!lessonId,
    queryFn: () => api("openClassLesson", { code, lessonId }),
    queryKey: ["class", code, "lesson", lessonId],
    retry: false,
  });
  const data = opened.data;
  const experiment = useLessonExperiment(data?.lesson, data?.visuals.visuals);
  const back = `/class?code=${encodeURIComponent(code)}`;
  const className = readClass()?.name;

  if (opened.isPending) {
    return (
      <main id="main" className="lesson">
        <StatusLine>{t("opening")}</StatusLine>
      </main>
    );
  }
  if (!data || opened.isError) {
    return (
      <main id="main" className="lesson">
        <h1>{t("classLessonMetaTitle")}</h1>
        <p role="alert">{errorText(opened.error?.message)}</p>
        <p>
          <Link href={back}>{t("joinHeading")}</Link>
        </p>
      </main>
    );
  }
  const { lesson, sources, visuals } = data;
  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        <Link href={back} className="lesson-head__change">
          {className ? t("backToClass", { name: className }) : t("classLessons")}
        </Link>
        <h1>{lesson.title}</h1>
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
        <CurriculumLinks concepts={lesson.concepts.map((concept) => concept.label)} />
        <SourceList sources={sources} lesson={lesson} />
        <LessonFeedback lessonId={lesson.lessonId} version={lesson.version} />
      </div>
    </main>
  );
}
