"use client";

import { Button, TextField } from "@sbi/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { lessonHref } from "../../lesson/lesson-request";
import { readPrefs } from "../../lesson/prefs";

const MIN_LENGTH = 2;

/** Starts a lesson on whatever the learner names; nothing has to be in our catalogue (ADR 0013). */
export function DescribeForm({
  label = "What is it?",
  hint = "Anything you can see or name, like a kettle, a rainbow or a bike bell.",
  submitLabel = "Start lesson",
  message = "",
  onStart,
}: {
  label?: string;
  hint?: string;
  submitLabel?: string;
  message?: string;
  /** Runs just before the lesson opens, so a photo step can hand its photo on. */
  onStart?: () => void;
}) {
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
          setError(`Type at least ${MIN_LENGTH} letters.`);
          inputRef.current?.focus();
          return;
        }
        setError(undefined);
        const named = name.charAt(0).toUpperCase() + name.slice(1);
        setStarted(named);
        onStart?.();
        router.push(lessonHref({ label: named }, { prefs: readPrefs() }));
      }}
    >
      <TextField
        ref={inputRef}
        label={label}
        name="object-query"
        autoComplete="off"
        maxLength={80}
        value={text}
        error={error}
        hint={hint}
        onChange={(event) => setText(event.target.value)}
      />
      <Button type="submit" variant={onStart ? "quiet" : "primary"}>
        {submitLabel}
      </Button>
      <p role="status" className="sbi-status">
        {started ? `Starting lesson: ${started}.` : message}
      </p>
    </form>
  );
}
