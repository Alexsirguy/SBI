import type { VisualKind } from "@sbi/contracts";

/** The npm libraries each kind's renderer loads; the rights register must clear every one. */
export const RENDERER_LIBRARIES: Readonly<Record<VisualKind, readonly string[]>> = {
  mechanism: ["@mujoco/mujoco", "three", "mathjs"],
  molecule: ["3dmol", "mathjs"],
  process: ["mermaid", "mathjs"],
  graph: ["vega", "vega-lite", "vega-embed", "mathjs"],
  // acorn checks playground code on the server; the frame runs our small kit and nothing else.
  playground: ["acorn", "mathjs"],
};
