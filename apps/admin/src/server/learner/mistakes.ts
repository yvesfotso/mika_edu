import "server-only";
import { skillKeyFor, type AnswerInputDto, type LocalizedText, type MistakeDto, type MistakeStatus } from "@eduprep/core";
import { must, notFound, type Db } from "../db";
import { loadQuestions, toLearnerQuestion } from "./questions";

interface MistakeRow {
  id: string;
  question_id: string;
  question_version: number;
  chapter_id: string | null;
  skill_id: string | null;
  response: AnswerInputDto;
  misconception: LocalizedText | null;
  created_at: string;
  reviewed_at: string | null;
  retried_correct_at: string | null;
  recovered_at: string | null;
}

const statusOf = (m: Pick<MistakeRow, "reviewed_at" | "recovered_at">): MistakeStatus =>
  m.recovered_at ? "recovered" : m.reviewed_at ? "reviewed" : "open";

/** The learner's own mistake notebook, newest first. History stays visible after recovery. */
export async function listMistakes(
  db: Db,
  userId: string,
  filter: { status?: "open" | "recovered" | "all"; chapterId?: string },
): Promise<{ mistakes: MistakeDto[]; counts: Record<MistakeStatus, number> }> {
  let query = db
    .from("mistake_entries")
    .select("id, question_id, question_version, chapter_id, skill_id, response, misconception, created_at, reviewed_at, retried_correct_at, recovered_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter.chapterId) query = query.eq("chapter_id", filter.chapterId);
  const rows = must(await query, "loading mistakes") as MistakeRow[];

  const counts: Record<MistakeStatus, number> = { open: 0, reviewed: 0, recovered: 0 };
  for (const r of rows) counts[statusOf(r)]++;
  const visible = rows.filter((r) => {
    const s = statusOf(r);
    return filter.status === "all" || !filter.status ? true : filter.status === "recovered" ? s === "recovered" : s !== "recovered";
  });
  if (visible.length === 0) return { mistakes: [], counts };

  const chapterIds = [...new Set(visible.map((r) => r.chapter_id).filter((id): id is string => Boolean(id)))];
  const [questions, chaptersRes, skillsRes, poolRes, lessonsRes] = await Promise.all([
    loadQuestions(db, [...new Set(visible.map((r) => r.question_id))]),
    db.from("chapters").select("id, title, subjects(name)").in("id", chapterIds),
    db.from("skills").select("id, name").in("chapter_id", chapterIds),
    db.from("questions").select("id, chapter_id, skill_id").in("chapter_id", chapterIds).eq("status", "published").eq("purpose", "practice"),
    db
      .from("lessons")
      .select("id, chapter_id, order_index, lesson_checkpoints(after_block, questions(skill_id))")
      .in("chapter_id", chapterIds)
      .eq("status", "published")
      .order("order_index"),
  ]);
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const chapters = new Map(
    (must(chaptersRes, "loading chapters") as unknown as { id: string; title: LocalizedText; subjects: { name: LocalizedText } | null }[]).map((c) => [c.id, c]),
  );
  const skills = new Map((must(skillsRes, "loading skills") as { id: string; name: LocalizedText }[]).map((s) => [s.id, s.name]));
  const pool = must(poolRes, "loading question pool") as { id: string; chapter_id: string; skill_id: string | null }[];
  const lessons = must(lessonsRes, "loading lessons") as unknown as {
    id: string;
    chapter_id: string;
    lesson_checkpoints: { after_block: number; questions: { skill_id: string | null } | null }[];
  }[];

  /** The lesson section that teaches a skill: where its checkpoint sits, else the chapter's first lesson. */
  const lessonFor = (chapterId: string, skillId: string | null) => {
    const own = lessons.filter((l) => l.chapter_id === chapterId);
    for (const l of own) {
      const cp = l.lesson_checkpoints.find((c) => skillId && c.questions?.skill_id === skillId);
      if (cp) return { id: l.id, block: cp.after_block };
    }
    return own[0] ? { id: own[0].id, block: 0 } : null;
  };

  const mistakes = visible.flatMap((r): MistakeDto[] => {
    const q = questionById.get(r.question_id);
    if (!q || !r.chapter_id) return [];
    const chapter = chapters.get(r.chapter_id);
    const key = skillKeyFor(r.skill_id, r.chapter_id);
    return [
      {
        id: r.id,
        status: statusOf(r),
        createdAt: r.created_at,
        question: toLearnerQuestion(q, `mistake:${r.id}`, "practice"),
        response: r.response,
        correctOptionIds: q.question_options.filter((o) => o.is_correct).map((o) => o.id),
        correctNumericValue: q.type === "numeric" ? q.numeric_answer : null,
        explanation: q.solutions?.explanation ?? {},
        misconception: r.misconception,
        subjectName: chapter?.subjects?.name ?? {},
        chapter: { id: r.chapter_id, title: chapter?.title ?? {} },
        skill: { key, id: r.skill_id, name: (r.skill_id && skills.get(r.skill_id)) || chapter?.title || {} },
        lesson: lessonFor(r.chapter_id, r.skill_id),
        reviewedAt: r.reviewed_at,
        retriedCorrectAt: r.retried_correct_at,
        recoveredAt: r.recovered_at,
        canRetry: pool.some((p) => skillKeyFor(p.skill_id, p.chapter_id) === key && p.id !== r.question_id),
        questionUpdated: q.version !== r.question_version,
      },
    ];
  });
  return { mistakes, counts };
}

/** The learner read the correction. Only the owner can mark their own entry. */
export async function reviewMistake(db: Db, userId: string, mistakeId: string, now: Date) {
  const row = must(
    await db.from("mistake_entries").select("id, reviewed_at").eq("id", mistakeId).eq("user_id", userId).maybeSingle<{ id: string; reviewed_at: string | null }>(),
    "loading mistake",
  );
  if (!row) throw notFound("Mistake");
  if (!row.reviewed_at) {
    must(await db.from("mistake_entries").update({ reviewed_at: now.toISOString() }).eq("id", mistakeId).eq("user_id", userId), "reviewing mistake");
  }
  return { reviewedAt: row.reviewed_at ?? now.toISOString() };
}
