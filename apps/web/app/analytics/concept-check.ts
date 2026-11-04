/** Bumped whenever the check's wording, placement or scoring changes, so results stay comparable. */
export const CONCEPT_CHECK = "concept-check-v1";

/** Typed subjects get ids made from the learner's words, so they are reported only as "subject". */
export function topicOf(taxonomyId: string): string {
  return taxonomyId.startsWith("subject.") ? "subject" : taxonomyId;
}
