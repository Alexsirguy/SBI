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
