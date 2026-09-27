import { canEdit, type ContentStatus } from "@eduprep/core";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { StatusActions } from "@/components/status-actions";
import { Card, Empty, Field, inputClass, LocalizedInputs, PageHeader, secondaryButtonClass, StatusBadge, t } from "@/components/ui";
import { createChapter, createLesson, transitionChapter, updateChapter } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";

type L = Record<string, string>;

export default async function CurriculumPage({ searchParams }: PageProps<"/curriculum">) {
  const sp = await searchParams;
  const staff = await requireStaffPage();
  const { db } = staff;

  const exams = must(
    await db.from("exams").select("id, name, exam_tracks(id, name, order_index)").order("slug"),
    "loading exams",
  ) as { id: string; name: L; exam_tracks: { id: string; name: L; order_index: number }[] }[];

  const allTracks = exams.flatMap((e) =>
    [...e.exam_tracks].sort((a, b) => a.order_index - b.order_index).map((tr) => ({ ...tr, examName: e.name })),
  );
  const trackId = typeof sp.track === "string" ? sp.track : allTracks[0]?.id;
  const track = allTracks.find((tr) => tr.id === trackId);

  const subjects = track
    ? (must(
        await db.from("track_subjects").select("subjects(id, name)").eq("track_id", track.id).order("order_index"),
        "loading subjects",
      ) as unknown as { subjects: { id: string; name: L } }[]).map((r) => r.subjects)
    : [];
  const subjectId = typeof sp.subject === "string" ? sp.subject : subjects[0]?.id;
  const subject = subjects.find((s) => s.id === subjectId);

  const chapters =
    track && subject
      ? (must(
          await db
            .from("chapters")
            .select("id, title, order_index, status, lessons(id, title, status, order_index, version), questions(count)")
            .eq("track_id", track.id)
            .eq("subject_id", subject.id)
            .order("order_index"),
          "loading chapters",
        ) as {
          id: string;
          title: L;
          order_index: number;
          status: ContentStatus;
          lessons: { id: string; title: L; status: ContentStatus; order_index: number; version: number }[];
          questions: { count: number }[];
        }[])
      : [];

  const href = (params: Record<string, string | undefined>) =>
    `/curriculum?${new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString()}`;

  return (
    <>
      <PageHeader title="Curriculum" description="Chapters and lessons per exam track and subject." />

      <div className="mb-4 flex flex-wrap gap-3">
        <form className="flex flex-wrap items-end gap-3" action="/curriculum">
          <Field label="Track">
            <select name="track" defaultValue={track?.id} className={inputClass}>
              {allTracks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {t(tr.examName)} — {t(tr.name)}
                </option>
              ))}
            </select>
          </Field>
          <button className={secondaryButtonClass}>Show</button>
        </form>
      </div>

      {track && (
        <div className="mb-6 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <Link
              key={s.id}
              href={href({ track: track.id, subject: s.id })}
              className={`rounded-full px-3 py-1 text-sm ${
                s.id === subject?.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
              }`}
            >
              {t(s.name)}
            </Link>
          ))}
          {subjects.length === 0 && <Empty>This track has no subjects yet. An admin can add them under Exams & tracks.</Empty>}
        </div>
      )}

      {track && subject && (
        <>
          {chapters.length === 0 && <Empty>No chapters yet for {t(subject.name)}.</Empty>}
          {chapters.map((ch) => (
            <Card
              key={ch.id}
              title={`${ch.order_index + 1}. ${t(ch.title)}`}
              actions={
                <div className="flex items-center gap-3">
                  <StatusBadge status={ch.status} />
                  <Link className="text-sm text-indigo-600 hover:underline dark:text-indigo-400" href={`/questions?chapter=${ch.id}`}>
                    {ch.questions[0]?.count ?? 0} questions
                  </Link>
                </div>
              }
            >
              <ul className="mb-4 divide-y divide-slate-100 dark:divide-slate-700">
                {[...ch.lessons]
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/lessons/${l.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                        {t(l.title)}
                      </Link>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        v{l.version} <StatusBadge status={l.status} />
                      </span>
                    </li>
                  ))}
                {ch.lessons.length === 0 && <li className="py-2 text-sm text-slate-500">No lessons yet.</li>}
              </ul>
              {ch.status !== "published" && ch.lessons.some((l) => l.status === "published") && (
                <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                  Learners won&apos;t see this chapter&apos;s lessons until the chapter itself is published.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <form action={createLesson}>
                  <input type="hidden" name="chapterId" value={ch.id} />
                  <button className={secondaryButtonClass}>+ New lesson</button>
                </form>
                <Link href={`/questions/new?chapter=${ch.id}`} className={secondaryButtonClass}>
                  + New question
                </Link>
                <StatusActions id={ch.id} status={ch.status} role={staff.role} action={transitionChapter} />
              </div>
              {canEdit(ch.status, staff.role) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-slate-500">Edit chapter</summary>
                  <div className="mt-3">
                    <ActionForm action={updateChapter} submitLabel="Save chapter">
                      <input type="hidden" name="id" value={ch.id} />
                      <LocalizedInputs name="title" label="Title" value={ch.title} required />
                      <Field label="Order">
                        <input name="orderIndex" type="number" min="0" defaultValue={ch.order_index} className={inputClass} />
                      </Field>
                    </ActionForm>
                  </div>
                </details>
              )}
            </Card>
          ))}

          <Card title={`Add a chapter to ${t(subject.name)}`}>
            <ActionForm action={createChapter} submitLabel="Create chapter">
              <input type="hidden" name="trackId" value={track.id} />
              <input type="hidden" name="subjectId" value={subject.id} />
              <LocalizedInputs name="title" label="Title" required />
              <Field label="Order">
                <input name="orderIndex" type="number" min="0" defaultValue={chapters.length} className={inputClass} />
              </Field>
            </ActionForm>
          </Card>
        </>
      )}
    </>
  );
}
