"use client";

/** Asks Unsplash's imgix CDN for the exact width Next.js wants, in WebP/AVIF where supported. */
export default function unsplashLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 75));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  return url.toString();
}
