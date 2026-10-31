import { VisualAsset, VisualManifest } from "@sbi/contracts";
import { describe, expect, it, vi } from "vitest";
import { GALLERY_FIXTURES } from "./fixtures";
import { moleculeExtent, molfileOnly, sdfProblems } from "./kinds/molecule-spec";
import { memoryPubChemCache, resolveMolecules } from "./pubchem";

const water = GALLERY_FIXTURES.find((item) => item.kind === "molecule");
const WATER_SDF = (water?.spec as { molecules: { sdf: string }[] }).molecules[0]?.sdf ?? "";

const asked = VisualManifest.parse({
  visualId: "0192f1a0-0000-7000-8000-0000000000e1",
  kind: "molecule",
  alt: "Water",
  fallback: { text: "Water is one oxygen atom joined to two hydrogen atoms." },
  spec: { molecules: [{ name: "Water" }] },
});

function pubchem(responses: Record<string, Response | (() => Response)>) {
  return vi.fn(async (url: string | URL | Request) => {
    const key = Object.keys(responses).find((part) => String(url).includes(part));
    const response = key ? responses[key] : undefined;
    if (!response) return new Response("", { status: 404 });
    return typeof response === "function" ? response() : response.clone();
  });
}

describe("resolveMolecules", () => {
  const found = {
    "/name/water/cids/JSON": new Response(JSON.stringify({ IdentifierList: { CID: [962] } })),
    "/cid/962/SDF": new Response(`${WATER_SDF}> <PUBCHEM_IUPAC_NAME>\noxidane\n\n$$$$\n`),
  };

  it("fills the structure from PubChem, keeps only the molfile, and records its rights", async () => {
    const result = await resolveMolecules(asked, {
      fetch: pubchem(found),
      cache: memoryPubChemCache(),
    });
    if ("problems" in result) throw new Error(result.problems.join());
    const [molecule] = (result.manifest.spec as { molecules: { cid: number; sdf: string }[] })
      .molecules;
    expect(molecule?.cid).toBe(962);
    expect(molecule?.sdf.endsWith("M  END\n")).toBe(true);
    expect(molecule?.sdf).not.toContain("oxidane");
    const [asset] = result.assets;
    expect(VisualAsset.parse(asset).sourceUrl).toBe(
      "https://pubchem.ncbi.nlm.nih.gov/compound/962",
    );
    expect(result.manifest.assetIds).toEqual([asset?.assetId]);
  });

  it("asks PubChem once per name", async () => {
    const fetcher = pubchem(found);
    const cache = memoryPubChemCache();
    await resolveMolecules(asked, { fetch: fetcher, cache });
    await resolveMolecules(asked, { fetch: fetcher, cache });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("says when PubChem does not know the name or has no 3D structure", async () => {
    const unknown = await resolveMolecules(asked, {
      fetch: pubchem({}),
      cache: memoryPubChemCache(),
    });
    expect(unknown).toEqual({ problems: ['PubChem does not know a molecule called "water"'] });
    const flat = await resolveMolecules(asked, {
      fetch: pubchem({ "/name/water/cids/JSON": found["/name/water/cids/JSON"] }),
      cache: memoryPubChemCache(),
    });
    expect(flat).toEqual({ problems: ['PubChem has no 3D structure for "water"'] });
  });

  it("says when PubChem cannot be reached", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await resolveMolecules(asked, { fetch: offline, cache: memoryPubChemCache() });
    expect(result).toEqual({ problems: ['PubChem could not be reached for "water"'] });
  });
});

describe("sdfProblems", () => {
  it("accepts a 3D structure", () => {
    expect(sdfProblems("water", WATER_SDF)).toEqual([]);
  });

  it("refuses an empty, unreadable or flat structure", () => {
    expect(sdfProblems("x", "")).toEqual(["the structure for x has no atoms"]);
    const flat = [
      "flat",
      "",
      "",
      "  3  2  0     0  0  0  0  0  0999 V2000",
      "    0.0000    0.0000    0.0000 O   0  0",
      "    0.7570    0.5860    0.0000 H   0  0",
      "   -0.7570    0.5860    0.0000 H   0  0",
      "M  END",
    ].join("\n");
    expect(sdfProblems("water", flat)).toEqual(["the structure for water is flat, not 3D"]);
  });

  it("measures the molecule across, in ångströms", () => {
    // The two hydrogens of water sit about 1.53 Å apart.
    expect(moleculeExtent(WATER_SDF)).toBeCloseTo(1.53, 2);
  });

  it("cuts an SDF record at its molfile end", () => {
    expect(molfileOnly("a\nM  END\n> <X>\ny\n$$$$")).toBe("a\nM  END\n");
  });
});
