import "server-only";
import {
  acceptsAnswersAt,
  activeSubjectIds,
  isAnswerCorrect,
  mergeAnswers,
  scoreAttempt,
  skillKeyFor,
  type AnswerInputDto,
  type AttemptMode,
  type AttemptResultDto,
  type LocalizedText,
  type OfflineAttemptInput,
  type QuizAttemptDto,
  type StartAttemptInput,
} from "@eduprep/core";
import { ApiError, must, notFound, type Db } from "../db";
import { parseProgram } from "../mappers";
import { effectiveActivityTime, recordStudyActivity } from "./activity";
import { ANSWER_COLUMNS, mistakeIdsFor, recordAnswerEvidence, updateChapterMastery, type GradedAnswerRow } from "./evidence";
import { getProfileRow } from "./profile";
import { loadQuestions, misconceptionFor, toLearnerQuestion, toScorable, type QuestionRow } from "./questions";

const MOCK_SECONDS_PER_QUESTION = 90;
const MAX_COUNTED_SECONDS = 3 * 60 * 60;
const DIAGNOSTIC_MAX_QUESTIONS = 8;

interface AttemptRow {
  id: string;
  user_id: string;
  mode: AttemptMode;
  track_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  skill_id: string | null;
  lesson_id: string | null;
  question_ids: string[];
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  duration_seconds: number | null;
}

const ATTEMPT_COLUMNS =
  "id, user_id, mode, track_id, subject_id, chapter_id, skill_id, lesson_id, question_ids, started_at, deadline_at, submitted_at, score, max_score, percentage, duration_seconds";

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadAttempt(db: Db, userId: string, attemptId: string): Promise<AttemptRow> {
  const row = must(
    await db.from("quiz_attempts").select(ATTEMPT_COLUMNS).eq("id", attemptId).eq("user_id", userId).maybeSingle<AttemptRow>(),
    "loading attempt",
  );
  if (!row) throw notFound("Attempt");
  return row;
}

async function loadAnswers(db: Db, attemptId: string): Promise<GradedAnswerRow[]> {
  return must(await db.from("question_attempts").select(ANSWER_COLUMNS).eq("attempt_id", attemptId), "loading answers") as GradedAnswerRow[];
}

