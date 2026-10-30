"use client";

import type { Claim, Lesson, LessonSection, LessonSources } from "@sbi/contracts";
import { createContext, useContext } from "react";

interface CitationIndex {
  claims: Map<string, Claim>;
  /** Source id to its number in the source list, in first-cited order. */
  numbers: Map<string, number>;
  titles: Map<string, string>;
}

const Citations = createContext<CitationIndex | null>(null);

export function citationIndex(lesson: Lesson, sources: LessonSources | undefined): CitationIndex {
  const titles = new Map(sources?.sources.map((source) => [source.sourceId, source.title]));
  const numbers = new Map<string, number>();
  for (const section of lesson.sections) {
    for (const claimId of section.claimIds) {
      const claim = lesson.claims.find((item) => item.claimId === claimId);
      for (const sourceId of claim?.sourceIds ?? []) {
        if (titles.has(sourceId) && !numbers.has(sourceId)) numbers.set(sourceId, numbers.size + 1);
      }
    }
  }
  return { claims: new Map(lesson.claims.map((claim) => [claim.claimId, claim])), numbers, titles };
}

export const CitationProvider = Citations.Provider;

export const sourceAnchor = (number: number) => `source-${number}`;

// Model-knowledge claims are covered by the one lesson-level notice (ADR 0011), not per section.
const STATUS_LABELS: Partial<Record<Claim["status"], string>> = {
  qualified: "Based on limited evidence",
  disputed: "Sources disagree",
  unsupported: "Not yet confirmed",
};

/** Markers for a section's sources and words for any claim that is not fully settled. */
export function SectionCitations({ section }: { section: LessonSection }) {
  const index = useContext(Citations);
  if (!index) return null;
  const claims = section.claimIds.flatMap((id) => index.claims.get(id) ?? []);
  const numbers = [
    ...new Set(
      claims.flatMap((claim) => claim.sourceIds.flatMap((id) => index.numbers.get(id) ?? [])),
    ),
  ].sort((a, b) => a - b);
  const sourceOf = new Map([...index.numbers].map(([id, number]) => [number, id]));
  const unsettled = claims.filter(
    (claim) => claim.origin !== "model" && STATUS_LABELS[claim.status],
  );
  if (numbers.length === 0 && unsettled.length === 0) return null;
  return (
    <div className="section-citations">
      {numbers.length > 0 ? (
        <p>
          Sources:{" "}
          {numbers.map((number) => (
            <a
              key={number}
              href={`#${sourceAnchor(number)}`}
              className="citation-marker"
              aria-label={`Source ${number}: ${index.titles.get(sourceOf.get(number) ?? "") ?? ""}`}
            >
              [{number}]
            </a>
          ))}
        </p>
      ) : null}
      {unsettled.length > 0 ? (
        <ul className="claim-status">
          {unsettled.map((claim) => (
            <li key={claim.claimId}>
              <strong>{STATUS_LABELS[claim.status]}:</strong> {claim.text}
              {claim.uncertainty ? ` ${claim.uncertainty}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The numbered source list markers link to, with credits and only the quotes licences allow. */
export function SourceList({ sources, lesson }: { sources: LessonSources; lesson: Lesson }) {
  const { numbers } = citationIndex(lesson, sources);
  const listed = sources.sources
    .filter((source) => numbers.has(source.sourceId))
    .sort((a, b) => (numbers.get(a.sourceId) ?? 0) - (numbers.get(b.sourceId) ?? 0));
  const generated = new Date(lesson.reuse.generatedAt);
  const checked = lesson.reuse.validatedAt ? new Date(lesson.reuse.validatedAt) : undefined;
  const day = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  return (
    <section aria-labelledby="sources-heading" className="lesson-sources">
      <h2 id="sources-heading">Sources</h2>
      <p>
        Lesson written <time dateTime={lesson.reuse.generatedAt}>{day(generated)}</time>
        {checked ? (
          <>
            {"; sources last checked "}
            <time dateTime={lesson.reuse.validatedAt}>{day(checked)}</time>
          </>
        ) : null}
        .
      </p>
      {listed.length > 0 ? (
        <ol>
          {listed.map((source) => (
            <li key={source.sourceId} id={sourceAnchor(numbers.get(source.sourceId) ?? 0)}>
              {source.url ? (
                <a href={source.url} rel="noopener noreferrer" target="_blank">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              <p className="credit">
                {source.credit}
                {source.license?.url ? (
                  <>
                    {" "}
                    <a href={source.license.url} rel="noopener noreferrer" target="_blank">
                      Licence
                    </a>
                  </>
                ) : null}
              </p>
              {source.excerpts
                .filter((excerpt) => excerpt.mode === "quote" && excerpt.text)
                .map((excerpt) => (
                  <blockquote key={excerpt.excerptId} cite={source.url}>
                    <p>{excerpt.text}</p>
                    {excerpt.location ? <footer>{excerpt.location}</footer> : null}
                  </blockquote>
                ))}
            </li>
          ))}
        </ol>
      ) : (
        <p>No outside source is cited; see the note at the top of the lesson.</p>
      )}
    </section>
  );
}
