import type { ConnectorOptions } from "./crossref";
import { getText, SourceFetchError } from "./http";
import { contentSha256, htmlParagraphs, htmlTitle } from "./text";
import type { SourceConnector } from "./types";

// Federal science agencies whose own pages are US government works.
export const US_GOV_PUBLISHERS: Readonly<Record<string, string>> = {
  "nasa.gov": "NASA",
  "nist.gov": "National Institute of Standards and Technology",
  "noaa.gov": "National Oceanic and Atmospheric Administration",
  "usgs.gov": "U.S. Geological Survey",
  "nih.gov": "National Institutes of Health",
  "nps.gov": "National Park Service",
  "energy.gov": "U.S. Department of Energy",
  "epa.gov": "U.S. Environmental Protection Agency",
};

// These republish journal abstracts under the publishers' copyright; Europe PMC covers them.
const EXCLUDED_HOSTS = ["ncbi.nlm.nih.gov"];

const matches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

export function usGovDomain(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || EXCLUDED_HOSTS.some((domain) => matches(host, domain))) {
    return undefined;
  }
  return Object.keys(US_GOV_PUBLISHERS).find((domain) => matches(host, domain));
}

export const US_GOV_LICENSE = "US federal government work (17 U.S.C. §105)";

export function createUsGovConnector(options: ConnectorOptions = {}): SourceConnector {
  const now = options.now ?? (() => new Date());
  return {
    id: "us-gov",
    canFetch: (ref) => Boolean(ref.url && usGovDomain(ref.url)),
    async fetch(ref, { signal } = {}) {
      const response = await getText(ref.url ?? "", options, signal);
      // A redirect off the allowlist would launder an untrusted page.
      const domain = usGovDomain(response.url);
      if (!domain) {
        throw new SourceFetchError(`${ref.url} redirected outside the allowlist`);
      }
      const passages = htmlParagraphs(response.text).map((text, index) => ({
        location: `paragraph ${index + 1}`,
        text,
      }));
      if (passages.length === 0) {
        throw new SourceFetchError(`${response.url} has no readable paragraphs`);
      }
      return {
        title: htmlTitle(response.text) ?? response.url,
        publisher: US_GOV_PUBLISHERS[domain],
        authors: [],
        url: response.url,
        sourceType: "institution",
        studyDesign: "not-research",
        passages,
        rightsStatus: "reusable",
        retrieval: {
          connector: "us-gov",
          fetchedAt: now().toISOString(),
          access: "full-text",
          license: US_GOV_LICENSE,
          contentSha256: contentSha256(passages),
        },
      };
    },
  };
}
