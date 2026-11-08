import type { Database } from "../client";
import {
  createAccountRepository,
  createAccountTokenRepository,
  createSessionRepository,
} from "./accounts";
import { createCatalogGapRepository } from "./catalog-gaps";
import { createClassRepository } from "./classes";
import { createCoverageRepository } from "./coverage";
import { createClaimRepository, createEvidenceSourceRepository } from "./evidence";
import { createEvidencePackRepository } from "./evidence-packs";
import { createLessonFeedbackRepository } from "./lesson-feedback";
import { createLessonRepository } from "./lessons";
import { createDeletionAuditLog, createMediaRegistry } from "./media";
import { createRecognitionResultRepository } from "./recognition-results";
import { createReviewAuditLog } from "./review-audit";
import { createSavedLessonRepository } from "./saved-lessons";
import { createTutorTurnRepository } from "./tutor-turns";
import { createVisualAssetRepository } from "./visual-assets";
import { createVisualManifestRepository } from "./visual-manifests";

export function createRepositories(db: Database) {
  return {
    accounts: createAccountRepository(db),
    accountTokens: createAccountTokenRepository(db),
    sessions: createSessionRepository(db),
    catalogGaps: createCatalogGapRepository(db),
    classes: createClassRepository(db),
    coverage: createCoverageRepository(db),
    deletionAudit: createDeletionAuditLog(db),
    lessons: createLessonRepository(db),
    lessonFeedback: createLessonFeedbackRepository(db),
    mediaRegistry: createMediaRegistry(db),
    evidenceSources: createEvidenceSourceRepository(db),
    evidencePacks: createEvidencePackRepository(db),
    claims: createClaimRepository(db),
    visualAssets: createVisualAssetRepository(db),
    visualManifests: createVisualManifestRepository(db),
    recognitionResults: createRecognitionResultRepository(db),
    reviewAudit: createReviewAuditLog(db),
    savedLessons: createSavedLessonRepository(db),
    tutorTurns: createTutorTurnRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
