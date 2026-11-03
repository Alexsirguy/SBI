import { z } from "zod";
import { IsoDateTime, Locale, Uuid } from "./common";
import { AudienceBand, ReadingLevel } from "./lesson";
import { PolicyResponse } from "./safety";

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
  policy: PolicyResponse.optional(),
  createdAt: IsoDateTime,
});
export type TutorExchange = z.infer<typeof TutorExchange>;

export const TutorReply = z.object({ exchange: TutorExchange });

export const TutorConversationRequest = z.object({
  sessionId: Uuid,
  lessonId: Uuid,
});

export const TutorConversation = z.object({ exchanges: z.array(TutorExchange) });
