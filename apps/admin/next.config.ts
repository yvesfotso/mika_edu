import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@eduprep/core"],
  experimental: {
    // Past-paper PDFs go up to 15 MB (PAST_PAPER_MAX_BYTES); leave room for the multipart overhead.
    serverActions: { bodySizeLimit: "16mb" },
    // The auth proxy buffers request bodies; without this, uploads over 10 MB would arrive truncated.
    proxyClientMaxBodySize: "16mb",
  },
};

export default nextConfig;
