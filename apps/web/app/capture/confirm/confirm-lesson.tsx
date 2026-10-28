"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MIN_QUERY_LENGTH, searchTaxonomy, type CandidateChoice } from "../taxonomy";

interface ConfirmLessonProps {
  /** Level of the "Start this lesson?" heading, so it nests under the caller's section. */
  headingLevel: 2 | 3;
  initialCandidates?: CandidateChoice[];
  initialMessage?: string;
  search?: (query: string) => CandidateChoice[];
}

function matchesMessage(count: number, query: string): string {
  return count === 0
    ? `No matches for “${query}”. Try another word, like “kettle”.`
    : `${count} ${count === 1 ? "match" : "matches"} for “${query}”.`;
}

// Photo and text entry share this step so every lesson starts from a learner-confirmed object.
export function ConfirmLesson({
  headingLevel,
  initialCandidates = [],
  initialMessage = "",
  search = searchTaxonomy,
}: ConfirmLessonProps) {
  const inputId = useId();
  const confirmHeadingId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const startedRef = useRef<HTMLParagraphElement>(null);
  const returnFocus = useRef(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState(initialCandidates);
  const [message, setMessage] = useState(initialMessage);
  const [selected, setSelected] = useState<CandidateChoice | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) {
      startedRef.current?.focus();
    } else if (selected) {
      confirmRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      (listRef.current?.querySelector("button") ?? inputRef.current)?.focus();
    }
  }, [selected, started]);

  function runSearch() {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setCandidates([]);
      setMessage(`Type at least ${MIN_QUERY_LENGTH} letters to search.`);
      return;
    }
    const found = search(trimmed);
    setCandidates(found);
    setMessage(matchesMessage(found.length, trimmed));
  }

  function chooseAgain() {
    returnFocus.current = true;
    setSelected(null);
    setMessage("");
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
          <button type="button" onClick={() => setStarted(true)}>
            Start lesson
          </button>
          <button type="button" onClick={chooseAgain}>
            Choose again
          </button>
        </section>
      ) : (
        <>
          {candidates.length > 0 ? (
            <ul ref={listRef} aria-label="Matching objects">
              {candidates.map((candidate) => (
                <li key={candidate.taxonomyId}>
                  <button type="button" onClick={() => setSelected(candidate)}>
                    {candidate.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label htmlFor={inputId}>Describe the object</label>
          <input
            id={inputId}
            ref={inputRef}
            name="object-query"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCandidates(initialCandidates);
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
              }
            }}
          />
          <button type="button" onClick={runSearch}>
            Search objects
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
