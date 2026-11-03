"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
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

/** Drops everything cached for the last account, so a shared device never shows it to the next. */
export function forgetAccountData(client: QueryClient) {
  client.removeQueries({ queryKey: ACCOUNT_KEY });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api("signOut", {}),
    onSuccess: () => {
      forgetAccountData(client);
      client.setQueryData(ACCOUNT_KEY, null);
    },
  });
}

/** Keeps only paths on this site, so a crafted link cannot send the learner elsewhere. */
export function safeNext(value: string | null): string {
  // Backslashes, spaces and control characters can turn "/x" into another origin in a browser.
  const unsafe =
    !value ||
    !/^\/(?![/\\])/.test(value) ||
    /[\\\s]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) < 32);
  if (!value || unsafe) return "/account";
  const base = "https://sbi.invalid";
  const url = new URL(value, base);
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/account";
}
