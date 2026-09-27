import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputClass, LocalizedInputs, PageHeader, secondaryButtonClass, t } from "@/components/ui";
import { createTrack, removeTrackSubject, setTrackSubject } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";
import { ExamForm, type ExamFormValues } from "../exam-form";

interface TrackRow {
  id: string;
  slug: string;
  name: Record<string, string>;
  order_index: number;
  track_subjects: { coefficient: number; order_index: number; subjects: { id: string; name: Record<string, string> } }[];
}

export default async function ExamDetailPage({ params }: PageProps<"/exams/[examId]">) {
  const { examId } = await params;
  const { db } = await requireStaffPage(["admin"]);

  const exam = must(
    await db
      .from("exams")
      .select("id, country_code, slug, name, description, level, primary_language, exam_date, registration_deadline, source_url, verified_at, active")
      .eq("id", examId)
      .maybeSingle(),
    "loading exam",
  ) as ExamFormValues | null;
  if (!exam) notFound();

  const [tracksRes, subjectsRes] = await Promise.all([
    db
      .from("exam_tracks")
      .select("id, slug, name, order_index, track_subjects(coefficient, order_index, subjects(id, name))")
      .eq("exam_id", examId)
      .order("order_index"),
    db.from("subjects").select("id, name").order("slug"),
  ]);
  const tracks = must(tracksRes, "loading tracks") as unknown as TrackRow[];
  const subjects = must(subjectsRes, "loading subjects") as { id: string; name: Record<string, string> }[];

  return (
    <>
      <PageHeader title={t(exam.name)} description={`${exam.slug} · ${exam.country_code}`} />
      <Card title="Exam details">
        <ExamForm exam={exam} />
      </Card>

      {tracks.map((track) => (
        <Card key={track.id} title={`Track: ${t(track.name)}`}>
          <table className="mb-4 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Coefficient</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...track.track_subjects]
                .sort((a, b) => a.order_index - b.order_index)
                .map((ts) => (
                  <tr key={ts.subjects.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="py-2">{t(ts.subjects.name)}</td>
                    <td className="py-2 tabular-nums">{Number(ts.coefficient)}</td>
                    <td className="py-2 text-right">
                      <form action={removeTrackSubject}>
                        <input type="hidden" name="trackId" value={track.id} />
                        <input type="hidden" name="subjectId" value={ts.subjects.id} />
                        <button className="text-xs text-rose-600 hover:underline">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <ActionForm action={setTrackSubject} submitLabel="Add / update subject" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="trackId" value={track.id} />
            <div className="min-w-48 flex-1">
              <Field label="Subject">
                <select name="subjectId" className={inputClass}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {t(s.name)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="w-28">
              <Field label="Coefficient">
                <input name="coefficient" type="number" step="0.5" min="0.5" defaultValue={1} className={inputClass} />
              </Field>
            </div>
            <div className="w-24">
              <Field label="Order">
                <input name="orderIndex" type="number" min="0" defaultValue={track.track_subjects.length} className={inputClass} />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ))}

      <Card title="Add a track / series">
        <ActionForm action={createTrack} submitLabel="Add track">
          <input type="hidden" name="examId" value={exam.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug">
              <input name="slug" required pattern="[a-z0-9-]+" placeholder="serie-c" className={inputClass} />
            </Field>
            <Field label="Order">
              <input name="orderIndex" type="number" min="0" defaultValue={tracks.length} className={inputClass} />
            </Field>
          </div>
          <LocalizedInputs name="name" label="Name" required />
        </ActionForm>
      </Card>
      <Link href="/exams" className={secondaryButtonClass}>
        Back to exams
      </Link>
    </>
  );
}
