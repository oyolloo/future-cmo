import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kit/database", "@kit/shared", "@kit/ui"],
};

export default nextConfig;
