import "server-only";
import { packVersion, type LocalizedText, type StudyPackDto } from "@eduprep/core";
import { must, notFound, type Db } from "../db";
import { loadQuestions, toPackQuestion } from "./questions";

/**
 * A chapter's lessons, checkpoints and practice questions (with answer keys and explanations) for
 * offline study. Mock-exam and past-paper conditions don't apply offline, so keys are acceptable here;
 * the server re-marks every offline answer when it syncs.
 */
export async function getStudyPack(db: Db, chapterId: string, now: Date): Promise<StudyPackDto> {
  const chapter = must(
    await db.from("chapters").select("id, title, subjects(name)").eq("id", chapterId).eq("status", "published").maybeSingle(),
    "loading chapter",
  ) as unknown as { id: string; title: LocalizedText; subjects: { name: LocalizedText } | null } | null;
  if (!chapter) throw notFound("Chapter");

  const [lessonsRes, questionsRes, skillsRes] = await Promise.all([
    db
      .from("lessons")
      .select("id, title, body, estimated_minutes, version, publish_at, lesson_checkpoints(question_id, after_block, order_index)")
      .eq("chapter_id", chapterId)
      .eq("status", "published")
      .order("order_index"),
    db.from("questions").select("id").eq("chapter_id", chapterId).eq("status", "published"),
    db.from("skills").select("id, name").eq("chapter_id", chapterId).order("order_index"),
  ]);
  const lessons = (
    must(lessonsRes, "loading lessons") as {
      id: string;
      title: LocalizedText;
      body: LocalizedText;
      estimated_minutes: number;
      version: number;
      publish_at: string | null;
      lesson_checkpoints: { question_id: string; after_block: number; order_index: number }[];
    }[]
  ).filter((l) => !l.publish_at || new Date(l.publish_at) <= now);
  const questions = await loadQuestions(
    db,
    (must(questionsRes, "loading questions") as { id: string }[]).map((q) => q.id),
  );
  const published = new Set(questions.map((q) => q.id));

  return {
    chapterId,
    version: packVersion([...lessons.map((l) => ({ id: l.id, version: l.version })), ...questions.map((q) => ({ id: q.id, version: q.version }))]),
    generatedAt: now.toISOString(),
    subjectName: chapter.subjects?.name ?? {},
    title: chapter.title,
    lessons: lessons.map((l) => ({
      id: l.id,
      title: l.title,
      body: l.body,
      estimatedMinutes: l.estimated_minutes,
      version: l.version,
      checkpoints: [...l.lesson_checkpoints]
        .filter((c) => published.has(c.question_id))
        .sort((a, b) => a.order_index - b.order_index)
        .map((c) => ({ afterBlock: c.after_block, questionId: c.question_id })),
    })),
    questions: questions.map(toPackQuestion),
    skills: must(skillsRes, "loading skills") as { id: string; name: LocalizedText }[],
  };
}
