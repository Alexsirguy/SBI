import { createRegistry } from "@sbi/visuals";

// Each kind's renderer is a dynamic import, so its libraries load only when it is shown.
export const webRegistry = createRegistry({
  graph: () => import("@sbi/visuals/graph").then((module) => module.graphRenderer),
  process: () => import("@sbi/visuals/process").then((module) => module.processRenderer),
});
