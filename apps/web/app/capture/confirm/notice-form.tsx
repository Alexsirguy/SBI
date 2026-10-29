"use client";

import type { ApiRequest, TaxonomyMatch } from "@sbi/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { useNoticeObject } from "../use-recognition";

type Notes = Required<{ [K in keyof ApiRequest<"noticeObject">]: string }>;

const PROMPTS: { key: keyof Notes; label: string; hint: string }[] = [
  { key: "shape", label: "What shape is it?", hint: "For example: round, long and thin, spiky" },
  { key: "material", label: "What is it made of?", hint: "For example: metal, wood, glass" },
  {
    key: "use",
    label: "What does it do, or where did you find it?",
    hint: "For example: it boils water, it was in the park",
  },
  { key: "guess", label: "What do you think it is? (optional)", hint: "Your best guess is fine" },
];

interface NoticeFormProps {
  onResults: (results: TaxonomyMatch[], guess: string) => void;
}

// Prompts give learners words to search with when recognition and naming both failed.
export function NoticeForm({ onResults }: NoticeFormProps) {
  const id = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<Notes>({ guess: "", material: "", shape: "", use: "" });
  const notice = useNoticeObject();
  const empty = Object.values(notes).every((note) => !note.trim());

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  return (
    <form
      aria-labelledby={`${id}-legend`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!empty) {
          notice.mutate(notes, {
            onSuccess: ({ results }) => onResults(results, notes.guess.trim()),
          });
        }
      }}
    >
      <fieldset>
        <legend id={`${id}-legend`}>Tell us what you notice</legend>
        {PROMPTS.map(({ key, label, hint }, index) => (
          <div key={key}>
            <label htmlFor={`${id}-${key}`}>{label}</label>
            <input
              id={`${id}-${key}`}
              ref={index === 0 ? firstRef : undefined}
              name={key}
              maxLength={100}
              autoComplete="off"
              aria-describedby={`${id}-${key}-hint`}
              value={notes[key]}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setNotes((current) => ({ ...current, [key]: value }));
              }}
            />
            <span id={`${id}-${key}-hint`}> {hint}</span>
          </div>
        ))}
        <button
          type="submit"
          disabled={empty || notice.isPending}
          aria-describedby={empty ? `${id}-empty` : undefined}
        >
          Find matches
        </button>
        {empty ? <p id={`${id}-empty`}>Fill in at least one answer.</p> : null}
        {notice.isError ? <p role="alert">{notice.error.message}</p> : null}
      </fieldset>
    </form>
  );
}
