"use client";

import type { ApiRequest } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { putObject } from "../api-client";
import type { ProcessedImage } from "./processing";

export function usePhotoUpload() {
  const [stage, setStage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (image: ProcessedImage) => {
      setStage("Requesting a private upload…");
      const ticket = await api("requestUpload", {
        declaredType: image.blob.type || "image/jpeg",
        sizeBytes: image.size,
      });
      setStage("Uploading your photo…");
      await putObject(ticket.uploadUrl, image.blob);
      setStage("Checking privacy…");
      return api("confirmUpload", { token: ticket.token });
    },
    onSettled: () => setStage(null),
  });
  return { ...mutation, stage: mutation.isPending ? stage : null };
}

export function useKeepPhoto() {
  return useMutation({
    mutationFn: (request: ApiRequest<"keepPhoto">) => api("keepPhoto", request),
  });
}

export function useDeletePhoto() {
  return useMutation({ mutationFn: (key: string) => api("deletePhoto", { key }) });
}
