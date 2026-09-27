"use client";

import type { LocalizedText } from "@eduprep/core";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/action-form";
import { MarkdownPreview } from "@/components/markdown-preview";
import { buttonClass, Field, inputClass } from "@/components/ui";
import { saveLesson } from "@/server/cms/actions";
import { initialActionState } from "@/server/cms/state";

interface Props {
  lesson: {
    id: string;
    chapter_id: string;
    title: LocalizedText;
    body: LocalizedText;
    estimated_minutes: number;
    order_index: number;
    publish_at: string | null;
  };
  readOnly: boolean;
}

export function LessonEditor({ lesson, readOnly }: Props) {
  const [state, formAction, pending] = useActionState(saveLesson, initialActionState);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [body, setBody] = useState({ en: lesson.body.en ?? "", fr: lesson.body.fr ?? "" });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={lesson.id} />
      <input type="hidden" name="chapterId" value={lesson.chapter_id} />
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title (English)">
            <input name="title_en" defaultValue={lesson.title.en ?? ""} className={inputClass} />
          </Field>
          <Field label="Title (Français)">
            <input name="title_fr" defaultValue={lesson.title.fr ?? ""} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Estimated minutes">
            <input name="estimatedMinutes" type="number" min="1" max="240" defaultValue={lesson.estimated_minutes} className={inputClass} />
          </Field>
          <Field label="Order in chapter">
            <input name="orderIndex" type="number" min="0" defaultValue={lesson.order_index} className={inputClass} />
          </Field>
          <Field label="Publish from, UTC (optional)" hint="Scheduled lessons stay hidden until this time.">
            <input
              name="publishAt"
              type="datetime-local"
              defaultValue={lesson.publish_at ? lesson.publish_at.slice(0, 16) : ""}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex gap-1" role="tablist">
            {(["en", "fr"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={`rounded-md px-3 py-1 text-sm ${lang === l ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-700"}`}
              >
                {l === "en" ? "English" : "Français"}
                {!body[l].trim() && " (empty)"}
              </button>
            ))}
          </div>
          <input type="hidden" name="body_en" value={body.en} />
          <input type="hidden" name="body_fr" value={body.fr} />
          <div className="grid gap-4 lg:grid-cols-2">
            <textarea
              aria-label={`Lesson body (${lang})`}
              value={body[lang]}
              onChange={(e) => setBody((b) => ({ ...b, [lang]: e.target.value }))}
              rows={24}
              className={`${inputClass} font-mono`}
              placeholder={"# Title\n\nUse Markdown: **bold**, lists, tables, > tips"}
            />
            <div className="max-h-[36rem] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              {body[lang].trim() ? <MarkdownPreview source={body[lang]} /> : <p className="text-sm text-slate-500">Preview</p>}
            </div>
          </div>
        </div>
      </fieldset>
      <FormMessage state={state} />
      {!readOnly && (
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save lesson"}
        </button>
      )}
    </form>
  );
}
