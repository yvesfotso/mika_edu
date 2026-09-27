import { canEdit, type ContentStatus, type LocalizedText } from "@eduprep/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusActions } from "@/components/status-actions";
import { Card, PageHeader, StatusBadge, t } from "@/components/ui";
import { transitionLesson } from "@/server/cms/actions";
import { must } from "@/server/db";
import { requireStaffPage } from "@/server/staff";
import { LessonEditor } from "./lesson-editor";

export default async function LessonPage({ params }: PageProps<"/lessons/[lessonId]">) {
  const { lessonId } = await params;
  const staff = await requireStaffPage();
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();

  const lesson = must(
    await staff.db
      .from("lessons")
      .select("id, chapter_id, title, body, estimated_minutes, order_index, status, version, publish_at, chapters(title, track_id, subject_id)")
      .eq("id", lessonId)
      .maybeSingle(),
    "loading lesson",
  ) as {
    id: string;
    chapter_id: string;
    title: LocalizedText;
    body: LocalizedText;
    estimated_minutes: number;
    order_index: number;
    status: ContentStatus;
    version: number;
    publish_at: string | null;
    chapters: { title: LocalizedText; track_id: string; subject_id: string };
  } | null;
  if (!lesson) notFound();

  const editable = canEdit(lesson.status, staff.role);

  return (
    <>
      <PageHeader
        title={t(lesson.title)}
        description={
          <>
            <Link
              href={`/curriculum?track=${lesson.chapters.track_id}&subject=${lesson.chapters.subject_id}`}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {t(lesson.chapters.title)}
            </Link>{" "}
            · version {lesson.version}
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={lesson.status} />
            <StatusActions id={lesson.id} status={lesson.status} role={staff.role} action={transitionLesson} />
          </div>
        }
      />
      {!editable && (
        <p className="mb-4 rounded-md bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          This lesson is {lesson.status}; your role can&apos;t edit it in this state. Move it back to draft to make changes.
        </p>
      )}
      <Card>
        <LessonEditor lesson={lesson} readOnly={!editable} />
      </Card>
    </>
  );
}
