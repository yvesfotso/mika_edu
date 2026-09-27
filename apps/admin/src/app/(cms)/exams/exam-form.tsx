import type { LocalizedText } from "@eduprep/core";
import { ActionForm } from "@/components/action-form";
import { Field, inputClass, LocalizedInputs } from "@/components/ui";
import { saveExam } from "@/server/cms/actions";

export interface ExamFormValues {
  id: string;
  country_code: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  level: string;
  primary_language: string;
  exam_date: string | null;
  registration_deadline: string | null;
  source_url: string | null;
  verified_at: string | null;
  active: boolean;
}

export function ExamForm({ exam }: { exam?: ExamFormValues }) {
  return (
    <ActionForm action={saveExam} submitLabel={exam ? "Save exam" : "Create exam"}>
      {exam && <input type="hidden" name="examId" value={exam.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Country code">
          <input name="countryCode" defaultValue={exam?.country_code ?? "CM"} maxLength={2} required className={inputClass} />
        </Field>
        <Field label="Slug">
          <input name="slug" defaultValue={exam?.slug ?? ""} required pattern="[a-z0-9-]+" className={inputClass} />
        </Field>
        <Field label="Primary language">
          <select name="primaryLanguage" defaultValue={exam?.primary_language ?? "en"} className={inputClass}>
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </Field>
      </div>
      <LocalizedInputs name="name" label="Name" value={exam?.name} required />
      <LocalizedInputs name="description" label="Description" value={exam?.description} />
      <Field label="Level">
        <input name="level" defaultValue={exam?.level ?? "secondary"} required className={inputClass} />
      </Field>

      <fieldset className="rounded-md border border-amber-300 p-4 dark:border-amber-700">
        <legend className="px-1 text-sm font-medium">Official facts</legend>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Learners only see dates once they are verified against the official source. Changing a date or the source clears
          the verification.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Exam date">
            <input type="date" name="examDate" defaultValue={exam?.exam_date ?? ""} className={inputClass} />
          </Field>
          <Field label="Registration deadline">
            <input type="date" name="registrationDeadline" defaultValue={exam?.registration_deadline ?? ""} className={inputClass} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Official source URL">
            <input type="url" name="sourceUrl" defaultValue={exam?.source_url ?? ""} className={inputClass} placeholder="https://" />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="markVerified" />
          I checked these facts against the official source today
        </label>
        {exam?.verified_at && (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            Last verified {new Date(exam.verified_at).toLocaleDateString("en-GB")}
          </p>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={exam?.active ?? true} />
        Active (visible to learners)
      </label>
    </ActionForm>
  );
}
