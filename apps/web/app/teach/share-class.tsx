"use client";

import type { TeacherClass } from "@sbi/contracts";
import { Button, VisuallyHidden } from "@sbi/ui";
import { useId, useState } from "react";
import { useT } from "../i18n/provider";
import { useErrorText } from "../lesson/lesson-t";
import { useClassMutation } from "./use-classes";

export const classLink = (joinCode: string) => `${window.location.origin}/class?code=${joinCode}`;

function useCopy() {
  const [copied, setCopied] = useState<string>();
  const copy = (value: string, done: string) =>
    void navigator.clipboard
      ?.writeText(value)
      .then(() => setCopied(done))
      .catch(() => setCopied(undefined));
  return { copied, copy };
}

/** The class's code and link on its list card, with one press to copy the link. */
export function CardShare({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const { copied, copy } = useCopy();
  if (!item.joinCode) return null;
  const { joinCode } = item;
  return (
    <div className="teach-card__share">
      <span>
        {t("codeLabel")}: <strong className="teach-share__code-inline">{joinCode}</strong>
      </span>
      <Button variant="quiet" size="small" onClick={() => copy(classLink(joinCode), t("copied"))}>
        {t("copyLink")}
        <VisuallyHidden>: {item.name}</VisuallyHidden>
      </Button>
      {copied ? <span role="status">{copied}</span> : null}
    </div>
  );
}

/** Code and link at the top of a class's page, always there to copy (#412). */
export function ShareBox({ item }: { item: TeacherClass }) {
  const t = useT("teach");
  const errorText = useErrorText();
  const rotate = useClassMutation("rotateClassCode");
  const { copied, copy } = useCopy();
  const headingId = useId();
  const code = item.joinCode;

  return (
    <section className="teach-share" aria-labelledby={headingId}>
      <h2 id={headingId}>{t("shareHeading")}</h2>
      {code ? (
        <>
          <dl>
            <dt>{t("codeLabel")}</dt>
            <dd className="teach-code__code">{code}</dd>
            <dt>{t("linkLabel")}</dt>
            <dd>
              <code>{classLink(code)}</code>
            </dd>
          </dl>
          <p className="teach-code__actions">
            <Button onClick={() => copy(classLink(code), t("copied"))}>{t("copyLink")}</Button>
            <Button variant="quiet" onClick={() => copy(code, t("copiedCode"))}>
              {t("copyCode")}
            </Button>
          </p>
          {copied ? <p role="status">{copied}</p> : null}
        </>
      ) : (
        <>
          <p>{t("codeMissing")}</p>
          <Button
            disabled={rotate.isPending}
            onClick={() => rotate.mutate({ classId: item.classId })}
          >
            {t("newCode")}
          </Button>
          {rotate.error ? <p role="alert">{errorText(rotate.error.message)}</p> : null}
        </>
      )}
    </section>
  );
}
