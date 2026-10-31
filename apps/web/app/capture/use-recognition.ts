"use client";

import type { ApiRequest } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";

export function useRecognisePhoto() {
  return useMutation({
    mutationFn: (request: ApiRequest<"recognisePhoto">) => api("recognisePhoto", request),
  });
}
