"use client";

import type { ApiResponse } from "@sbi/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export const SAVED_KEY = ["account", "saved-lessons"] as const;

/** The signed-in learner's saved lessons; only asked for once we know they are signed in. */
export function useSavedLessons(signedIn: boolean) {
  return useQuery({
    enabled: signedIn,
    queryFn: async () => (await api("savedLessons", {})).lessons,
    queryKey: SAVED_KEY,
  });
}

export function useSaveLesson() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lesson: { lessonId: string; version: number }) => api("saveLesson", lesson),
    onSuccess: (saved: ApiResponse<"saveLesson">) =>
      client.setQueryData(SAVED_KEY, (list: ApiResponse<"savedLessons">["lessons"] = []) => [
        saved,
        ...list.filter((item) => item.lessonId !== saved.lessonId),
      ]),
  });
}

export function useRemoveSavedLesson() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      await api("removeSavedLesson", { lessonId });
      return lessonId;
    },
    onSuccess: (lessonId: string) =>
      client.setQueryData(SAVED_KEY, (list: ApiResponse<"savedLessons">["lessons"] = []) =>
        list.filter((item) => item.lessonId !== lessonId),
      ),
  });
}

export function useShareLesson() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api("shareSavedLesson", { lessonId }),
    onSuccess: ({ sharedAt }, lessonId) =>
      client.setQueryData(SAVED_KEY, (list: ApiResponse<"savedLessons">["lessons"] = []) =>
        list.map((item) => (item.lessonId === lessonId ? { ...item, sharedAt } : item)),
      ),
  });
}
