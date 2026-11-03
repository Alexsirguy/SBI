export {
  Domain,
  FactScope,
  TaxonomyEntry,
  TaxonomyFact,
  TaxonomyPart,
  type TaxonomyEntryInput,
} from "./schema";
export { sourcedFacts, type FactClaimStatus } from "./facts";
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
export {
  MAX_GAP_TERM_LENGTH,
  normaliseGapTerm,
  searchObservations,
  type CatalogGap,
  type CatalogGapRepository,
  type GapSource,
} from "./gaps";
export { prioritiseDemand, type DemandPriority } from "./demand";
export { LABELS_ES } from "./labels-es";
export { supportMap, type SupportCategory, type SupportObject } from "./support-map";
