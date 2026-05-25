import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kit/database", "@kit/shared", "@kit/ui"],
  // Native Rust binaries inside `impit` (browser-fingerprinted HTTP client
  // used by `google-maps-review-scraper`) can't be bundled by Turbopack.
  // Marking the chain as external loads them via Node's require at
  // runtime — server-side only, never ships to the client.
  serverExternalPackages: [
    "google-maps-review-scraper",
    "impit",
    "simple-wappalyzer",
    "playwright",
    "playwright-core",
  ],
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
