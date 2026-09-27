"use client";

import { QUESTION_SOURCES, QUESTION_TYPES, type LocalizedText, type QuestionSource, type QuestionType } from "@eduprep/core";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/action-form";
import { buttonClass, Field, inputClass, secondaryButtonClass } from "@/components/ui";
import { saveQuestion } from "@/server/cms/actions";
import { initialActionState } from "@/server/cms/state";

export interface QuestionEditorValue {
  id?: string;
  subjectId: string;
  chapterId: string | null;
  type: QuestionType;
  prompt: LocalizedText;
  difficulty: number;
  sourceType: QuestionSource;
  sourceYear: number | null;
  officialSourceUrl: string | null;
  numericAnswer: number | null;
  numericTolerance: number | null;
  options: { id?: string; text: LocalizedText; isCorrect: boolean }[];
  explanation: LocalizedText;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice (select all)",
  true_false: "True / false",
  numeric: "Numeric answer",
};

const SOURCE_LABELS: Record<QuestionSource, string> = {
  original: "Original (written for EduPrep)",
  teacher_created: "Teacher-created",
  official_past_paper: "Official past paper",
  ai_generated: "AI-generated (needs review)",
};

const emptyOption = () => ({ text: { en: "", fr: "" }, isCorrect: false });

export function QuestionEditor({
  value,
  chapters,
  readOnly,
}: {
  value: QuestionEditorValue;
  chapters: { id: string; title: string }[];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveQuestion, initialActionState);
  const [q, setQ] = useState<QuestionEditorValue>(() => ({
    ...value,
    options: value.options.length > 0 ? value.options : [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
  }));

  const set = <K extends keyof QuestionEditorValue>(key: K, v: QuestionEditorValue[K]) => setQ((prev) => ({ ...prev, [key]: v }));

  function setType(type: QuestionType) {
    setQ((prev) => {
      if (type === "true_false") {
        return {
          ...prev,
          type,
          options: [
            { text: { en: "True", fr: "Vrai" }, isCorrect: true },
            { text: { en: "False", fr: "Faux" }, isCorrect: false },
          ],
        };
      }
      return { ...prev, type };
    });
  }

  function setOption(index: number, patch: Partial<QuestionEditorValue["options"][number]>) {
    setQ((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => {
        if (i === index) return { ...o, ...patch };
        // Single-answer types: checking one option unchecks the others.
        if (patch.isCorrect && prev.type !== "multiple_choice") return { ...o, isCorrect: false };
        return o;
      }),
    }));
  }

  const payload = JSON.stringify({
    ...q,
    options: q.type === "numeric" ? [] : q.options.filter((o) => o.text.en?.trim() || o.text.fr?.trim()),
    prompt: { en: q.prompt.en || undefined, fr: q.prompt.fr || undefined },
  });

  return (
    <form action={formAction} className="space-y-5">
      {q.id && <input type="hidden" name="id" value={q.id} />}
      <input type="hidden" name="payload" value={payload} />
      <fieldset disabled={readOnly} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type">
            <select value={q.type} onChange={(e) => setType(e.target.value as QuestionType)} className={inputClass}>
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Chapter">
            <select value={q.chapterId ?? ""} onChange={(e) => set("chapterId", e.target.value || null)} className={inputClass}>
              <option value="">— No chapter —</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Difficulty (1–5)">
            <input
              type="number"
              min={1}
              max={5}
              value={q.difficulty}
              onChange={(e) => set("difficulty", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Question (English)">
            <textarea
              rows={3}
              value={q.prompt.en ?? ""}
              onChange={(e) => set("prompt", { ...q.prompt, en: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Question (Français)">
            <textarea
              rows={3}
              value={q.prompt.fr ?? ""}
              onChange={(e) => set("prompt", { ...q.prompt, fr: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        {q.type === "numeric" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Correct answer">
              <input
                type="number"
                step="any"
                value={q.numericAnswer ?? ""}
                onChange={(e) => set("numericAnswer", e.target.value === "" ? null : Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Accepted tolerance (±)" hint="e.g. 0.01 to accept rounding differences">
              <input
                type="number"
                step="any"
                min={0}
                value={q.numericTolerance ?? ""}
                onChange={(e) => set("numericTolerance", e.target.value === "" ? null : Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-sm font-medium">Options — tick the correct answer{q.type === "multiple_choice" ? "s" : ""}</div>
            <div className="space-y-2">
              {q.options.map((o, i) => (
                <div key={o.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Option ${i + 1} is correct`}
                    checked={o.isCorrect}
                    onChange={(e) => setOption(i, { isCorrect: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <input
                    placeholder={`Option ${i + 1} (English)`}
                    value={o.text.en ?? ""}
                    onChange={(e) => setOption(i, { text: { ...o.text, en: e.target.value } })}
                    className={`${inputClass} min-w-40 flex-1`}
                  />
                  <input
                    placeholder={`Option ${i + 1} (Français)`}
                    value={o.text.fr ?? ""}
                    onChange={(e) => setOption(i, { text: { ...o.text, fr: e.target.value } })}
                    className={`${inputClass} min-w-40 flex-1`}
                  />
                  {q.type !== "true_false" && (
                    <button
                      type="button"
                      onClick={() => set("options", q.options.filter((_, j) => j !== i))}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {q.type !== "true_false" && q.options.length < 8 && (
              <button type="button" onClick={() => set("options", [...q.options, emptyOption()])} className={`${secondaryButtonClass} mt-2`}>
                + Add option
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Explanation (English)" hint="Shown after the learner submits.">
            <textarea
              rows={3}
              value={q.explanation.en ?? ""}
              onChange={(e) => set("explanation", { ...q.explanation, en: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Explanation (Français)">
            <textarea
              rows={3}
              value={q.explanation.fr ?? ""}
              onChange={(e) => set("explanation", { ...q.explanation, fr: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <fieldset className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-medium">Provenance</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Source">
              <select value={q.sourceType} onChange={(e) => set("sourceType", e.target.value as QuestionSource)} className={inputClass}>
                {QUESTION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Year">
              <input
                type="number"
                value={q.sourceYear ?? ""}
                onChange={(e) => set("sourceYear", e.target.value === "" ? null : Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Official source URL">
              <input
                type="url"
                value={q.officialSourceUrl ?? ""}
                onChange={(e) => set("officialSourceUrl", e.target.value || null)}
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>
      </fieldset>
      <FormMessage state={state} />
      {!readOnly && (
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : q.id ? "Save question" : "Create question"}
        </button>
      )}
    </form>
  );
}
