import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Workspace packages ship TypeScript source, so they must be bundled.
  noExternal: [/^@sbi\//],
});
