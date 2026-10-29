export {
  creditLine,
  excerptDisplay,
  licenseInfo,
  QUOTE_LIMIT_CHARS,
  type ExcerptDisplay,
  type LicenseInfo,
} from "./citations/display";
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
  groundVerdict,
  SUPPORT_PROMPT_VERSION,
  SupportVerdict,
  type SupportJudge,
  type SupportQuestion,
} from "./claims/judge";
export {
  checkSource,
  runFreshnessPass,
  type CheckOutcome,
  type FreshnessPassOptions,
  type FreshnessPassResult,
  type InvalidationSink,
} from "./freshness/freshness";
export {
  applySourcePolicy,
  assessClaim,
  checkSourcePolicy,
  independentSourceCount,
  isPrimaryStudy,
  sameOrigin,
  SINGLE_SOURCE_NOTE,
  SINGLE_STUDY_LIMITATION,
  STUDIES_LIMITATION,
  type PolicyAssessment,
  type PolicyIssue,
} from "./policy/two-source";
export {
  ingestTopic,
  TopicSources,
  TopicSpec,
  type IngestOptions,
  type IngestReport,
} from "./ingest/ingest";
export { saveClaimGraph, type EvidenceRepositories } from "./claims/persist";
export { claimTerms, matchTerms, type TermMatch, type TermProfile } from "./claims/terms";
export { createMemoryEvidenceRepositories, type MemoryEvidenceRepositories } from "./memory";
export {
  DuplicateSourceError,
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
  type RetrieveOptions,
  type RetrieverOptions,
} from "./retrieval/retriever";
export { rightsFromLicense } from "./retrieval/rights";
export { comparableText, contentSha256 } from "./retrieval/text";
export type {
  FetchedSource,
  FetchOptions,
  Passage,
  SourceConnector,
  SourceRef,
} from "./retrieval/types";
export {
  createInstitutionConnector,
  GRANTS,
  institutionFor,
  INSTITUTIONS,
  US_GOV_LICENSE,
  type Institution,
  type ReuseGrant,
} from "./retrieval/institutions";
export { discoverReferences, refFromLink } from "./retrieval/wikipedia";
export { EvidenceSnapshot, loadSnapshot, snapshotRepositories } from "./snapshot";
export {
  createOpenTextbookConnector,
  libreTextsLicence,
  OPENSTAX_RELICENSED_AT,
  TEXTBOOK_HOSTS,
  textbookHostFor,
  wikisourceLicence,
  type TextbookConnectorOptions,
} from "./retrieval/open-textbooks";
