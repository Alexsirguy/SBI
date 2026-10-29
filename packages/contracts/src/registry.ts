import { Claim, EvidenceInvalidated, EvidenceSource } from "./evidence";
import { Lesson } from "./lesson";
import { RecognitionResult } from "./recognition";
import { TutorTurn } from "./tutor";
import { VisualAsset, VisualManifest, VisualRef } from "./visual";

/** Semver for the published contracts; bump per docs/contracts-versioning.md. */
export const CONTRACTS_VERSION = "0.15.0";

export const CONTRACT_SCHEMAS = {
  Claim,
  EvidenceInvalidated,
  EvidenceSource,
  Lesson,
  RecognitionResult,
  TutorTurn,
  VisualAsset,
  VisualManifest,
  VisualRef,
};
