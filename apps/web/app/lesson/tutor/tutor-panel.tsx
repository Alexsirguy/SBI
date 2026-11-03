"use client";

import type { Lesson, LessonSources, TutorExchange, VisualAction } from "@sbi/contracts";
import { Button, Notice, StatusLine, TextField } from "@sbi/ui";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAccount } from "../../account/use-account";
import { ApiRequestError } from "../../api-client";
import { useT } from "../../i18n/provider";
import { citationIndex, sourceAnchor } from "../citations";
import { useErrorText } from "../lesson-t";
import { usePractice } from "../practice";
import { DEPTHS, type LessonPrefs } from "../prefs";
import { tutorVisitId, useAskTutor, useResetTutor, useTutorConversation } from "./use-tutor";
import "./tutor.css";

// Wide enough for the 44rem lesson column and a 22rem panel side by side.
const DOCKED = "(min-width: 1180px)";

function useDocked() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DOCKED);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DOCKED).matches,
    () => false,
  );
}

interface TutorProps {
  lesson: Lesson;
  sources: LessonSources | undefined;
  prefs: LessonPrefs;
}

/** Beside the lesson on wide screens; a bottom sheet behind a button on narrower ones. */
export default function Tutor(props: TutorProps) {
  const t = useT("tutor");
  const docked = useDocked();
  const sheet = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const close = () => sheet.current?.close();
  if (docked) {
    return (
      <aside className="tutor-dock" aria-labelledby="tutor-heading">
        <Conversation {...props} />
      </aside>
    );
  }
  return (
    <>
      <Button
        ref={launcher}
        className="tutor-launch"
        aria-haspopup="dialog"
        onClick={() => sheet.current?.showModal()}
      >
        {t("open")}
      </Button>
      <dialog
        ref={sheet}
        className="tutor-sheet"
        aria-labelledby="tutor-heading"
        // Focus goes back to the button that opened it, so keyboard users are not lost.
        onClose={() => launcher.current?.focus()}
      >
        <Button variant="quiet" size="small" className="tutor-sheet__close" onClick={close}>
          {t("close")}
        </Button>
        <Conversation {...props} onShow={close} />
      </dialog>
    </>
  );
}

function Conversation({
  lesson,
  sources,
  prefs,
  onShow,
}: TutorProps & {
  /** Called before the tutor points at the lesson, so a sheet can step out of the way. */
  onShow?: () => void;
}) {
  const t = useT("tutor");
  const errorText = useErrorText();
  const account = useAccount();
  const [sessionId] = useState(() => tutorVisitId(lesson.lessonId));
  const conversation = useTutorConversation(sessionId, lesson.lessonId, lesson.locale);
  const ask = useAskTutor(sessionId, lesson.lessonId);
  const reset = useResetTutor(sessionId, lesson.lessonId);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string>();
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const tl = useT("lesson");

  const unavailable =
    conversation.error instanceof ApiRequestError && conversation.error.status === 503;
  if (unavailable) {
    return (
      <>
        <h2 id="tutor-heading">{t("heading")}</h2>
        <p>{t("unavailable")}</p>
      </>
    );
  }

  const exchanges = conversation.data ?? [];
  const send = () => {
    const question = text.trim();
    if (question.length < 2) {
      setProblem(t("tooShort"));
      input.current?.focus();
      return;
    }
    setProblem(undefined);
    ask.mutate(
      {
        sessionId,
        lessonId: lesson.lessonId,
        lessonVersion: lesson.version,
        text: question,
        audience: prefs.age === "none" ? "general" : prefs.age,
        readingLevel: DEPTHS[prefs.depth].readingLevel,
        locale: lesson.locale,
      },
      { onSuccess: () => setText("") },
    );
  };

  return (
    <>
      <h2 id="tutor-heading">{t("heading")}</h2>
      <p className="tutor__intro">{t("intro")}</p>
      <div className="tutor__log" role="log" aria-live="polite" aria-label={t("logLabel")}>
        <ol>
          {exchanges.length === 0 && !ask.isPending ? (
            <li className="tutor__empty">{t("empty")}</li>
          ) : null}
          {exchanges.map((exchange) => (
            <li key={exchange.turnId} className="tutor__exchange">
              <p className="tutor__you">
                <span className="tutor__who">{t("you")}</span> {exchange.userText}
              </p>
              <Reply
                exchange={exchange}
                lesson={lesson}
                sources={sources}
                onShow={onShow}
                onStatus={setStatus}
              />
            </li>
          ))}
        </ol>
      </div>
      <StatusLine className="tutor__status">
        {ask.isPending ? t("thinking") : reset.isSuccess ? t("cleared") : status}
      </StatusLine>
      {ask.error ? (
        <Notice kind="error" label={tl("noticeProblem")} live>
          <p>{errorText(ask.error.message)}</p>
        </Notice>
      ) : null}
      <form
        className="tutor__form"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <TextField
          ref={input}
          label={t("questionLabel")}
          type="text"
          maxLength={500}
          autoComplete="off"
          value={text}
          error={problem}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" disabled={ask.isPending}>
          {t("send")}
        </Button>
      </form>
      <p className="tutor__kept">
        {account.data ? t("keptAccount") : t("keptVisit")}
        {exchanges.length > 0 ? (
          <>
            {" "}
            <Button
              variant="quiet"
              size="small"
              disabled={reset.isPending}
              onClick={() => {
                reset.mutate();
                input.current?.focus();
              }}
            >
              {t("reset")}
            </Button>
          </>
        ) : null}
      </p>
    </>
  );
}

