import { describe, expect, it } from "vitest";
import { manifestProblems } from "./server";

const base = {
  visualId: "0192f1a0-0000-7000-8000-0000000000c1",
  alt: "Photosynthesis",
  fallback: { text: "Leaves make sugar from light, water and carbon dioxide." },
};

describe("manifestProblems", () => {
  it("passes a process Mermaid can read", async () => {
    const spec =
      "flowchart LR\n  light[Light] --> leaf[Leaf]\n  water[Water] --> leaf\n  leaf --> sugar[Sugar]";
    expect(await manifestProblems({ ...base, kind: "process", spec })).toEqual([]);
  });

  it("reports Mermaid's own error for a broken diagram", async () => {
    const problems = await manifestProblems({
      ...base,
      kind: "process",
      spec: "flowchart LR\n  A[Light --> ",
    });
    expect(problems.join()).toMatch(/Mermaid could not read the diagram/);
  });

  it("passes a graph Vega-Lite can compile", async () => {
    const manifest = {
      ...base,
      kind: "graph",
      controls: [
        { id: "power", label: "Power", unit: "W", min: 500, max: 3000, step: 100, value: 2000 },
      ],
      spec: {
        x: { name: "t", label: "Time", unit: "s", from: 0, to: 600 },
        series: [
          { name: "temp", label: "Temperature", formula: "min(20 + power * t / 4190, 100)" },
        ],
      },
    };
    expect(await manifestProblems(manifest)).toEqual([]);
  });

  it("runs a mechanism through MuJoCo", async () => {
    const { REFERENCE_MECHANISMS } = await import("./references");
    expect(await manifestProblems(REFERENCE_MECHANISMS.engine)).toEqual([]);
    const spec = { mjcf: "<mujoco><worldbody><geom type='bogus'/></worldbody></mujoco>" };
    expect((await manifestProblems({ ...base, kind: "mechanism", spec })).join()).toMatch(/bogus/);
  });

  it("needs every molecule looked up in PubChem first", async () => {
    const spec = { molecules: [{ name: "caffeine" }] };
    expect(await manifestProblems({ ...base, kind: "molecule", spec })).toEqual([
      "caffeine has not been looked up in PubChem",
    ]);
  });

  it("reports contract errors by field", async () => {
    expect(await manifestProblems({ ...base, kind: "process", alt: "" })).toEqual([
      expect.stringMatching(/^alt:/),
    ]);
  });

  it("asks for code when a playground has none", async () => {
    expect(await manifestProblems({ ...base, kind: "playground" })).toEqual([
      "spec.code: write the playground's code",
    ]);
  });
});

describe("GALLERY_FIXTURES", () => {
  it("are valid, one for every kind", async () => {
    const { GALLERY_FIXTURES } = await import("./fixtures");
    for (const manifest of GALLERY_FIXTURES) {
      expect(await manifestProblems(manifest)).toEqual([]);
    }
  });
});
