"use client";

import { Button, StatusLine, TextField } from "@sbi/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useT } from "../i18n/provider";
import { readCurriculum, writeCurriculum } from "../lesson/curriculum-pref";
import { useErrorText } from "../lesson/lesson-t";
import { enterClass, leaveClass } from "./class-context";

export const classLessonHref = (code: string, lessonId: string) =>
  `/class/lesson?code=${encodeURIComponent(code)}&id=${lessonId}`;

function JoinForm({ initial = "" }: { initial?: string }) {
  const t = useT("teach");
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    router.push(`/class?code=${encodeURIComponent(code.trim())}`);
  };
  return (
    <form className="teach-form" onSubmit={submit}>
      <TextField
        label={t("codeInput")}
        value={code}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        required
        onChange={(event) => setCode(event.currentTarget.value)}
      />
      <Button type="submit" disabled={!code.trim()}>
        {t("joinButton")}
      </Button>
    </form>
  );
}

/** A pupil's view of a class: no sign-in, and nothing about them is stored (ADR 0027). */
export function ClassPage() {
  const t = useT("teach");
  const errorText = useErrorText();
  const router = useRouter();
  const code = useSearchParams().get("code")?.trim() ?? "";
  const opened = useQuery({
    enabled: !!code,
    queryFn: () => api("openClass", { code }),
    queryKey: ["class", code],
    retry: false,
  });
  const data = opened.data;

  useEffect(() => {
    if (!data) return;
    enterClass({ code, name: data.name, tutorEnabled: data.controls.tutorEnabled });
    // The class's curriculum is a starting point; a pupil's own choice is never overwritten.
    if (data.curriculum && readCurriculum().curriculum === "none") {
      writeCurriculum(
        data.level
          ? { curriculum: data.curriculum, level: data.level }
          : { curriculum: data.curriculum },
      );
    }
  }, [data, code]);

  if (!code) {
    return (
      <main id="main" className="prose-page">
        <h1>{t("joinHeading")}</h1>
        <p className="home__lead">{t("joinLead")}</p>
        <JoinForm />
      </main>
    );
  }
  if (opened.isPending) {
    return (
      <main id="main" className="prose-page">
        <StatusLine>{t("opening")}</StatusLine>
      </main>
    );
  }
  if (!data || opened.isError) {
    return (
      <main id="main" className="prose-page">
        <h1>{t("joinHeading")}</h1>
        <p role="alert">{errorText(opened.error?.message)}</p>
        <JoinForm initial={code} />
      </main>
    );
  }
  return (
    <main id="main" className="prose-page">
      <h1>{data.name}</h1>
      <p className="home__lead">{t("classPrivacy")}</p>
      {data.controls.tutorEnabled ? null : <p>{t("classTutorOff")}</p>}
      <h2>{t("classLessons")}</h2>
      {data.lessons.length === 0 ? (
        <p>{t("classEmpty")}</p>
      ) : (
        <ul className="class-page__lessons">
          {data.lessons.map((lesson) => (
            <li key={lesson.lessonId}>
              <Link href={classLessonHref(code, lesson.lessonId)}>{lesson.title}</Link>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Button
          variant="quiet"
          onClick={() => {
            leaveClass();
            router.push("/");
          }}
        >
          {t("leaveClass")}
        </Button>
      </p>
    </main>
  );
}
