import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sbi/env", "@sbi/ui", "@sbi/visuals"],
};

export default nextConfig;
