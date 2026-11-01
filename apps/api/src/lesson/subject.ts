import type { LessonRequest } from "@sbi/contracts";
import type { Taxonomy, TaxonomyEntry } from "@sbi/taxonomy";

/** What a lesson is about: a catalogue entry, or a stand-in for a subject the catalogue lacks. */
export type LessonSubject = Pick<TaxonomyEntry, "id" | "label" | "parentId" | "facts">;

// Common risky subjects borrow their catalogue topic's own notice and fallbacks; the classifier
// in @sbi/safety catches every other wording.
const RISKY_TOPICS: readonly (readonly [RegExp, string])[] = [
  [
    /\b(medicines?|medications?|pills?|painkillers?|paracetamol|acetaminophen|ibuprofen|aspirin|antibiotics?|vitamins?|inhalers?)\b/,
    "object.medicine-tablets",
  ],
  [
    /\b(bleach|detergents?|disinfectants?|ammonia|chemicals?|acids?|solvents?|pesticides?|insecticides?|weedkillers?|lye|caustic|cleaning (products?|sprays?|fluids?)|(oven|drain|toilet|bathroom) cleaners?)\b/,
    "category.household-chemicals",
  ],
  [
    /\b(sockets?|outlets?|mains|power strips?|extension (leads?|cords?)|fuse ?box(es)?|wiring|electrical (plugs?|wires?))\b/,
    "object.electrical-socket",
  ],
  [/\b(mushrooms?|toadstools?|fung(us|i)|amanita|death caps?|fly agarics?)\b/, "object.mushroom"],
];

function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The catalogue entry a request names, or a stand-in for its free subject (ADR 0013). */
export function resolveSubject(
  request: Pick<LessonRequest, "taxonomyId" | "subject">,
  taxonomy: Pick<Taxonomy, "get" | "resolve">,
): LessonSubject | undefined {
  if (request.taxonomyId) return taxonomy.get(request.taxonomyId);
  const subject = request.subject?.trim().replace(/\s+/g, " ");
  const slug = subject ? slugOf(subject) : "";
  if (!subject || !slug) return undefined;
  // An exact name or alias reuses the catalogue's facts; a part or an ambiguous name does not.
  const matches = taxonomy.resolve(subject);
  const [only] = matches;
  if (matches.length === 1 && only && !only.part) return only.entry;
  const lower = subject.toLowerCase();
  const risky = RISKY_TOPICS.find(([pattern]) => pattern.test(lower));
  return {
    id: `subject.${slug}`,
    label: sentenceCase(subject),
    parentId: risky?.[1],
    facts: [],
  };
}
