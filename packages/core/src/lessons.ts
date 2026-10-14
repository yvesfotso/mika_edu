/**
 * Splits lesson markdown into blocks at `## ` headings: the text before the first heading (if any)
 * is block 0, then one block per section. Checkpoints sit between blocks, and reading progress is
 * saved per block. A lesson without headings is a single block.
 */
export function splitLessonBlocks(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[][] = [[]];
  let inFence = false;
  for (const line of lines) {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (!inFence && /^##\s/.test(line) && blocks.at(-1)!.some((l) => l.trim() !== "")) blocks.push([]);
    blocks.at(-1)!.push(line);
  }
  const text = blocks.map((b) => b.join("\n").trim()).filter((b) => b !== "");
  return text.length > 0 ? text : [""];
}

/** Clamps a checkpoint or resume position to the blocks available in the displayed language. */
export function clampBlock(index: number, blockCount: number): number {
  return Math.min(Math.max(0, Math.floor(index)), Math.max(0, blockCount - 1));
}

/**
 * Short, stable fingerprint of a study pack's contents (FNV-1a over the sorted ids and versions).
 * Not a security hash: it only tells the app that a downloaded pack is out of date.
 */
export function packVersion(parts: { id: string; version: number }[]): string {
  const canonical = [...parts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => `${p.id}@${p.version}`)
    .join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${parts.length}-${hash.toString(16).padStart(8, "0")}`;
}
