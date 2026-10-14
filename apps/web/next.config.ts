import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos are hotlinked from Unsplash's CDN, which resizes them itself (see src/lib/unsplash-loader.ts).
    loader: "custom",
    loaderFile: "./src/lib/unsplash-loader.ts",
    qualities: [60, 75],
  },
};

export default nextConfig;
