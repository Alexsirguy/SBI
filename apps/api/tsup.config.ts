import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Workspace packages ship TypeScript source, so they must be bundled.
  noExternal: [/^@sbi\//],
  // Bundled CommonJS dependencies (mysql2) call require() for Node built-ins.
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
