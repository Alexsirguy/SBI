import { DEFAULT_RETENTION_POLICY, type ObjectStorage } from "@sbi/media";
import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../env";
import { runRetentionPass, type RetentionDeps } from "./retention-pass";

const NOW = new Date("2026-11-02T12:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function deps() {
  const storage = { list: vi.fn(async () => []), remove: vi.fn() } as unknown as ObjectStorage;
  const repos = {
    accountTokens: { deleteExpired: vi.fn(async () => 1) },
    catalogGaps: { deleteLastSeenBefore: vi.fn(async () => 1) },
    deletionAudit: { record: vi.fn(), purgeOlderThan: vi.fn(async () => 0) },
    evidencePacks: { deleteCreatedBefore: vi.fn(async () => 2) },
    lessonFeedback: { clearDetailsBefore: vi.fn(async () => 3) },
    mediaRegistry: { listExpired: vi.fn(async () => []) },
    recognitionResults: { deleteExpired: vi.fn(async () => 4) },
    sessions: { deleteExpired: vi.fn(async () => 2) },
    tutorTurns: { deleteCreatedBefore: vi.fn(async () => 1) },
  };
  return { repos, deps: { repos, storage } as unknown as RetentionDeps };
}

// Defaults straight from the env schema, so the test checks what production runs with.
const SETTINGS = loadEnv({
  DATABASE_URL: "mysql://sbi:sbi@localhost:3306/sbi",
  S3_ENDPOINT: "http://localhost:8333",
  S3_REGION: "auto",
  S3_BUCKET: "sbi",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  CLAMAV_HOST: "localhost",
  UPLOAD_TOKEN_SECRET: "x".repeat(32),
  WEB_ORIGINS: "http://localhost:3000",
});

describe("runRetentionPass", () => {
  it("deletes every data class at the cutoff docs/retention.md promises", async () => {
    const { repos, deps: input } = deps();
    const result = await runRetentionPass(input, NOW, DEFAULT_RETENTION_POLICY, SETTINGS);

    expect(repos.recognitionResults.deleteExpired).toHaveBeenCalledWith(NOW);
    expect(repos.lessonFeedback.clearDetailsBefore).toHaveBeenCalledWith(days(90));
    expect(repos.tutorTurns.deleteCreatedBefore.mock.calls).toEqual([
      ["session", days(1)],
      ["account", days(30)],
      ["quality-review", days(30)],
      ["research-consented", days(365)],
    ]);
    expect(repos.evidencePacks.deleteCreatedBefore).toHaveBeenCalledWith(days(30));
    expect(repos.catalogGaps.deleteLastSeenBefore).toHaveBeenCalledWith(days(365));
    expect(repos.deletionAudit.purgeOlderThan).toHaveBeenCalledWith(days(365));
    expect(repos.sessions.deleteExpired).toHaveBeenCalledWith(NOW);
    expect(repos.accountTokens.deleteExpired).toHaveBeenCalledWith(NOW);
    expect(result).toMatchObject({
      recognitionPurged: 4,
      feedbackDetailsCleared: 3,
      tutorTurnsPurged: 4,
      evidencePacksPurged: 2,
      catalogGapsPurged: 1,
      accountSecretsPurged: 3,
    });
  });

  it("follows shorter settings from the environment", async () => {
    const { repos, deps: input } = deps();
    await runRetentionPass(input, NOW, DEFAULT_RETENTION_POLICY, {
      ...SETTINGS,
      TUTOR_TTL_SESSION_HOURS: 2,
      EVIDENCE_PACK_TTL_DAYS: 7,
    });
    expect(repos.tutorTurns.deleteCreatedBefore).toHaveBeenCalledWith(
      "session",
      new Date(NOW.getTime() - 2 * 3_600_000),
    );
    expect(repos.evidencePacks.deleteCreatedBefore).toHaveBeenCalledWith(days(7));
  });
});
