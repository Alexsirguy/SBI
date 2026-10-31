"use client";

import Link from "next/link";
import type { Lesson, LessonDisclaimer, LessonRequest, LessonVisuals } from "@sbi/contracts";
import { Button, Mark, Notice, StatusLine } from "@sbi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { handedOffPhoto } from "../photo-handoff";
import { Scanner } from "../scanner";
import { AskQuestion } from "./ask-question";
import { EvidenceList, SourceList } from "./citations";
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
  /** What the lesson is about, shown until the lesson brings its own title. */
  label: string;
  /** The depth and age band this request was built from. */
  prefs: LessonPrefs;
  /** The learner's own question, when they asked one. */
  question?: string;
  fetcher?: typeof fetch;
}

/** The prototype opens on what you're seeing and the short answer; the rest is one tap each. */
const FIRST_OPEN = 2;

// One notice, whatever the lesson carries, with any safety text first (owner decision, #281).
function LessonNotice({ items }: { items: LessonDisclaimer[] }) {
  if (items.length === 0) return null;
  const ordered = [...items].sort(
    (a, b) => Number(b.kind === "safety") - Number(a.kind === "safety"),
  );
  return (
    <aside aria-label="Before you read" className="lesson-notices">
      <Notice kind={ordered[0]?.kind === "safety" ? "safety" : "note"}>
        {ordered.map((item) => (
          <p key={item.kind}>{item.message}</p>
        ))}
      </Notice>
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

const noSubscription = () => () => undefined;

/** The learner's photo from the capture step, if this visit came from one; never on the server. */
function useHandedOffPhoto() {
  return useSyncExternalStore(noSubscription, handedOffPhoto, () => null);
}

/** The prototype's rail: open steps in full, the rest as faint titles until the learner asks. */
function LessonRail({
  lesson,
  label,
  askQuestion,
  visuals,
  shown,
  onOpen,
}: {
  lesson?: Lesson;
  label: string;
  askQuestion: ReactNode;
  visuals: LessonVisuals["visuals"];
  shown: number;
  onOpen: (count: number) => void;
}) {
  const [focusOn, setFocusOn] = useState<string>();
  const sections = lesson?.sections ?? [];
  const next = sections[shown];

  useEffect(() => {
    if (focusOn) document.getElementById(focusOn)?.focus();
  }, [focusOn]);

  function reveal(count: number) {
    const target = sections[shown];
    onOpen(count);
    if (target) setFocusOn(`${sectionAnchor(target)}-heading`);
  }

  if (!lesson) {
    return (
      <ol className="rail" aria-hidden="true">
        {MODULES.map((module) => (
          <li key={module} className="rail__step rail__step--ghost">
            {MODULE_LABELS[module]}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <>
      <ol
        className="rail"
        aria-label={`Lesson, ${Math.min(shown, sections.length)} of ${sections.length} steps open`}
      >
        {sections.slice(0, shown).map((section) => (
          <li
            key={section.sectionId}
            className={`rail__step${section.module === "short-answer" ? " rail__step--answer" : ""}`}
          >
            <SectionView
              section={section}
              lesson={lesson}
              objectLabel={label}
              askQuestion={askQuestion}
            />
            {/* Pictures sit beside the mechanism they show, after the text (#83). */}
            {section.module === "how-parts-work" ? <VisualsSlot visuals={visuals} /> : null}
          </li>
        ))}
        {sections.slice(shown).map((section) => (
          <li key={section.sectionId} className="rail__step rail__step--ghost" aria-hidden="true">
            {section.heading ?? MODULE_LABELS[section.module]}
          </li>
        ))}
      </ol>
      {next ? (
        <div className="lesson-actions">
          <Button onClick={() => reveal(shown + 1)}>
            {shown === FIRST_OPEN
              ? "Show me why"
              : `Next: ${(next.heading ?? MODULE_LABELS[next.module]).toLowerCase()}`}
          </Button>
          <Button variant="quiet" onClick={() => reveal(sections.length)}>
            Show the whole lesson
          </Button>
        </div>
      ) : null}
    </>
  );
}

// The prototype's order: a loader until the quick answer, then the answer, then the steps.
export function LessonReader({ request, label, prefs, question, fetcher }: LessonReaderProps) {
  const router = useRouter();
  const subject = { label, taxonomyId: request.taxonomyId };
  const photo = useHandedOffPhoto();
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
  const writing = loading && !answer && !lesson;
  const [opened, setOpened] = useState(FIRST_OPEN);
  const total = lesson?.sections.length ?? 0;
  // A link into a step or a source (or a reader who asked for everything) opens the whole lesson.
  const linked =
    typeof window !== "undefined" && /^#(section|source)-/.test(window.location.hash) ? total : 0;
  const shown = Math.max(opened, linked);
  // As in the prototype, evidence, sources and feedback follow the last step once it is open.
  const finished = lesson !== undefined && shown >= total;

  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        {/* Recognition can be wrong, so a way back is always here, where the prototype puts it. */}
        <Link href="/capture#text-entry" className="lesson-head__change">
          Not a {label.toLowerCase()}? Describe it instead
        </Link>
        <p className="topic-chip">{label}</p>
        <h1>{lesson?.title ?? answer?.title ?? `Lesson: ${label}`}</h1>
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
      {writing ? (
        <div className="writing">
          <h2>Writing your lesson…</h2>
          <p className="writing__lede">Working out “{request.question}” from the beginning.</p>
          <Scanner src={photo} label={label} />
        </div>
      ) : null}
      <LessonNotice items={disclaimers} />
      {answer && !lesson ? (
        <section aria-labelledby="quick-answer-heading" className="quick-answer">
          <h2 id="quick-answer-heading">Quick answer</h2>
          <p className="short-answer">
            <Mark>{answer.shortAnswer}</Mark>
          </p>
          {answer.note ? <p className="note">{answer.note}</p> : null}
        </section>
      ) : null}
      {(answer?.kind === "cached" && written) ||
      answer?.kind === "fallback" ||
      status === "ready" ? (
        <p className="provenance">
          {answer?.kind === "cached" && written
            ? `This lesson was written earlier for a similar question, on ${written.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}. `
            : answer?.kind === "fallback"
              ? "This is a related lesson, shown because a new one could not be written. "
              : null}
          {status === "ready" && !request.fresh ? (
            <Button variant="quiet" size="small" onClick={askFresh}>
              Get a fresh answer
            </Button>
          ) : null}
        </p>
      ) : null}
      {writing || (error && !lesson) ? null : (
        <div aria-busy={!lesson} className="lesson-body">
          <LessonRail
            lesson={lesson}
            label={label}
            askQuestion={<AskQuestion subject={subject} prefs={prefs} />}
            visuals={visuals?.visuals ?? []}
            shown={shown}
            onOpen={setOpened}
          />
          {lesson && finished ? <EvidenceList lesson={lesson} sources={sources} /> : null}
          {lesson && finished && sources ? <SourceList sources={sources} lesson={lesson} /> : null}
          {lesson && finished ? (
            <LessonFeedback lessonId={lesson.lessonId} version={lesson.version} />
          ) : null}
        </div>
      )}
    </main>
  );
}
