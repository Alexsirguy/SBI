"use client";

import { readableText, type Claim, type Lesson, type LessonSources } from "@sbi/contracts";
import { type ReactNode, useEffect, useRef } from "react";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";
import { rich } from "./lesson-t";

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

/** The numbered source list, with credits and only the quotes licences allow. */
export function SourceList({ sources, lesson }: { sources: LessonSources; lesson: Lesson }) {
  const t = useT("lesson");
  const locale = useLocale();
  const { numbers } = citationIndex(lesson, sources);
  const listed = sources.sources
    .filter((source) => numbers.has(source.sourceId))
    .sort((a, b) => (numbers.get(a.sourceId) ?? 0) - (numbers.get(b.sourceId) ?? 0));
  const generated = new Date(lesson.reuse.generatedAt);
  const checked = lesson.reuse.validatedAt ? new Date(lesson.reuse.validatedAt) : undefined;
  const day = (date: Date) =>
    date.toLocaleDateString(INTL_LOCALE[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  return (
    <section aria-labelledby="sources-heading" className="lesson-sources">
      <SourcesFold count={listed.length}>
        <p>
          {rich(t(checked ? "sourcesWrittenChecked" : "sourcesWritten"), {
            written: <time dateTime={lesson.reuse.generatedAt}>{day(generated)}</time>,
            checked: checked ? (
              <time dateTime={lesson.reuse.validatedAt}>{day(checked)}</time>
            ) : null,
          })}
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
                        {t("licence")}
                      </a>
                    </>
                  ) : null}
                </p>
                <Quotes source={source} />
              </li>
            ))}
          </ol>
        ) : (
          <p>{t("noSources")}</p>
        )}
      </SourcesFold>
    </section>
  );
}

/** Collapsed until asked for, or opened by a link straight to one of its sources. */
function SourcesFold({ count, children }: { count: number; children: ReactNode }) {
  const t = useT("lesson");
  const fold = useRef<HTMLDetailsElement>(null);
  // A shared link to a source would otherwise land on a closed list.
  useEffect(() => {
    if (window.location.hash.startsWith("#source-") && fold.current) {
      fold.current.open = true;
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, []);
  return (
    <details ref={fold} className="lesson-fold">
      <summary>
        <h2 id="sources-heading">{t("sourcesHeading")}</h2>
        <span className="lesson-fold__count">
          {t(count === 1 ? "sourceCountOne" : "sourceCountOther", { count })}
        </span>
      </summary>
      {children}
    </details>
  );
}

/** The passages a source is quoted for, behind their own toggle so the list stays short. */
function Quotes({ source }: { source: LessonSources["sources"][number] }) {
  const t = useT("lesson");
  const quotes = source.excerpts.filter((excerpt) => excerpt.mode === "quote" && excerpt.text);
  if (quotes.length === 0) return null;
  return (
    <details className="source-quotes">
      <summary>
        {quotes.length === 1 ? t("quotesOne") : t("quotesOther", { count: quotes.length })}
      </summary>
      {quotes.map((excerpt) => (
        <blockquote key={excerpt.excerptId} cite={source.url}>
          <p>{readableText(excerpt.text ?? "")}</p>
          {excerpt.location ? <footer>{excerpt.location}</footer> : null}
        </blockquote>
      ))}
    </details>
  );
}
