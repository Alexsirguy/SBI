"use client";

import type { ApiRequest, ApiResponse, TeacherClass } from "@sbi/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACCOUNT_KEY } from "../account/use-account";
import { api } from "../api";

// Under the account key, so signing out drops every class from the cache.
export const CLASSES_KEY = ["account", "classes"] as const;
type Classes = ApiResponse<"classes">;

export function useClasses(signedIn: boolean) {
  return useQuery({
    enabled: signedIn,
    queryFn: () => api("classes", {}),
    queryKey: CLASSES_KEY,
  });
}

function useReplaceClass() {
  const client = useQueryClient();
  return (updated: TeacherClass) =>
    client.setQueryData(CLASSES_KEY, (data: Classes | undefined) =>
      data
        ? {
            ...data,
            classes: data.classes.some((item) => item.classId === updated.classId)
              ? data.classes.map((item) => (item.classId === updated.classId ? updated : item))
              : [...data.classes, updated],
          }
        : data,
    );
}

export function useBecomeEducator() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api("becomeEducator", {}),
    onSuccess: () => {
      client.setQueryData(CLASSES_KEY, (data: Classes | undefined) => ({
        classes: data?.classes ?? [],
        educator: true,
      }));
      // The account page picks its layout from the account, so it learns too.
      client.setQueryData(ACCOUNT_KEY, (me: ApiResponse<"getAccount"> | null | undefined) =>
        me ? { ...me, educator: true, educatorPending: false } : me,
      );
    },
  });
}

/** Mutations that return the changed class, so the list updates without a refetch. */
export function useClassMutation<
  N extends
    | "createClass"
    | "updateClass"
    | "rotateClassCode"
    | "archiveClass"
    | "addClassLesson"
    | "removeClassLesson",
>(name: N) {
  const replace = useReplaceClass();
  return useMutation({
    mutationFn: (body: ApiRequest<N>) => api(name, body) as Promise<ApiResponse<N>>,
    onSuccess: (result: ApiResponse<N>) => replace((result as { class: TeacherClass }).class),
  });
}
