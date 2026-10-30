import type { Database } from "../client";
import { createCatalogGapRepository } from "./catalog-gaps";
import { createClaimRepository, createEvidenceSourceRepository } from "./evidence";
import { createEvidencePackRepository } from "./evidence-packs";
import { createLessonRepository } from "./lessons";
import { createDeletionAuditLog, createMediaRegistry } from "./media";
import { createRecognitionResultRepository } from "./recognition-results";
import { createReviewAuditLog } from "./review-audit";
import { createTutorTurnRepository } from "./tutor-turns";
import { createVisualAssetRepository } from "./visual-assets";

export function createRepositories(db: Database) {
  return {
    catalogGaps: createCatalogGapRepository(db),
    deletionAudit: createDeletionAuditLog(db),
    lessons: createLessonRepository(db),
    mediaRegistry: createMediaRegistry(db),
    evidenceSources: createEvidenceSourceRepository(db),
    evidencePacks: createEvidencePackRepository(db),
    claims: createClaimRepository(db),
    visualAssets: createVisualAssetRepository(db),
    recognitionResults: createRecognitionResultRepository(db),
    reviewAudit: createReviewAuditLog(db),
    tutorTurns: createTutorTurnRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
