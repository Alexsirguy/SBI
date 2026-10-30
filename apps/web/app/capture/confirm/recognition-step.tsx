"use client";

import type { ApiRequest, ApiResponse } from "@sbi/contracts";
import type { UseMutationResult } from "@tanstack/react-query";
import { StatusLine } from "@sbi/ui";
import { ConfirmLesson } from "./confirm-lesson";

interface RecognitionStepProps {
  recognition: UseMutationResult<
    ApiResponse<"recognisePhoto">,
    Error,
    ApiRequest<"recognisePhoto">
  >;
  onSelect: (request: ApiRequest<"recordSelection">) => void;
}

const DESCRIBE = "We could not recognise the object. Describe it to start your lesson.";

function promptFor(reply: ApiResponse<"recognisePhoto">): string {
  switch (reply.next.kind) {
    case "proceed":
      return "Is this right? Pick the object in your photo, or tell us what it is.";
    case "ask":
      return reply.next.question;
    case "assume-category":
      return `${reply.next.fallback.assumption} Pick the object if you know which it is.`;
    case "describe":
      return DESCRIBE;
  }
}

// Recognition only suggests: the learner still confirms, and every choice is recorded as feedback.
export function RecognitionStep({ recognition, onSelect }: RecognitionStepProps) {
  if (recognition.isPending) {
    return <StatusLine>Recognising the object…</StatusLine>;
  }
  if (!recognition.data) {
    return (
      <ConfirmLesson headingLevel={3} initialMessage={recognition.error?.message ?? DESCRIBE} />
    );
  }
  const reply = recognition.data;
  const options = reply.next.kind === "ask" ? reply.next.options : [];
  const candidates = reply.candidates.length > 0 ? reply.candidates : options;
  const fallback =
    reply.next.kind === "ask" || reply.next.kind === "assume-category"
      ? reply.next.fallback
      : undefined;
  return (
    <ConfirmLesson
      key={reply.resultId}
      headingLevel={3}
      initialCandidates={candidates}
      initialMessage={promptFor(reply)}
      fallback={fallback}
      otherLabels={reply.otherLabels}
      onStart={({ taxonomyId }) =>
        onSelect({ resultId: reply.resultId, selection: { kind: "object", taxonomyId } })
      }
      onCorrection={(text) =>
        onSelect({ resultId: reply.resultId, selection: { kind: "free-text", text } })
      }
    />
  );
}
