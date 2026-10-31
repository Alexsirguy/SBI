"use client";

import type { Claim, Lesson, LessonSources } from "@sbi/contracts";
import { MODULE_LABELS } from "./modules/labels";

interface CitationIndex {
  claims: Map<string, Claim>;
  /** Source id to its number in the source list, in first-cited order. */
  numbers: Map<string, number>;
  titles: Map<string, string>;
}

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

export const sourceAnchor = (number: number) => `source-${number}`;

const STATUS_LABELS: Partial<Record<Claim["status"], string>> = {
  qualified: "Based on limited evidence",
  disputed: "Sources disagree",
  unsupported: "Not yet confirmed",
};

/** Every statement the lesson rests on, by section, with its status and sources; read last. */
export function EvidenceList({ lesson, sources }: { lesson: Lesson; sources?: LessonSources }) {
  const index = citationIndex(lesson, sources);
  const sourceOf = new Map([...index.numbers].map(([id, number]) => [number, id]));
  const seen = new Set<string>();
  const groups = lesson.sections.flatMap((section) => {
    const claims = section.claimIds.flatMap((id) => {
      const claim = index.claims.get(id);
      if (!claim || seen.has(id)) return [];
      seen.add(id);
      return [claim];
    });
    return claims.length > 0 ? [{ section, claims }] : [];
  });
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="evidence-heading" className="lesson-evidence">
      <h2 id="evidence-heading">How do we know?</h2>
      <p>Each statement in the lesson, and where it comes from.</p>
      {groups.map(({ section, claims }) => (
        <div key={section.sectionId}>
          <h3>{section.heading ?? MODULE_LABELS[section.module]}</h3>
          <ul>
            {claims.map((claim) => {
              const numbers = [
                ...new Set(claim.sourceIds.flatMap((id) => index.numbers.get(id) ?? [])),
              ].sort((a, b) => a - b);
              const status = claim.origin === "model" ? undefined : STATUS_LABELS[claim.status];
              return (
                <li key={claim.claimId}>
                  {status ? <strong>{status}: </strong> : null}
                  {claim.text}
                  {claim.uncertainty && status ? ` ${claim.uncertainty}` : ""}{" "}
                  {claim.origin === "model" ? (
                    <span className="evidence-origin">(the AI&apos;s general knowledge)</span>
                  ) : (
                    numbers.map((number) => (
                      <a
                        key={number}
                        href={`#${sourceAnchor(number)}`}
                        className="citation-marker"
                        aria-label={`Source ${number}: ${index.titles.get(sourceOf.get(number) ?? "") ?? ""}`}
                      >
                        [{number}]
                      </a>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
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
