"use client";

import { CurriculumId } from "@sbi/contracts";
import { Button, Disclosure, SelectField, StatusLine, TextField } from "@sbi/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAccount } from "../account/use-account";
import { useT } from "../i18n/provider";
import { useErrorText } from "../lesson/lesson-t";
import { ClassCard } from "./class-card";
import { CURRICULUM_LEVELS } from "./levels";
import { useBecomeEducator, useClasses, useClassMutation } from "./use-classes";

/** The full code, shown once after creating or rotating; only its hash is kept (ADR 0027). */
export interface ShownCode {
  classId: string;
  name: string;
  joinCode: string;
}

export function CodePanel({ shown, onDone }: { shown: ShownCode; onDone: () => void }) {
  const t = useT("teach");
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/class?code=${shown.joinCode}`;
  return (
    <section className="teach-code" aria-labelledby="teach-code-heading" tabIndex={-1}>
      <h2 id="teach-code-heading">{t("codeHeading", { name: shown.name })}</h2>
      <p>{t("codeText")}</p>
      <dl>
        <dt>{t("codeLabel")}</dt>
        <dd className="teach-code__code">{shown.joinCode}</dd>
        <dt>{t("linkLabel")}</dt>
        <dd>
          <code>{link}</code>
        </dd>
      </dl>
      <p className="teach-code__actions">
        <Button
          variant="quiet"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(link)
              .then(() => setCopied(true))
              .catch(() => undefined)
          }
        >
          {t("copyLink")}
        </Button>
        <Button onClick={onDone}>{t("dismissCode")}</Button>
      </p>
      <p role="status">{copied ? t("copied") : ""}</p>
    </section>
  );
}

export function CreateClass({ onCreated }: { onCreated: (shown: ShownCode) => void }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const create = useClassMutation("createClass");
  const [name, setName] = useState("");
  const [curriculum, setCurriculum] = useState<"" | CurriculumId>("");
  const [level, setLevel] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { curriculum: curriculum || null, level: level || null, name },
      {
        onSuccess: (result) => {
          setName("");
          onCreated({
            classId: result.class.classId,
            joinCode: result.joinCode,
            name: result.class.name,
          });
        },
      },
    );
  };

  return (
    <section className="account-card" aria-labelledby="teach-create">
      <h2 id="teach-create">{t("createHeading")}</h2>
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
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          {t("createButton")}
        </Button>
        {create.error ? <p role="alert">{errorText(create.error.message)}</p> : null}
      </form>
    </section>
  );
}

/** A teacher's classes as a short list; each class is managed on its own page (#113, #410). */
export function TeachHome() {
  const t = useT("teach");
  const errorText = useErrorText();
  const account = useAccount();
  const signedIn = !!account.data;
  const classes = useClasses(signedIn);
  const become = useBecomeEducator();
  const [shown, setShown] = useState<ShownCode>();
  const [creating, setCreating] = useState(false);

  if (account.isPending || (signedIn && classes.isPending)) {
    return <StatusLine>{t("checking")}</StatusLine>;
  }
  if (!signedIn) {
    return (
      <p>
        {t("signInFirst")}{" "}
        <Link href={`/account/sign-in?next=${encodeURIComponent("/teach")}`}>{t("signIn")}</Link>
      </p>
    );
  }
  if (classes.isError || !classes.data) {
    return <p role="alert">{errorText(classes.error?.message)}</p>;
  }
  if (!classes.data.educator) {
    return (
      <section className="account-card" aria-labelledby="teach-enable">
        <h2 id="teach-enable">{t("enableHeading")}</h2>
        <p>{t("enableText")}</p>
        <Button disabled={become.isPending} onClick={() => become.mutate()}>
          {t("enableButton")}
        </Button>
        {become.error ? <p role="alert">{errorText(become.error.message)}</p> : null}
      </section>
    );
  }
  const open = classes.data.classes.filter((item) => !item.archivedAt);
  const archived = classes.data.classes.filter((item) => item.archivedAt);
  // With no classes yet, making one is the only thing to do, so the form starts open.
  const showCreate = creating || classes.data.classes.length === 0;
  return (
    <div className="teach-home">
      {shown ? <CodePanel shown={shown} onDone={() => setShown(undefined)} /> : null}
      <div className="teach-home__head">
        {open.length === 0 ? <p className="teach-home__count">{t("noClasses")}</p> : <span />}
        {classes.data.classes.length > 0 ? (
          <Button aria-expanded={showCreate} onClick={() => setCreating(!creating)}>
            {t("dashNewClass")}
          </Button>
        ) : null}
      </div>
      {showCreate ? (
        <CreateClass
          onCreated={(created) => {
            setCreating(false);
            setShown(created);
          }}
        />
      ) : null}
      {open.length > 0 ? (
        <ul className="teach-cards">
          {open.map((item) => (
            <ClassCard key={item.classId} item={item} />
          ))}
        </ul>
      ) : null}
      {archived.length > 0 ? (
        <Disclosure summary={t("archivedHeading", { count: archived.length })}>
          <ul className="teach-cards">
            {archived.map((item) => (
              <ClassCard key={item.classId} item={item} />
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}
