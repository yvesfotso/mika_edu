import { describe, expect, it } from "vitest";
import { convertImportRows, parseCsv } from "./importer";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const CHAPTER = "22222222-2222-4222-8222-222222222222";

describe("parseCsv", () => {
  it("handles quotes, embedded commas and newlines", () => {
    const rows = parseCsv('prompt_en,option_1\r\n"What is 2, plus 2?","Four ""4""\nexactly"\n\n');
    expect(rows).toEqual([{ prompt_en: "What is 2, plus 2?", option_1: 'Four "4"\nexactly' }]);
  });
});

describe("convertImportRows", () => {
  it("builds valid bilingual questions", () => {
    const rows = parseCsv(
      [
        "type,prompt_en,prompt_fr,difficulty,correct,option_1,option_1_fr,option_2,option_2_fr,explanation_en",
        "single_choice,Capital of Cameroon?,Capitale du Cameroun ?,1,2,Douala,Douala,Yaoundé,Yaoundé,Yaoundé is the capital.",
        "numeric,g in m/s²?,,2,,,,,,",
      ].join("\n"),
    );
    rows[1]!.numeric_answer = "9.8";
    rows[1]!.numeric_tolerance = "0.1";

    const [first, second] = convertImportRows(rows, SUBJECT, CHAPTER);
    expect(first?.errors).toEqual([]);
    expect(first?.question?.options.map((o) => o.isCorrect)).toEqual([false, true]);
    expect(first?.question?.prompt.fr).toBe("Capitale du Cameroun ?");
    expect(first?.question?.chapterId).toBe(CHAPTER);
    expect(second?.errors).toEqual([]);
    expect(second?.question?.numericAnswer).toBe(9.8);
  });

  it("reports row-level errors instead of throwing", () => {
    const [result] = convertImportRows(
      [{ type: "single_choice", prompt_en: "No correct option", option_1: "A", option_2: "B", correct: "" }],
      SUBJECT,
      null,
    );
    expect(result?.row).toBe(2);
    expect(result?.question).toBeUndefined();
    expect(result?.errors.join(" ")).toMatch(/exactly one correct option/);
  });
});
