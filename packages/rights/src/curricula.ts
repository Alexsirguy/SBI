/** What we may do with one curriculum framework's text, and what we must show (ADR 0029). */
export interface CurriculumSource {
  /** The framework id used in `@sbi/taxonomy`, e.g. "ngss". */
  frameworkId: string;
  owner: string;
  termsUrl: string;
  /** The terms as we read them on `checkedOn`. */
  terms: string;
  checkedOn: string;
  /** What the catalogue keeps; never the standards' own text. */
  stored: string;
  /** Shown wherever the framework's name or codes appear; English, translated in the web app. */
  notice: string;
  reviewOwner: string;
  reviewDueOn: string;
}

const REVIEW_OWNER = "Content and rights lead";
const CHECKED_ON = "2026-11-09";
const REVIEW_DUE = "2027-05-09";

const NERDC: Omit<CurriculumSource, "frameworkId"> = {
  owner: "Nigerian Educational Research and Development Council (NERDC)",
  termsUrl: "https://nerdc.gov.ng",
  terms:
    "No published licence found; the curriculum documents are NERDC's. Topic names and their order are used as facts about the curriculum.",
  checkedOn: CHECKED_ON,
  stored: "Topic names, class and theme, our own learning goals, and the edition used.",
  notice: "Topic list from the NERDC curriculum; goals and alignments are our own.",
  reviewOwner: REVIEW_OWNER,
  reviewDueOn: REVIEW_DUE,
};

export const CURRICULUM_SOURCES: readonly CurriculumSource[] = [
  {
    frameworkId: "ngss",
    owner: "National Academies Press (copyright); WestEd (NGSS trademark)",
    termsUrl: "https://www.nextgenscience.org/trademark-and-copyright-guidelines",
    terms:
      "The public licence covers states, districts, schools, teachers and non-profit education bodies only. Commercial use of the name follows WestEd's trademark guidelines: a disclaimer where the mark first appears, no logo, no mark in titles.",
    checkedOn: CHECKED_ON,
    stored: "Official codes, our own short titles and learning goals, links to nextgenscience.org.",
    notice:
      "NGSS is a registered trademark of WestEd. Neither WestEd nor the lead states and partners that developed the Next Generation Science Standards were involved in the production of this product, and do not endorse it.",
    reviewOwner: REVIEW_OWNER,
    reviewDueOn: REVIEW_DUE,
  },
  {
    frameworkId: "ccss-math",
    owner: "NGA Center for Best Practices and Council of Chief State School Officers",
    termsUrl: "https://thecorestandards.org/public-license/",
    terms:
      "Royalty-free licence to copy, publish, distribute and display the standards for purposes that support the Common Core State Standards Initiative, with the copyright notice.",
    checkedOn: CHECKED_ON,
    stored: "Official codes, our own short titles and learning goals, links to the official text.",
    notice:
      "Common Core State Standards © Copyright 2010. National Governors Association Center for Best Practices and Council of Chief State School Officers. All rights reserved.",
    reviewOwner: REVIEW_OWNER,
    reviewDueOn: REVIEW_DUE,
  },
  { frameworkId: "nerdc-bst", ...NERDC },
  { frameworkId: "nerdc-mth", ...NERDC },
  { frameworkId: "nerdc-sss", ...NERDC },
];

export function curriculumSource(frameworkId: string): CurriculumSource | undefined {
  return CURRICULUM_SOURCES.find((source) => source.frameworkId === frameworkId);
}
