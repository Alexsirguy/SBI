"use client";

import Link from "next/link";
import type { LessonDisclaimer, LessonRequest, PolicyResponse } from "@sbi/contracts";
import { Button, Mark, Notice, StatusLine } from "@sbi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { handedOffPhoto } from "../photo-handoff";
import { Scanner } from "../scanner";
import { AskQuestion } from "./ask-question";
import { SourceList } from "./citations";
import { DepthControls } from "./depth-controls";
import { LessonFeedback } from "./feedback";
import { lessonHref } from "./lesson-request";
import { cautionText } from "./notice-text";
import { LessonRail } from "./lesson-rail";
import { useLessonExperiment } from "./lesson-experiment";
import { PracticeProvider } from "./practice";
import { type LessonPrefs, writePrefs } from "./prefs";
import { useLessonStream } from "./use-lesson-stream";
import { VisualFrame } from "./visual-frame";

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

// One notice, whatever the lesson carries, with any safety text first (owner decision, #281).
function LessonNotice({ items }: { items: LessonDisclaimer[] }) {
  const safety = items.find((item) => item.kind === "safety");
  const caution = cautionText(items);
  if (!safety && !caution) return null;
  return (
    <aside aria-label="Before you read" className="lesson-notices">
      <Notice kind={safety ? "safety" : "note"}>
        {safety ? <p>{safety.message}</p> : null}
        {caution ? <p>{caution}</p> : null}
      </Notice>
    </aside>
  );
}

/** Help instead of a lesson: what we can't do, who to turn to, and a way to learn something else. */
function PolicyHelp({
  policy,
  onChangeAge,
}: {
  policy: PolicyResponse;
  onChangeAge: (age: "teen" | "adult") => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const unlock = policy.reason === "age" ? policy.suitableFor : undefined;
  // The loader that held focus is gone, so the learner lands on the help.
  useEffect(() => heading.current?.focus(), []);
  return (
    <section aria-labelledby="policy-heading" className="policy-help">
      <h2 id="policy-heading" tabIndex={-1} ref={heading}>
        {policy.reason === "age"
          ? "This one is for older learners"
          : policy.category === "self-harm"
            ? "You don't have to face this alone"
            : "Let's try a safer question"}
      </h2>
      <Notice kind={policy.reason === "age" ? "note" : "safety"}>
        <p>{policy.message}</p>
        <ul>
          {policy.help.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Notice>
      {unlock ? (
        <Button onClick={() => onChangeAge(unlock)}>
          {unlock === "adult"
            ? "I'm an adult: change age band"
            : "I'm a teen or adult: change age band"}
        </Button>
      ) : null}
      <Link href="/capture" className="policy-help__next">
        Learn about something else
      </Link>
    </section>
  );
}

const noSubscription = () => () => undefined;

/** The learner's photo of this object, if this visit came from one; never on the server. */
function useHandedOffPhoto(label: string) {
  return useSyncExternalStore(
    noSubscription,
    () => handedOffPhoto(label),
    () => null,
  );
}

// The prototype's order: a loader until the quick answer, then the answer, then the steps.
export function LessonReader({ request, label, prefs, question, fetcher }: LessonReaderProps) {
  const router = useRouter();
  const subject = { label, taxonomyId: request.taxonomyId };
  const photo = useHandedOffPhoto(label);
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
  const { status, progress, answer, lesson, sources, visuals, policy, error, retry } =
    useLessonStream(request, fetcher);
  // The spec promises a fresh answer is always available, so a reused lesson can be replaced.
  const askFresh = () => router.push(lessonHref(subject, { question, prefs, fresh: true }));
  const written = lesson ? new Date(lesson.reuse.generatedAt) : undefined;
  const loading = status === "loading";
  const disclaimers = lesson?.disclaimers ?? answer?.disclaimers ?? [];
  const writing = loading && !answer && !lesson && !policy;
  const railVisuals = visuals?.visuals ?? (status === "loading" ? undefined : []);
  const experiment = useLessonExperiment(lesson, railVisuals);
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
        {policy
          ? ""
          : status === "ready"
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
      {/* Never beside a lesson: a Merrill lesson opens on its problem, and the answer spoils the guess. */}
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
      (status === "ready" && !policy) ? (
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
      {policy ? (
        <PolicyHelp policy={policy} onChangeAge={(age) => choose({ ...prefs, age })} />
      ) : null}
      {writing || policy || (error && !lesson) ? null : (
        <div aria-busy={!lesson} className="lesson-body">
          <PracticeProvider experiment={experiment}>
            <LessonRail
              lesson={lesson}
              label={label}
              askQuestion={<AskQuestion subject={subject} prefs={prefs} />}
              visuals={railVisuals}
              renderVisual={(visual) => <VisualFrame visual={visual} />}
            />
          </PracticeProvider>
          {lesson && sources ? <SourceList sources={sources} lesson={lesson} /> : null}
          {lesson ? <LessonFeedback lessonId={lesson.lessonId} version={lesson.version} /> : null}
        </div>
      )}
    </main>
  );
}
