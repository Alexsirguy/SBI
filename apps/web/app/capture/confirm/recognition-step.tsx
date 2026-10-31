"use client";

import type { ApiRequest, ApiResponse } from "@sbi/contracts";
import type { UseMutationResult } from "@tanstack/react-query";
import { StatusLine } from "@sbi/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { lessonHref } from "../../lesson/lesson-request";
import { readPrefs } from "../../lesson/prefs";
import { DescribeForm } from "./describe-form";

interface RecognitionStepProps {
  recognition: UseMutationResult<
    ApiResponse<"recognisePhoto">,
    Error,
    ApiRequest<"recognisePhoto">
  >;
}

const DESCRIBE = "We could not tell what is in the photo. Describe it to start your lesson.";

// What the model names is where the lesson starts; the reader offers a way back if it is wrong.
export function RecognitionStep({ recognition }: RecognitionStepProps) {
  const router = useRouter();
  const subject = recognition.data?.subject;

  useEffect(() => {
    if (subject) router.push(lessonHref({ label: subject }, { prefs: readPrefs() }));
  }, [router, subject]);

  if (recognition.isPending) {
    return <StatusLine>Recognising the object…</StatusLine>;
  }
  if (subject) {
    return <StatusLine>It looks like: {subject}. Starting your lesson…</StatusLine>;
  }
  return <DescribeForm message={recognition.error?.message ?? DESCRIBE} />;
}
