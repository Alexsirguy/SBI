"use client";

import Link from "next/link";
import type { LessonDisclaimer, LessonRequest, LessonVisuals } from "@sbi/contracts";
import { Button, Mark, Notice, Placeholder, StatusLine, VisuallyHidden } from "@sbi/ui";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { AskQuestion } from "./ask-question";
import { CitationProvider, citationIndex, SourceList } from "./citations";
import { DepthControls } from "./depth-controls";
import { LessonFeedback } from "./feedback";
import { lessonHref } from "./lesson-request";
import { sectionAnchor } from "./modules/frame";
import { MODULE_LABELS, MODULES } from "./modules/labels";
import { SectionView } from "./modules/section-view";
import { DEPTHS, type LessonPrefs, writePrefs } from "./prefs";
import { useCurrentSection } from "./use-current-section";
import { useLessonStream } from "./use-lesson-stream";

interface LessonReaderProps {
  request: LessonRequest;
  /** What the lesson is about, shown until the lesson brings its own title. */
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
      {items.map((item) => (
        <Notice key={item.kind} kind={item.kind === "safety" ? "safety" : "note"}>
          {item.message}
        </Notice>
      ))}
    </aside>
  );
}

// Reserved from the start so diagrams arrive without moving the text the learner is reading.
function VisualsSlot({ visuals }: { visuals: LessonVisuals["visuals"] }) {
  if (visuals.length === 0) return null;
  return (
    <section aria-labelledby="visuals-heading" className="lesson-visuals">
      <h2 id="visuals-heading">Pictures</h2>
      <ul>
        {visuals.map((visual) => (
          <li key={visual.visualId}>{visual.alt}</li>
        ))}
      </ul>
    </section>
  );
}

// Text first: the quick answer, then sections as they arrive; visuals load only after the text.
export function LessonReader({ request, label, prefs, question, fetcher }: LessonReaderProps) {
  const router = useRouter();
  const subject = { label, taxonomyId: request.taxonomyId };
  // The choice in the URL is the learner's latest, so it is what the session remembers.
  useEffect(() => writePrefs(prefs), [prefs]);
  // A choice shows at once and lasts until the URL catches up; it is tied to the prefs it
  // replaced, so arriving at any other URL (back button included) shows that URL's prefs.
  const [pending, setPending] = useState<{ from: string; next: LessonPrefs }>();
  const current = `${prefs.depth}/${prefs.age}`;
  const chosen = pending?.from === current ? pending.next : prefs;
  const choose = (next: LessonPrefs) => {
    setPending({ from: current, next });
    router.replace(lessonHref(subject, { question, prefs: next }), {
      scroll: false,
    });
  };
  const { status, progress, answer, lesson, sources, visuals, error, retry } = useLessonStream(
    request,
    fetcher,
  );
  // The spec promises a fresh answer is always available, so a reused lesson can be replaced.
  const askFresh = () => router.push(lessonHref(subject, { question, prefs, fresh: true }));
  const written = lesson ? new Date(lesson.reuse.generatedAt) : undefined;
  const loading = status === "loading";
  const disclaimers = lesson?.disclaimers ?? answer?.disclaimers ?? [];
  const sections = new Map(lesson?.sections.map((section) => [section.module, section]));
  const anchors = lesson?.sections.map((section) => sectionAnchor(section)) ?? [];
  const currentSection = useCurrentSection(anchors);
  const progressIndex = currentSection ? anchors.indexOf(currentSection) : -1;

  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        <p className="module-label">
          {label} · {DEPTHS[chosen.depth].label}
        </p>
        <h1>{lesson?.title ?? answer?.title ?? `Lesson: ${label}`}</h1>
        {/* Recognition can be wrong, and the lesson starts without asking, so a way back is always here. */}
        <p className="lesson-head__change">
          <Link href="/capture#text-entry">Not a {label.toLowerCase()}? Describe it instead</Link>
        </p>
        <DepthControls prefs={chosen} onChange={choose} />
      </header>
      <StatusLine>
        {status === "ready"
          ? "Lesson ready."
          : loading
            ? (progress?.message ?? "Starting your lesson…")
            : ""}
      </StatusLine>
      {error ? (
        <Notice kind="error" live>
          <p>{error}</p>
          <Button size="small" onClick={retry}>
            Try again
          </Button>
        </Notice>
      ) : null}
      <Disclaimers items={disclaimers} />
      {answer ? (
        <section aria-labelledby="quick-answer-heading" className="quick-answer">
          <h2 id="quick-answer-heading">Quick answer</h2>
          <p className="short-answer">
            <Mark>{answer.shortAnswer}</Mark>
          </p>
          {answer.note ? <p className="note">{answer.note}</p> : null}
          <p className="provenance">
            {answer.kind === "cached" && written
              ? `This lesson was written earlier for a similar question, on ${written.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}. `
              : answer.kind === "fallback"
                ? "This is a related lesson, shown because a new one could not be written. "
                : null}
            {status === "ready" && !request.fresh ? (
              <Button variant="quiet" size="small" onClick={askFresh}>
                Get a fresh answer
              </Button>
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
        <div className="reader-layout">
          <nav aria-label="Lesson sections" className="lesson-nav">
            <ol>
              {MODULES.map((module, index) => {
                const section = sections.get(module);
                return (
                  <li key={module}>
                    <span className="nav-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    {section ? (
                      <a
                        href={`#${sectionAnchor(section)}`}
                        aria-current={
                          currentSection === sectionAnchor(section) ? "location" : undefined
                        }
                      >
                        {section.heading ?? MODULE_LABELS[module]}
                      </a>
                    ) : (
                      <span>
                        {MODULE_LABELS[module]}
                        <VisuallyHidden> (loading)</VisuallyHidden>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="reader-main">
            <div aria-busy={!lesson} className="lesson-sections">
              {lesson ? (
                <CitationProvider value={citationIndex(lesson, sources)}>
                  {lesson.sections.map((section) => (
                    <Fragment key={section.sectionId}>
                      <SectionView
                        section={section}
                        lesson={lesson}
                        objectLabel={label}
                        askQuestion={<AskQuestion subject={subject} prefs={prefs} />}
                      />
                      {/* Pictures sit beside the mechanism they show, after the text (#83). */}
                      {section.module === "how-parts-work" ? (
                        <VisualsSlot visuals={visuals?.visuals ?? []} />
                      ) : null}
                    </Fragment>
                  ))}
                </CitationProvider>
              ) : (
                MODULES.map((module) => (
                  <div key={module} className="lesson-section" aria-hidden="true">
                    <p className="module-label">{MODULE_LABELS[module]}</p>
                    <Placeholder lines={2} />
                  </div>
                ))
              )}
            </div>
            {lesson && sources ? <SourceList sources={sources} lesson={lesson} /> : null}
            {lesson ? <LessonFeedback lessonId={lesson.lessonId} version={lesson.version} /> : null}
          </div>
        </div>
      )}
      {lesson && progressIndex >= 0 ? (
        <div className="reading-progress" aria-hidden="true">
          <span>
            {progressIndex + 1} of {lesson.sections.length} ·{" "}
            {lesson.sections[progressIndex]?.heading ??
              MODULE_LABELS[lesson.sections[progressIndex]?.module ?? "what-youre-seeing"]}
          </span>
          <span className="reading-progress__track">
            <span
              className="reading-progress__fill"
              style={{ width: `${((progressIndex + 1) / lesson.sections.length) * 100}%` }}
            />
          </span>
        </div>
      ) : null}
    </main>
  );
}
