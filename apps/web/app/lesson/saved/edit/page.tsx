import type { Metadata } from "next";
import { Suspense } from "react";
import "../../../account/account.css";
import { getT } from "../../../i18n/server";
import "../../../teach/teach.css";
import "../../lesson.css";
import { EditLesson } from "./edit-lesson";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("teach");
  return { title: t("editLesson") };
}

export default function EditLessonPage() {
  return (
    <Suspense>
      <EditLesson />
    </Suspense>
  );
}
