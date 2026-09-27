/**
 * Parser for the Markdown subset used in lessons: headings, paragraphs, lists, block quotes,
 * tables and inline bold/italic/code. Kept dependency-free so lessons render identically offline.
 */
export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type Block =
  | { type: "heading"; level: number; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; content: Inline[] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("**")) out.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith("`")) out.push({ text: token.slice(1, -1), code: true });
    else out.push({ text: token.slice(1, -1), italic: true });
    last = index + token.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

const isTableDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1]!.length, content: parseInline(heading[2]!) });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quoteLines = [trimmed.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && lines[i + 1]!.trim().startsWith(">")) {
        quoteLines.push(lines[++i]!.trim().replace(/^>\s?/, ""));
      }
      blocks.push({ type: "quote", content: parseInline(quoteLines.join(" ")) });
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableDivider(lines[i + 1]!)) {
      flushParagraph();
      const header = splitRow(trimmed);
      i++;
      const rows: Inline[][][] = [];
      while (i + 1 < lines.length && lines[i + 1]!.trim().startsWith("|")) rows.push(splitRow(lines[++i]!));
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const itemPattern = ordered ? /^\d+[.)]\s+(.*)$/ : /^[-*+]\s+(.*)$/;
      const items = [parseInline((bullet ?? numbered)![1]!)];
      while (i + 1 < lines.length) {
        const next = itemPattern.exec(lines[i + 1]!.trim());
        if (!next) break;
        items.push(parseInline(next[1]!));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}