function toAttemptDto(attempt: AttemptRow, questions: QuestionRow[], saved: GradedAnswerRow[]): QuizAttemptDto {
  return {
    id: attempt.id,
    mode: attempt.mode,
    chapterId: attempt.chapter_id,
    subjectId: attempt.subject_id,
    startedAt: attempt.started_at,
    deadlineAt: attempt.deadline_at,
    submittedAt: attempt.submitted_at,
    questions: questions.map((q) => toLearnerQuestion(q, attempt.id, attempt.mode)),
    savedAnswers: saved.map((s) => s.answer),
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Unseen questions first, then ones previously answered wrongly, then the rest. */
async function pickQuestions(db: Db, userId: string, candidateIds: string[], count: number): Promise<string[]> {
  const history = must(
    await db.from("question_attempts").select("question_id, correct").eq("user_id", userId).in("question_id", candidateIds),
    "loading question history",
  ) as { question_id: string; correct: boolean | null }[];

  const alwaysCorrect = new Map<string, boolean>();
  for (const h of history) {
    if (h.correct === null) continue;
    alwaysCorrect.set(h.question_id, (alwaysCorrect.get(h.question_id) ?? true) && h.correct);
  }
  const unseen = candidateIds.filter((id) => !alwaysCorrect.has(id));
  const wrong = candidateIds.filter((id) => alwaysCorrect.get(id) === false);
  const right = candidateIds.filter((id) => alwaysCorrect.get(id) === true);
  return [...shuffle(unseen), ...shuffle(wrong), ...shuffle(right)].slice(0, count);
}

interface PracticeQuestion {
  id: string;
  chapter_id: string;
  skill_id: string | null;
  difficulty: number;
  source_type: string;
}

/** The diagnostic: one easy validated question per skill in the learner's subjects. */
async function diagnosticQuestions(db: Db, userId: string): Promise<{ trackId: string; questionIds: string[] }> {
  const profile = await getProfileRow(db, userId);
  if (!profile.target_track_id) throw new ApiError(422, "no_track", "Choose an exam track first");
  const trackId = profile.target_track_id;
  const [trackRes, subjectsRes, chaptersRes] = await Promise.all([
    db.from("exam_tracks").select("exams(program_config)").eq("id", trackId).maybeSingle(),
    db.from("track_subjects").select("subject_id").eq("track_id", trackId),
    db.from("chapters").select("id, subject_id, order_index").eq("track_id", trackId).eq("status", "published").order("order_index"),
  ]);
  const track = must(trackRes, "loading track") as unknown as { exams: { program_config: unknown } | null } | null;
  const settings = profile.program_settings;
  const active = new Set(
    activeSubjectIds(
      parseProgram(track?.exams?.program_config),
      (must(subjectsRes, "loading track subjects") as { subject_id: string }[]).map((s) => s.subject_id),
      settings,
    ),
  );
  const chapters = (must(chaptersRes, "loading chapters") as { id: string; subject_id: string; order_index: number }[]).filter((c) =>
    active.has(c.subject_id),
  );
  if (chapters.length === 0) throw new ApiError(404, "no_questions", "No questions are available for your subjects yet");

  const questions = must(
    await db
      .from("questions")
      .select("id, chapter_id, skill_id, difficulty, source_type")
      .in(
        "chapter_id",
        chapters.map((c) => c.id),
      )
      .eq("status", "published")
      .eq("purpose", "practice"),
    "loading diagnostic questions",
  ) as PracticeQuestion[];

  const bySkill = new Map<string, PracticeQuestion>();
  for (const q of questions) {
    const key = skillKeyFor(q.skill_id, q.chapter_id);
    const best = bySkill.get(key);
    if (!best || q.difficulty < best.difficulty || (q.difficulty === best.difficulty && q.id < best.id)) bySkill.set(key, q);
  }
  const chapterOrder = new Map(chapters.map((c, i) => [c.id, i]));
  const picked = [...bySkill.values()]
    .sort((a, b) => (chapterOrder.get(a.chapter_id)! - chapterOrder.get(b.chapter_id)!) || a.id.localeCompare(b.id))
    .slice(0, DIAGNOSTIC_MAX_QUESTIONS);
  if (picked.length === 0) throw new ApiError(404, "no_questions", "No questions are available for your subjects yet");
  return { trackId, questionIds: picked.map((q) => q.id) };
}

export async function startAttempt(db: Db, userId: string, input: StartAttemptInput, now: Date) {
  const existing = must(
    await db.from("quiz_attempts").select("id").eq("user_id", userId).eq("client_attempt_id", input.clientAttemptId).maybeSingle<{ id: string }>(),
    "checking existing attempt",
  );
  if (existing) return getAttempt(db, userId, existing.id);

  let trackId: string;
  let subjectId: string | null = null;
  let chapterId: string | null = input.chapterId ?? null;
  let questionIds: string[];

  if (input.mode === "diagnostic") {
    ({ trackId, questionIds } = await diagnosticQuestions(db, userId));
  } else {
    let chapterIds: string[];
    if (input.skillId) {
      const skill = must(
        await db
          .from("skills")
          .select("id, chapter_id, chapters!inner(id, track_id, subject_id, status)")
          .eq("id", input.skillId)
          .maybeSingle(),
        "loading skill",
      ) as unknown as { id: string; chapter_id: string; chapters: { track_id: string; subject_id: string; status: string } } | null;
      if (!skill || skill.chapters.status !== "published") throw notFound("Skill");
      trackId = skill.chapters.track_id;
      subjectId = skill.chapters.subject_id;
      chapterId = skill.chapter_id;
      chapterIds = [skill.chapter_id];
    } else if (input.chapterId) {
      const chapter = must(
        await db
          .from("chapters")
          .select("id, track_id, subject_id")
          .eq("id", input.chapterId)
          .eq("status", "published")
          .maybeSingle<{ id: string; track_id: string; subject_id: string }>(),
        "loading chapter",
      );
      if (!chapter) throw notFound("Chapter");
      trackId = chapter.track_id;
      subjectId = chapter.subject_id;
      chapterIds = [chapter.id];
    } else {
      const profile = await getProfileRow(db, userId);
      if (!profile.target_track_id) throw new ApiError(422, "no_track", "Choose an exam track first");
      trackId = profile.target_track_id;
      subjectId = input.subjectId!;
      const chapters = must(
        await db.from("chapters").select("id").eq("track_id", trackId).eq("subject_id", subjectId).eq("status", "published"),
        "loading subject chapters",
      ) as { id: string }[];
      chapterIds = chapters.map((c) => c.id);
    }

    // Lesson checkpoints stay inside lessons; practice draws from the practice pool only.
    let query = db.from("questions").select("id").in("chapter_id", chapterIds).eq("status", "published").eq("purpose", "practice");
    if (input.skillId) query = query.eq("skill_id", input.skillId);
    if (input.mode === "past_paper") query = query.eq("source_type", "official_past_paper");
    const all = (must(await query, "loading candidate questions") as { id: string }[]).map((q) => q.id);
    const excluded = new Set(input.excludeQuestionIds);
    const candidates = all.filter((id) => !excluded.has(id));
    if (candidates.length === 0) {
      if (input.mode === "recovery" && all.length > 0) {
        throw new ApiError(404, "no_other_questions", "There is no other question on this skill yet");
      }
      throw new ApiError(
        404,
        "no_questions",
        input.mode === "past_paper" ? "No past-paper questions are available here yet" : "No questions are available here yet",
      );
    }
    questionIds = await pickQuestions(db, userId, candidates, input.questionCount);
  }

  const deadlineAt = input.mode === "mock" ? new Date(now.getTime() + questionIds.length * MOCK_SECONDS_PER_QUESTION * 1000) : null;
  const inserted = await db
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      client_attempt_id: input.clientAttemptId,
      mode: input.mode,
      track_id: trackId,
      subject_id: subjectId,
      chapter_id: chapterId,
      skill_id: input.skillId ?? null,
      question_ids: questionIds,
      started_at: now.toISOString(),
      deadline_at: deadlineAt?.toISOString() ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (inserted.error?.code === "23505") {
    // A concurrent retry with the same clientAttemptId won the race.
    const winner = must(
      await db.from("quiz_attempts").select("id").eq("user_id", userId).eq("client_attempt_id", input.clientAttemptId).single<{ id: string }>(),
      "loading concurrent attempt",
    );
    return getAttempt(db, userId, winner.id);
  }
  const created = must(inserted, "creating attempt");
  return getAttempt(db, userId, created.id);
}

// ---------------------------------------------------------------------------
// Read / autosave
// ---------------------------------------------------------------------------

export async function listRecentAttempts(db: Db, userId: string, limit = 20) {
  const rows = must(
    await db
      .from("quiz_attempts")
      .select("id, mode, chapter_id, subject_id, started_at, submitted_at, score, max_score, percentage, chapters(title), subjects(name)")
      .eq("user_id", userId)
      .not("submitted_at", "is", null)
      // Single lesson checkpoints aren't quizzes.
      .neq("mode", "checkpoint")
      .order("submitted_at", { ascending: false })
      .limit(limit),
    "loading attempt history",
  ) as unknown as (Pick<AttemptRow, "id" | "mode" | "chapter_id" | "subject_id" | "started_at" | "submitted_at" | "score" | "max_score" | "percentage"> & {
    chapters: { title: LocalizedText } | null;
    subjects: { name: LocalizedText } | null;
  })[];
  return rows.map((r) => ({
    id: r.id,
    mode: r.mode,
    title: r.chapters?.title ?? r.subjects?.name ?? {},
    submittedAt: r.submitted_at!,
    score: r.score ?? 0,
    maxScore: r.max_score ?? 0,
    percentage: Number(r.percentage ?? 0),
  }));
}

export async function getAttempt(
  db: Db,
  userId: string,
  attemptId: string,
): Promise<{ attempt: QuizAttemptDto; result: AttemptResultDto | null }> {
  const attempt = await loadAttempt(db, userId, attemptId);
  const [questions, saved] = await Promise.all([loadQuestions(db, attempt.question_ids), loadAnswers(db, attempt.id)]);
  const result = attempt.submitted_at ? await buildResult(db, userId, attempt, questions, saved) : null;
  return { attempt: toAttemptDto(attempt, questions, saved), result };
}

function sanitize(answers: AnswerInputDto[], attempt: Pick<AttemptRow, "question_ids">): AnswerInputDto[] {
  const allowed = new Set(attempt.question_ids);
  return answers.filter((a) => allowed.has(a.questionId));
}

function answerRow(
  attempt: Pick<AttemptRow, "id" | "user_id">,
  a: AnswerInputDto,
  now: Date,
  correct: boolean | null,
  version: number,
  countsAsEvidence = true,
) {
  return {
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    question_id: a.questionId,
    answer: a,
    correct,
    response_ms: a.responseMs ?? null,
    hints_used: a.hintsUsed ?? 0,
    question_version: version,
    counts_as_evidence: countsAsEvidence,
    answered_at: effectiveActivityTime(a.answeredAt, now).toISOString(),
    saved_at: now.toISOString(),
  };
}

export async function saveAnswers(db: Db, userId: string, attemptId: string, answers: AnswerInputDto[], now: Date) {
  const attempt = await loadAttempt(db, userId, attemptId);
  if (attempt.submitted_at) throw new ApiError(409, "already_submitted", "This attempt has already been submitted");
  if (!acceptsAnswersAt(attempt.deadline_at ? new Date(attempt.deadline_at) : null, now)) {
    throw new ApiError(409, "time_up", "Time is up for this attempt");
  }
  const versions = new Map((await loadQuestions(db, attempt.question_ids)).map((q) => [q.id, q.version]));
  const rows = sanitize(answers, attempt).map((a) => answerRow(attempt, a, now, null, versions.get(a.questionId) ?? 1));
  if (rows.length > 0) {
    must(await db.from("question_attempts").upsert(rows, { onConflict: "attempt_id,question_id" }), "autosaving answers");
  }
  return { saved: rows.length };
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export async function submitAttempt(
  db: Db,
  userId: string,
  attemptId: string,
  incoming: AnswerInputDto[],
  now: Date,
): Promise<AttemptResultDto> {
  const attempt = await loadAttempt(db, userId, attemptId);
  const questions = await loadQuestions(db, attempt.question_ids);

  if (attempt.submitted_at) return buildResult(db, userId, attempt, questions, await loadAnswers(db, attempt.id));

  const deadline = attempt.deadline_at ? new Date(attempt.deadline_at) : null;
  const saved = (await loadAnswers(db, attempt.id)).map((s) => s.answer);
  // After the deadline (+grace) only answers autosaved in time count.
  const accepted = acceptsAnswersAt(deadline, now) ? sanitize(incoming, attempt) : [];
  const answers = mergeAnswers(saved, accepted);
  const summary = scoreAttempt(questions.map(toScorable), answers);
  const correctById = new Map(summary.results.map((r) => [r.questionId, r.correct]));
  const versions = new Map(questions.map((q) => [q.id, q.version]));

  const rows = answers.map((a) => answerRow(attempt, a, now, correctById.get(a.questionId) ?? false, versions.get(a.questionId) ?? 1));
  if (rows.length > 0) {
    must(await db.from("question_attempts").upsert(rows, { onConflict: "attempt_id,question_id" }), "saving graded answers");
  }

  const endedAt = deadline && now > deadline ? deadline : now;
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(attempt.started_at).getTime()) / 1000));

  // Only the request that flips submitted_at applies progress updates, so retries can't double-count.
  const claimed = must(
    await db
      .from("quiz_attempts")
      .update({
        submitted_at: now.toISOString(),
        score: summary.score,
        max_score: summary.maxScore,
        percentage: summary.percentage,
        duration_seconds: durationSeconds,
      })
      .eq("id", attempt.id)
      .is("submitted_at", null)
      .select(ATTEMPT_COLUMNS),
    "submitting attempt",
  ) as AttemptRow[];

  const finalAttempt = claimed[0] ?? (await loadAttempt(db, userId, attemptId));
  const graded = await loadAnswers(db, attempt.id);
  if (claimed[0]) {
    await updateChapterMastery(db, userId, attempt.mode, questions, graded, now, { countSkipped: attempt.mode === "mock" });
    await recordAnswerEvidence(db, userId, graded, questions);
    const profile = await getProfileRow(db, userId);
    await recordStudyActivity(db, profile, now, {
      seconds: Math.min(durationSeconds, MAX_COUNTED_SECONDS),
      questions: answers.length,
      lessons: 0,
    });
    if (attempt.mode === "diagnostic") {
      must(await db.from("profiles").update({ diagnostic_status: "completed" }).eq("id", userId), "completing diagnostic");
    }
  }
  return buildResult(db, userId, finalAttempt, questions, graded);
}

