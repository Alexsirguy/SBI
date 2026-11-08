"use client";

import {
  AudienceBand,
  CurriculumId,
  SafetyCategory,
  type ClassControls,
  type TeacherClass,
} from "@sbi/contracts";
import { Button, SelectField, TextField, VisuallyHidden } from "@sbi/ui";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useAccount } from "../account/use-account";
import { useSavedLessons } from "../account/use-saved-lessons";
import { useT } from "../i18n/provider";
import { useErrorText } from "../lesson/lesson-t";
import { CURRICULUM_LEVELS } from "./levels";
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
  const headingId = useId();
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
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{t("detailsHeading")}</h2>
      <form className="teach-form" onSubmit={submit}>
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
        <Button type="submit" disabled={update.isPending || !name.trim()}>
          {t("saveDetails")}
        </Button>
        {update.isSuccess ? <p role="status">{t("savedDetails")}</p> : null}
        {update.error ? <p role="alert">{errorText(update.error.message)}</p> : null}
      </form>
    </section>
  );
}

function JoinCode({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const rotate = useClassMutation("rotateClassCode");
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{t("codeSection")}</h2>
      <p className="account-card__hint" id={`${headingId}-hint`}>
        {t("newCodeHint")}
      </p>
      <Button
        variant="quiet"
        disabled={rotate.isPending}
        aria-describedby={`${headingId}-hint`}
        onClick={() => rotate.mutate({ classId: item.classId })}
      >
        {t("newCode")}
      </Button>
      {rotate.isSuccess ? <p role="status">{t("newCodeMade")}</p> : null}
      {rotate.error ? <p role="alert">{errorText(rotate.error.message)}</p> : null}
    </section>
  );
}

export function ArchiveClass({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const archive = useClassMutation("archiveClass");
  const headingId = useId();
  const archived = !!item.archivedAt;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{archived ? t("restore") : t("archive")}</h2>
      {archived ? null : <p className="account-card__hint">{t("archiveHint")}</p>}
      <Button
        variant="quiet"
        disabled={archive.isPending}
        onClick={() => archive.mutate({ archived: !archived, classId: item.classId })}
      >
        {archived ? t("restore") : t("archive")}
      </Button>
      {archive.error ? <p role="alert">{errorText(archive.error.message)}</p> : null}
    </section>
  );
}

/** Name, curriculum and level, then the join code and archiving, each in its own block. */
export function EditPanel({ item }: { item: TeacherClass }) {
  return (
    <div className="teach-panel">
      <Details item={item} />
      <JoinCode item={item} />
      <ArchiveClass item={item} />
    </div>
  );
}

/** The class's lessons, then the teacher's saved lessons that can still be added. */
export function LessonsPanel({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const account = useAccount();
  const saved = useSavedLessons(!!account.data);
  const add = useClassMutation("addClassLesson");
  const remove = useClassMutation("removeClassLesson");
  const inClass = new Set(item.lessons.map((lesson) => lesson.lessonId));
  const addable = (saved.data ?? []).filter((lesson) => !inClass.has(lesson.lessonId));
  const inId = useId();
  const addId = useId();

  return (
    <div className="teach-panel">
      <section aria-labelledby={inId}>
        <h2 id={inId}>{t("inClassHeading", { count: item.lessons.length })}</h2>
        {item.lessons.length === 0 ? (
          <p>{t("noLessons")}</p>
        ) : (
          <ul className="teach-lessons">
            {item.lessons.map((lesson) => (
              <li key={lesson.lessonId}>
                <span className="teach-lessons__title">{lesson.title}</span>
                <span className="teach-lessons__actions">
                  <Link
                    className="sbi-button sbi-button--quiet sbi-button--small"
                    href={`/lesson/saved?id=${lesson.lessonId}`}
                  >
                    {t("lessonOpen")}
                    <VisuallyHidden> {lesson.title}</VisuallyHidden>
                  </Link>
                  <Link
                    className="sbi-button sbi-button--quiet sbi-button--small"
                    href={`/lesson/saved/edit?id=${lesson.lessonId}`}
                  >
                    {t("lessonEdit")}
                    <VisuallyHidden> {lesson.title}</VisuallyHidden>
                  </Link>
                  <Button
                    variant="quiet"
                    size="small"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate({ classId: item.classId, lessonId: lesson.lessonId })
                    }
                  >
                    {t("lessonRemove")}
                    <VisuallyHidden> {lesson.title}</VisuallyHidden>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={addId}>
        <h2 id={addId}>{t("addHeading")}</h2>
        {saved.data && addable.length === 0 ? (
          <p className="account-card__hint">
            {saved.data.length === 0 ? t("noSaved") : t("allAdded")}
          </p>
        ) : null}
        {addable.length > 0 ? (
          <ul className="teach-lessons">
            {addable.map((lesson) => (
              <li key={lesson.lessonId}>
                <span className="teach-lessons__title">{lesson.title}</span>
                <Button
                  variant="quiet"
                  size="small"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ classId: item.classId, lessonId: lesson.lessonId })}
                >
                  {t("lessonAdd")}
                  <VisuallyHidden> {lesson.title}</VisuallyHidden>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <p>
          <Link href="/capture">{t("makeLesson")}</Link>
        </p>
        {add.error || remove.error ? (
          <p role="alert">{errorText((add.error ?? remove.error)?.message)}</p>
        ) : null}
      </section>
    </div>
  );
}

export function ControlsPanel({ item }: { item: TeacherClass }) {
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
    <section className="teach-panel" aria-labelledby={headingId}>
      <h2 id={headingId}>{t("controlsHeading")}</h2>
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
        <Button type="submit" disabled={update.isPending}>
          {t("saveControls")}
        </Button>
        {update.isSuccess ? <p role="status">{t("savedControls")}</p> : null}
        {update.error ? <p role="alert">{errorText(update.error.message)}</p> : null}
      </form>
    </section>
  );
}
