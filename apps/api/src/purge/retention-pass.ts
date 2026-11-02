import type { Repositories } from "@sbi/db";
import { runDeletionPass, type ObjectStorage, type RetentionPolicy } from "@sbi/media";
import type { ApiEnv } from "../env";
import type { PurgePassResult } from "./purge-worker";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type RetentionSettings = Pick<
  ApiEnv,
  | "FEEDBACK_DETAILS_RETENTION_DAYS"
  | "TUTOR_TTL_SESSION_HOURS"
  | "TUTOR_TTL_QUALITY_DAYS"
  | "TUTOR_TTL_RESEARCH_DAYS"
  | "EVIDENCE_PACK_TTL_DAYS"
  | "CATALOG_GAP_TTL_DAYS"
>;

export interface RetentionDeps {
  repos: Pick<
    Repositories,
    | "accountTokens"
    | "catalogGaps"
    | "deletionAudit"
    | "evidencePacks"
    | "lessonFeedback"
    | "mediaRegistry"
    | "recognitionResults"
    | "sessions"
    | "tutorTurns"
  >;
  storage: ObjectStorage;
}

/** One pass of every TTL in docs/retention.md; each data class is deleted by its own rule. */
export async function runRetentionPass(
  { repos, storage }: RetentionDeps,
  now: Date,
  media: RetentionPolicy,
  settings: RetentionSettings,
): Promise<PurgePassResult> {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const result = await runDeletionPass(
    { audit: repos.deletionAudit, registry: repos.mediaRegistry, storage },
    now,
    media,
  );
  const recognitionPurged = await repos.recognitionResults.deleteExpired(now);
  const feedbackDetailsCleared = await repos.lessonFeedback.clearDetailsBefore(
    ago(settings.FEEDBACK_DETAILS_RETENTION_DAYS * DAY_MS),
  );
  const tutorTurnsPurged =
    (await repos.tutorTurns.deleteCreatedBefore(
      "session",
      ago(settings.TUTOR_TTL_SESSION_HOURS * HOUR_MS),
    )) +
    (await repos.tutorTurns.deleteCreatedBefore(
      "quality-review",
      ago(settings.TUTOR_TTL_QUALITY_DAYS * DAY_MS),
    )) +
    (await repos.tutorTurns.deleteCreatedBefore(
      "research-consented",
      ago(settings.TUTOR_TTL_RESEARCH_DAYS * DAY_MS),
    ));
  const evidencePacksPurged = await repos.evidencePacks.deleteCreatedBefore(
    ago(settings.EVIDENCE_PACK_TTL_DAYS * DAY_MS),
  );
  const catalogGapsPurged = await repos.catalogGaps.deleteLastSeenBefore(
    ago(settings.CATALOG_GAP_TTL_DAYS * DAY_MS),
  );
  // Sessions and email links stop working at expiry; this only removes the dead rows.
  const accountSecretsPurged =
    (await repos.sessions.deleteExpired(now)) + (await repos.accountTokens.deleteExpired(now));
  return {
    ...result,
    accountSecretsPurged,
    recognitionPurged,
    feedbackDetailsCleared,
    tutorTurnsPurged,
    evidencePacksPurged,
    catalogGapsPurged,
  };
}
