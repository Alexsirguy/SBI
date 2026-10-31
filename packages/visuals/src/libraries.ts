import type { VisualKind } from "@sbi/contracts";

/** The npm libraries each kind's renderer loads; the rights register must clear every one. */
export const RENDERER_LIBRARIES: Readonly<Record<VisualKind, readonly string[]>> = {
  mechanism: ["@mujoco/mujoco", "three", "mathjs"],
  molecule: ["3dmol", "mathjs"],
  process: ["mermaid", "mathjs"],
  graph: ["vega", "vega-lite", "vega-embed", "mathjs"],
  // acorn checks playground code on the server; the sandbox itself loads the kit's libraries.
  playground: ["three", "matter-js", "mathjs", "acorn"],
};
