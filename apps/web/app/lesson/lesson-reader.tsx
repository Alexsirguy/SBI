"use client";

import type { LessonDisclaimer, LessonRequest } from "@sbi/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AskQuestion } from "./ask-question";
import { CitationProvider, citationIndex, SourceList } from "./citations";
import { DepthControls } from "./depth-controls";
import { LessonFeedback } from "./feedback";
import { lessonHref } from "./lesson-request";
import { sectionAnchor } from "./modules/frame";
import { MODULE_LABELS, MODULES } from "./modules/labels";
import { SectionView } from "./modules/section-view";
import { type LessonPrefs, writePrefs } from "./prefs";
import { useLessonStream } from "./use-lesson-stream";

interface LessonReaderProps {
  request: LessonRequest;
  /** The confirmed object's name, shown until the lesson brings its own title. */
  label: string;
  /** The depth and age band this request was built from. */
  prefs: LessonPrefs;
  /** The learner's own question, when they asked one. */
  question?: string;
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
export function LessonReader({ request, label, prefs, question, fetcher }: LessonReaderProps) {
  const router = useRouter();
  // The choice in the URL is the learner's latest, so it is what the session remembers.
  useEffect(() => writePrefs(prefs), [prefs]);
  // A choice shows at once and lasts until the URL catches up; it is tied to the prefs it
  // replaced, so arriving at any other URL (back button included) shows that URL's prefs.
  const [pending, setPending] = useState<{ from: string; next: LessonPrefs }>();
  const current = `${prefs.depth}/${prefs.age}`;
  const chosen = pending?.from === current ? pending.next : prefs;
  const choose = (next: LessonPrefs) => {
    setPending({ from: current, next });
    router.replace(lessonHref(request.taxonomyId, label, { question, prefs: next }), {
      scroll: false,
    });
  };
  const { status, progress, answer, lesson, sources, visuals, error, retry } = useLessonStream(
    request,
    fetcher,
  );
  // The spec promises a fresh answer is always available, so a reused lesson can be replaced.
  const askFresh = () =>
    router.push(lessonHref(request.taxonomyId, label, { question, prefs, fresh: true }));
  const written = lesson ? new Date(lesson.reuse.generatedAt) : undefined;
  const loading = status === "loading";
  const disclaimers = lesson?.disclaimers ?? answer?.disclaimers ?? [];
  const sections = new Map(lesson?.sections.map((section) => [section.module, section]));

  return (
    <main className="lesson">
      <h1>{lesson?.title ?? answer?.title ?? `Lesson: ${label}`}</h1>
      <DepthControls prefs={chosen} onChange={choose} />
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
          <p className="provenance">
            {answer.kind === "cached" && written
              ? `This lesson was written earlier for a similar question, on ${written.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}. `
              : answer.kind === "fallback"
                ? "This is a related lesson, shown because a new one could not be written. "
                : null}
            {status === "ready" && !request.fresh ? (
              <button type="button" onClick={askFresh}>
                Get a fresh answer
              </button>
            ) : null}
          </p>
        </section>
      ) : null}
      {lesson && lesson.learningObjectives.length > 0 ? (
        <section aria-labelledby="objectives-heading" className="objectives">
          <h2 id="objectives-heading">In this lesson</h2>
          <ul>
            {lesson.learningObjectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
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
                      <span>
                        {MODULE_LABELS[module]}
                        <span className="visually-hidden"> (loading)</span>
                      </span>
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
                  <SectionView
                    key={section.sectionId}
                    section={section}
                    lesson={lesson}
                    objectLabel={label}
                    askQuestion={
                      <AskQuestion taxonomyId={request.taxonomyId} label={label} prefs={prefs} />
                    }
                  />
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
          {lesson ? <LessonFeedback lessonId={lesson.lessonId} version={lesson.version} /> : null}
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
