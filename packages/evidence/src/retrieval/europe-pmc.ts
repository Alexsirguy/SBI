import type { ConnectorOptions } from "./crossref";
import { getJson, SourceFetchError } from "./http";
import { rightsFromLicense } from "./rights";
import { abstractPassages, contentSha256, stripTags } from "./text";
import type { SourceConnector } from "./types";

interface EuropePmcSearch {
  resultList: {
    result: {
      pmid?: string;
      doi?: string;
      title?: string;
      authorString?: string;
      firstPublicationDate?: string;
      license?: string;
      abstractText?: string;
      pubTypeList?: { pubType?: string[] };
      journalInfo?: { journal?: { title?: string } };
    }[];
  };
}

export function createEuropePmcConnector(options: ConnectorOptions = {}): SourceConnector {
  const now = options.now ?? (() => new Date());
  return {
    id: "europe-pmc",
    canFetch: (ref) => Boolean(ref.doi || ref.pmid),
    async fetch(ref, { signal } = {}) {
      const query = ref.doi ? `DOI:"${ref.doi}"` : `EXT_ID:${ref.pmid} AND SRC:MED`;
      const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&resultType=core&format=json&pageSize=1`;
      const body = await getJson<EuropePmcSearch>(url, options, signal);
      const record = body.resultList.result[0];
      if (!record) {
        throw new SourceFetchError(`Europe PMC has no record for ${query}`, 404);
      }
      const passages = record.abstractText ? abstractPassages(record.abstractText) : [];
      const pubTypes = record.pubTypeList?.pubType ?? [];
      return {
        title: stripTags(record.title ?? query).replace(/\.$/, ""),
        publisher: record.journalInfo?.journal?.title,
        authors: (record.authorString ?? "").replace(/\.$/, "").split(", ").filter(Boolean),
        url: record.doi
          ? `https://doi.org/${record.doi}`
          : `https://europepmc.org/article/MED/${record.pmid}`,
        doi: record.doi,
        sourceType: "peer-reviewed",
        // Reviews pool many studies; anything else in a journal is read as one study.
        studyDesign: pubTypes.some((type) => /review|meta-analysis/i.test(type))
          ? "review"
          : "primary-study",
        publishedOn: record.firstPublicationDate,
        passages,
        rightsStatus: passages.length > 0 ? rightsFromLicense(record.license) : "link-only",
        retrieval: {
          connector: "europe-pmc",
          fetchedAt: now().toISOString(),
          access: passages.length > 0 ? "abstract" : "metadata-only",
          license: record.license,
          contentSha256: contentSha256(passages),
        },
      };
    },
  };
}
