export {
  CitationError,
  createCitationResolver,
  type CitationProblem,
  type CitationResolver,
  type QuotedRef,
  type ResolvedClaim,
  type ResolvedExcerpt,
} from "./citations/resolver";
export {
  buildClaims,
  type BuildOptions,
  type BuiltClaims,
  type ClaimDraft,
  type RemovedClaim,
} from "./claims/builder";
export {
  ClaimGraphError,
  collectDependents,
  createClaimGraph,
  orderByDependencies,
  type ClaimGraph,
} from "./claims/graph";
export {
  createLlmSupportJudge,
  SUPPORT_PROMPT_VERSION,
  SupportVerdict,
  type SupportJudge,
  type SupportQuestion,
} from "./claims/judge";
export { saveClaimGraph, type EvidenceRepositories } from "./claims/persist";
export { claimTerms, matchTerms, type TermMatch, type TermProfile } from "./claims/terms";
export { createMemoryEvidenceRepositories, type MemoryEvidenceRepositories } from "./memory";
export {
  sourceLocatorKey,
  type ClaimRepository,
  type EvidenceSourceRepository,
  type SourceLocator,
} from "./repositories";
export { createCrossrefConnector, fullDate, type ConnectorOptions } from "./retrieval/crossref";
export { createEuropePmcConnector } from "./retrieval/europe-pmc";
export { getText, SourceFetchError, USER_AGENT, type HttpOptions } from "./retrieval/http";
export {
  createDefaultRetriever,
  createRetriever,
  toEvidenceSource,
  UntrustedSourceError,
  type ExcerptChoice,
  type RetrievalFailure,
  type Retriever,
  type RetrieverOptions,
} from "./retrieval/retriever";
export { rightsFromLicense } from "./retrieval/rights";
export { contentSha256 } from "./retrieval/text";
export type {
  FetchedSource,
  FetchOptions,
  Passage,
  SourceConnector,
  SourceRef,
} from "./retrieval/types";
export {
  createUsGovConnector,
  US_GOV_LICENSE,
  US_GOV_PUBLISHERS,
  usGovDomain,
} from "./retrieval/us-gov";
export { discoverReferences, refFromLink } from "./retrieval/wikipedia";
