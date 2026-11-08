import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "../../i18n/server";
import "../../lesson/lesson.css";
import { ClassLesson } from "./class-lesson";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("teach");
  return { title: t("classLessonMetaTitle") };
}

export default function ClassLessonPage() {
  return (
    <Suspense>
      <ClassLesson />
    </Suspense>
  );
}
