import { createHash } from "node:crypto";

/** Deterministic UUID (v5-style) from a stable key, so seeds and demo data share IDs. */
export function uuidFor(key: string): string {
  const h = createHash("sha1").update(`eduprep:${key}`).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
