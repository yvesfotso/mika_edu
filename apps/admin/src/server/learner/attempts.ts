import "server-only";
import {
  acceptsAnswersAt,
  EMPTY_MASTERY,
  mergeAnswers,
  scoreAttempt,
  seededShuffle,
  updateMastery,
  type AnswerInputDto,
  type AttemptMode,
  type AttemptQuestionDto,
  type AttemptResultDto,
  type LocalizedText,
  type MasteryEvidence,
  type QuestionSource,
  type QuestionType,
  type QuizAttemptDto,
  type ScorableQuestion,
  type StartAttemptInput,
} from "@eduprep/core";
import { ApiError, must, notFound, type Db } from "../db";
import { recordStudyActivity } from "./activity";
import { toMasteryState } from "./curriculum";
import { getProfileRow } from "./profile";

const MOCK_SECONDS_PER_QUESTION = 90;
const MAX_COUNTED_SECONDS = 3 * 60 * 60;

interface AttemptRow {
  id: string;
  user_id: string;
  mode: AttemptMode;
  track_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  question_ids: string[];
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  duration_seconds: number | null;
}

interface QuestionRow {
  id: string;
  chapter_id: string | null;
  type: QuestionType;
  prompt: LocalizedText;
  difficulty: number;
  source_type: QuestionSource;
  source_year: number | null;
  numeric_answer: number | null;
  numeric_tolerance: number | null;
  question_options: { id: string; text: LocalizedText; is_correct: boolean; order_index: number }[];
  solutions: { explanation: LocalizedText } | null;
}

interface SavedAnswerRow {
  question_id: string;
  answer: AnswerInputDto;
  correct: boolean | null;
  response_ms: number | null;
  hints_used: number;
}

const ATTEMPT_COLUMNS =
  "id, user_id, mode, track_id, subject_id, chapter_id, question_ids, started_at, deadline_at, submitted_at, score, max_score, percentage, duration_seconds";

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

/** Questions in the attempt's order, including answer keys (server-side only). */
async function loadQuestions(db: Db, ids: string[]): Promise<QuestionRow[]> {
  if (ids.length === 0) return [];
  const rows = must(
    await db
      .from("questions")
      .select(
        "id, chapter_id, type, prompt, difficulty, source_type, source_year, numeric_answer, numeric_tolerance, question_options(id, text, is_correct, order_index), solutions(explanation)",
      )
      .in("id", ids),
    "loading questions",
  ) as unknown as QuestionRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((q): q is QuestionRow => Boolean(q));
}

async function loadSavedAnswers(db: Db, attemptId: string): Promise<SavedAnswerRow[]> {
  return must(
    await db
      .from("question_attempts")
      .select("question_id, answer, correct, response_ms, hints_used")
      .eq("attempt_id", attemptId),
    "loading answers",
  ) as SavedAnswerRow[];
}

function toLearnerQuestion(q: QuestionRow, attemptId: string): AttemptQuestionDto {
  const authored = [...q.question_options].sort((a, b) => a.order_index - b.order_index);
  // Shuffle per attempt (stable across reloads) so the correct answer isn't always in the same place.
  const options = q.type === "true_false" ? authored : seededShuffle(authored, `${attemptId}:${q.id}`);
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    sourceType: q.source_type,
    sourceYear: q.source_year,
    options: options.map((o) => ({ id: o.id, text: o.text })),
  };
}

function toScorable(q: QuestionRow): ScorableQuestion {
  return {
    id: q.id,
    type: q.type,
    options: q.question_options.map((o) => ({ id: o.id, isCorrect: o.is_correct })),
    numericAnswer: q.numeric_answer,
    numericTolerance: q.numeric_tolerance,
  };
}

