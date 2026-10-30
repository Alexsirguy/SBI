import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sbi/env", "@sbi/ui"],
};

export default nextConfig;
