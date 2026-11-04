import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output lets the Docker image run without the workspace's node_modules.
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../.."),
  transpilePackages: ["@sbi/env", "@sbi/ui", "@sbi/visuals"],
  devIndicators: false,
  turbopack: {
    // MuJoCo's loader imports `module` on its Node path only; browsers never take that branch.
    resolveAlias: { module: { browser: "./empty-module.js" } },
  },
};

export default nextConfig;
