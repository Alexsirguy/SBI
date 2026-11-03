"use client";

import type { ApiRequest } from "@sbi/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { putObject } from "../api-client";
import { useT } from "../i18n/provider";
import type { CaptureKey } from "./messages";
import type { ProcessedImage } from "./processing";

export function usePhotoUpload() {
  const t = useT("capture");
  const [stage, setStage] = useState<CaptureKey | null>(null);
  const mutation = useMutation({
    mutationFn: async (image: ProcessedImage) => {
      setStage("stageRequesting");
      const ticket = await api("requestUpload", {
        declaredType: image.blob.type || "image/jpeg",
        sizeBytes: image.size,
      });
      setStage("stageUploading");
      await putObject(ticket.uploadUrl, image.blob);
      setStage("stageChecking");
      return api("confirmUpload", { token: ticket.token });
    },
    onSettled: () => setStage(null),
  });
  return { ...mutation, stage: mutation.isPending && stage ? t(stage) : null };
}

export function useKeepPhoto() {
  return useMutation({
    mutationFn: (request: ApiRequest<"keepPhoto">) => api("keepPhoto", request),
  });
}

export function useDeletePhoto() {
  return useMutation({ mutationFn: (key: string) => api("deletePhoto", { key }) });
}
