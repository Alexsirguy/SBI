import { isSpanishLabel } from "./locale";
import { LABELS_ES } from "./labels-es";
import type { Taxonomy } from "./taxonomy";

export interface SupportObject {
  id: string;
  label: string;
  /** Has checked facts of its own, beyond what any lesson finds. */
  curated: boolean;
}

export interface SupportCategory {
  id: string;
  label: string;
  domain: string | undefined;
  objects: SupportObject[];
}

/** The curated catalogue by category, in the reader's language, for the public support map. */
export function supportMap(
  taxonomy: Pick<Taxonomy, "entries" | "domainOf">,
  locale?: string,
): SupportCategory[] {
  const label = (id: string, english: string) =>
    isSpanishLabel(locale) ? (LABELS_ES[id] ?? english) : english;
  const entries = taxonomy.entries();
  const collator = new Intl.Collator(isSpanishLabel(locale) ? "es" : "en");
  return entries
    .filter((entry) => entry.kind === "category")
    .map((category) => ({
      domain: taxonomy.domainOf(category.id),
      id: category.id,
      label: label(category.id, category.label),
      objects: entries
        .filter((entry) => entry.kind === "object" && entry.parentId === category.id)
        .map((entry) => ({
          curated: entry.facts.length > 0,
          id: entry.id,
          label: label(entry.id, entry.label),
        }))
        .sort((a, b) => collator.compare(a.label, b.label)),
    }))
    .filter((category) => category.objects.length > 0);
}
