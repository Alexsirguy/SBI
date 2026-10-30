# 0009. Trusted evidence sources and how we read their rights

- Status: accepted
- Date: 2026-10-29
- Issue: #44

## Context

Every factual claim a lesson shows must trace to a stored excerpt from a real source (§7). The Phase 0 spike used Wikipedia text as evidence. That is quick, but Wikipedia is a tertiary source that anyone can edit, and its text is CC BY-SA. We need an allowlist of authoritative sources, a record of how each one was fetched, and a reading of its licence that the lesson pipeline can act on.

## Decision

- **Wikipedia is used for discovery only.** `discoverReferences` returns an article's references and never its text. Only references a trusted connector can fetch are kept: DOIs, PubMed ids, and allowlisted federal pages.
- **Connectors, in order of preference:**
  - **Europe PMC**, by DOI or PubMed id. Gives the abstract with its section headings, the licence, and the open-access flag.
  - **Crossref**, by DOI. Gives metadata, the licence URL and, sometimes, a JATS abstract. Used when Europe PMC lacks the work.
  - **US federal agencies:** nasa.gov, nist.gov, noaa.gov, usgs.gov, nih.gov, nps.gov, energy.gov and epa.gov, over HTTPS only. The last three were added for #182 because their pages state everyday science plainly.
    - Pages there are US government works (17 U.S.C. §105).
    - `ncbi.nlm.nih.gov` is excluded because it republishes publishers' copyrighted abstracts.
    - A redirect off the allowlist is refused.
    - Only body paragraphs are kept; headers, navigation, footers and asides are dropped.
