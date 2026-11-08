"use client";

import {
  AudienceBand,
  CurriculumId,
  SafetyCategory,
  type ClassControls,
  type TeacherClass,
} from "@sbi/contracts";
import { Button, SelectField, TextField } from "@sbi/ui";
import { useId, useState, type FormEvent } from "react";
import { useAccount } from "../account/use-account";
import { useSavedLessons } from "../account/use-saved-lessons";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";
import { useErrorText } from "../lesson/lesson-t";
import { ClassSummaryTable } from "./class-summary";
import { CURRICULUM_LEVELS } from "./levels";
import type { ShownCode } from "./teach-home";
import { useClassMutation } from "./use-classes";

const AGE_KEY = {
  child: "ageChild",
  teen: "ageTeen",
  adult: "ageAdult",
  general: "ageGeneral",
} as const;
const CATEGORY_KEY = {
  medical: "categoryMedical",
  "chemical-exposure": "categoryChemical",
  weapons: "categoryWeapons",
  "self-harm": "categorySelfHarm",
  "dangerous-biology": "categoryBiology",
} as const;

function Details({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const update = useClassMutation("updateClass");
  const [name, setName] = useState(item.name);
  const [curriculum, setCurriculum] = useState<"" | CurriculumId>(item.curriculum ?? "");
  const [level, setLevel] = useState(item.level ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({
      classId: item.classId,
      curriculum: curriculum || null,
      level: level || null,
      name,
    });
  };
  return (
    <form className="teach-form" onSubmit={submit} aria-label={t("detailsHeading")}>
      <TextField
        label={t("nameLabel")}
        hint={t("nameHint")}
        value={name}
        maxLength={60}
        required
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <SelectField
        label={t("curriculumLabel")}
        value={curriculum}
        onChange={(event) => {
          setCurriculum(event.currentTarget.value as "" | CurriculumId);
          setLevel("");
        }}
      >
        <option value="">{t("curriculumNone")}</option>
        {CurriculumId.options.map((id) => (
          <option key={id} value={id}>
            {t(id === "us" ? "curriculumUs" : "curriculumNg")}
          </option>
        ))}
      </SelectField>
      {curriculum ? (
        <SelectField
          label={t("levelLabel")}
          value={level}
          onChange={(event) => setLevel(event.currentTarget.value)}
        >
          <option value="">{t("levelAny")}</option>
          {CURRICULUM_LEVELS[curriculum].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      ) : null}
      <Button type="submit" variant="quiet" disabled={update.isPending || !name.trim()}>
        {t("saveDetails")}
      </Button>
      <p role="status">{update.isSuccess ? t("savedDetails") : ""}</p>
      {update.error ? <p role="alert">{errorText(update.error.message)}</p> : null}
    </form>
  );
}

function Lessons({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const account = useAccount();
  const saved = useSavedLessons(!!account.data);
  const add = useClassMutation("addClassLesson");
  const remove = useClassMutation("removeClassLesson");
  const [choice, setChoice] = useState("");
  const inClass = new Set(item.lessons.map((lesson) => lesson.lessonId));
  const addable = (saved.data ?? []).filter((lesson) => !inClass.has(lesson.lessonId));
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{t("lessonsHeading")}</h3>
      {item.lessons.length === 0 ? (
        <p>{t("noLessons")}</p>
      ) : (
        <ul className="teach-lessons">
          {item.lessons.map((lesson) => (
            <li key={lesson.lessonId}>
              <span>{lesson.title}</span>
              <Button
                variant="quiet"
                size="small"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ classId: item.classId, lessonId: lesson.lessonId })}
              >
                {t("removeLesson", { title: lesson.title })}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {saved.data && addable.length === 0 && item.lessons.length === 0 ? (
        <p className="account-card__hint">{t("noSaved")}</p>
      ) : null}
      {addable.length > 0 ? (
        <form
          className="teach-form teach-form--inline"
          onSubmit={(event) => {
            event.preventDefault();
            if (!choice) return;
            add.mutate(
              { classId: item.classId, lessonId: choice },
              { onSuccess: () => setChoice("") },
            );
          }}
        >
          <SelectField
            label={t("addLessonLabel")}
            value={choice}
            onChange={(event) => setChoice(event.currentTarget.value)}
          >
            <option value="">{t("addLessonChoose")}</option>
            {addable.map((lesson) => (
              <option key={lesson.lessonId} value={lesson.lessonId}>
                {lesson.title}
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="quiet" disabled={add.isPending || !choice}>
            {t("addLessonButton")}
          </Button>
        </form>
      ) : null}
      {add.error || remove.error ? (
        <p role="alert">{errorText((add.error ?? remove.error)?.message)}</p>
      ) : null}
    </section>
  );
}

function Controls({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const update = useClassMutation("updateClass");
  const [controls, setControls] = useState<ClassControls>(item.controls);
  const headingId = useId();
  const toggle = (category: SafetyCategory, on: boolean) =>
    setControls((current) => ({
      ...current,
      blockedCategories: on
        ? [...current.blockedCategories, category]
        : current.blockedCategories.filter((other) => other !== category),
    }));

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{t("controlsHeading")}</h3>
      <form
        className="teach-form"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate({ classId: item.classId, controls });
        }}
      >
        <SelectField
          label={t("ageLockLabel")}
          value={controls.audienceLock ?? ""}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setControls((current) => ({
              ...current,
              audienceLock: value ? AudienceBand.parse(value) : null,
            }));
          }}
        >
          <option value="">{t("ageLockNone")}</option>
          {AudienceBand.options.map((band) => (
            <option key={band} value={band}>
              {t(AGE_KEY[band])}
            </option>
          ))}
        </SelectField>
        <fieldset className="teach-checks">
          <legend>{t("blockedLegend")}</legend>
          {SafetyCategory.options.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={controls.blockedCategories.includes(category)}
                onChange={(event) => toggle(category, event.currentTarget.checked)}
              />
              {t(CATEGORY_KEY[category])}
            </label>
          ))}
        </fieldset>
        <label className="teach-switch">
          <input
            type="checkbox"
            checked={controls.tutorEnabled}
            onChange={(event) => {
              const tutorEnabled = event.currentTarget.checked;
              setControls((current) => ({ ...current, tutorEnabled }));
            }}
          />
          {t("tutorLabel")}
        </label>
        <Button type="submit" variant="quiet" disabled={update.isPending}>
          {t("saveControls")}
        </Button>
        <p role="status">{update.isSuccess ? t("savedControls") : ""}</p>
        {update.error ? <p role="alert">{errorText(update.error.message)}</p> : null}
      </form>
    </section>
  );
}

/** One class: its details, lessons and controls, plus a new code and archive (#113). */
export function ClassCard({
  item,
  onNewCode,
}: {
  item: TeacherClass;
  onNewCode: (shown: ShownCode) => void;
}) {
  const t = useT("teach");
  const locale = useLocale();
  const errorText = useErrorText();
  const rotate = useClassMutation("rotateClassCode");
  const archive = useClassMutation("archiveClass");
  const headingId = useId();
  const archivedAt = item.archivedAt
    ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "long" }).format(
        new Date(item.archivedAt),
      )
    : null;

  return (
    <section className="account-card teach-class" aria-labelledby={headingId}>
      <h2 id={headingId}>
        {item.name}
        {archivedAt ? <span className="teach-tag"> · {t("archivedTag")}</span> : null}
      </h2>
      <p className="account-card__hint">{t("codeHint", { hint: item.codeHint })}</p>
      {archivedAt ? (
        <p>{t("archivedText", { date: archivedAt })}</p>
      ) : (
        <>
          <Details item={item} />
          <Lessons item={item} />
          <Controls item={item} />
          <ClassSummaryTable classId={item.classId} />
          <p>
            <Button
              variant="quiet"
              disabled={rotate.isPending}
              aria-describedby={`${headingId}-rotate`}
              onClick={() =>
                rotate.mutate(
                  { classId: item.classId },
                  {
                    onSuccess: (result) =>
                      onNewCode({
                        classId: item.classId,
                        joinCode: result.joinCode,
                        name: result.class.name,
                      }),
                  },
                )
              }
            >
              {t("newCode")}
            </Button>{" "}
            <span id={`${headingId}-rotate`} className="account-card__hint">
              {t("newCodeHint")}
            </span>
          </p>
        </>
      )}
      <p>
        <Button
          variant="quiet"
          disabled={archive.isPending}
          onClick={() => archive.mutate({ archived: !archivedAt, classId: item.classId })}
        >
          {archivedAt ? t("restore") : t("archive")}
        </Button>
      </p>
      {rotate.error || archive.error ? (
        <p role="alert">{errorText((rotate.error ?? archive.error)?.message)}</p>
      ) : null}
    </section>
  );
}
