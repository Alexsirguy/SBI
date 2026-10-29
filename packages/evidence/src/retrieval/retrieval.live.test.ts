import { describe, expect, it } from "vitest";
import { createDefaultRetriever } from "./retriever";

// Hits the real public APIs; opt in with EVIDENCE_LIVE=1 so CI never depends on them.
describe.skipIf(process.env.EVIDENCE_LIVE !== "1")("live retrieval", () => {
  const retriever = createDefaultRetriever({ retryDelayMs: 2000 });

  it("fetches an open-access paper through Europe PMC", async () => {
    const source = await retriever.retrieve({ doi: "10.1371/journal.pone.0000217" });
    expect(source.retrieval.connector).toBe("europe-pmc");
    expect(source.rightsStatus).toBe("reusable");
    expect(source.passages.length).toBeGreaterThan(0);
  }, 30_000);

  it("fetches a federal science page", async () => {
    const source = await retriever.retrieve({
      url: "https://www.usgs.gov/special-topics/water-science-school/science/water-density",
    });
    expect(source.passages.some((passage) => passage.text.includes("0.9998395"))).toBe(true);
  }, 30_000);

  it("discovers trusted references from a Wikipedia article", async () => {
    const { fetched } = await retriever.discover("Boiling point");
    expect(fetched.length).toBeGreaterThan(0);
  }, 120_000);

  it("fetches an openly licensed LibreTexts page and refuses a non-commercial one", async () => {
    const open = await retriever.retrieve({
      url: "https://geo.libretexts.org/Bookshelves/Geology/Physical_Geology_(Earle)/01%3A_Introduction_to_Geology/1.02%3A_Why_Study_Earth",
    });
    expect(open).toMatchObject({ rightsStatus: "reusable", sourceType: "textbook" });
    expect(open.passages.length).toBeGreaterThan(0);
    const closed = await retriever.retrieve({
      url: "https://chem.libretexts.org/Bookshelves/General_Chemistry/Map%3A_General_Chemistry_(Petrucci_et_al.)/01%3A_Matter-_Its_Properties_And_Measurement/1.1%3A_The_Scientific_Method",
    });
    expect(closed).toMatchObject({ rightsStatus: "restricted", passages: [] });
  }, 60_000);
});