- **Every fetch is recorded** on the stored source as `retrieval`: connector, time, access level (`full-text`, `abstract` or `metadata-only`), the licence as stated, and a SHA-256 of the fetched passages. The freshness checker (#47) compares against that hash.
- **Rights are read conservatively** (`rightsFromLicense`):
  - CC0, public domain, CC BY and CC BY-SA → `reusable`.
  - Any NC or ND term, an unknown licence or no licence → `quote-only`.
  - Metadata with no text → `link-only`, since it supports nothing.
  - Stored excerpts are capped at 1,000 characters either way.
- No API key, account or personal data is sent. Requests carry a generic `User-Agent`, run one at a time, and back off on 429s.

## Consequences

- Sources stay limited to abstracts and agency pages until a full-text connector exists for open-access articles. Abstracts rarely contain the precise figures a lesson quotes, such as a boiling point at altitude, so many claims will need an agency page or remain open questions.
- Topics whose Wikipedia references are mostly blogs or manufacturer pages, such as bicycle gearing, yield nothing. That is the point: those claims must be sourced another way or shown as open questions (#45).
- Some federal pages still embed third-party images or quotes. We store text excerpts only, and the rights register (#19) governs any media.
- Adding a source means a new connector, a test with recorded fixtures, and an update to this ADR.

## Update 2026-10-29: sources rejected for taxonomy facts (#182)

- **OpenStax** textbooks are now CC BY-NC-SA 4.0, and every book states that it "may not be used in the training of large language models or otherwise be ingested into large language models or generative AI offerings without OpenStax's permission". Our support judge sends excerpts to a model, so OpenStax stays off the allowlist unless OpenStax grants written permission.
- **USDA and Forest Service** pages answer automated fetches with 403, so they are not on the allowlist.
- With the allowlist above, 2 of the 22 seeded taxonomy facts are linked to claims (`packages/evidence/snapshots/taxonomy-facts.json`); the rest are marked unsourced and lessons may not state them (`sourcedFacts`).

## Update 2026-10-29: showing excerpts (#181)

Pages render `ResolvedExcerpt.display` from `excerptDisplay`, never the raw excerpt text:

| Rights status                        | Shown                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `reusable`                           | The excerpt with its credit line                                                                                 |
| `quote-only`                         | The excerpt only if it is at most `QUOTE_LIMIT_CHARS` (300) characters, with its credit line; otherwise the link |
| `link-only`, `restricted`, `unknown` | The credit line and link only                                                                                    |

- **Credit line** (`creditLine`): title, then publisher (or authors), licence label and access date, as CC BY attribution asks. A source without a recorded licence says "Licence not stated" rather than guessing.
- **Storage:** for `quote-only` sources the claim builder stores only the judge's quoted sentence, and only when it is within the cap. Otherwise the passage is not cited, so stored excerpts never exceed what may be shown.

## Update 2026-10-29: open textbooks, more institutions, robots.txt (#42)

Sources follow the spec's §7 list (textbooks, public science institutions, standards, peer-reviewed papers). Every entry below was checked against the source's own terms on 2026-10-29; the registry in `packages/evidence/src/retrieval/` is the source of truth.

- **NASA stays.** The owner accepted NASA's guidance on AI attribution: credits name NASA as the source of an excerpt, never of a generated answer.
- **Open textbooks** (`open-textbook` connector):
  - **LibreTexts:** a page is used only if its own licence tag is CC BY, CC BY-SA or public domain. Most books are NC, so the check is per page. Pages under any other tag keep no text and are stored `restricted`. OpenStax-derived pages modified after 2026-04-22 are also refused, since OpenStax then relicensed new editions as NC with an AI clause.
  - **Wikisource:** only works marked public domain, for history of science.
  - **Kuphaldt, _Lessons In Electric Circuits_:** CC BY, as each chapter states.
  - **Rejected:** openstax.org (NC plus an AI clause), MIT OCW and Saylor (NC), CK-12 (educational use only; bans AI scraping), OpenIntro (terms target AI scrapers), BCcampus and other Pressbooks hosts (block automated access), Project Gutenberg (human users only).
- **Institutions** (`institution` connector). Each entry records its reuse grant, any excluded sub-hosts and any path scope.
  - **US federal works:** FDA, NSF, EIA, NRC, USDA and ARS, NWS, Climate.gov, NARA (excluding catalog.archives.gov), USPTO (excluding its search databases), FAA, FWS.
  - **CDC:** public domain, with its required notice that use implies no endorsement and the material is free at cdc.gov.
  - **LANL:** free use provided its notice is reproduced.
  - **UK:** GOV.UK under OGL v3.
  - **CC BY 4.0:** European Commission and JRC (ec.europa.eu and commission.europa.eu only), CORDIS, ECMWF, Geoscience Australia, NZ Department of Conservation, and ESO, whose grant is limited to news, announcements, pictures of the week and blog paths.
- **Not added:**
  - **Non-commercial terms or no reuse grant:** Smithsonian web pages (only its CC0 Open Access records qualify, which needs a separate API connector), LLNL, Sandia, LBNL, Fermilab, Argonne, Brookhaven, PNNL, Ames, SLAC, NREL, UKRI, NPL, BGS web text, Science Museum Group and NHM websites, Kew, canada.ca, NRCan, Canadian Space Agency, Ingenium, CSIRO, Bureau of Meteorology, Science Learning Hub, Earth Sciences NZ, ESA, CERN text, Biodiversity Heritage Library, Internet Archive.
  - **Terms that forbid scraping or AI tools:** Met Office, NIWA, HathiTrust.
  - **Blocking automated access:** Library of Congress, Forest Service, Science Museum Group collection pages, Europeana.
  - **Left for the owner:** ORNL (it promises not to assert rights rather than granting a licence) and Australia's DCCEEW (CC BY 4.0, but its robots.txt blocks AI crawlers by name).
- **robots.txt is honoured** for every web source:
  - disallowed paths are never fetched;
  - each host's `Crawl-delay` is respected, with at least 1 s between requests otherwise;
  - an unreachable robots.txt means staying out, per RFC 9309.
- **User-Agent contact:** every request names the owner-chosen contact `alex@moonsatech.com`, because Wikimedia's User-Agent policy asks automated clients for one. `EVIDENCE_CONTACT` overrides it.
