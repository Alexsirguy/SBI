import { EvidenceSource } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { lessonSources } from "./sources";

const SOURCE = "0192f1a0-0000-7000-8000-00000000b001";
const OTHER = "0192f1a0-0000-7000-8000-00000000b002";
const CLAIM = "0192f1a0-0000-7000-8000-00000000c001";

const source = (sourceId: string, rightsStatus: EvidenceSource["rightsStatus"]): EvidenceSource =>
  EvidenceSource.parse({
    sourceId,
    title: "Refraction",
    publisher: "University Physics (OpenStax), LibreTexts",
    authors: ["OpenStax"],
    url: "https://phys.libretexts.org/x",
    sourceType: "textbook",
    accessedOn: "2026-10-30",
    excerpts: [
      { excerptId: "x1", location: "paragraph 2", text: "Light bends at a boundary." },
      { excerptId: "x2", location: "paragraph 9", text: "Not cited by this lesson." },
    ],
    claimIds: [CLAIM],
    evidenceQuality: "moderate",
    rightsStatus,
    lastCheckedAt: "2026-10-30T09:00:00.000Z",
    retrieval: {
      connector: "open-textbook",
      fetchedAt: "2026-10-30T09:00:00.000Z",
      access: "full-text",
      license: "https://creativecommons.org/licenses/by/4.0/",
      contentSha256: "a".repeat(64),
    },
  });

const lesson = (sourceId: string) =>
  ({
    lessonId: "0192f1a0-0000-7000-8000-00000000a001",
    claims: [
      {
        claimId: CLAIM,
        text: "Light bends at a boundary.",
        status: "qualified",
        sourceIds: [sourceId],
        scope: "physics",
        confidence: "medium",
        dependsOn: [],
        citations: [{ sourceId, excerptId: "x1" }],
      },
    ],
  }) as never;

describe("lessonSources", () => {
  it("names each cited source with its credit and quotes only the cited excerpt", () => {
    const { sources } = lessonSources(lesson(SOURCE), [
      source(SOURCE, "reusable"),
      source(OTHER, "reusable"),
    ]);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      title: "Refraction",
      url: "https://phys.libretexts.org/x",
      license: { label: "CC BY 4.0" },
      excerpts: [
        {
          excerptId: "x1",
          mode: "quote",
          text: "Light bends at a boundary.",
          location: "paragraph 2",
        },
      ],
    });
    expect(sources[0]?.credit).toContain("Accessed 2026-10-30");
  });

  it("links out without quoting when the licence allows only a link", () => {
    const { sources } = lessonSources(lesson(SOURCE), [source(SOURCE, "link-only")]);
    expect(sources[0]?.excerpts).toEqual([
      { excerptId: "x1", mode: "link", location: "paragraph 2" },
    ]);
  });
});
