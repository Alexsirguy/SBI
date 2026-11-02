"use client";

import type {
  Lesson,
  LessonProgress,
  LessonRequest,
  LessonSources,
  LessonVisuals,
  PolicyResponse,
  QuickAnswer,
} from "@sbi/contracts";
import { useCallback, useEffect, useReducer, useState } from "react";
import { ApiRequestError, UNREACHABLE } from "../api-client";
import { webEnv } from "../../env";
import { streamLesson, type LessonEvent } from "./stream";

export interface LessonStreamState {
  status: "loading" | "ready" | "error";
  progress?: LessonProgress;
  answer?: QuickAnswer;
  lesson?: Lesson;
  sources?: LessonSources;
  visuals?: LessonVisuals;
  /** Help sent instead of a lesson, when the question sought harm. */
  policy?: PolicyResponse;
  error?: string;
}

type Action =
  LessonEvent | { type: "start" } | { type: "done" } | { type: "failed"; error: string };

export function lessonReducer(state: LessonStreamState, action: Action): LessonStreamState {
  switch (action.type) {
    case "start":
      return { status: "loading" };
    case "policy":
      return { ...state, policy: action.data };
    case "progress":
      return { ...state, progress: action.data };
    case "quick-answer":
      return { ...state, answer: action.data };
    case "lesson":
      return { ...state, lesson: action.data };
    case "sources":
      return { ...state, sources: action.data };
    case "visuals":
      return { ...state, visuals: action.data };
    case "done": {
      const answered = state.lesson ?? state.policy;
      return {
        ...state,
        status: answered ? "ready" : "error",
        error: answered ? undefined : UNREACHABLE,
      };
    }
    case "failed":
      return { ...state, status: "error", error: action.error };
  }
}

/** Streams the lesson for `request`; `retry` starts it again after a failure. */
export function useLessonStream(request: LessonRequest, fetcher?: typeof fetch) {
  const [state, dispatch] = useReducer(lessonReducer, { status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "start" });
    // Every dispatch checks the signal, so an old request can never update the new one's state.
    const live = (action: Parameters<typeof dispatch>[0]) => {
      if (!controller.signal.aborted) dispatch(action);
    };
    streamLesson(webEnv.apiUrl, JSON.parse(key) as LessonRequest, live, {
      signal: controller.signal,
      fetcher,
    }).then(
      () => live({ type: "done" }),
      (error: unknown) => {
        live({
          type: "failed",
          error: error instanceof ApiRequestError ? error.message : UNREACHABLE,
        });
      },
    );
    return () => controller.abort();
  }, [key, attempt, fetcher]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { ...state, retry };
}
