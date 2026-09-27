import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass, PageHeader, t } from "@/components/ui";
import { importQuestions } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";
import { chapterOptions } from "../chapters";

const SAMPLE = `type,prompt_en,prompt_fr,difficulty,correct,option_1,option_1_fr,option_2,option_2_fr,option_3,option_3_fr,explanation_en,explanation_fr
single_choice,What is 7 × 8?,Combien font 7 × 8 ?,1,2,54,54,56,56,64,64,7 × 8 = 56.,7 × 8 = 56.
numeric,Solve 2x = 10.,Résoudre 2x = 10.,1,,,,,,,,x = 10 ÷ 2 = 5.,x = 10 ÷ 2 = 5.`;

export default async function ImportPage({ searchParams }: PageProps<"/questions/import">) {
  const { subject } = await searchParams;
  const { db } = await requireStaffPage();
  const subjects = must(await db.from("subjects").select("id, name").order("slug"), "loading subjects") as {
    id: string;
    name: Record<string, string>;
  }[];
  const subjectId = typeof subject === "string" && subjects.some((s) => s.id === subject) ? subject : subjects[0]?.id;
  const chapters = subjectId ? await chapterOptions(db, subjectId) : [];

  return (
    <>
      <PageHeader
        title="Import questions"
        description="Upload a CSV or JSON array. All rows are validated first; nothing is imported if any row has errors. Imported questions start as drafts."
      />
      <form action="/questions/import" className="mb-4 flex items-end gap-3">
        <Field label="Subject">
          <select name="subject" defaultValue={subjectId} className={inputClass}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.name)}
              </option>
            ))}
          </select>
        </Field>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">Choose</button>
      </form>
      {subjectId && (
        <Card>
          <ActionForm action={importQuestions} submitLabel="Validate & import">
            <input type="hidden" name="subjectId" value={subjectId} />
            <Field label="Default chapter" hint="Used for rows without a chapter_id column.">
              <select name="chapterId" className={inputClass}>
                <option value="">— None —</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="File (.csv or .json, max 2 MB)">
              <input type="file" name="file" accept=".csv,.json,text/csv,application/json" className="text-sm" />
            </Field>
            <Field label="…or paste rows">
              <textarea name="text" rows={8} className={`${inputClass} font-mono text-xs`} placeholder={SAMPLE} />
            </Field>
          </ActionForm>
        </Card>
      )}
      <Card title="Columns">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <code>type</code>: single_choice, multiple_choice, true_false or numeric
          </li>
          <li>
            <code>prompt_en</code>, <code>prompt_fr</code>: at least one is required
          </li>
          <li>
            <code>option_1</code>…<code>option_6</code> and <code>option_1_fr</code>…<code>option_6_fr</code>
          </li>
          <li>
            <code>correct</code>: 1-based option numbers, e.g. <code>2</code> or <code>1;3</code>
          </li>
          <li>
            <code>numeric_answer</code>, <code>numeric_tolerance</code> for numeric questions
          </li>
          <li>
            <code>difficulty</code> (1–5), <code>source_type</code>, <code>source_year</code>, <code>explanation_en</code>,{" "}
            <code>explanation_fr</code>, optional <code>chapter_id</code>
          </li>
        </ul>
      </Card>
    </>
  );
}
