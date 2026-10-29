import type { RightsStatus } from "@sbi/contracts";
import type { ConnectorOptions } from "./crossref";
import { getText, SourceFetchError } from "./http";
import { contentSha256, htmlParagraphs, htmlTablePassages, htmlTitle } from "./text";
import type { SourceConnector } from "./types";

/** A reuse grant an institution's own terms state; each entry below cites one (ADR 0009). */
export interface ReuseGrant {
  /** Recorded on every fetch as `retrieval.license`; licenseInfo turns it into a credit label. */
  license: string;
  rightsStatus: RightsStatus;
}

export const US_GOV_LICENSE = "US federal government work (17 U.S.C. §105)";

export const GRANTS = {
  usFederal: { license: US_GOV_LICENSE, rightsStatus: "reusable" },
} as const satisfies Record<string, ReuseGrant>;

export interface Institution {
  domain: string;
  publisher: string;
  grant: ReuseGrant;
  /** Sub-hosts that republish third-party copyrighted text under this domain. */
  exclude?: string[];
}

// Only add an entry after checking the institution's own terms; ADR 0009 records the evidence.
export const INSTITUTIONS: readonly Institution[] = [
  { domain: "nasa.gov", publisher: "NASA", grant: GRANTS.usFederal },
  {
    domain: "nist.gov",
    publisher: "National Institute of Standards and Technology",
    grant: GRANTS.usFederal,
  },
  {
    domain: "noaa.gov",
    publisher: "National Oceanic and Atmospheric Administration",
    grant: GRANTS.usFederal,
  },
  { domain: "usgs.gov", publisher: "U.S. Geological Survey", grant: GRANTS.usFederal },
  {
    domain: "nih.gov",
    publisher: "National Institutes of Health",
    grant: GRANTS.usFederal,
    // Republishes journal abstracts under the publishers' copyright; Europe PMC covers them.
    exclude: ["ncbi.nlm.nih.gov"],
  },
  { domain: "nps.gov", publisher: "National Park Service", grant: GRANTS.usFederal },
  { domain: "energy.gov", publisher: "U.S. Department of Energy", grant: GRANTS.usFederal },
  { domain: "epa.gov", publisher: "U.S. Environmental Protection Agency", grant: GRANTS.usFederal },
];

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** The allowlisted institution behind an HTTPS URL, or undefined; the longest domain wins. */
export function institutionFor(
  url: string,
  registry: readonly Institution[] = INSTITUTIONS,
): Institution | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") return undefined;
  const host = parsed.hostname.toLowerCase();
  const found = registry
    .filter((entry) => matches(host, entry.domain))
    .sort((a, b) => b.domain.length - a.domain.length)[0];
  if (!found || found.exclude?.some((domain) => matches(host, domain))) return undefined;
  return found;
}

export function createInstitutionConnector(
  options: ConnectorOptions & { institutions?: readonly Institution[] } = {},
): SourceConnector {
  const now = options.now ?? (() => new Date());
  const registry = options.institutions ?? INSTITUTIONS;
  return {
    id: "institution",
    canFetch: (ref) => Boolean(ref.url && institutionFor(ref.url, registry)),
    async fetch(ref, { signal } = {}) {
      const response = await getText(ref.url ?? "", options, signal);
      // A redirect off the allowlist would launder an untrusted page.
      const institution = institutionFor(response.url, registry);
      if (!institution) {
        throw new SourceFetchError(`${ref.url} redirected outside the allowlist`);
      }
      const passages = [
        ...htmlParagraphs(response.text).map((text, index) => ({
          location: `paragraph ${index + 1}`,
          text,
        })),
        ...htmlTablePassages(response.text),
      ];
      if (passages.length === 0) {
        throw new SourceFetchError(`${response.url} has no readable paragraphs`);
      }
      return {
        title: htmlTitle(response.text) ?? response.url,
        publisher: institution.publisher,
        authors: [],
        url: response.url,
        sourceType: "institution",
        studyDesign: "not-research",
        passages,
        rightsStatus: institution.grant.rightsStatus,
        retrieval: {
          connector: "institution",
          fetchedAt: now().toISOString(),
          access: "full-text",
          license: institution.grant.license,
          contentSha256: contentSha256(passages),
        },
      };
    },
  };
}
