import { VisualManifest } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { graphProblems, graphRows, planGraph, vegaLiteSpec } from "./graph-spec";
import { processSpecProblems, stackedFlowchart } from "./process-spec";

describe("processSpecProblems", () => {
  it("accepts a plain flowchart", () => {
    expect(processSpecProblems("flowchart LR\n  A[Light] --> B[Leaf] --> C[Sugar]")).toEqual([]);
  });

  it.each([
    ["no text", 42, /Mermaid text/],
    ["a chart type that is not a process", 'pie\n  "a": 1', /must start with one of/],
    ["a directive", "%%{init: {'securityLevel': 'loose'}}%%\nflowchart LR\n A-->B", /directives/],
    ["a click handler", "flowchart LR\n  A-->B\n  click A callback", /click and href/],
    ["a link in a label", "flowchart LR\n  A[https://example.org] --> B", /links and HTML/],
    ["HTML in a label", 'flowchart LR\n  A["<img src=x>"] --> B', /links and HTML/],
  ])("refuses %s", (_case, spec, message) => {
    expect(processSpecProblems(spec).join("; ")).toMatch(message);
  });
});

describe("stackedFlowchart", () => {
  it("turns a row of stages into a column", () => {
    expect(stackedFlowchart("flowchart LR\n  A[Light] --> B[Leaf]")).toBe(
      "flowchart TD\n  A[Light] --> B[Leaf]",
    );
    expect(stackedFlowchart("graph RL\n  A --> B")).toBe("graph TD\n  A --> B");
  });

  it("leaves a column and other diagram types as they are", () => {
    expect(stackedFlowchart("flowchart TD\n  A --> B")).toBe("flowchart TD\n  A --> B");
    expect(stackedFlowchart("timeline\n  LR : a")).toBe("timeline\n  LR : a");
  });
});

const kettle = VisualManifest.parse({
  visualId: "0192f1a0-0000-7000-8000-00000000002a",
  kind: "graph",
  alt: "Kettle temperature over time",
  fallback: { text: "The water warms, then boils." },
  controls: [
    { id: "power", label: "Power", unit: "W", min: 500, max: 3000, step: 100, value: 2000 },
  ],
  spec: {
    x: { name: "t", label: "Time", unit: "s", from: 0, to: 600, samples: 3 },
    series: [
      {
        name: "temp",
        label: "Temperature",
        unit: "°C",
        formula: "min(20 + power * t / 4190, 100)",
      },
    ],
  },
});

describe("graph spec", () => {
  it("samples each series across the range at the current slider values", () => {
    const plan = planGraph(kettle);
    if ("problems" in plan) throw new Error(plan.problems.join());
    expect(graphRows(plan, { power: 2000 }).map((row) => [row.x, Math.round(row.y)])).toEqual([
      [0, 20],
      [300, 100],
      [600, 100],
    ]);
    expect(graphRows(plan, { power: 500 })[1]?.y).toBeCloseTo(55.8, 1);
  });

  it("draws our own data and axis titles, whatever look the spec asks for", () => {
    const plan = planGraph({
      ...kettle,
      spec: { ...(kettle.spec as object), vegaLite: { mark: "area" } },
    });
    if ("problems" in plan) throw new Error(plan.problems.join());
    const spec = vegaLiteSpec(plan, kettle.alt);
    expect(spec.mark).toBe("area");
    expect(spec.data).toEqual({ name: "rows" });
    expect(spec).toMatchObject({
      encoding: { x: { title: "Time (s)" }, y: { title: "Temperature (°C)" } },
    });
  });

  it.each([
    [
      "data from a URL",
      { vegaLite: { data: { url: "https://example.org/x.csv" } } },
      /vegaLite.data is not allowed/,
    ],
    ["a nested link", { vegaLite: { encoding: { href: { field: "x" } } } }, /href is not allowed/],
    [
      "a backwards range",
      { x: { name: "t", label: "Time", from: 5, to: 1 } },
      /from must be below/,
    ],
    [
      "an unknown name",
      { series: [{ name: "temp", label: "T", formula: "power * gravity" }] },
      /unknown name "gravity"/,
    ],
  ])("refuses %s", (_case, change, message) => {
    const spec = { ...(kettle.spec as object), ...change };
    expect(graphProblems({ ...kettle, spec }).join("; ")).toMatch(message);
  });

  it("refuses a series that blows up at a slider's end", () => {
    const spec = {
      ...(kettle.spec as object),
      series: [{ name: "rate", label: "Rate", formula: "1 / (power - 500)" }],
    };
    expect(graphProblems({ ...kettle, spec }).join()).toMatch(/finite number/);
  });
});
