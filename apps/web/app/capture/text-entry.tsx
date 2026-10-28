"use client";

import { useId, useState } from "react";
import { ConfirmStart } from "./confirm-start";
import { resolveCandidates, type TaxonomyCandidate } from "./taxonomy";

export function TextEntry() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [candidates, setCandidates] = useState<TaxonomyCandidate[]>([]);
  const [selected, setSelected] = useState<TaxonomyCandidate | null>(null);
  const [started, setStarted] = useState(false);

  function search() {
    setCandidates(resolveCandidates(query));
    setSearched(true);
    setSelected(null);
    setStarted(false);
  }

  function back() {
    setSelected(null);
    setStarted(false);
  }

  return (
    <div>
      <label htmlFor={inputId}>Describe the object</label>
      <input
        id={inputId}
        name="object-query"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSearched(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            search();
          }
        }}
      />
      <button type="button" onClick={search}>
        Search objects
      </button>
      <div role="status">
        {searched && candidates.length === 0 ? (
          <p>No matches yet — new objects arrive as lessons are added. Try “kettle”.</p>
        ) : null}
      </div>
      {candidates.length > 0 && !selected ? (
        <ul aria-label="Matching objects">
          {candidates.map((candidate) => (
            <li key={candidate.taxonomyId}>
              <button type="button" onClick={() => setSelected(candidate)}>
                {candidate.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected && !started ? (
        <ConfirmStart
          subject={`Lesson about: ${selected.label}.`}
          onConfirm={() => setStarted(true)}
          onBack={back}
        />
      ) : null}
      {started && selected ? <p role="status">Starting lesson: {selected.label}.</p> : null}
    </div>
  );
}
