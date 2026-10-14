import "server-only";
import {
  EMPTY_MASTERY,
  isAnswered,
  recoveryUpdates,
  skillKeyFor,
  updateMastery,
  type AnswerInputDto,
  type AttemptMode,
  type MasteryEvidence,
} from "@eduprep/core";
import { must, type Db } from "../db";
import { toMasteryState } from "./curriculum";
import { misconceptionFor, type QuestionRow } from "./questions";

/** A graded answer row as stored in question_attempts. */
export interface GradedAnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: AnswerInputDto;
  correct: boolean | null;
  response_ms: number | null;
  hints_used: number;
  question_version: number;
  counts_as_evidence: boolean;
  answered_at: string | null;
  saved_at: string;
}

export const ANSWER_COLUMNS =
  "id, attempt_id, question_id, answer, correct, response_ms, hints_used, question_version, counts_as_evidence, answered_at, saved_at";

export const answeredAt = (row: Pick<GradedAnswerRow, "answered_at" | "saved_at">) => new Date(row.answered_at ?? row.saved_at);

/**
 * After grading: wrong answers become mistake-notebook entries (once per answer row), and correct
 * answers recover older mistakes on the same skill. Returns the mistake id for each wrong question.
 */
export async function recordAnswerEvidence(
  db: Db,
  userId: string,
  rows: GradedAnswerRow[],
  questions: QuestionRow[],
): Promise<Map<string, string>> {
  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const counted = rows.filter((r) => r.correct !== null && r.counts_as_evidence && byQuestion.has(r.question_id));

  const wrong = counted.filter((r) => r.correct === false && isAnswered(r.answer));
  if (wrong.length > 0) {
    must(
      await db.from("mistake_entries").upsert(
        wrong.map((r) => {
          const q = byQuestion.get(r.question_id)!;
          return {
            user_id: userId,
            question_attempt_id: r.id,
            question_id: r.question_id,
            question_version: r.question_version,
            chapter_id: q.chapter_id,
            skill_id: q.skill_id,
            response: r.answer,
            misconception: misconceptionFor(q, r.answer),
            created_at: answeredAt(r).toISOString(),
          };
        }),
        { onConflict: "question_attempt_id", ignoreDuplicates: true },
      ),
      "saving mistakes",
    );
  }

  const chapterIds = [...new Set(counted.map((r) => byQuestion.get(r.question_id)!.chapter_id).filter((id): id is string => Boolean(id)))];
  if (chapterIds.length > 0) {
    const open = must(
      await db
        .from("mistake_entries")
        .select("id, question_id, chapter_id, skill_id, created_at, retried_correct_at, question_attempts!mistake_entries_question_attempt_id_fkey(attempt_id)")
        .eq("user_id", userId)
        .is("recovered_at", null)
        .in("chapter_id", chapterIds),
      "loading open mistakes",
    ) as unknown as {
      id: string;
      question_id: string;
      chapter_id: string | null;
      skill_id: string | null;
      created_at: string;
      retried_correct_at: string | null;
      question_attempts: { attempt_id: string } | null;
    }[];

    const updates = recoveryUpdates(
      open
        .filter((m) => m.chapter_id)
        .map((m) => ({
          id: m.id,
          questionId: m.question_id,
          skillKey: skillKeyFor(m.skill_id, m.chapter_id!),
          createdAt: new Date(m.created_at),
          retriedCorrectAt: m.retried_correct_at ? new Date(m.retried_correct_at) : null,
          attemptId: m.question_attempts?.attempt_id ?? "",
        })),
      counted
        .filter((r) => r.correct)
        .map((r) => {
          const q = byQuestion.get(r.question_id)!;
          return {
            questionId: r.question_id,
            skillKey: skillKeyFor(q.skill_id, q.chapter_id ?? ""),
            correct: true,
            hintsUsed: r.hints_used,
            at: answeredAt(r),
            answerId: r.id,
            attemptId: r.attempt_id,
          };
        }),
    );
    for (const u of updates) {
      const patch: Record<string, string> = {};
      if (u.retriedCorrectAt) patch.retried_correct_at = u.retriedCorrectAt.toISOString();
      if (u.recoveredAt) patch.recovered_at = u.recoveredAt.toISOString();
      if (u.recoveredByAnswerId) patch.recovered_by = u.recoveredByAnswerId;
      must(await db.from("mistake_entries").update(patch).eq("id", u.id).eq("user_id", userId), "recovering mistakes");
    }
  }

  return mistakeIdsFor(db, userId, rows);
}

/** Mistake-notebook ids for the given answer rows, keyed by question id. */
export async function mistakeIdsFor(db: Db, userId: string, rows: Pick<GradedAnswerRow, "id" | "question_id">[]): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map();
  const entries = must(
    await db
      .from("mistake_entries")
      .select("id, question_attempt_id")
      .eq("user_id", userId)
      .in(
        "question_attempt_id",
        rows.map((r) => r.id),
      ),
    "loading mistake ids",
  ) as { id: string; question_attempt_id: string }[];
  const questionByRow = new Map(rows.map((r) => [r.id, r.question_id]));
  return new Map(entries.map((e) => [questionByRow.get(e.question_attempt_id)!, e.id]));
}

/** Moving-average chapter mastery, still used to rank recommendations. */
export async function updateChapterMastery(
  db: Db,
  userId: string,
  mode: AttemptMode,
  questions: QuestionRow[],
  rows: GradedAnswerRow[],
  now: Date,
  options: { countSkipped: boolean } = { countSkipped: false },
) {
  const rowByQuestion = new Map(rows.map((r) => [r.question_id, r]));
  const evidenceByChapter = new Map<string, MasteryEvidence[]>();
  for (const q of questions) {
    const row = rowByQuestion.get(q.id);
    // Skipped questions don't count, except in a mock exam; stale-version answers never count.
    if (!q.chapter_id || (row && !row.counts_as_evidence) || (!row && !options.countSkipped)) continue;
    const list = evidenceByChapter.get(q.chapter_id) ?? [];
    list.push({
      correct: row?.correct ?? false,
      difficulty: q.difficulty,
      responseMs: row?.response_ms ?? undefined,
      hintsUsed: row?.hints_used,
      mode,
    });
    evidenceByChapter.set(q.chapter_id, list);
  }

  const chapterIds = [...evidenceByChapter.keys()];
  if (chapterIds.length === 0) return;
  const existing = must(
    await db
      .from("mastery")
      .select("chapter_id, score, confidence, attempts_count, last_practiced_at")
      .eq("user_id", userId)
      .in("chapter_id", chapterIds),
    "loading mastery",
  ) as Parameters<typeof toMasteryState>[0][];
  const prev = new Map(existing.map((m) => [m.chapter_id, toMasteryState(m)]));
  const upserts = chapterIds.map((chapterId) => {
    const next = updateMastery(prev.get(chapterId) ?? EMPTY_MASTERY, evidenceByChapter.get(chapterId)!, now);
    return {
      user_id: userId,
      chapter_id: chapterId,
      score: next.score,
      confidence: next.confidence,
      attempts_count: next.attemptsCount,
      last_practiced_at: next.lastPracticedAt?.toISOString() ?? null,
      updated_at: now.toISOString(),
    };
  });
  must(await db.from("mastery").upsert(upserts), "saving mastery");
}
