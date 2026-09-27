import "server-only";
import type { LessonDto, LocalizedText } from "@eduprep/core";
import { must, notFound, type Db } from "../db";
import { effectiveActivityTime, recordStudyActivity } from "./activity";
import { getProfileRow } from "./profile";

interface LessonRow {
  id: string;
  chapter_id: string;
  title: LocalizedText;
  body: LocalizedText;
  estimated_minutes: number;
  version: number;
  publish_at: string | null;
  chapters: { status: string };
}

async function loadPublishedLesson(db: Db, lessonId: string): Promise<LessonRow> {
  const row = must(
    await db
      .from("lessons")
      .select("id, chapter_id, title, body, estimated_minutes, version, publish_at, chapters!inner(status)")
      .eq("id", lessonId)
      .eq("status", "published")
      .maybeSingle<LessonRow>(),
    "loading lesson",
  );
  if (!row || row.chapters.status !== "published" || (row.publish_at && new Date(row.publish_at) > new Date())) {
    throw notFound("Lesson");
  }
  return row;
}

export async function getLesson(db: Db, userId: string, lessonId: string): Promise<LessonDto> {
  const row = await loadPublishedLesson(db, lessonId);
  const done = must(
    await db.from("lesson_completions").select("lesson_id").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle(),
    "loading completion",
  );
  return {
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    body: row.body,
    estimatedMinutes: row.estimated_minutes,
    version: row.version,
    completed: Boolean(done),
  };
}

/** Idempotent: completing the same lesson twice (e.g. an offline retry) counts once. */
export async function completeLesson(
  db: Db,
  userId: string,
  lessonId: string,
  input: { secondsSpent: number; completedAt?: string },
  now: Date,
): Promise<{ completed: true; firstCompletion: boolean }> {
  const lesson = await loadPublishedLesson(db, lessonId);
  const profile = await getProfileRow(db, userId);
  const at = effectiveActivityTime(input.completedAt, now);

  const inserted = must(
    await db
      .from("lesson_completions")
      .upsert(
        { user_id: userId, lesson_id: lessonId, lesson_version: lesson.version, completed_at: at.toISOString() },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      )
      .select("lesson_id"),
    "saving lesson completion",
  ) as unknown[];

  const firstCompletion = inserted.length > 0;
  if (firstCompletion) {
    await recordStudyActivity(db, profile, at, {
      seconds: Math.min(input.secondsSpent, lesson.estimated_minutes * 60 * 3),
      questions: 0,
      lessons: 1,
    });
  }
  return { completed: true, firstCompletion };
}
