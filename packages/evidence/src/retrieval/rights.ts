import type { RightsStatus } from "@sbi/contracts";

/** Reads a stated licence conservatively: anything not clearly open is quote-only. */
export function rightsFromLicense(license: string | undefined): RightsStatus {
  if (!license) return "quote-only";
  const normalised = license
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?creativecommons\.org\/licenses\//, "cc ")
    .replace(/^https?:\/\/(www\.)?creativecommons\.org\/publicdomain\//, "cc0 ")
    .replace(/[/_-]+/g, " ")
    .trim();
  if (/^cc0\b|public domain/.test(normalised)) return "reusable";
  // Non-commercial and no-derivatives terms do not fit a product that adapts text.
  if (/\b(nc|nd)\b/.test(normalised)) return "quote-only";
  if (/^cc by\b/.test(normalised)) return "reusable";
  return "quote-only";
}
