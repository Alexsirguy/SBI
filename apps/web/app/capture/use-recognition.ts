"use client";

import type { ApiRequest } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";

export function useRecognisePhoto() {
  return useMutation({
    mutationFn: (request: ApiRequest<"recognisePhoto">) => api("recognisePhoto", request),
  });
}

export function useRecordSelection() {
  return useMutation({
    mutationFn: (request: ApiRequest<"recordSelection">) => api("recordSelection", request),
  });
}

export function useNoticeObject() {
  return useMutation({
    mutationFn: (request: ApiRequest<"noticeObject">) => api("noticeObject", request),
  });
}
