import type { EvidenceSource } from "@sbi/contracts";
import { OGL_V3, US_GOV_LICENSE } from "../retrieval/institutions";

/** Longest excerpt shown from a quote-only source: a short quotation, not a reproduction. */
export const QUOTE_LIMIT_CHARS = 300;

export interface LicenseInfo {
  /** Short name for the credit line, e.g. "CC BY 4.0". */
  label: string;
  url?: string;
}

const CC_NAMES: Record<string, string> = {
  by: "CC BY",
  "by-sa": "CC BY-SA",
  "by-nc": "CC BY-NC",
  "by-nc-sa": "CC BY-NC-SA",
  "by-nd": "CC BY-ND",
  "by-nc-nd": "CC BY-NC-ND",
};

/** Turns the licence a connector recorded (a URL, "cc by" or our own text) into a credit label. */
export function licenseInfo(license: string | undefined): LicenseInfo | undefined {
  if (!license) return undefined;
  if (license === US_GOV_LICENSE) return { label: "Public domain (US government work)" };
  if (license === "public domain") return { label: "Public domain" };
  if (license === OGL_V3) return { label: "Open Government Licence v3.0", url: OGL_V3 };
  const ccUrl = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i.exec(license);
  if (ccUrl) {
    const name = CC_NAMES[ccUrl[1]?.toLowerCase() ?? ""];
    const url = `https://creativecommons.org/licenses/${ccUrl[1]?.toLowerCase()}/${ccUrl[2]}/`;
    return name ? { label: `${name} ${ccUrl[2]}`, url } : { label: license, url: license };
  }
  if (/creativecommons\.org\/publicdomain\/zero/i.test(license) || /^cc0\b/i.test(license)) {
    return { label: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };
  }
  const ccShort = /^cc[ -]([a-z -]+)$/i.exec(license.trim());
  const shortName =
    ccShort && CC_NAMES[ccShort[1]?.trim().toLowerCase().replace(/\s+/g, "-") ?? ""];
  if (shortName) return { label: shortName };
  return /^https?:\/\//.test(license)
    ? { label: "Publisher licence", url: license }
    : { label: license };
}

/** "Title. Publisher or authors. Licence. Accessed date." — what CC BY's attribution asks for. */
export function creditLine(source: EvidenceSource): string {
  const by =
    source.publisher ?? (source.authors.length > 0 ? source.authors.join(", ") : undefined);
  const license = licenseInfo(source.retrieval?.license);
  return [source.title, by, license?.label ?? "Licence not stated", `Accessed ${source.accessedOn}`]
    .filter(Boolean)
    .map((part) => (part as string).replace(/\.$/, ""))
    .join(". ")
    .concat(".");
}

export type ExcerptDisplay =
  | { mode: "quote"; text: string; credit: string; url?: string; license?: LicenseInfo }
  | { mode: "link"; credit: string; url?: string; license?: LicenseInfo };

/** What may be shown for one excerpt, decided by the source's rights status alone. */
export function excerptDisplay(source: EvidenceSource, excerptText: string): ExcerptDisplay {
  const base = {
    credit: creditLine(source),
    url: source.url ?? (source.doi ? `https://doi.org/${source.doi}` : undefined),
    license: licenseInfo(source.retrieval?.license),
  };
  const quotable =
    source.rightsStatus === "reusable" ||
    (source.rightsStatus === "quote-only" && excerptText.length <= QUOTE_LIMIT_CHARS);
  return quotable ? { mode: "quote", text: excerptText, ...base } : { mode: "link", ...base };
}
