import { describe, expect, it } from "vitest";
import { experimentVisualId } from "./experiment-visual";

const visual = (visualId: string, kind: "process" | "graph" | "playground") => ({
  visualId,
  kind,
  manifestUri: `/visuals?visualId=${visualId}`,
  alt: kind,
});

describe("experimentVisualId", () => {
  it("drives the visual with sliders, never the stage diagram beside it", () => {
    const graph = "0192f1a0-0000-7000-8000-000000000601";
    const diagram = "0192f1a0-0000-7000-8000-000000000602";
    expect(experimentVisualId([visual(diagram, "process"), visual(graph, "graph")])).toBe(graph);
    expect(experimentVisualId([visual(graph, "graph"), visual(diagram, "process")])).toBe(graph);
  });

  it("has no experiment when only a diagram arrived", () => {
    expect(
      experimentVisualId([visual("0192f1a0-0000-7000-8000-000000000603", "process")]),
    ).toBeUndefined();
    expect(experimentVisualId(undefined)).toBeUndefined();
  });
});
