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
