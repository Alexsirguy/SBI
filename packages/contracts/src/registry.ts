import { Claim, EvidenceSource } from "./evidence";
import { Lesson } from "./lesson";
import { RecognitionResult } from "./recognition";
import { TutorTurn } from "./tutor";
import { VisualAsset, VisualManifest, VisualRef } from "./visual";

/** Semver for the published contracts; bump per docs/contracts-versioning.md. */
export const CONTRACTS_VERSION = "0.1.0";

export const CONTRACT_SCHEMAS = {
  Claim,
  EvidenceSource,
  Lesson,
  RecognitionResult,
  TutorTurn,
  VisualAsset,
  VisualManifest,
  VisualRef,
};
