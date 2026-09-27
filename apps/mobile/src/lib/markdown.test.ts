import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("splits bold, italic and code", () => {
    expect(parseInline("a **b** c `d` *e*")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " c " },
      { text: "d", code: true },
      { text: " " },
      { text: "e", italic: true },
    ]);
  });

  it("leaves maths symbols alone", () => {
    expect(parseInline("x² − 5x + 6 = 0 and 2 * 3")).toEqual([{ text: "x² − 5x + 6 = 0 and 2 * 3" }]);
  });
});

describe("parseMarkdown", () => {
  it("parses the lesson subset", () => {
    const blocks = parseMarkdown(
      [
        "# Title",
        "",
        "First line",
        "continues here.",
        "",
        "- one",
        "- **two**",
        "",
        "1. first",
        "2. second",
        "",
        "> Exam tip: check",
        "> your roots.",
        "",
        "| f(x) | f'(x) |",
        "|---|---|",
        "| xⁿ | n·xⁿ⁻¹ |",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "table"]);
    expect(blocks[1]).toEqual({ type: "paragraph", content: [{ text: "First line continues here." }] });
    expect(blocks[3]).toMatchObject({ ordered: true });
    expect(blocks[4]).toEqual({ type: "quote", content: [{ text: "Exam tip: check your roots." }] });
    expect(blocks[5]).toMatchObject({ header: [[{ text: "f(x)" }], [{ text: "f'(x)" }]], rows: [[[{ text: "xⁿ" }], [{ text: "n·xⁿ⁻¹" }]]] });
  });
});
