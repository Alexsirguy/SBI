import type { Database } from "../client";
import { createCatalogGapRepository } from "./catalog-gaps";
import { createClaimRepository, createEvidenceSourceRepository } from "./evidence";
import { createLessonRepository } from "./lessons";
import { createDeletionAuditLog, createMediaRegistry } from "./media";
import { createRecognitionResultRepository } from "./recognition-results";
import { createTutorTurnRepository } from "./tutor-turns";
import { createVisualAssetRepository } from "./visual-assets";

export function createRepositories(db: Database) {
  return {
    catalogGaps: createCatalogGapRepository(db),
    deletionAudit: createDeletionAuditLog(db),
    lessons: createLessonRepository(db),
    mediaRegistry: createMediaRegistry(db),
    evidenceSources: createEvidenceSourceRepository(db),
    claims: createClaimRepository(db),
    visualAssets: createVisualAssetRepository(db),
    recognitionResults: createRecognitionResultRepository(db),
    tutorTurns: createTutorTurnRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
