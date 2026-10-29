import { getJson, type HttpOptions } from "./http";
import type { SourceRef } from "./types";
import { usGovDomain } from "./us-gov";

interface ParseResponse {
  parse?: { externallinks?: string[] };
}

/** Turns one external link into a ref a trusted connector can fetch, or drops it. */
export function refFromLink(link: string): SourceRef | undefined {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  if (host === "doi.org" || host === "dx.doi.org") {
    const doi = decodeURIComponent(url.pathname.slice(1));
    return /^10\.\d{4,9}\/\S+$/.test(doi) ? { doi } : undefined;
  }
  if (host === "pubmed.ncbi.nlm.nih.gov") {
    const pmid = /^\/(\d+)\/?$/.exec(url.pathname)?.[1];
    return pmid ? { pmid } : undefined;
  }
  return usGovDomain(link) ? { url: link } : undefined;
}

const refKey = (ref: SourceRef) => ref.doi?.toLowerCase() ?? ref.pmid ?? ref.url ?? "";

/** Discovery only: returns an article's references, never its text, so Wikipedia is never evidence. */
export async function discoverReferences(
  title: string,
  options: HttpOptions = {},
  signal?: AbortSignal,
): Promise<SourceRef[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&prop=externallinks&format=json&redirects=1&page=${encodeURIComponent(title)}`;
  const body = await getJson<ParseResponse>(url, options, signal);
  const refs = new Map<string, SourceRef>();
  for (const link of body.parse?.externallinks ?? []) {
    const ref = refFromLink(link);
    if (ref && !refs.has(refKey(ref))) refs.set(refKey(ref), ref);
  }
  return [...refs.values()];
}
