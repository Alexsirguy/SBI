import { createRegistry } from "@sbi/visuals";

// Each kind's renderer joins here as a dynamic import, so its libraries load only when shown.
export const webRegistry = createRegistry({});
