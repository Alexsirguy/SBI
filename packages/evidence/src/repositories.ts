import type { Claim, EvidenceSource } from "@sbi/contracts";

export interface EvidenceSourceRepository {
  save(source: EvidenceSource): Promise<void>;
  get(sourceId: string): Promise<EvidenceSource | undefined>;
  getMany(sourceIds: string[]): Promise<EvidenceSource[]>;
}

export interface ClaimRepository {
  save(claim: Claim): Promise<void>;
  get(claimId: string): Promise<Claim | undefined>;
  getMany(claimIds: string[]): Promise<Claim[]>;
}
