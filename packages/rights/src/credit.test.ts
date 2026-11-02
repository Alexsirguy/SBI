import type { VisualAsset } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { creditFor, isShareAlike } from "./credit";
import { LIBRARY_ASSETS, projectOutputAsset, pubChemStructureAsset } from "./libraries";

const SHA = "a".repeat(64);

function photo(overrides: Partial<VisualAsset> = {}): VisualAsset {
  return {
    assetId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
    kind: "model",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kettle.jpg",
    creator: "A. Photographer",
    assetLicense: { id: "CC-BY-SA-4.0" },
    attribution: "Kettle by A. Photographer",
    modified: false,
    commercialUse: "allowed",
    sha256: SHA,
    format: "jpeg",
    sizeBytes: 1000,
    accessibilityFallback: "A steel kettle",
    reviewOwner: "content",
    approvedLessonIds: [],
    ...overrides,
  };
}

describe("creditFor", () => {
  it("gives the credit line, item page and licence link, and flags share-alike", () => {
    expect(creditFor(photo())).toEqual({
      assetId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
      text: "Kettle by A. Photographer, CC BY-SA 4.0",
      itemUrl: "https://commons.wikimedia.org/wiki/File:Kettle.jpg",
      license: { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
      shareAlike: true,
    });
  });

  it("says when the asset was changed, and how", () => {
    const credit = creditFor(
      photo({ assetLicense: { id: "CC-BY-4.0" }, modified: true, modificationNotes: "Cropped." }),
    );
    expect(credit).toMatchObject({
      text: "Kettle by A. Photographer, CC BY 4.0, changed",
      changes: "Cropped.",
      shareAlike: false,
    });
  });

  it("credits PubChem data with its policy page and the changes made", () => {
    const credit = creditFor(
      pubChemStructureAsset({
        assetId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
        cid: 962,
        sha256: SHA,
        sizeBytes: 10,
        accessibilityFallback: "Water",
      }),
    );
    expect(credit).toMatchObject({
      itemUrl: "https://pubchem.ncbi.nlm.nih.gov/compound/962",
      license: {
        label: "NCBI data policy (free to use)",
        url: "https://www.ncbi.nlm.nih.gov/home/about/policies/",
      },
      shareAlike: false,
    });
    expect(credit?.text).toMatch(/^3D structure from PubChem \(CID 962\)/);
  });

  it("shows nothing for our own work or for software libraries", () => {
    const own = projectOutputAsset({
      assetId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
      kind: "data",
      format: "json",
      sha256: SHA,
      sizeBytes: 1,
      accessibilityFallback: "A graph",
    });
    expect(creditFor(own)).toBeUndefined();
    for (const library of LIBRARY_ASSETS) expect(creditFor(library)).toBeUndefined();
  });

  it("keeps an unknown licence id rather than guessing a name", () => {
    expect(creditFor(photo({ assetLicense: { id: "LicenseRef-x" } }))?.license).toEqual({
      label: "LicenseRef-x",
    });
  });
});

describe("isShareAlike", () => {
  it.each([
    ["CC-BY-SA-4.0", true],
    ["CC-BY-SA-3.0", true],
    ["ODbL-1.0", true],
    ["GFDL-1.3", true],
    ["CC-BY-4.0", false],
    ["CC0-1.0", false],
    ["LicenseRef-NCBI-PubChem-data", false],
  ])("%s → %s", (id, expected) => {
    expect(isShareAlike(id)).toBe(expected);
  });
});