// ---------------------------------------------------------------------------
// Offline practice from a study pack
// ---------------------------------------------------------------------------

/**
 * Records a practice session done offline. Idempotent on clientAttemptId. Answers are re-marked with
 * the current answer keys; an answer to an older version of a question is kept but not counted.
 */
export async function submitOfflineAttempt(db: Db, userId: string, input: OfflineAttemptInput, now: Date) {
  const existing = must(
    await db.from("quiz_attempts").select("id").eq("user_id", userId).eq("client_attempt_id", input.clientAttemptId).maybeSingle<{ id: string }>(),
    "checking existing attempt",
  );
  if (existing) {
    const view = await getAttempt(db, userId, existing.id);
    return { result: view.result!, duplicate: true, staleQuestions: 0 };
  }

  const chapter = must(
    await db.from("chapters").select("id, track_id, subject_id").eq("id", input.chapterId).eq("status", "published").maybeSingle<{ id: string; track_id: string; subject_id: string }>(),
    "loading chapter",
  );
  if (!chapter) throw notFound("Chapter");

  const requested = new Map(input.questions.map((q) => [q.questionId, q.version]));
  const questions = (await loadQuestions(db, [...requested.keys()])).filter((q) => q.chapter_id === chapter.id);
  if (questions.length === 0) throw new ApiError(422, "no_valid_questions", "None of these questions belong to the chapter any more");
  const stale = questions.filter((q) => requested.get(q.id) !== q.version).map((q) => q.id);

  const startedAt = effectiveActivityTime(input.startedAt, now);
  const submittedAt = effectiveActivityTime(input.submittedAt, now);
  // A device that merged two offline sessions can send the same question twice; keep the last answer.
  const answers = mergeAnswers([], sanitize(input.answers, { question_ids: questions.map((q) => q.id) }));
  const summary = scoreAttempt(questions.map(toScorable), answers);

  const inserted = await db
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      client_attempt_id: input.clientAttemptId,
      mode: input.mode,
      offline: true,
      track_id: chapter.track_id,
      subject_id: chapter.subject_id,
      chapter_id: chapter.id,
      skill_id: input.skillId ?? null,
      lesson_id: input.lessonId ?? null,
      question_ids: questions.map((q) => q.id),
      started_at: startedAt.toISOString(),
      submitted_at: submittedAt.toISOString(),
      score: summary.score,
      max_score: summary.maxScore,
      percentage: summary.percentage,
      duration_seconds: Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)),
    })
    .select(ATTEMPT_COLUMNS)
    .single<AttemptRow>();
  if (inserted.error?.code === "23505") {
    const winner = must(
      await db.from("quiz_attempts").select("id").eq("user_id", userId).eq("client_attempt_id", input.clientAttemptId).single<{ id: string }>(),
      "loading concurrent attempt",
    );
    return { result: (await getAttempt(db, userId, winner.id)).result!, duplicate: true, staleQuestions: 0 };
  }
  const attempt = must(inserted, "saving offline attempt");

  const correct = new Map(questions.map((q) => [q.id, q]));
  const rows = answers.map((a) => {
    const q = correct.get(a.questionId)!;
    return answerRow(attempt, a, now, isAnswerCorrect(toScorable(q), a), requested.get(q.id) ?? q.version, !stale.includes(q.id));
  });
  if (rows.length > 0) must(await db.from("question_attempts").insert(rows), "saving offline answers");

  const graded = await loadAnswers(db, attempt.id);
  await updateChapterMastery(db, userId, input.mode, questions, graded, submittedAt);
  await recordAnswerEvidence(db, userId, graded, questions);
  const profile = await getProfileRow(db, userId);
  await recordStudyActivity(db, profile, submittedAt, {
    seconds: Math.min(attempt.duration_seconds ?? 0, MAX_COUNTED_SECONDS),
    questions: answers.length,
    lessons: 0,
  });
  return { result: await buildResult(db, userId, attempt, questions, graded), duplicate: false, staleQuestions: stale.length };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

