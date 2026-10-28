export {
  Domain,
  FactScope,
  TaxonomyEntry,
  TaxonomyFact,
  TaxonomyPart,
  type TaxonomyEntryInput,
} from "./schema";
export { SEED_TAXONOMY } from "./seed";
export {
  createTaxonomy,
  MAX_SEARCH_RESULTS,
  MIN_QUERY_LENGTH,
  type ResolvedLabel,
  type Taxonomy,
} from "./taxonomy";
export {
  routeVisual,
  UnroutableError,
  VISUAL_ROUTES,
  type Interaction,
  type VisualFamily,
  type VisualRoute,
} from "./visual-routing";
