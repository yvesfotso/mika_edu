import { questionFormSchema, questionImportRowSchema, type QuestionFormInput } from "./schemas";

/** RFC 4180 CSV: quoted fields, escaped quotes (""), commas and newlines inside quotes. */
export function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = input.replace(/^﻿/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  const [header, ...data] = nonEmpty;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return data.map((cells) => Object.fromEntries(keys.map((k, idx) => [k, (cells[idx] ?? "").trim()])));
}

export interface ImportRowResult {
  row: number;
  question?: QuestionFormInput;
  errors: string[];
}

/** Validate import rows and convert them into question form inputs for one subject. */
export function convertImportRows(rows: unknown[], subjectId: string, defaultChapterId: string | null): ImportRowResult[] {
  return rows.map((raw, index) => {
    const rowNumber = index + 2; // header is row 1 in a spreadsheet
    const parsed = questionImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      return { row: rowNumber, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    }
    const r = parsed.data;
    const correct = new Set(
      r.correct
        .split(/[;|\s]+/)
        .filter(Boolean)
        .map((n) => Number(n)),
    );

    const options: QuestionFormInput["options"] = [];
    for (let n = 1; n <= 6; n++) {
      const en = (r[`option_${n}` as keyof typeof r] as string | undefined)?.trim();
      const fr = (r[`option_${n}_fr` as keyof typeof r] as string | undefined)?.trim();
      if (!en && !fr) continue;
      options.push({ text: { en: en || undefined, fr: fr || undefined }, isCorrect: correct.has(n) });
    }

    const candidate = {
      subjectId,
      chapterId: r.chapter_id || defaultChapterId,
      type: r.type,
      prompt: { en: r.prompt_en || undefined, fr: r.prompt_fr || undefined },
      difficulty: r.difficulty,
      sourceType: r.source_type,
      sourceYear: r.source_year === "" || r.source_year === undefined ? null : r.source_year,
      officialSourceUrl: null,
      numericAnswer: r.numeric_answer === "" || r.numeric_answer === undefined ? null : r.numeric_answer,
      numericTolerance: r.numeric_tolerance === "" || r.numeric_tolerance === undefined ? null : r.numeric_tolerance,
      options: r.type === "numeric" ? [] : options,
      explanation: { en: r.explanation_en || undefined, fr: r.explanation_fr || undefined },
    };
    const validated = questionFormSchema.safeParse(candidate);
    if (!validated.success) {
      return { row: rowNumber, errors: validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
    }
    return { row: rowNumber, question: validated.data, errors: [] };
  });
}
