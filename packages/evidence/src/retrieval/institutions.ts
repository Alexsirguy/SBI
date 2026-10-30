import type { RightsStatus } from "@sbi/contracts";
import type { ConnectorOptions } from "./crossref";
import { SourceFetchError } from "./http";
import { createPoliteFetcher, type PoliteFetcher } from "./robots";
import { contentSha256, htmlParagraphs, htmlTablePassages, htmlTitle } from "./text";
import type { SourceConnector } from "./types";

/** A reuse grant an institution's own terms state; each entry below cites one (ADR 0009). */
export interface ReuseGrant {
  /** Recorded on every fetch as `retrieval.license`; licenseInfo turns it into a credit label. */
  license: string;
  rightsStatus: RightsStatus;
}

export const US_GOV_LICENSE = "US federal government work (17 U.S.C. §105)";

export const OGL_V3 = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";

export const GRANTS = {
  usFederal: { license: US_GOV_LICENSE, rightsStatus: "reusable" },
  // CDC asks reusers to say this, and not to change the substantive content.
  cdc: {
    license:
      "US federal government work (CDC). Use does not imply endorsement by CDC, HHS or the U.S. Government; the material is available free at cdc.gov",
    rightsStatus: "reusable",
  },
  // LANL allows free use provided its notice is reproduced with every copy.
  lanl: {
    license:
      "© Triad National Security, LLC; used under the notice at https://www.lanl.gov/lanl-resources/web-policies",
    rightsStatus: "reusable",
  },
  ogl3: { license: OGL_V3, rightsStatus: "reusable" },
  ccBy4: { license: "https://creativecommons.org/licenses/by/4.0/", rightsStatus: "reusable" },
} as const satisfies Record<string, ReuseGrant>;

export interface Institution {
  domain: string;
  publisher: string;
  grant: ReuseGrant;
  /** Sub-hosts that republish third-party copyrighted text under this domain. */
  exclude?: string[];
  /** When set, only these path prefixes fall under the grant. */
  paths?: string[];
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
  { domain: "fda.gov", publisher: "U.S. Food and Drug Administration", grant: GRANTS.usFederal },
  { domain: "nsf.gov", publisher: "U.S. National Science Foundation", grant: GRANTS.usFederal },
  {
    domain: "eia.gov",
    publisher: "U.S. Energy Information Administration",
    grant: GRANTS.usFederal,
  },
  { domain: "nrc.gov", publisher: "U.S. Nuclear Regulatory Commission", grant: GRANTS.usFederal },
  { domain: "usda.gov", publisher: "U.S. Department of Agriculture", grant: GRANTS.usFederal },
  {
    domain: "ars.usda.gov",
    publisher: "USDA Agricultural Research Service",
    grant: GRANTS.usFederal,
  },
  { domain: "weather.gov", publisher: "National Weather Service", grant: GRANTS.usFederal },
  { domain: "climate.gov", publisher: "NOAA Climate.gov", grant: GRANTS.usFederal },
  {
    domain: "archives.gov",
    publisher: "U.S. National Archives",
    grant: GRANTS.usFederal,
    // Catalogue holdings carry donors' rights, unlike NARA's own pages.
    exclude: ["catalog.archives.gov"],
  },
  {
    domain: "uspto.gov",
    publisher: "United States Patent and Trademark Office",
    grant: GRANTS.usFederal,
    // Search databases are not for automated access under USPTO's terms.
    exclude: ["ppubs.uspto.gov", "image-ppubs.uspto.gov", "tsdr.uspto.gov", "tmsearch.uspto.gov"],
  },
  { domain: "faa.gov", publisher: "Federal Aviation Administration", grant: GRANTS.usFederal },
  { domain: "fws.gov", publisher: "U.S. Fish and Wildlife Service", grant: GRANTS.usFederal },
  {
    domain: "cdc.gov",
    publisher: "Centers for Disease Control and Prevention",
    grant: GRANTS.cdc,
  },
  { domain: "lanl.gov", publisher: "Los Alamos National Laboratory", grant: GRANTS.lanl },
  { domain: "gov.uk", publisher: "GOV.UK", grant: GRANTS.ogl3 },
  // Only the Commission's own sites; other EU bodies on europa.eu set their own terms.
  { domain: "ec.europa.eu", publisher: "European Commission", grant: GRANTS.ccBy4 },
  { domain: "commission.europa.eu", publisher: "European Commission", grant: GRANTS.ccBy4 },
  { domain: "cordis.europa.eu", publisher: "CORDIS, European Commission", grant: GRANTS.ccBy4 },
  {
    domain: "ecmwf.int",
    publisher: "European Centre for Medium-Range Weather Forecasts",
    grant: GRANTS.ccBy4,
  },
  { domain: "ga.gov.au", publisher: "Geoscience Australia", grant: GRANTS.ccBy4 },
  {
    domain: "doc.govt.nz",
    publisher: "New Zealand Department of Conservation",
    grant: GRANTS.ccBy4,
  },
  {
    domain: "eso.org",
    publisher: "European Southern Observatory",
    grant: GRANTS.ccBy4,
    // ESO releases only these texts under CC BY 4.0; its other pages are for ESO products only.
    paths: ["/public/news/", "/public/announcements/", "/public/images/potw", "/public/blog/"],
  },
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
  if (found.paths && !found.paths.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return undefined;
  }
  return found;
}

export function createInstitutionConnector(
  options: ConnectorOptions & {
    institutions?: readonly Institution[];
    fetcher?: PoliteFetcher;
  } = {},
): SourceConnector {
  const now = options.now ?? (() => new Date());
  const registry = options.institutions ?? INSTITUTIONS;
  const fetcher = options.fetcher ?? createPoliteFetcher(options);
  return {
    id: "institution",
    canFetch: (ref) => Boolean(ref.url && institutionFor(ref.url, registry)),
    async fetch(ref, { signal } = {}) {
      const response = await fetcher.get(ref.url ?? "", signal);
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
