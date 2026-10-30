"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  TAXONOMY_QUERY_MIN_LENGTH,
  type CategoryFallback,
  type Certainty,
  type LearnerCandidate,
  type TaxonomyMatch,
} from "@sbi/contracts";
import type { z } from "zod";
import { lessonHref } from "../../lesson/lesson-request";
import { readPrefs } from "../../lesson/prefs";
import { useTaxonomySearch } from "../use-taxonomy-search";
import { NoticeForm } from "./notice-form";

export type Suggestion = TaxonomyMatch &
  Partial<Pick<LearnerCandidate, "certainty" | "reasons" | "parts">>;

interface ConfirmLessonProps {
  /** Level of the "Start this lesson?" heading, so it nests under the caller's section. */
  headingLevel: 2 | 3;
  initialCandidates?: Suggestion[];
  initialMessage?: string;
  /** A category the learner can learn about when unsure which object it is. */
  fallback?: z.output<typeof CategoryFallback>;
  /** Look-alikes the catalog cannot teach yet; picking one searches for it as a correction. */
  otherLabels?: string[];
  onStart?: (choice: TaxonomyMatch) => void;
  /** Set for photos, where the learner's own words correct what recognition suggested. */
  onCorrection?: (text: string) => void;
}

const CERTAINTY_LABELS: Record<Certainty, string> = {
  likely: "Likely",
  possible: "Possibly",
  unsure: "Not sure",
};

function matchesMessage(count: number, query: string): string {
  return count === 0
    ? `No matches for “${query}”. Try another word, like “kettle”.`
    : `${count} ${count === 1 ? "match" : "matches"} for “${query}”.`;
}

function describeSuggestion({ certainty, reasons = [] }: Suggestion): string | null {
  if (!certainty) {
    return null;
  }
  const sentences = reasons.map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1));
  return [CERTAINTY_LABELS[certainty], ...sentences].join(". ") + ".";
}

// Photo and text entry share this step so every lesson starts from a learner-confirmed object.
export function ConfirmLesson({
  headingLevel,
  initialCandidates = [],
  initialMessage = "",
  fallback,
  otherLabels = [],
  onStart,
  onCorrection,
}: ConfirmLessonProps) {
  const router = useRouter();
  const othersId = useId();
  const inputId = useId();
  const confirmHeadingId = useId();
  const describedById = useId();
  const partsId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const startedRef = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [message, setMessage] = useState(initialMessage);
  const [selected, setSelected] = useState<TaxonomyMatch | null>(null);
  const [started, setStarted] = useState(false);
  const [noticing, setNoticing] = useState(false);
  const [noticed, setNoticed] = useState<TaxonomyMatch[] | null>(null);
  const search = useTaxonomySearch(submitted);
  const suggesting = submitted === null && noticed === null;
  const candidates: Suggestion[] =
    noticed ?? (submitted === null ? initialCandidates : (search.data?.results ?? []));
  const [primary] = candidates;
  const parts = suggesting ? (primary?.parts ?? []) : [];
  const searchMessage =
    submitted === null
      ? null
      : search.isPending
        ? "Searching…"
        : search.isError
          ? search.error.message
          : matchesMessage(candidates.length, submitted);
  const assumed = selected && fallback?.taxonomyId === selected.taxonomyId ? fallback : null;

  useEffect(() => {
    if (started) {
      startedRef.current?.focus();
    } else if (selected) {
      confirmRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      (listRef.current?.querySelector("button") ?? inputRef.current)?.focus();
    }
  }, [selected, started, noticed]);

  function runSearch(text = query) {
    const trimmed = text.trim();
    if (trimmed.length < TAXONOMY_QUERY_MIN_LENGTH) {
      setSubmitted(null);
      setMessage(`Type at least ${TAXONOMY_QUERY_MIN_LENGTH} letters to search.`);
      return;
    }
    if (trimmed !== submitted) {
      onCorrection?.(trimmed);
    }
    setSubmitted(trimmed);
  }

  function showNoticed(results: TaxonomyMatch[], guess: string) {
    setNoticing(false);
    setNoticed(results);
    setSubmitted(null);
    if (results.length > 0) {
      setMessage(
        `${results.length} ${results.length === 1 ? "object matches" : "objects match"} what you noticed.`,
      );
      returnFocus.current = true;
    } else {
      // Nothing fits yet: hand the learner back to search, starting from their own guess.
      setQuery(guess);
      setMessage(
        "Thanks. We have noted this so we can add it. Try other words, or pick the closest object.",
      );
      inputRef.current?.focus();
    }
  }

  function chooseAgain() {
    returnFocus.current = true;
    setSelected(null);
    setMessage("");
  }

  function start() {
    if (selected) {
      onStart?.(selected);
      setStarted(true);
      router.push(lessonHref(selected.taxonomyId, selected.label, { prefs: readPrefs() }));
    }
  }

  if (started && selected) {
    return (
      <div>
        <p ref={startedRef} tabIndex={-1} role="status">
          Starting lesson: {selected.label}.
        </p>
      </div>
    );
  }

  return (
    <div>
      {selected ? (
        <section aria-labelledby={confirmHeadingId}>
          <Heading id={confirmHeadingId} ref={confirmRef} tabIndex={-1}>
            Start this lesson?
          </Heading>
          <p>Lesson about: {selected.label}.</p>
          {assumed ? <p>{assumed.assumption}</p> : null}
          <button type="button" onClick={start}>
            Start lesson
          </button>
          <button type="button" onClick={chooseAgain}>
            Choose again
          </button>
        </section>
      ) : (
        <>
          {candidates.length > 0 ? (
            <ul
              ref={listRef}
              aria-label={
                suggesting && primary?.certainty ? "What we think it is" : "Matching objects"
              }
            >
              {candidates.map((candidate, index) => {
                const description = describeSuggestion(candidate);
                return (
                  <li key={candidate.taxonomyId}>
                    <button
                      type="button"
                      aria-describedby={description ? `${describedById}-${index}` : undefined}
                      onClick={() => setSelected(candidate)}
                    >
                      {candidate.label}
                    </button>
                    {description ? (
                      <span id={`${describedById}-${index}`}> {description}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {parts.length > 0 && primary ? (
            <>
              <p id={partsId}>Is it only part of a {primary.label.toLowerCase()}? Pick the part:</p>
              <ul aria-labelledby={partsId}>
                {parts.map((part) => (
                  <li key={part.taxonomyId}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({
                          ...part,
                          label: `${primary.label}: ${part.label.toLowerCase()}`,
                        })
                      }
                    >
                      {part.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {suggesting && otherLabels.length > 0 ? (
            <>
              <p id={othersId}>Or something we cannot teach yet:</p>
              <ul aria-labelledby={othersId}>
                {otherLabels.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(label);
                        runSearch(label);
                      }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {suggesting && fallback ? (
            <button type="button" onClick={() => setSelected(fallback)}>
              Not sure? Learn about {fallback.label.toLowerCase()}
            </button>
          ) : null}
          <label htmlFor={inputId}>
            {onCorrection ? "Not right? Tell us what it is" : "Describe the object"}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            name="object-query"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSubmitted(null);
              setNoticed(null);
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
              }
            }}
          />
          <button type="button" onClick={() => runSearch()}>
            Search objects
          </button>
          {noticing ? (
            <NoticeForm onResults={showNoticed} />
          ) : candidates.length === 0 && !search.isFetching ? (
            <button type="button" onClick={() => setNoticing(true)}>
              Can&apos;t find it? Tell us what you notice
            </button>
          ) : null}
        </>
      )}
      <p role="status">{searchMessage ?? message}</p>
    </div>
  );
}