function toAttemptDto(attempt: AttemptRow, questions: QuestionRow[], saved: SavedAnswerRow[]): QuizAttemptDto {
  return {
    id: attempt.id,
    mode: attempt.mode,
    chapterId: attempt.chapter_id,
    subjectId: attempt.subject_id,
    startedAt: attempt.started_at,
    deadlineAt: attempt.deadline_at,
    submittedAt: attempt.submitted_at,
    questions: questions.map((q) => toLearnerQuestion(q, attempt.id)),
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

export async function startAttempt(db: Db, userId: string, input: StartAttemptInput, now: Date) {
  const existing = must(
    await db
      .from("quiz_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("client_attempt_id", input.clientAttemptId)
      .maybeSingle<{ id: string }>(),
    "checking existing attempt",
  );
  if (existing) return getAttempt(db, userId, existing.id);

  let trackId: string;
  let subjectId: string;
  let chapterIds: string[];

  if (input.chapterId) {
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
      await db
        .from("chapters")
        .select("id")
        .eq("track_id", trackId)
        .eq("subject_id", subjectId)
        .eq("status", "published"),
      "loading subject chapters",
    ) as { id: string }[];
    chapterIds = chapters.map((c) => c.id);
  }

  let questionQuery = db.from("questions").select("id").in("chapter_id", chapterIds).eq("status", "published");
  if (input.mode === "past_paper") questionQuery = questionQuery.eq("source_type", "official_past_paper");
  const candidates = (must(await questionQuery, "loading candidate questions") as { id: string }[]).map((q) => q.id);
  if (candidates.length === 0) {
    throw new ApiError(
      404,
      "no_questions",
      input.mode === "past_paper" ? "No past-paper questions are available here yet" : "No questions are available here yet",
    );
  }

  const questionIds = await pickQuestions(db, userId, candidates, input.questionCount);
  const deadlineAt =
    input.mode === "mock" ? new Date(now.getTime() + questionIds.length * MOCK_SECONDS_PER_QUESTION * 1000) : null;

  const inserted = await db
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      client_attempt_id: input.clientAttemptId,
      mode: input.mode,
      track_id: trackId,
      subject_id: subjectId,
      chapter_id: input.chapterId ?? null,
      question_ids: questionIds,
      started_at: now.toISOString(),
      deadline_at: deadlineAt?.toISOString() ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (inserted.error?.code === "23505") {
    // A concurrent retry with the same clientAttemptId won the race.
    const winner = must(
      await db
        .from("quiz_attempts")
        .select("id")
        .eq("user_id", userId)
        .eq("client_attempt_id", input.clientAttemptId)
        .single<{ id: string }>(),
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
  const [questions, saved] = await Promise.all([loadQuestions(db, attempt.question_ids), loadSavedAnswers(db, attempt.id)]);
  const result = attempt.submitted_at ? await buildResult(db, userId, attempt, questions, saved) : null;
  return { attempt: toAttemptDto(attempt, questions, saved), result };
}

function sanitize(answers: AnswerInputDto[], attempt: AttemptRow): AnswerInputDto[] {
  const allowed = new Set(attempt.question_ids);
  return answers.filter((a) => allowed.has(a.questionId));
}

function answerRow(attempt: AttemptRow, a: AnswerInputDto, now: Date, correct: boolean | null) {
  return {
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    question_id: a.questionId,
    answer: a,
    correct,
    response_ms: a.responseMs ?? null,
    hints_used: a.hintsUsed ?? 0,
    saved_at: now.toISOString(),
  };
}

export async function saveAnswers(db: Db, userId: string, attemptId: string, answers: AnswerInputDto[], now: Date) {
  const attempt = await loadAttempt(db, userId, attemptId);
  if (attempt.submitted_at) throw new ApiError(409, "already_submitted", "This attempt has already been submitted");
  if (!acceptsAnswersAt(attempt.deadline_at ? new Date(attempt.deadline_at) : null, now)) {
    throw new ApiError(409, "time_up", "Time is up for this attempt");
  }
  const rows = sanitize(answers, attempt).map((a) => answerRow(attempt, a, now, null));
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

  if (attempt.submitted_at) {
    return buildResult(db, userId, attempt, questions, await loadSavedAnswers(db, attempt.id));
  }

  const deadline = attempt.deadline_at ? new Date(attempt.deadline_at) : null;
  const saved = (await loadSavedAnswers(db, attempt.id)).map((s) => s.answer);
  // After the deadline (+grace) only answers autosaved in time count.
  const accepted = acceptsAnswersAt(deadline, now) ? sanitize(incoming, attempt) : [];
  const answers = mergeAnswers(saved, accepted);
  const summary = scoreAttempt(questions.map(toScorable), answers);
  const correctById = new Map(summary.results.map((r) => [r.questionId, r.correct]));

  const rows = answers.map((a) => answerRow(attempt, a, now, correctById.get(a.questionId) ?? false));
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
  if (claimed[0]) {
    await applyProgress(db, userId, attempt.mode, questions, answers, correctById, now, durationSeconds);
  }
  return buildResult(db, userId, finalAttempt, questions, await loadSavedAnswers(db, attempt.id));
}

async function applyProgress(
  db: Db,
  userId: string,
  mode: AttemptMode,
  questions: QuestionRow[],
  answers: AnswerInputDto[],
  correctById: Map<string, boolean>,
  now: Date,
  durationSeconds: number,
) {
  const answerById = new Map(answers.map((a) => [a.questionId, a]));
  const evidenceByChapter = new Map<string, MasteryEvidence[]>();
  for (const q of questions) {
    const answer = answerById.get(q.id);
    // Skipped questions in practice don't count against mastery; in a mock they do.
    if (!q.chapter_id || (!answer && mode !== "mock")) continue;
    const list = evidenceByChapter.get(q.chapter_id) ?? [];
    list.push({
      correct: correctById.get(q.id) ?? false,
      difficulty: q.difficulty,
      responseMs: answer?.responseMs,
      hintsUsed: answer?.hintsUsed,
      mode,
    });
    evidenceByChapter.set(q.chapter_id, list);
  }

  const chapterIds = [...evidenceByChapter.keys()];
  if (chapterIds.length > 0) {
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

  const profile = await getProfileRow(db, userId);
  await recordStudyActivity(db, profile, now, {
    seconds: Math.min(durationSeconds, MAX_COUNTED_SECONDS),
    questions: answers.length,
    lessons: 0,
  });
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

async function buildResult(
  db: Db,
  userId: string,
  attempt: AttemptRow,
  questions: QuestionRow[],
  saved: SavedAnswerRow[],
): Promise<AttemptResultDto> {
  const answerById = new Map(saved.map((s) => [s.question_id, s]));
  const chapterIds = [...new Set(questions.map((q) => q.chapter_id).filter((id): id is string => Boolean(id)))];

  const [chapters, mastery] = await Promise.all([
    db.from("chapters").select("id, title").in("id", chapterIds),
    db.from("mastery").select("chapter_id, score").eq("user_id", userId).in("chapter_id", chapterIds),
  ]);
  const titles = new Map((must(chapters, "loading chapter titles") as { id: string; title: LocalizedText }[]).map((c) => [c.id, c.title]));

  const results = questions.map((q) => {
    const row = answerById.get(q.id);
    const correctOptions = q.question_options.filter((o) => o.is_correct).map((o) => o.id);
    return {
      questionId: q.id,
      answered: Boolean(row),
      correct: row?.correct ?? false,
      selectedOptionIds: row?.answer.selectedOptionIds ?? [],
      numericValue: row?.answer.numericValue ?? null,
      correctOptionIds: correctOptions,
      correctNumericValue: q.type === "numeric" ? q.numeric_answer : null,
      explanation: q.solutions?.explanation ?? {},
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
    chapterBreakdown: [...breakdown.entries()].map(([chapterId, b]) => ({
      chapterId,
      title: titles.get(chapterId) ?? {},
      ...b,
    })),
    masteryAfter: (must(mastery, "loading mastery") as { chapter_id: string; score: number }[]).map((m) => ({
      chapterId: m.chapter_id,
      mastery: Number(m.score),
    })),
  };
}
