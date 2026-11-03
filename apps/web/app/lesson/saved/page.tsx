import type { Metadata } from "next";
import { Suspense } from "react";
import "../lesson.css";
import { SavedLesson } from "./saved-lesson";

export const metadata: Metadata = { title: "Saved lesson · Science Behind It" };

export default function SavedLessonPage() {
  return (
    <Suspense>
      <SavedLesson />
    </Suspense>
  );
}
