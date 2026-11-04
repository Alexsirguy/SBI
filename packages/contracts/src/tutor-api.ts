import { z } from "zod";
import { IsoDateTime, Locale, Uuid } from "./common";
import { AudienceBand, ReadingLevel } from "./lesson";
import { PolicyResponse } from "./safety";
import { TutorReplyKind, VisualAction } from "./tutor";

/** Matches `userText`, with room left so a pasted paragraph is refused before it costs a call. */
export const TUTOR_MESSAGE_MAX = 500;

export const TutorTurnRequest = z.object({
  /** Random per lesson visit; the browser makes it so signed-out learners need no account. */
  sessionId: Uuid,
  lessonId: Uuid,
  lessonVersion: z.coerce.number().int().positive(),
  text: z.string().trim().min(2).max(TUTOR_MESSAGE_MAX),
  audience: AudienceBand.default("general"),
  readingLevel: ReadingLevel.default("plain"),
  locale: Locale.default("en"),
});

/** One exchange as the learner sees it; versions and retention stay on the server. */
export const TutorExchange = z.object({
  turnId: Uuid,
  userText: z.string().min(1),
  text: z.string().min(1),
  citedClaimIds: z.array(Uuid),
  kind: TutorReplyKind,
  /** The beyond-the-lesson note, in the lesson's language; set whenever nothing is cited. */
  note: z.string().min(1).optional(),
  policy: PolicyResponse.optional(),
  visualAction: VisualAction.optional(),
  createdAt: IsoDateTime,
});
export type TutorExchange = z.infer<typeof TutorExchange>;

export const TutorReply = z.object({ exchange: TutorExchange });

export const TutorConversationRequest = z.object({
  sessionId: Uuid,
  lessonId: Uuid,
  locale: Locale.default("en"),
});

export const TutorConversation = z.object({ exchanges: z.array(TutorExchange) });

/** Clears one lesson's conversation: this visit's turns, and the account's when signed in. */
export const TutorResetRequest = z.object({ sessionId: Uuid, lessonId: Uuid });

export const TutorReset = z.object({ deleted: z.int().nonnegative() });
