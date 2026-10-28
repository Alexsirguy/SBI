import type { Database } from "../client";
import { createClaimRepository, createEvidenceSourceRepository } from "./evidence";
import { createLessonRepository } from "./lessons";
import { createMediaStores } from "./media";
import { createRecognitionResultRepository } from "./recognition-results";
import { createTutorTurnRepository } from "./tutor-turns";
import { createVisualAssetRepository } from "./visual-assets";

export function createRepositories(db: Database) {
  const media = createMediaStores(db);
  return {
    deletionAudit: media.audit,
    lessons: createLessonRepository(db),
    mediaRegistry: media.registry,
    evidenceSources: createEvidenceSourceRepository(db),
    claims: createClaimRepository(db),
    visualAssets: createVisualAssetRepository(db),
    recognitionResults: createRecognitionResultRepository(db),
    tutorTurns: createTutorTurnRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
