"use client";

import { BAD_REPLY, UNREACHABLE, UPLOAD_FAILED } from "../api-client";
import { useT } from "./provider";

const KEYS = {
  [UNREACHABLE]: "errorUnreachable",
  [BAD_REPLY]: "errorBadReply",
  [UPLOAD_FAILED]: "errorUploadFailed",
} as const;

/** The web app's own failure messages in the page's language; the API's arrive already written. */
export function useErrorText() {
  const t = useT("common");
  return (message: string | undefined): string | undefined =>
    message !== undefined && message in KEYS ? t(KEYS[message as keyof typeof KEYS]) : message;
}
