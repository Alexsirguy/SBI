import type { CurriculumId } from "@sbi/contracts";

// Mirrors CURRICULA in @sbi/taxonomy, kept here so the teacher page doesn't load the standards.
export const CURRICULUM_LEVELS: Record<CurriculumId, readonly string[]> = {
  us: ["3-5", "6-8", "9-12"],
  ng: ["P4-6", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"],
};
