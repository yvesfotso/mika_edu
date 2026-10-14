import "server-only";
import { isAnswerCorrect, type CheckpointAnswerInput, type CheckpointResultDto } from "@eduprep/core";
import { ApiError, must, notFound, type Db } from "../db";
import { effectiveActivityTime, recordStudyActivity } from "./activity";
import { ANSWER_COLUMNS, mistakeIdsFor, recordAnswerEvidence, updateChapterMastery, type GradedAnswerRow } from "./evidence";
import { lessonCheckpoints, loadPublishedLesson } from "./lessons";
import { getProfileRow } from "./profile";
import { misconceptionFor, toScorable, type QuestionRow } from "./questions";

function toResult(q: QuestionRow, row: GradedAnswerRow, mistakeId: string | null): CheckpointResultDto {
  const correct = row.correct ?? false;
  return {
    questionId: q.id,
    correct,
    correctOptionIds: q.question_options.filter((o) => o.is_correct).map((o) => o.id),
    correctNumericValue: q.type === "numeric" ? q.numeric_answer : null,
    explanation: q.solutions?.explanation ?? {},
    misconception: correct ? null : misconceptionFor(q, row.answer),
    mistakeId,
  };
}

/**
 * Marks one checkpoint answer inside a lesson. Each answer is its own single-question attempt
 * (mode "checkpoint"), so it is idempotent on clientAttemptId and counts as assessment evidence,
 * unlike opening or reading the lesson.
 */
export async function answerCheckpoint(db: Db, userId: string, input: CheckpointAnswerInput, now: Date): Promise<CheckpointResultDto> {
  const lesson = await loadPublishedLesson(db, input.lessonId);
  const checkpoint = (await lessonCheckpoints(db, lesson.id)).find((c) => c.question.id === input.questionId);
  if (!checkpoint) throw notFound("Checkpoint");
  const q = checkpoint.question;
  const answer = {
    questionId: input.questionId,
    selectedOptionIds: input.selectedOptionIds,
    numericValue: input.numericValue,
    responseMs: input.responseMs,
    hintsUsed: input.hintsUsed,
    answeredAt: input.answeredAt,
  };
  if (answer.numericValue === undefined && !(answer.selectedOptionIds?.length ?? 0)) {
    throw new ApiError(422, "empty_answer", "Choose an answer first");
  }

  const findExisting = async () => {
    const existing = must(
      await db.from("quiz_attempts").select("id").eq("user_id", userId).eq("client_attempt_id", input.clientAttemptId).maybeSingle<{ id: string }>(),
      "checking existing answer",
    );
    if (!existing) return null;
    const row = must(
      await db.from("question_attempts").select(ANSWER_COLUMNS).eq("attempt_id", existing.id).maybeSingle<GradedAnswerRow>(),
      "loading checkpoint answer",
    );
    if (!row) return null;
    const mistakes = await mistakeIdsFor(db, userId, [row]);
    return toResult(q, row, mistakes.get(q.id) ?? null);
  };
  const replay = await findExisting();
  if (replay) return replay;

  const at = effectiveActivityTime(input.answeredAt, now);
  const correct = isAnswerCorrect(toScorable(q), answer);
  const inserted = await db
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      client_attempt_id: input.clientAttemptId,
      mode: "checkpoint",
      track_id: lesson.chapters.track_id,
      subject_id: lesson.chapters.subject_id,
      chapter_id: lesson.chapter_id,
      skill_id: q.skill_id,
      lesson_id: lesson.id,
      question_ids: [q.id],
      started_at: at.toISOString(),
      submitted_at: at.toISOString(),
      score: correct ? 1 : 0,
      max_score: 1,
      percentage: correct ? 100 : 0,
      duration_seconds: Math.round((input.responseMs ?? 0) / 1000),
    })
    .select("id")
    .single<{ id: string }>();
  if (inserted.error?.code === "23505") {
    const winner = await findExisting();
    if (winner) return winner;
  }
  const attempt = must(inserted, "saving checkpoint attempt");

  const row = must(
    await db
      .from("question_attempts")
      .insert({
        attempt_id: attempt.id,
        user_id: userId,
        question_id: q.id,
        answer,
        correct,
        response_ms: input.responseMs ?? null,
        hints_used: input.hintsUsed ?? 0,
        question_version: input.questionVersion ?? q.version,
        // An answer to an older version (e.g. from an outdated offline pack) is kept but not counted.
        counts_as_evidence: input.questionVersion === undefined || input.questionVersion === q.version,
        answered_at: at.toISOString(),
        saved_at: now.toISOString(),
      })
      .select(ANSWER_COLUMNS)
      .single<GradedAnswerRow>(),
    "saving checkpoint answer",
  );

  await updateChapterMastery(db, userId, "checkpoint", [q], [row], at);
  const mistakes = await recordAnswerEvidence(db, userId, [row], [q]);
  const profile = await getProfileRow(db, userId);
  await recordStudyActivity(db, profile, at, { seconds: Math.min(Math.round((input.responseMs ?? 0) / 1000), 600), questions: 1, lessons: 0 });
  return toResult(q, row, mistakes.get(q.id) ?? null);
}
