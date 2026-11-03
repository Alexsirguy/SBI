"use client";

import { Button, TextField } from "@sbi/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { lessonHref } from "../../lesson/lesson-request";
import { useT } from "../../i18n/provider";
import { handOffPhoto } from "../../photo-handoff";
import { readPrefs } from "../../lesson/prefs";

const MIN_LENGTH = 2;

/** Starts a lesson on whatever the learner names; nothing has to be in our catalogue (ADR 0013). */
export function DescribeForm({
  label,
  hint,
  submitLabel,
  message = "",
  onStart,
  onName,
}: {
  label?: string;
  hint?: string;
  submitLabel?: string;
  message?: string;
  /** Runs just before the lesson opens, so a photo step can hand its photo on. */
  onStart?: (name: string) => void;
  /** Takes the name instead of opening a lesson, for a step that asks what to learn first. */
  onName?: (name: string) => void;
}) {
  const t = useT("capture");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [started, setStarted] = useState<string | null>(null);

  return (
    // Unnamed, so it is not a landmark: the photo step and the text section can both show one.
    <form
      className="describe-form"
      onSubmit={(event) => {
        event.preventDefault();
        // "a rainbow" names the same thing as "rainbow", and reads better as a lesson title.
        const name = text
          .trim()
          .replace(/\s+/g, " ")
          .replace(/^(a|an|the) /i, "");
        if (name.length < MIN_LENGTH) {
          setError(t("minLetters", { count: MIN_LENGTH }));
          inputRef.current?.focus();
          return;
        }
        setError(undefined);
        const named = name.charAt(0).toUpperCase() + name.slice(1);
        if (onName) {
          onName(named);
          return;
        }
        setStarted(named);
        // Without a photo step this is a new object, so an earlier photo must not show on its lesson.
        if (onStart) onStart(named);
        else handOffPhoto(null);
        router.push(lessonHref({ label: named }, { prefs: readPrefs() }));
      }}
    >
      <TextField
        ref={inputRef}
        label={label ?? t("describeLabel")}
        name="object-query"
        autoComplete="off"
        maxLength={80}
        value={text}
        error={error}
        hint={hint ?? t("describeHint")}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" variant={onStart || onName ? "quiet" : "primary"}>
        {submitLabel ?? t("startLesson")}
      </Button>
      <p role="status" className="sbi-status">
        {started ? t("startingLesson", { name: started }) : message}
      </p>
    </form>
  );
}
