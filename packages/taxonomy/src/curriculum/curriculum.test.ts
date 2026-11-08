import { describe, expect, it } from "vitest";
import { SEED_TAXONOMY } from "../seed";
import { createTaxonomy } from "../taxonomy";
import { alignmentsFor, CURRICULA } from "./curricula";
import { conceptKey, Curriculum, Standard } from "./schema";

const taxonomy = createTaxonomy(SEED_TAXONOMY);
const seedKeys = new Set(
  SEED_TAXONOMY.flatMap((entry) => taxonomy.concepts(entry.id)).map(conceptKey),
);
// Seed concepts a curriculum genuinely doesn't cover; anything else unmapped fails.
const KNOWN_GAPS: Record<Curriculum, string[]> = {
  us: ["pressure", "navigation", "firing"],
  ng: [],
};
const codes = (curriculum: Curriculum, labels: string[], level?: string) =>
  alignmentsFor(labels, curriculum, { level }).map((a) => a.standard.code);

describe.each(Curriculum.options)("%s curriculum", (curriculum) => {
  const { standards, levels } = CURRICULA[curriculum];

  it("has valid standards with unique codes and known levels", () => {
    for (const standard of standards) {
      expect(() => Standard.parse(standard)).not.toThrow();
      expect(standard.curriculum).toBe(curriculum);
      expect(levels).toContain(standard.level);
    }
    const all = standards.map((s) => s.code);
    expect(new Set(all).size).toBe(all.length);
  });

  it("only names concepts the seed teaches", () => {
    for (const standard of standards) {
      for (const key of standard.concepts) expect(seedKeys, standard.code).toContain(key);
    }
  });

  it("covers every seed concept outside the arts, apart from known gaps", () => {
    const covered = new Set(standards.flatMap((s) => s.concepts));
    const missing = SEED_TAXONOMY.filter((entry) => taxonomy.domainOf(entry.id) !== "arts")
      .flatMap((entry) => taxonomy.concepts(entry.id).map(conceptKey))
      .filter((key) => !covered.has(key) && !KNOWN_GAPS[curriculum].includes(key));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe("Nigeria senior secondary", () => {
  it("maps maths, physics, chemistry and biology in each of SSS1 to SSS3", () => {
    for (const level of ["SSS1", "SSS2", "SSS3"]) {
      const subjects = new Set(
        CURRICULA.ng.standards.filter((s) => s.level === level).map((s) => s.subject),
      );
      expect([...subjects].sort(), level).toEqual(["biology", "chemistry", "maths", "physics"]);
    }
  });

  it("uses our NG code scheme under the senior secondary framework", () => {
    const sss = CURRICULA.ng.standards.filter((s) => s.level.startsWith("SSS"));
    for (const s of sss) {
      expect(s.framework).toBe("nerdc-sss");
      expect(s.code).toMatch(/^NG-(MTH|PHY|CHM|BIO)-SSS[1-3]-[A-Z-]+$/);
    }
  });
});

describe("alignmentsFor", () => {
  it("finds standards in the chosen curriculum only", () => {
    const us = codes("us", ["gear ratio"]);
    const ng = codes("ng", ["gear ratio"]);
    expect(us).toEqual(expect.arrayContaining(["6.RP.A.1", "HS-PS2-1"]));
    expect(ng).toEqual(expect.arrayContaining(["NG-MTH-SSS1-NUMBER-RATIO-VARIATION"]));
    expect(us.some((code) => code.startsWith("NG-"))).toBe(false);
  });

  it("filters by level", () => {
    expect(codes("ng", ["refraction"], "SSS2")).toEqual(["NG-PHY-SSS2-WAVES-LIGHT-REFRACTION"]);
    expect(codes("us", ["refraction"], "3-5")).toEqual([]);
  });

  it("orders by level and lists each standard once", () => {
    const found = alignmentsFor(["boiling", "melting"], "ng");
    const levels = found.map((a) => CURRICULA.ng.levels.indexOf(a.standard.level));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    const all = found.map((a) => a.standard.code);
    expect(new Set(all).size).toBe(all.length);
  });

  it("matches a concept that contains a known one, marked partial", () => {
    const [first] = alignmentsFor(["static friction"], "ng");
    expect(first).toMatchObject({ conceptKey: "static-friction", match: "partial" });
    expect(first?.standard.code).toBe("NG-PHY-SSS1-MOTION-FRICTION");
  });

  it("does not match part of a word", () => {
    expect(codes("us", ["frictionless"])).toEqual([]);
    expect(codes("us", ["poetry"])).toEqual([]);
  });
});

describe("conceptKey", () => {
  it("is the slug lessons already use for concept ids", () => {
    expect(conceptKey("Earth's magnetic field")).toBe("earth-s-magnetic-field");
    expect(conceptKey("  Gear ratio ")).toBe("gear-ratio");
    expect(conceptKey("!!")).toBe("");
  });
});
