import { createRegistry } from "@sbi/visuals";

// Each kind's renderer is a dynamic import, so its libraries load only when it is shown.
export const webRegistry = createRegistry({
  graph: () => import("@sbi/visuals/graph").then((module) => module.graphRenderer),
  mechanism: () => import("@sbi/visuals/mechanism").then((module) => module.mechanismRenderer),
  molecule: () => import("@sbi/visuals/molecule").then((module) => module.moleculeRenderer),
  process: () => import("@sbi/visuals/process").then((module) => module.processRenderer),
});
