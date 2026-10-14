import "server-only";
import type { CheckpointDto, LessonDto, LessonProgressDto, LocalizedText } from "@eduprep/core";
import { must, notFound, type Db } from "../db";
import { effectiveActivityTime, recordStudyActivity } from "./activity";
import { getProfileRow } from "./profile";
import { loadQuestions, toLearnerQuestion } from "./questions";

interface LessonRow {
  id: string;
  chapter_id: string;
  title: LocalizedText;
  body: LocalizedText;
  estimated_minutes: number;
  version: number;
  publish_at: string | null;
  chapters: { status: string; track_id: string; subject_id: string };
}

export async function loadPublishedLesson(db: Db, lessonId: string): Promise<LessonRow> {
  const row = must(
    await db
      .from("lessons")
      .select("id, chapter_id, title, body, estimated_minutes, version, publish_at, chapters!inner(status, track_id, subject_id)")
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

/** Published checkpoint questions of a lesson, in order, with the block each one follows. */
export async function lessonCheckpoints(db: Db, lessonId: string) {
  const rows = must(
    await db.from("lesson_checkpoints").select("question_id, after_block, order_index").eq("lesson_id", lessonId).order("order_index"),
    "loading checkpoints",
  ) as { question_id: string; after_block: number; order_index: number }[];
  const questions = await loadQuestions(
    db,
    rows.map((r) => r.question_id),
  );
  const afterBlock = new Map(rows.map((r) => [r.question_id, r.after_block]));
  return questions.filter((q) => q.status === "published").map((q) => ({ question: q, afterBlock: afterBlock.get(q.id) ?? 0 }));
}

async function lessonProgress(db: Db, userId: string, lessonId: string): Promise<LessonProgressDto> {
  const [progressRes, answersRes] = await Promise.all([
    db.from("lesson_progress").select("last_block").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle<{ last_block: number }>(),
    db
      .from("question_attempts")
      .select("question_id, correct, answered_at, saved_at, quiz_attempts!inner(lesson_id, mode)")
      .eq("user_id", userId)
      .eq("quiz_attempts.lesson_id", lessonId)
      .eq("quiz_attempts.mode", "checkpoint")
      .not("correct", "is", null),
  ]);
  const progress = must(progressRes, "loading lesson progress");
  const answers = must(answersRes, "loading checkpoint answers") as unknown as {
    question_id: string;
    correct: boolean;
    answered_at: string | null;
    saved_at: string;
  }[];
  // The latest answer per checkpoint is what the lesson shows.
  const checkpoints: LessonProgressDto["checkpoints"] = {};
  for (const a of answers) {
    const at = a.answered_at ?? a.saved_at;
    const prev = checkpoints[a.question_id];
    if (!prev || prev.answeredAt < at) checkpoints[a.question_id] = { correct: a.correct, answeredAt: at };
  }
  return { lastBlock: progress?.last_block ?? 0, checkpoints };
}

export async function getLesson(db: Db, userId: string, lessonId: string): Promise<LessonDto> {
  const row = await loadPublishedLesson(db, lessonId);
  const [done, checkpoints, progress] = await Promise.all([
    db.from("lesson_completions").select("lesson_id").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle(),
    lessonCheckpoints(db, lessonId),
    lessonProgress(db, userId, lessonId),
  ]);
  return {
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    body: row.body,
    estimatedMinutes: row.estimated_minutes,
    version: row.version,
    completed: Boolean(must(done, "loading completion")),
    checkpoints: checkpoints.map(
      (c): CheckpointDto => ({ afterBlock: c.afterBlock, question: toLearnerQuestion(c.question, `lesson:${lessonId}`, "checkpoint") }),
    ),
    progress,
  };
}

/** Saves the furthest block reached. Reading position never moves backwards and is not mastery evidence. */
export async function saveLessonProgress(db: Db, userId: string, lessonId: string, block: number, now: Date) {
  await loadPublishedLesson(db, lessonId);
  const current = must(
    await db.from("lesson_progress").select("last_block").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle<{ last_block: number }>(),
    "loading lesson progress",
  );
  const lastBlock = Math.max(current?.last_block ?? 0, block);
  if (current && current.last_block === lastBlock) return { lastBlock };
  must(
    await db.from("lesson_progress").upsert({ user_id: userId, lesson_id: lessonId, last_block: lastBlock, updated_at: now.toISOString() }),
    "saving lesson progress",
  );
  return { lastBlock };
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
