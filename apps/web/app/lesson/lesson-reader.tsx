"use client";

import type { LessonDisclaimer, LessonRequest } from "@sbi/contracts";
import { CitationProvider, citationIndex, SourceList } from "./citations";
import { sectionAnchor } from "./modules/frame";
import { MODULE_LABELS, MODULES } from "./modules/labels";
import { SectionView } from "./modules/section-view";
import { useLessonStream } from "./use-lesson-stream";

interface LessonReaderProps {
  request: LessonRequest;
  /** The confirmed object's name, shown until the lesson brings its own title. */
  label: string;
  fetcher?: typeof fetch;
}

function Disclaimers({ items }: { items: LessonDisclaimer[] }) {
  if (items.length === 0) return null;
  return (
    <aside aria-label="Before you read" className="lesson-notices">
      <ul>
        {items.map((item) => (
          <li key={item.kind} className={`notice notice-${item.kind}`}>
            <strong>{item.kind === "safety" ? "Safety: " : "Note: "}</strong>
            {item.message}
          </li>
        ))}
      </ul>
    </aside>
  );
}

// Text first: the quick answer, then sections as they arrive; visuals load only after the text.
export function LessonReader({ request, label, fetcher }: LessonReaderProps) {
  const { status, progress, answer, lesson, sources, visuals, error, retry } = useLessonStream(
    request,
    fetcher,
  );
  const loading = status === "loading";
  const disclaimers = lesson?.disclaimers ?? answer?.disclaimers ?? [];
  const sections = new Map(lesson?.sections.map((section) => [section.module, section]));

  return (
    <main className="lesson">
      <h1>{lesson?.title ?? answer?.title ?? `Lesson: ${label}`}</h1>
      <p role="status" className="lesson-status">
        {status === "ready"
          ? "Lesson ready."
          : loading
            ? (progress?.message ?? "Starting your lesson…")
            : ""}
      </p>
      {error ? (
        <div role="alert" className="lesson-error">
          <p>{error}</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}
      <Disclaimers items={disclaimers} />
      {answer ? (
        <section aria-labelledby="quick-answer-heading" className="quick-answer">
          <h2 id="quick-answer-heading">Quick answer</h2>
          <p>{answer.shortAnswer}</p>
          {answer.note ? <p className="note">{answer.note}</p> : null}
        </section>
      ) : null}
      {error && !lesson ? null : (
        <>
          <nav aria-label="Lesson sections" className="lesson-nav">
            <ol>
              {MODULES.map((module) => {
                const section = sections.get(module);
                return (
                  <li key={module}>
                    {section ? (
                      <a href={`#${sectionAnchor(section)}`}>
                        {section.heading ?? MODULE_LABELS[module]}
                      </a>
                    ) : (
                      <span aria-disabled="true">{MODULE_LABELS[module]}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div aria-busy={!lesson} className="lesson-sections">
            {lesson ? (
              <CitationProvider value={citationIndex(lesson, sources)}>
                {lesson.sections.map((section) => (
                  <SectionView key={section.sectionId} section={section} lesson={lesson} />
                ))}
              </CitationProvider>
            ) : (
              MODULES.map((module) => (
                <div key={module} className="lesson-section skeleton" aria-hidden="true">
                  <p className="module-label">{MODULE_LABELS[module]}</p>
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                </div>
              ))
            )}
          </div>
          {lesson && sources ? <SourceList sources={sources} lesson={lesson} /> : null}
        </>
      )}
      {lesson && visuals && visuals.visuals.length > 0 ? (
        <section aria-labelledby="visuals-heading" className="lesson-visuals">
          <h2 id="visuals-heading">Pictures</h2>
          <ul>
            {visuals.visuals.map((visual) => (
              <li key={visual.visualId}>{visual.alt}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
