"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { ApiRequestError } from "../api-client";

export const ACCOUNT_KEY = ["account"] as const;

/** The signed-in account, null when signed out, undefined while checking. */
export function useAccount() {
  return useQuery({
    queryFn: async () => {
      try {
        return await api("getAccount", {});
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) return null;
        throw error;
      }
    },
    queryKey: ACCOUNT_KEY,
    retry: false,
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api("signOut", {}),
    onSuccess: () => client.setQueryData(ACCOUNT_KEY, null),
  });
}

/** Keeps only paths on this site, so a crafted link cannot send the learner elsewhere. */
export function safeNext(value: string | null): string {
  return value && /^\/(?!\/)/.test(value) ? value : "/account";
}
