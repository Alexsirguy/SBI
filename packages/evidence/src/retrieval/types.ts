import type { RightsStatus, SourceRetrieval, SourceType, StudyDesign } from "@sbi/contracts";

/** Points at a source without its content; discovery yields these, connectors resolve them. */
export interface SourceRef {
  doi?: string;
  pmid?: string;
  url?: string;
}

export interface Passage {
  location: string;
  text: string;
}

export interface FetchedSource {
  title: string;
  publisher?: string;
  authors: string[];
  url?: string;
  doi?: string;
  sourceType: SourceType;
  studyDesign?: StudyDesign;
  publishedOn?: string;
  passages: Passage[];
  rightsStatus: RightsStatus;
  retrieval: SourceRetrieval;
}

export interface FetchOptions {
  signal?: AbortSignal;
}

export interface SourceConnector {
  readonly id: string;
  canFetch(ref: SourceRef): boolean;
  fetch(ref: SourceRef, options?: FetchOptions): Promise<FetchedSource>;
}
