import type { AgeChoice } from "../lesson/prefs";

/** Chosen by the learner or their grown-up, never inferred from an age (#108). */
export type Pathway = "self" | "child";
export const PATHWAY_COOKIE = "sbi_pathway";
const YEAR_SECONDS = 365 * 24 * 60 * 60;

export function isPathway(value: unknown): value is Pathway {
  return value === "self" || value === "child";
}

/** In the child pathway lessons are always for the child band, whatever the URL asks. */
export function pathwayAge(pathway: Pathway | undefined, chosen: AgeChoice): AgeChoice {
  return pathway === "child" ? "child" : chosen;
}

// A cookie, not storage, so the server can hold the child band even on a shared or typed link.
export function writePathwayCookie(pathway: Pathway) {
  document.cookie = `${PATHWAY_COOKIE}=${pathway}; Path=/; Max-Age=${YEAR_SECONDS}; SameSite=Lax`;
}
