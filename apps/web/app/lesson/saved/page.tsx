import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "../../i18n/server";
import "../lesson.css";
import { SavedLesson } from "./saved-lesson";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("lesson");
  return { title: t("savedLessonTitle") };
}

export default function SavedLessonPage() {
  return (
    <Suspense>
      <SavedLesson />
    </Suspense>
  );
}
