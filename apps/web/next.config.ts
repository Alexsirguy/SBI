import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sbi/env", "@sbi/ui", "@sbi/visuals"],
  turbopack: {
    // MuJoCo's loader imports `module` on its Node path only; browsers never take that branch.
    resolveAlias: { module: { browser: "./empty-module.js" } },
  },
};

export default nextConfig;
