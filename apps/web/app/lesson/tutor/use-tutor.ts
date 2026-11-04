"use client";

import type { ApiRequest, TutorExchange } from "@sbi/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { track } from "../../analytics/track";
import { api } from "../../api";

const KEY_PREFIX = "sbi.tutor-visit.";

/** A random id per lesson per tab, so a signed-out conversation lasts the visit and no longer. */
export function tutorVisitId(lessonId: string, storage?: Pick<Storage, "getItem" | "setItem">) {
  try {
    const store = storage ?? window.sessionStorage;
    const kept = store.getItem(KEY_PREFIX + lessonId);
    if (kept) return kept;
    const made = crypto.randomUUID();
    store.setItem(KEY_PREFIX + lessonId, made);
    return made;
  } catch {
    // Storage can be refused in private browsing; the conversation then lasts this page only.
    return crypto.randomUUID();
  }
}

export const tutorKey = (lessonId: string, sessionId: string) =>
  ["tutor", lessonId, sessionId] as const;

export function useTutorConversation(sessionId: string, lessonId: string, locale: string) {
  return useQuery({
    queryFn: async () =>
      (await api("tutorConversation", { sessionId, lessonId, locale })).exchanges,
    queryKey: tutorKey(lessonId, sessionId),
    retry: false,
  });
}

export function useAskTutor(sessionId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: ApiRequest<"askTutor">) =>
      (await api("askTutor", request)).exchange,
    onSuccess: (exchange: TutorExchange, request) => {
      track("tutor_question", {
        lessonId,
        version: Number(request.lessonVersion),
        replyKind: exchange.kind,
        citedCount: exchange.citedClaimIds.length,
      });
      client.setQueryData(tutorKey(lessonId, sessionId), (list: TutorExchange[] = []) => [
        ...list,
        exchange,
      ]);
    },
  });
}

export function useResetTutor(sessionId: string, lessonId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api("resetTutorConversation", { sessionId, lessonId }),
    onSuccess: () => client.setQueryData(tutorKey(lessonId, sessionId), []),
  });
}
