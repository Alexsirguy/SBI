import type { Claim, EvidenceSource } from "@sbi/contracts";

export interface SourceLocator {
  url?: string;
  doi?: string;
}

export interface EvidenceSourceRepository {
  save(source: EvidenceSource): Promise<void>;
  get(sourceId: string): Promise<EvidenceSource | undefined>;
  getMany(sourceIds: string[]): Promise<EvidenceSource[]>;
  /** Finds a stored source by DOI or URL, so fetching it again updates it instead of duplicating it. */
  findByLocator(locator: SourceLocator): Promise<EvidenceSource | undefined>;
  delete(sourceId: string): Promise<boolean>;
  /** Sources last checked before the cutoff, oldest first. */
  listDueForCheck(checkedBefore: Date, limit: number): Promise<EvidenceSource[]>;
}

export interface ClaimRepository {
  save(claim: Claim): Promise<void>;
  get(claimId: string): Promise<Claim | undefined>;
  getMany(claimIds: string[]): Promise<Claim[]>;
  delete(claimId: string): Promise<boolean>;
  /** Claims that list this one in `dependsOn`. */
  findDependents(claimId: string): Promise<Claim[]>;
  /** Claims that cite this source, so a changed source can invalidate them. */
  findBySource(sourceId: string): Promise<Claim[]>;
}

/** One key per source: the DOI when there is one, since the same paper has many URLs. */
export function sourceLocatorKey({ url, doi }: SourceLocator): string {
  if (doi) {
    return `doi:${doi.toLowerCase()}`;
  }
  if (!url) {
    throw new Error("A source locator needs a url or a doi");
  }
  const parsed = new URL(url);
  parsed.hash = "";
  const path = parsed.pathname.replace(/\/+$/, "");
  return `url:${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
}