function Reply({
  exchange,
  lesson,
  sources,
  onShow,
  onStatus,
}: {
  exchange: TutorExchange;
  lesson: Lesson;
  sources: LessonSources | undefined;
  onShow?: () => void;
  onStatus: (message: string) => void;
}) {
  const t = useT("tutor");
  const index = useMemo(() => citationIndex(lesson, sources), [lesson, sources]);
  const numbers = [
    ...new Set(
      exchange.citedClaimIds.flatMap((claimId) =>
        (index.claims.get(claimId)?.sourceIds ?? []).flatMap((id) => index.numbers.get(id) ?? []),
      ),
    ),
  ].sort((a, b) => a - b);
  return (
    <div className="tutor__reply">
      <p>
        <span className="tutor__who">{t("tutor")}</span> {exchange.text}
      </p>
      {exchange.policy && exchange.policy.help.length > 0 ? (
        <ul className="tutor__help">
          {exchange.policy.help.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {numbers.length > 0 ? (
        <p className="tutor__sources">
          {t("sources")}{" "}
          {numbers.map((number) => (
            <a
              key={number}
              href={`#${sourceAnchor(number)}`}
              className="citation-marker"
              aria-label={t("sourceLink", { number })}
              onClick={() => {
                onShow?.();
                openSource(number);
              }}
            >
              {number}
            </a>
          ))}
        </p>
      ) : exchange.kind === "lesson" ? (
        <p className="tutor__note">{t("fromLesson")}</p>
      ) : null}
      {exchange.note ? <p className="tutor__note">{exchange.note}</p> : null}
      {exchange.visualAction ? (
        <Watch action={exchange.visualAction} onShow={onShow} onStatus={onStatus} />
      ) : null}
    </div>
  );
}

// The source list starts folded, so a link from the tutor opens it before jumping.
function openSource(number: number) {
  const target = document.getElementById(sourceAnchor(number));
  const fold = target?.closest("details");
  if (fold) fold.open = true;
}

function Watch({
  action,
  onShow,
  onStatus,
}: {
  action: VisualAction;
  onShow?: () => void;
  onStatus: (message: string) => void;
}) {
  const t = useT("tutor");
  const { experiment } = usePractice();
  const ready = experiment.status === "ready" && experiment.controller.visualId === action.visualId;
  const marked = useRef(false);
  useEffect(
    () => () => {
      // Leaving the conversation clears a part the tutor pointed at.
      if (marked.current && experiment.status === "ready")
        experiment.controller.highlight(undefined);
    },
    [experiment],
  );
  return (
    <Button
      variant="quiet"
      size="small"
      className="tutor__watch"
      onClick={() => {
        if (!ready) {
          onStatus(t("watchUnavailable"));
          return;
        }
        onShow?.();
        const { controller } = experiment;
        const applied = controller.apply(action.settings);
        const pointed = controller.highlight(action.highlight);
        marked.current = action.highlight !== undefined;
        controller.reveal();
        onStatus(applied && pointed ? t("watched") : t("watchUnavailable"));
      }}
    >
      {t("watch")}
    </Button>
  );
}
