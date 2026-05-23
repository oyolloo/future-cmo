import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kit/database", "@kit/shared", "@kit/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-icons-png.flaticon.com",
      },
      {
        // Google Places Photo API — used for business thumbnails.
        protocol: "https",
        hostname: "places.googleapis.com",
      },
      {
        // Some Places photos redirect to Google's user-content CDN.
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
