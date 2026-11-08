"use client";

import { useLessonEvents } from "../analytics/use-lesson-events";
import Link from "next/link";
import type { LessonDisclaimer, LessonRequest, PolicyResponse } from "@sbi/contracts";
import { Button, Mark, Notice, StatusLine } from "@sbi/ui";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { INTL_LOCALE } from "../i18n/locales";
import { useLocale, useT } from "../i18n/provider";
import { handedOffPhoto } from "../photo-handoff";
import { Scanner } from "../scanner";
import { AskQuestion } from "./ask-question";
import { SourceList } from "./citations";
import { DepthControls } from "./depth-controls";
import { topicOf } from "../analytics/concept-check";
import { ConceptCheck } from "./concept-check";
import { LessonFeedback } from "./feedback";
import { lessonHref } from "./lesson-request";
import { cautionText } from "./notice-text";
import { LessonRail } from "./lesson-rail";
import { useErrorText } from "./lesson-t";
import { useLessonExperiment } from "./lesson-experiment";
import { GrownUpGate } from "../pathway/grown-up-gate";
import { usePathway } from "../pathway/provider";
import { CurriculumLinks } from "./curriculum-links";
import { NextConcepts } from "./next-concepts";
import { PracticeProvider } from "./practice";
import { SaveLesson } from "./save-lesson";
import { type LessonPrefs, writePrefs } from "./prefs";
import { useLessonStream } from "./use-lesson-stream";
import { VisualFrame } from "./visual-frame";
import { webEnv } from "../../env";

