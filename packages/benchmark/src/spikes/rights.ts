import type { SeedSet } from "../seed-set";

export interface RightsResult {
  images: number;
  complete: number;
  byLicence: Record<string, number>;
  shareAlike: number;
  // GFDL and FAL carry licence-text duties on every copy, so they stay internal until reviewed.
  internalOnly: string[];
  publishable: number;
}

/** Checks every seed image has a complete rights record and sorts them by what reuse allows. */
export function auditRights(set: SeedSet): RightsResult {
  const images = set.prompts.flatMap((prompt) =>
    prompt.image ? [{ id: prompt.id, ...prompt.image }] : [],
  );
  const result: RightsResult = {
    images: images.length,
    complete: 0,
    byLicence: {},
    shareAlike: 0,
    internalOnly: [],
    publishable: 0,
  };
  for (const image of images) {
    const { license, author, sourceUrl, title } = image.rights;
    if (license && author && sourceUrl && title && image.sha256) result.complete += 1;
    result.byLicence[license] = (result.byLicence[license] ?? 0) + 1;
    if (/-SA/.test(license)) result.shareAlike += 1;
    if (/^(GFDL|FAL)/.test(license)) result.internalOnly.push(image.id);
    else result.publishable += 1;
  }
  return result;
}
