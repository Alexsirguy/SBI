import { createTaxonomy, SEED_TAXONOMY } from "@sbi/taxonomy";
import { describe, expect, it } from "vitest";
import { safetyNoticeFor } from "./lesson.service";
import { resolveSubject } from "./subject";

const taxonomy = createTaxonomy(SEED_TAXONOMY);

describe("resolveSubject", () => {
  it("uses the catalogue entry a request names by id", () => {
    expect(resolveSubject({ taxonomyId: "object.teapot" }, taxonomy)?.id).toBe("object.teapot");
    expect(resolveSubject({ taxonomyId: "object.nothing-here" }, taxonomy)).toBeUndefined();
  });

  it("reuses a catalogue entry when the subject is its exact name", () => {
    const entry = resolveSubject({ subject: "stovetop kettle" }, taxonomy);
    expect(entry?.id).toBe("object.stovetop-kettle");
    expect(entry?.label).toBe("Stovetop kettle");
  });

  it("teaches any other subject under its own stable id", () => {
    const entry = resolveSubject({ subject: "  rainbow   over the sea " }, taxonomy);
    expect(entry).toEqual({
      id: "subject.rainbow-over-the-sea",
      label: "Rainbow over the sea",
      parentId: undefined,
      facts: [],
    });
    // "kettle" names two catalogue objects, so it stays a subject rather than a guess between them.
    expect(resolveSubject({ subject: "kettle" }, taxonomy)?.id).toBe("subject.kettle");
  });

  it.each([
    ["ibuprofen", "Medicines"],
    ["bottle of bleach", "Household chemicals"],
    ["wall socket in the kitchen", "Electricity"],
    ["red toadstool", "Wild mushrooms"],
  ])("gives %s the safety notice of its topic", (subject, notice) => {
    const entry = resolveSubject({ subject }, taxonomy);
    expect(entry && safetyNoticeFor(entry)).toMatch(new RegExp(`^${notice}:`));
  });

  it("does not warn about everyday look-alikes", () => {
    for (const subject of ["vacuum cleaner", "tablet computer", "spark plug"]) {
      const entry = resolveSubject({ subject }, taxonomy);
      expect(entry && safetyNoticeFor(entry)).toBeUndefined();
    }
  });

  it("names nothing for an empty subject", () => {
    expect(resolveSubject({ subject: " -- " }, taxonomy)).toBeUndefined();
    expect(resolveSubject({}, taxonomy)).toBeUndefined();
  });
});