// Fetched only when the tutor is switched on, so the lesson page keeps its JS budget.
const Tutor = dynamic(() => import("./tutor/tutor-panel"), { ssr: false });

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
export function LessonNotice({ items }: { items: LessonDisclaimer[] }) {
  const t = useT("lesson");
  const safety = items.find((item) => item.kind === "safety");
  const caution = cautionText(items, t);
  if (!safety && !caution) return null;
  return (
    <aside aria-label={t("noticeAside")} className="lesson-notices">
      <Notice
        kind={safety ? "safety" : "note"}
        label={safety ? t("noticeSafety") : t("noticeNote")}
      >
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
  const t = useT("lesson");
  const tp = useT("pathway");
  const { pathway, choose } = usePathway();
  const [gating, setGating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const unlock = policy.reason === "age" ? policy.suitableFor : undefined;
  // The loader that held focus is gone, so the learner lands on the help.
  useEffect(() => heading.current?.focus(), []);
  return (
    <section aria-labelledby="policy-heading" className="policy-help">
      <h2 id="policy-heading" tabIndex={-1} ref={heading}>
        {policy.reason === "age"
          ? t("policyAgeHeading")
          : policy.category === "self-harm"
            ? t("policySelfHarmHeading")
            : t("policySaferHeading")}
      </h2>
      <Notice
        kind={policy.reason === "age" ? "note" : "safety"}
        label={policy.reason === "age" ? t("noticeNote") : t("noticeSafety")}
      >
        <p>{policy.message}</p>
        <ul>
          {policy.help.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Notice>
      {/* In the child pathway the band only changes after a grown-up check. */}
      {unlock && gating ? (
        <GrownUpGate
          reason={tp("gateAgeBand")}
          onPass={() => {
            setGating(false);
            choose("self");
            onChangeAge(unlock);
          }}
          onCancel={() => setGating(false)}
        />
      ) : unlock ? (
        <Button onClick={() => (pathway === "child" ? setGating(true) : onChangeAge(unlock))}>
          {unlock === "adult" ? t("policyUnlockAdult") : t("policyUnlockTeen")}
        </Button>
      ) : null}
      <Link href="/capture" className="policy-help__next">
        {t("learnSomethingElse")}
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
  const t = useT("lesson");
  const locale = useLocale();
  const errorText = useErrorText();
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
  const day = (date: Date) =>
    date.toLocaleDateString(INTL_LOCALE[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const loading = status === "loading";
  const disclaimers = lesson?.disclaimers ?? answer?.disclaimers ?? [];
  const writing = loading && !answer && !lesson && !policy;
  const railVisuals = visuals?.visuals ?? (status === "loading" ? undefined : []);
  const experiment = useLessonExperiment(lesson, railVisuals);
  useLessonEvents(
    answer,
    lesson,
    status === "ready" && !!lesson && experiment.status !== "pending",
  );
  const tutoring = webEnv.features.tutor && !!lesson && status === "ready";
  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        {/* Recognition can be wrong, so a way back is always here, where the prototype puts it. */}
        <Link href="/capture#text-entry" className="lesson-head__change">
          {t("notThisObject", { label: label.toLowerCase() })}
        </Link>
        <p className="topic-chip">{label}</p>
        <h1>{lesson?.title ?? answer?.title ?? t("lessonFallbackTitle", { label })}</h1>
        <DepthControls prefs={chosen} onChange={choose} />
        {lesson && status === "ready" ? (
          <SaveLesson
            lessonId={lesson.lessonId}
            version={lesson.version}
            returnTo={lessonHref(subject, { question, prefs })}
          />
        ) : null}
      </header>
      <StatusLine>
        {policy
          ? ""
          : status === "ready"
            ? t("statusReady")
            : loading
              ? (progress?.message ?? t("statusStarting"))
              : ""}
      </StatusLine>
      {error ? (
        <Notice kind="error" label={t("noticeProblem")} live>
          <p>{errorText(error)}</p>
          <Button size="small" onClick={retry}>
            {t("tryAgain")}
          </Button>
        </Notice>
      ) : null}
      {writing ? (
        <div className="writing">
          <h2>{t("writingHeading")}</h2>
          <p className="writing__lede">{t("writingLede", { question: request.question })}</p>
          <Scanner src={photo} label={label} />
        </div>
      ) : null}
      <LessonNotice items={disclaimers} />
      {/* Never beside a lesson: a Merrill lesson opens on its problem, and the answer spoils the guess. */}
      {answer && !lesson ? (
        <section aria-labelledby="quick-answer-heading" className="quick-answer">
          <h2 id="quick-answer-heading">{t("quickAnswer")}</h2>
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
            ? `${t("provenanceCached", { date: day(written) })} `
            : answer?.kind === "fallback"
              ? `${t("provenanceFallback")} `
              : null}
          {status === "ready" && !request.fresh ? (
            <Button variant="quiet" size="small" onClick={askFresh}>
              {t("freshAnswer")}
            </Button>
          ) : null}
        </p>
      ) : null}
      {policy ? (
        <PolicyHelp policy={policy} onChangeAge={(age) => choose({ ...prefs, age })} />
      ) : null}
      {writing || policy || (error && !lesson) ? null : (
        <div
          aria-busy={!lesson}
          className={tutoring ? "lesson-body lesson-body--tutor" : "lesson-body"}
        >
          <PracticeProvider experiment={experiment}>
            <LessonRail
              lesson={lesson}
              label={label}
              askQuestion={<AskQuestion subject={subject} prefs={prefs} />}
              visuals={railVisuals}
              renderVisual={(visual) => <VisualFrame visual={visual} />}
            />
            {lesson && status === "ready" ? <ConceptCheck lesson={lesson} /> : null}
            {tutoring && lesson ? <Tutor lesson={lesson} sources={sources} prefs={prefs} /> : null}
          </PracticeProvider>
          {lesson && status === "ready" ? (
            <NextConcepts lessonId={lesson.lessonId} version={lesson.version} prefs={prefs} />
          ) : null}
          {lesson && status === "ready" ? (
            <CurriculumLinks concepts={lesson.concepts.map((concept) => concept.label)} />
          ) : null}
          {lesson && sources ? <SourceList sources={sources} lesson={lesson} /> : null}
          {lesson ? (
            <LessonFeedback
              lessonId={lesson.lessonId}
              version={lesson.version}
              topic={topicOf(lesson.taxonomyId)}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
