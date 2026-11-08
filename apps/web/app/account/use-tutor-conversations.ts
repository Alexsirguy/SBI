"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useLocale } from "../i18n/provider";

// Under the account key, so signing out drops the conversations from the cache.
export const TUTOR_CONVERSATIONS_KEY = ["account", "tutor-conversations"] as const;

export function useTutorConversations() {
  const locale = useLocale();
  return useQuery({
    queryFn: async () => (await api("tutorConversations", { locale })).conversations,
    queryKey: [...TUTOR_CONVERSATIONS_KEY, locale],
  });
}
