import { canEdit, CONTENT_STATUSES, type ContentStatus, type LocalizedText } from "@eduprep/core";
import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { StatusActions } from "@/components/status-actions";
import { Card, Empty, Field, inputClass, PageHeader, secondaryButtonClass, StatusBadge, t } from "@/components/ui";
import { deletePastPaper, transitionPastPaper, uploadPastPaper } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

export const metadata: Metadata = { title: "Past papers" };

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const KIND_LABEL = { paper: "Exam paper", marking_scheme: "Marking scheme" } as const;

type Paper = {
  id: string;
  year: number;
  session: string | null;
  kind: keyof typeof KIND_LABEL;
  language: "en" | "fr";
  notes: string | null;
  file_name: string;
  file_size: number;
  status: ContentStatus;
  uploaded_by: string | null;
  created_at: string;
  exams: { name: LocalizedText } | null;
  exam_tracks: { name: LocalizedText } | null;
  subjects: { name: LocalizedText } | null;
  profiles: { display_name: string | null } | null;
};

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default async function PastPapersPage({ searchParams }: PageProps<"/past-papers">) {
  const sp = await searchParams;
  const staff = await requireStaffPage();
  const { db } = staff;
  const subjectFilter = isUuid(sp.subject) ? sp.subject : undefined;
  const statusFilter = CONTENT_STATUSES.includes(sp.status as ContentStatus) ? (sp.status as ContentStatus) : undefined;

  let query = db
    .from("past_papers")
    .select(
      "id, year, session, kind, language, notes, file_name, file_size, status, uploaded_by, created_at, exams(name), exam_tracks(name), subjects(name), profiles(display_name)",
    )
    .order("year", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (subjectFilter) query = query.eq("subject_id", subjectFilter);
  if (statusFilter) query = query.eq("status", statusFilter);

  const [examsRes, subjectsRes, papersRes] = await Promise.all([
    db.from("exams").select("id, name, exam_tracks(id, name, order_index)").eq("active", true).order("slug"),
    db.from("subjects").select("id, name").order("slug"),
    query,
  ]);
  const exams = must(examsRes, "loading exams") as {
    id: string;
    name: LocalizedText;
    exam_tracks: { id: string; name: LocalizedText; order_index: number }[];
  }[];
  const subjects = must(subjectsRes, "loading subjects") as { id: string; name: LocalizedText }[];
  const papers = must(papersRes, "loading past papers") as unknown as Paper[];
  const lastYear = new Date().getFullYear() - 1;

  return (
    <>
      <PageHeader
        title="Past papers"
        description="Upload past exam papers and marking schemes as PDFs. New uploads start as drafts and go through review like other content."
      />

      <Card title="Upload a past paper">
        <ActionForm action={uploadPastPaper} submitLabel="Upload PDF">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Exam & series">
              <select name="program" required className={inputClass}>
                {exams.map((e) => (
                  <optgroup key={e.id} label={t(e.name)}>
                    <option value={e.id}>{t(e.name)} — all series</option>
                    {[...e.exam_tracks]
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((tr) => (
                        <option key={tr.id} value={`${e.id}:${tr.id}`}>
                          {t(e.name)} — {t(tr.name)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Subject">
              <select name="subjectId" required className={inputClass}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.name)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Year">
                <input name="year" type="number" required min={1960} max={lastYear + 1} defaultValue={lastYear} className={inputClass} />
              </Field>
              <Field label="Language">
                <select name="language" defaultValue="fr" className={inputClass}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </Field>
            </div>
            <Field label="Document">
              <select name="kind" defaultValue="paper" className={inputClass}>
                <option value="paper">Exam paper (subject)</option>
                <option value="marking_scheme">Marking scheme (corrigé)</option>
              </select>
            </Field>
            <Field label="Session" hint="Optional, e.g. Session normale, Rattrapage">
              <input name="session" maxLength={60} className={inputClass} />
            </Field>
            <Field label="Notes" hint="Optional, e.g. source or missing pages">
              <input name="notes" maxLength={500} className={inputClass} />
            </Field>
          </div>
          <Field label="PDF file" hint="PDF only, up to 15 MB. Scanned papers are fine.">
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,.pdf"
              className="block w-full rounded-2xl border border-dashed border-line bg-frame p-3 text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-frame hover:file:opacity-85"
            />
          </Field>
        </ActionForm>
      </Card>

      <Card
        title={`Library (${papers.length}${papers.length === 200 ? "+" : ""})`}
        actions={
          <form action="/past-papers" className="flex flex-wrap items-center gap-2">
            <select name="subject" defaultValue={subjectFilter ?? ""} aria-label="Filter by subject" className={`${inputClass} w-auto! py-2!`}>
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.name)}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={statusFilter ?? ""} aria-label="Filter by status" className={`${inputClass} w-auto! py-2! capitalize`}>
              <option value="">Any status</option>
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className={secondaryButtonClass}>Filter</button>
          </form>
        }
      >
        {papers.length === 0 ? (
          <Empty>{subjectFilter || statusFilter ? "No past papers match these filters." : "No past papers yet. Upload the first one above."}</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {papers.map((p) => {
              const deletable = canEdit(p.status, staff.role) && (staff.role !== "teacher" || p.uploaded_by === staff.userId);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-4 py-4">
                  <span className="inline-flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand text-brand-ink">
                    <span className="text-[10px] leading-none font-semibold">PDF</span>
                    <span className="text-sm leading-tight font-bold tabular-nums">{p.year}</span>
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">
                        {t(p.subjects?.name)} · {p.year}
                      </span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-muted">
                      {t(p.exams?.name)}
                      {p.exam_tracks ? ` — ${t(p.exam_tracks.name)}` : ""} · {KIND_LABEL[p.kind]} · {p.language.toUpperCase()}
                      {p.session ? ` · ${p.session}` : ""}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {p.file_name} · {fileSize(p.file_size)} · uploaded by {p.profiles?.display_name ?? "unknown"}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/past-papers/${p.id}/file`} target="_blank" rel="noopener" className={secondaryButtonClass}>
                      Open PDF
                    </a>
                    <StatusActions id={p.id} status={p.status} role={staff.role} action={transitionPastPaper} />
                    {deletable && (
                      <form action={deletePastPaper}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmButton
                          message={`Delete “${p.file_name}”? The PDF will be removed permanently.`}
                          className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