async function buildResult(
  db: Db,
  userId: string,
  attempt: AttemptRow,
  questions: QuestionRow[],
  saved: GradedAnswerRow[],
): Promise<AttemptResultDto> {
  const answerById = new Map(saved.map((s) => [s.question_id, s]));
  const chapterIds = [...new Set(questions.map((q) => q.chapter_id).filter((id): id is string => Boolean(id)))];

  const [chapters, mastery, mistakes] = await Promise.all([
    db.from("chapters").select("id, title").in("id", chapterIds),
    db.from("mastery").select("chapter_id, score").eq("user_id", userId).in("chapter_id", chapterIds),
    mistakeIdsFor(db, userId, saved),
  ]);
  const titles = new Map((must(chapters, "loading chapter titles") as { id: string; title: LocalizedText }[]).map((c) => [c.id, c.title]));

  const results = questions.map((q) => {
    const row = answerById.get(q.id);
    const correct = row?.correct ?? false;
    return {
      questionId: q.id,
      answered: Boolean(row),
      correct,
      selectedOptionIds: row?.answer.selectedOptionIds ?? [],
      numericValue: row?.answer.numericValue ?? null,
      correctOptionIds: q.question_options.filter((o) => o.is_correct).map((o) => o.id),
      correctNumericValue: q.type === "numeric" ? q.numeric_answer : null,
      explanation: q.solutions?.explanation ?? {},
      misconception: correct ? null : misconceptionFor(q, row?.answer),
      hintsUsed: row?.hints_used ?? 0,
      mistakeId: mistakes.get(q.id) ?? null,
    };
  });

  const breakdown = new Map<string, { correct: number; total: number }>();
  questions.forEach((q, i) => {
    if (!q.chapter_id) return;
    const b = breakdown.get(q.chapter_id) ?? { correct: 0, total: 0 };
    b.total++;
    if (results[i]!.correct) b.correct++;
    breakdown.set(q.chapter_id, b);
  });

  return {
    attemptId: attempt.id,
    mode: attempt.mode,
    score: attempt.score ?? 0,
    maxScore: attempt.max_score ?? questions.length,
    percentage: Number(attempt.percentage ?? 0),
    durationSeconds: attempt.duration_seconds ?? 0,
    submittedAt: attempt.submitted_at!,
    results,
    chapterBreakdown: [...breakdown.entries()].map(([chapterId, b]) => ({ chapterId, title: titles.get(chapterId) ?? {}, ...b })),
    masteryAfter: (must(mastery, "loading mastery") as { chapter_id: string; score: number }[]).map((m) => ({
      chapterId: m.chapter_id,
      mastery: Number(m.score),
    })),
  };
}
