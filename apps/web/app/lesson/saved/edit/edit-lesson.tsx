"use client";

import type { ApiRequest, Lesson, LessonTask } from "@sbi/contracts";
import { Button, StatusLine, TextArea, TextField } from "@sbi/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SAVED_KEY } from "../../../account/use-saved-lessons";
import { api } from "../../../api";
import { useT } from "../../../i18n/provider";
import { CLASSES_KEY } from "../../../teach/use-classes";
import { useErrorText } from "../../lesson-t";
import { MODULE_LABEL_KEYS } from "../../modules/labels";

type Edits = Omit<ApiRequest<"editSavedLesson">, "lessonId">;
type TaskDraft = Pick<LessonTask, "prompt" | "options" | "answerIndex" | "feedback">;

const sameTask = (a: TaskDraft, b: TaskDraft) =>
  a.prompt === b.prompt &&
  a.answerIndex === b.answerIndex &&
  a.options.join("\n") === b.options.join("\n") &&
  a.feedback.join("\n") === b.feedback.join("\n");

/** Only what changed is sent, so untouched sections stay unmarked (#398). */
export function changesFrom(lesson: Lesson, draft: Lesson): Edits {
  return {
    sections: draft.sections
      .filter((section, index) => {
        const before = lesson.sections[index];
        return before && (before.text !== section.text || before.heading !== section.heading);
      })
      .map(({ sectionId, heading, text }) => ({ heading, sectionId, text })),
    summary: draft.summary !== lesson.summary ? draft.summary : undefined,
    tasks: draft.tasks
      .filter((task, index) => {
        const before = lesson.tasks[index];
        return before && !sameTask(before, task);
      })
      .map(({ taskId, prompt, options, answerIndex, feedback }) => ({
        answerIndex,
        feedback,
        options,
        prompt,
        taskId,
      })),
    title: draft.title !== lesson.title ? draft.title : undefined,
  };
}

function Form({ lesson }: { lesson: Lesson }) {
  const t = useT("teach");
  const lessonT = useT("lesson");
  const errorText = useErrorText();
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Lesson>(lesson);
  const [nothing, setNothing] = useState(false);
  const save = useMutation({
    mutationFn: (edits: Edits) => api("editSavedLesson", { ...edits, lessonId: lesson.lessonId }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: SAVED_KEY });
      void client.invalidateQueries({ queryKey: CLASSES_KEY });
      router.push(`/lesson/saved?id=${result.lesson.lessonId}&edited=${result.classesUpdated}`);
    },
  });
  const back = `/lesson/saved?id=${lesson.lessonId}`;

  const setSection = (index: number, change: Partial<Lesson["sections"][number]>) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((item, at) => (at === index ? { ...item, ...change } : item)),
    }));
  const setTask = (index: number, change: (task: LessonTask) => LessonTask) =>
    setDraft((current) => ({
      ...current,
      tasks: current.tasks.map((item, at) => (at === index ? change(item) : item)),
    }));
  const replace = (list: string[], at: number, value: string) =>
    list.map((item, index) => (index === at ? value : item));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const edits = changesFrom(lesson, draft);
    const empty = !edits.title && !edits.summary && !edits.sections?.length && !edits.tasks?.length;
    setNothing(empty);
    if (!empty) save.mutate(edits);
  };

  return (
    <form className="teach-form lesson-edit" onSubmit={submit}>
      <TextField
        label={t("editTitle")}
        value={draft.title}
        maxLength={200}
        required
        onChange={(event) => {
          const title = event.currentTarget.value;
          setDraft((current) => ({ ...current, title }));
        }}
      />
      <TextArea
        label={t("editSummary")}
        value={draft.summary}
        maxLength={1000}
        rows={3}
        required
        onChange={(event) => {
          const summary = event.currentTarget.value;
          setDraft((current) => ({ ...current, summary }));
        }}
      />
      {draft.sections.map((section, index) => (
        <fieldset key={section.sectionId} className="lesson-edit__part">
          <legend>{lessonT(MODULE_LABEL_KEYS[section.module])}</legend>
          {section.heading !== undefined ? (
            <TextField
              label={t("editSectionHeading")}
              value={section.heading}
              maxLength={120}
              required
              onChange={(event) => setSection(index, { heading: event.currentTarget.value })}
            />
          ) : null}
          <TextArea
            label={t("editSectionText")}
            value={section.text}
            maxLength={4000}
            rows={6}
            required
            onChange={(event) => setSection(index, { text: event.currentTarget.value })}
          />
        </fieldset>
      ))}
      {draft.tasks.map((task, index) => (
        <fieldset key={task.taskId} className="lesson-edit__part">
          <legend>{`${t("editQuestion")} ${index + 1}`}</legend>
          <TextArea
            label={t("editQuestion")}
            value={task.prompt}
            maxLength={400}
            rows={2}
            required
            onChange={(event) => {
              const prompt = event.currentTarget.value;
              setTask(index, (item) => ({ ...item, prompt }));
            }}
          />
          {task.options.map((option, at) => (
            <div key={at} className="lesson-edit__option">
              <TextField
                label={t("editOption", { n: at + 1 })}
                value={option}
                maxLength={200}
                required
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTask(index, (item) => ({
                    ...item,
                    options: replace(item.options, at, value),
                  }));
                }}
              />
              <TextArea
                label={t("editFeedback", { n: at + 1 })}
                value={task.feedback[at] ?? ""}
                maxLength={400}
                rows={2}
                required
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setTask(index, (item) => ({
                    ...item,
                    feedback: replace(item.feedback, at, value),
                  }));
                }}
              />
              <label className="teach-switch">
                <input
                  type="radio"
                  name={`right-${task.taskId}`}
                  checked={task.answerIndex === at}
                  onChange={() => setTask(index, (item) => ({ ...item, answerIndex: at }))}
                />
                {t("editRight")}
              </label>
            </div>
          ))}
        </fieldset>
      ))}
      <p className="teach-code__actions">
        <Button type="submit" disabled={save.isPending}>
          {t("editSave")}
        </Button>
        <Link href={back}>{t("editCancel")}</Link>
      </p>
      {nothing ? <p role="status">{t("editNothing")}</p> : null}
      {save.error ? <p role="alert">{errorText(save.error.message)}</p> : null}
    </form>
  );
}

/** A teacher edits their saved lesson's words and questions; pictures and sources stay (#398). */
export function EditLesson() {
  const t = useT("teach");
  const errorText = useErrorText();
  const lessonId = useSearchParams().get("id") ?? "";
  const opened = useQuery({
    queryFn: () => api("openSavedLesson", { lessonId }),
    queryKey: ["account", "saved-lesson", lessonId],
    retry: false,
  });
  if (opened.isPending) {
    return (
      <main id="main" className="prose-page">
        <StatusLine>{t("editOpening")}</StatusLine>
      </main>
    );
  }
  if (!opened.data || opened.isError) {
    return (
      <main id="main" className="prose-page">
        <h1>{t("editLesson")}</h1>
        <p role="alert">{errorText(opened.error?.message)}</p>
      </main>
    );
  }
  const { lesson } = opened.data;
  return (
    <main id="main" className="prose-page">
      <h1>{t("editHeading", { title: lesson.title })}</h1>
      <p className="home__lead">{t("editLead")}</p>
      <Form lesson={lesson} />
    </main>
  );
}
