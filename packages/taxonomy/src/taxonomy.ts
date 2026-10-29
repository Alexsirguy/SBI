import {
  TAXONOMY_QUERY_MIN_LENGTH,
  TAXONOMY_SEARCH_LIMIT,
  type TaxonomyMatch,
} from "@sbi/contracts";
import {
  TaxonomyEntry,
  type Domain,
  type FactScope,
  type TaxonomyEntryInput,
  type TaxonomyFact,
  type TaxonomyPart,
} from "./schema";

export const MAX_SEARCH_RESULTS = TAXONOMY_SEARCH_LIMIT;
export const MIN_QUERY_LENGTH = TAXONOMY_QUERY_MIN_LENGTH;

export interface ResolvedLabel {
  entry: TaxonomyEntry;
  /** Set when the label named a part, like "chain", rather than the whole object. */
  part?: TaxonomyPart;
}

export interface Taxonomy {
  get(id: string): TaxonomyEntry | undefined;
  entries(): readonly TaxonomyEntry[];
  /** Exact name or alias lookup; a part name returns every object that has that part. */
  resolve(label: string): ResolvedLabel[];
  search(query: string, limit?: number): TaxonomyMatch[];
  ancestors(id: string): TaxonomyEntry[];
  domainOf(id: string): Domain | undefined;
  concepts(id: string): string[];
  facts(id: string, scope: FactScope): TaxonomyFact[];
  /** Returns a new taxonomy with more entries; existing ids cannot be redefined. */
  extend(entries: readonly TaxonomyEntryInput[]): Taxonomy;
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// "kettles" and "glasses" should still find "kettle" and "glass".
function variants(token: string): string[] {
  const forms = [token];
  if (token.length > 3 && token.endsWith("s")) forms.push(token.slice(0, -1));
  if (token.length > 4 && token.endsWith("es")) forms.push(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("ies")) forms.push(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith("ves")) forms.push(`${token.slice(0, -3)}f`);
  return forms;
}

function normalise(text: string): string[] {
  return [...new Set(variants(words(text).join(" ")))];
}

function names(entry: TaxonomyEntry): string[] {
  return [entry.label, ...entry.aliases];
}

// Name matches outrank keyword matches so the object the learner named is offered first.
function scoreToken(token: string, entry: TaxonomyEntry): number {
  const nameWords = names(entry).flatMap(words);
  const keywords = entry.keywords.flatMap(words);
  let best = 0;
  for (const form of variants(token)) {
    if (nameWords.includes(form)) best = Math.max(best, 4);
    else if (nameWords.some((word) => word.startsWith(form))) best = Math.max(best, 3);
    else if (keywords.includes(form)) best = Math.max(best, 2);
    else if (keywords.some((word) => word.startsWith(form))) best = Math.max(best, 1);
  }
  return best;
}

function validate(entries: readonly TaxonomyEntry[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate taxonomy id ${entry.id}`);
    ids.add(entry.id);
  }
  for (const entry of entries) {
    if (entry.parentId && !ids.has(entry.parentId)) {
      throw new Error(`${entry.id} has unknown parent ${entry.parentId}`);
    }
    if (entry.kind === "object" && !entry.parentId) {
      throw new Error(`Object ${entry.id} needs a parent category`);
    }
  }
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    const seen = new Set<string>();
    for (let at: TaxonomyEntry | undefined = entry; at; at = byId.get(at.parentId ?? "")) {
      if (seen.has(at.id)) throw new Error(`Taxonomy cycle through ${at.id}`);
      seen.add(at.id);
    }
  }
}

/** In-memory taxonomy: validated once, then every lookup is synchronous. */
export function createTaxonomy(input: readonly TaxonomyEntryInput[]): Taxonomy {
  const entries = input.map((entry) => TaxonomyEntry.parse(entry));
  validate(entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byName = new Map<string, ResolvedLabel[]>();
  function index(name: string, resolved: ResolvedLabel) {
    const key = words(name).join(" ");
    byName.set(key, [...(byName.get(key) ?? []), resolved]);
  }
  for (const entry of entries) {
    for (const name of names(entry)) index(name, { entry });
    for (const part of entry.parts) {
      for (const name of [part.label, ...part.aliases]) index(name, { entry, part });
    }
  }

  function ancestors(id: string): TaxonomyEntry[] {
    const chain: TaxonomyEntry[] = [];
    for (let at = byId.get(byId.get(id)?.parentId ?? ""); at; at = byId.get(at.parentId ?? "")) {
      chain.push(at);
    }
    return chain;
  }

  return {
    get: (id) => byId.get(id),
    entries: () => entries,
    resolve(label) {
      const found = [
        ...new Map(
          normalise(label)
            .flatMap((key) => byName.get(key) ?? [])
            .map((match) => [`${match.entry.id}/${match.part?.id ?? ""}`, match]),
        ).values(),
      ];
      // Whole-object names win over part names, so "lens" means the lens, not a camera part.
      const whole = found.filter((match) => !match.part);
      return whole.length > 0 ? whole : found;
    },
    search(query, limit = MAX_SEARCH_RESULTS) {
      const tokens = words(query);
      if (tokens.join("").length < MIN_QUERY_LENGTH) return [];
      return entries
        .filter((entry) => entry.kind === "object")
        .map((entry) => {
          const scores = tokens.map((token) => scoreToken(token, entry));
          return {
            entry,
            score: scores.every((score) => score > 0) ? scores.reduce((a, b) => a + b) : 0,
          };
        })
        .filter(({ score }) => score > 0)
        .sort(
          (left, right) =>
            right.score - left.score || left.entry.label.localeCompare(right.entry.label),
        )
        .slice(0, limit)
        .map(({ entry }) => ({ label: entry.label, taxonomyId: entry.id }));
    },
    ancestors,
    domainOf(id) {
      return [byId.get(id), ...ancestors(id)].find((entry) => entry?.domain)?.domain;
    },
    // Concepts and category facts are inherited, since what holds for a category holds for members.
    concepts(id) {
      const own = byId.get(id);
      if (!own) return [];
      return [...new Set([own, ...ancestors(id)].flatMap((entry) => entry.concepts))];
    },
    facts(id, scope) {
      const own = byId.get(id);
      if (!own) return [];
      const sources = scope === "category" ? [own, ...ancestors(id)] : [own];
      return sources.flatMap((entry) => entry.facts.filter((fact) => fact.scope === scope));
    },
    extend(more) {
      return createTaxonomy([...entries, ...more]);
    },
  };
}
