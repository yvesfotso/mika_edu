/**
 * Simulated EduPrep API for demo mode. Implements the same /api/v1 endpoints and response
 * shapes as apps/admin, using the shared scoring/mastery/streak logic from @eduprep/core and
 * the pilot content from content.json. State lives in this device's storage.
 */
import {
  activeSubjectIds,
  canChangeProgram,
  DEFAULT_PROGRAM,
  normalizeProgramSettings,
  ProgramSettingsError,
  programConfigSchema,
  type ProgramConfig,
  ACTIVITY_DAYS,
  acceptsAnswersAt,
  addDays,
  completeLessonSchema,
  daysBetween,
  daysUntil,
  displayedStreak,
  EMPTY_MASTERY,
  localDate,
  mergeAnswers,
  recommendChapters,
  recordActivity,
  retainedScore,
  saveAnswersSchema,
  scoreAttempt,
  seededShuffle,
  startAttemptSchema,
  submitAttemptSchema,
  updateMastery,
  updateProfileSchema,
  weightedMastery,
  type AnswerInputDto,
  type AttemptMode,
  type AttemptResultDto,
  type ChapterDto,
  type DashboardDto,
  type ExamDto,
  type Locale,
  type LocalizedText,
  type MasteryEvidence,
  type MasteryState,
  type ProfileDto,
  type QuestionType,
  type QuizAttemptDto,
  type StreakState,
  type SubjectSummaryDto,
} from "@eduprep/core";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "@/lib/errors";
import { randomId } from "@/lib/ids";
import { store } from "@/lib/storage";
import rawContent from "./content.json";
import { claimFriendCode, handleMessaging, seedDemoConversations, stateKey } from "./messaging";

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface DemoQuestion {
  id: string;
  type: QuestionType;
  prompt: LocalizedText;
  difficulty: number;
  options: { id: string; text: LocalizedText; isCorrect: boolean }[];
  numericAnswer: number | null;
  numericTolerance: number | null;
  explanation: LocalizedText;
}
interface DemoChapter {
  id: string;
  trackId: string;
  subjectId: string;
  title: LocalizedText;
  orderIndex: number;
  lessons: { id: string; title: LocalizedText; body: LocalizedText; estimatedMinutes: number }[];
  questions: DemoQuestion[];
}
interface DemoContent {
  subjects: { id: string; slug: string; name: LocalizedText; icon: string | null }[];
  exams: {
    id: string;
    slug: string;
    countryCode: string;
    name: LocalizedText;
    description: LocalizedText;
    level: string;
    primaryLanguage: string;
    program: unknown;
    tracks: { id: string; slug: string; name: LocalizedText; subjects: { subjectId: string; coefficient: number }[] }[];
  }[];
  chapters: DemoChapter[];
}

const content = rawContent as DemoContent;
const subjectsById = new Map(content.subjects.map((s) => [s.id, s]));
const chaptersById = new Map(content.chapters.map((c) => [c.id, c]));
const questionsById = new Map(content.chapters.flatMap((c) => c.questions.map((q) => [q.id, { ...q, chapterId: c.id }] as const)));
const lessonsById = new Map(content.chapters.flatMap((c) => c.lessons.map((l) => [l.id, { ...l, chapterId: c.id }] as const)));

function programOf(exam: DemoContent["exams"][number] | undefined): ProgramConfig {
  const parsed = programConfigSchema.safeParse(exam?.program);
  return parsed.success ? parsed.data : DEFAULT_PROGRAM;
}

function examDto(exam: DemoContent["exams"][number]): ExamDto {
  return {
    id: exam.id,
    slug: exam.slug,
    countryCode: exam.countryCode,
    name: exam.name,
    description: exam.description,
    level: exam.level,
    primaryLanguage: exam.primaryLanguage === "fr" ? "fr" : "en",
    // Official dates are never invented, even in the demo.
    examDate: null,
    registrationDeadline: null,
    sourceUrl: null,
    verifiedAt: null,
    program: programOf(exam),
    tracks: exam.tracks.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      subjects: t.subjects.map(({ subjectId, coefficient }) => {
        const subject = subjectsById.get(subjectId)!;
        return { id: subject.id, slug: subject.slug, name: subject.name, icon: subject.icon, coefficient };
      }),
    })),
  };
}

function findTrack(trackId: string) {
  for (const exam of content.exams) {
    const track = exam.tracks.find((t) => t.id === trackId);
    if (track) return { exam, track };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-user state
// ---------------------------------------------------------------------------

interface StoredMastery {
  score: number;
  confidence: number;
  attemptsCount: number;
  lastPracticedAt: string | null;
}
interface DemoAttempt {
  id: string;
  clientAttemptId: string;
  mode: AttemptMode;
  trackId: string;
  subjectId: string;
  chapterId: string | null;
  questionIds: string[];
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  saved: Record<string, AnswerInputDto>;
  graded: Record<string, boolean>;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  durationSeconds: number | null;
}
interface DemoState {
  profile: ProfileDto;
  completions: Record<string, string>;
  mastery: Record<string, StoredMastery>;
  streak: StreakState;
  daily: Record<string, number>;
  attempts: Record<string, DemoAttempt>;
}

export const DEMO_ACCOUNT = {
  email: "demo@eduprep.africa",
  password: "Demo1234!",
  displayName: "Amina",
  userId: "5eed0000-0000-4000-8000-000000000001",
};


function loadState(userId: string): DemoState {
  const state = store.get<DemoState>(stateKey(userId));
  if (!state) throw new ApiError(401, "unauthenticated", "Sign in required");
  // Accounts created before messaging existed get a friend code on first use.
  state.profile.friendCode ??= claimFriendCode(userId);
  return state;
}

function saveState(userId: string, state: DemoState) {
  store.set(stateKey(userId), state);
}

function profileDto(state: DemoState): ProfileDto {
  return {
    ...state.profile,
    programSettings: state.profile.programSettings ?? null,
    canChangeProgram: canChangeProgram(state.profile.onboardingCompleted, state.profile.role),
  };
}

/** Subjects this learner studies in the given track (GCE subject choice or the whole track). */
function activeSubjects(state: DemoState, trackId: string): Set<string> {
  const found = findTrack(trackId);
  if (!found) return new Set();
  const settings = state.profile.targetTrackId === trackId ? state.profile.programSettings : null;
  return new Set(activeSubjectIds(programOf(found.exam), found.track.subjects.map((s) => s.subjectId), settings));
}

const toMastery = (m: StoredMastery): MasteryState => ({
  score: m.score,
  confidence: m.confidence,
  attemptsCount: m.attemptsCount,
  lastPracticedAt: m.lastPracticedAt ? new Date(m.lastPracticedAt) : null,
});

/** Creates a user's demo state on first sign-in. The demo account starts with some history. */
export function ensureDemoUserState(userId: string, displayName: string, locale: Locale): void {
  if (store.get(stateKey(userId))) return;
  const now = new Date();
  const profile: ProfileDto = {
    id: userId,
    displayName,
    preferredLanguage: locale,
    role: "student",
    countryCode: "CM",
    educationLevel: null,
    schoolName: null,
    timezone: "Africa/Douala",
    targetExamId: null,
    targetTrackId: null,
    dailyGoalMinutes: 30,
    onboardingCompleted: false,
    programSettings: null,
    canChangeProgram: true,
    friendCode: claimFriendCode(userId, userId === DEMO_ACCOUNT.userId ? "AMNA27" : undefined),
  };
  const state: DemoState = {
    profile,
    completions: {},
    mastery: {},
    streak: { currentDays: 0, bestDays: 0, lastActivityDate: null },
    daily: {},
    attempts: {},
  };

  if (userId === DEMO_ACCOUNT.userId) {
    const bac = content.exams.find((e) => e.slug === "cm-bac")!;
    const serieD = bac.tracks.find((t) => t.slug === "serie-d")!;
    const [complexes, mendel] = content.chapters.filter((c) => c.trackId === serieD.id);
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const yesterday = localDate(daysAgo(1), profile.timezone);

    state.profile = {
      ...profile,
      targetExamId: bac.id,
      targetTrackId: serieD.id,
      onboardingCompleted: true,
      programSettings: { targetAverage: 14 },
    };
    if (complexes) {
      state.completions[complexes.lessons[0]!.id] = daysAgo(3).toISOString();
      state.mastery[complexes.id] = { score: 0.42, confidence: 0.39, attemptsCount: 6, lastPracticedAt: daysAgo(3).toISOString() };
    }
    if (mendel) {
      state.mastery[mendel.id] = { score: 0.82, confidence: 0.34, attemptsCount: 5, lastPracticedAt: daysAgo(50).toISOString() };
    }
    state.streak = { currentDays: 2, bestDays: 5, lastActivityDate: yesterday };
    // Study history (days ago → minutes); day 3 is skipped so the current streak is 2 days.
    const history: [number, number][] = [
      [1, 25], [2, 40], [4, 30], [5, 55], [6, 20], [8, 35], [9, 15], [11, 45], [12, 30], [15, 20], [18, 40], [20, 25],
    ];
    for (const [ago, minutes] of history) state.daily[localDate(daysAgo(ago), profile.timezone)] = minutes * 60;
  }
  saveState(userId, state);
  if (userId === DEMO_ACCOUNT.userId) seedDemoConversations(userId, now);
}

// ---------------------------------------------------------------------------
// Helpers mirroring the real services
// ---------------------------------------------------------------------------

function parse<T>(schema: ZodType<T>, body: unknown): T {
  try {
    return schema.parse(body ?? {});
  } catch (err) {
    if (err instanceof ZodError) throw new ApiError(422, "validation_error", err.issues.map((i) => i.message).join("; "));
    throw err;
  }
}

function retained(state: DemoState, chapterId: string, now: Date): number {
  const m = state.mastery[chapterId];
  return m ? retainedScore(toMastery(m), now) : 0;
}

function trackChapters(trackId: string) {
  return content.chapters.filter((c) => c.trackId === trackId).sort((a, b) => a.orderIndex - b.orderIndex);
}

function subjectSummaries(state: DemoState, trackId: string, now: Date): SubjectSummaryDto[] {
  const found = findTrack(trackId);
  if (!found) throw new ApiError(404, "not_found", "Track not found");
  const chapters = trackChapters(trackId);
  const active = activeSubjects(state, trackId);
  const targets = state.profile.targetTrackId === trackId ? (state.profile.programSettings?.targetGrades ?? {}) : {};
  return found.track.subjects.filter(({ subjectId }) => active.has(subjectId)).map(({ subjectId, coefficient }) => {
    const subject = subjectsById.get(subjectId)!;
    const own = chapters.filter((c) => c.subjectId === subjectId);
    const practicable = own.filter((c) => c.questions.length > 0);
    const mastery = practicable.length ? practicable.reduce((sum, c) => sum + retained(state, c.id, now), 0) / practicable.length : 0;
    return {
      id: subject.id,
      slug: subject.slug,
      name: subject.name,
      icon: subject.icon,
      coefficient,
      chapterCount: own.length,
      mastery: Math.round(mastery * 1000) / 1000,
      targetGrade: targets[subjectId] ?? null,
    };
  });
}

function chaptersFor(state: DemoState, trackId: string, subjectId: string, now: Date): ChapterDto[] {
  return trackChapters(trackId)
    .filter((c) => c.subjectId === subjectId)
    .map((c) => ({
      id: c.id,
      subjectId: c.subjectId,
      title: c.title,
      orderIndex: c.orderIndex,
      mastery: retained(state, c.id, now),
      questionCount: c.questions.length,
      lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, estimatedMinutes: l.estimatedMinutes, completed: Boolean(state.completions[l.id]) })),
    }));
}

function recordStudy(state: DemoState, at: Date, seconds: number) {
  const day = localDate(at, state.profile.timezone);
  state.daily[day] = (state.daily[day] ?? 0) + Math.max(0, seconds);
  state.streak = recordActivity(state.streak, day);
}

function dashboard(state: DemoState, now: Date): DashboardDto {
  const today = localDate(now, state.profile.timezone);
  const exam = content.exams.find((e) => e.id === state.profile.targetExamId);
  const trackId = state.profile.targetTrackId;
  const subjects = trackId ? subjectSummaries(state, trackId, now) : [];
  const active = trackId ? activeSubjects(state, trackId) : new Set<string>();
  const chapters = trackId ? trackChapters(trackId).filter((c) => active.has(c.subjectId)) : [];
  const found = trackId ? findTrack(trackId) : null;
  const coef = new Map((found?.track.subjects ?? []).map((s) => [s.subjectId, s.coefficient]));

  const recs = recommendChapters(
    chapters.map((c) => ({
      chapterId: c.id,
      subjectId: c.subjectId,
      coefficient: coef.get(c.subjectId) ?? 1,
      orderIndex: c.orderIndex,
      hasQuestions: c.questions.length > 0,
      mastery: state.mastery[c.id] ? toMastery(state.mastery[c.id]!) : null,
    })),
    now,
    3,
  ).map((r) => {
    const ch = chaptersById.get(r.chapterId)!;
    return { chapterId: r.chapterId, chapterTitle: ch.title, subjectName: subjectsById.get(ch.subjectId)!.name, mastery: r.mastery, reason: r.reason };
  });

  const preferred = [...recs.map((r) => r.chapterId), ...chapters.map((c) => c.id)];
  let continueLesson: DashboardDto["continueLesson"] = null;
  for (const chapterId of preferred) {
    const ch = chaptersById.get(chapterId)!;
    const lesson = ch.lessons.find((l) => !state.completions[l.id]);
    if (lesson) {
      continueLesson = { id: lesson.id, title: lesson.title, chapterTitle: ch.title };
      break;
    }
  }

  const streak = displayedStreak(state.streak, today);
  const examInfo = exam ? examDto(exam) : null;
  return {
    profile: profileDto(state),
    exam: examInfo,
    daysUntilExam: daysUntil(examInfo?.examDate ?? null, now, state.profile.timezone),
    streak: { ...streak, bestDays: state.streak.bestDays },
    todayMinutes: Math.round((state.daily[today] ?? 0) / 60),
    continueLesson,
    recommendations: recs,
    subjects: [...subjects].sort((a, b) => Number(b.chapterCount > 0) - Number(a.chapterCount > 0)),
    overallMastery: weightedMastery(subjects.filter((s) => s.chapterCount > 0)),
    activity: Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
      const date = addDays(today, i - (ACTIVITY_DAYS - 1));
      return { date, minutes: Math.round((state.daily[date] ?? 0) / 60) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function attemptView(state: DemoState, attempt: DemoAttempt): { attempt: QuizAttemptDto; result: AttemptResultDto | null } {
  const questions = attempt.questionIds.map((id) => questionsById.get(id)!).filter(Boolean);
  const dto: QuizAttemptDto = {
    id: attempt.id,
    mode: attempt.mode,
    chapterId: attempt.chapterId,
    subjectId: attempt.subjectId,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    submittedAt: attempt.submittedAt,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      difficulty: q.difficulty,
      sourceType: "original",
      sourceYear: null,
      options: (q.type === "true_false" ? q.options : seededShuffle(q.options, `${attempt.id}:${q.id}`)).map((o) => ({ id: o.id, text: o.text })),
    })),
    savedAnswers: Object.values(attempt.saved),
  };
  if (!attempt.submittedAt) return { attempt: dto, result: null };

  const breakdown = new Map<string, { correct: number; total: number }>();
  const results = questions.map((q) => {
    const answer = attempt.saved[q.id];
    const correct = attempt.graded[q.id] ?? false;
    const b = breakdown.get(q.chapterId) ?? { correct: 0, total: 0 };
    b.total++;
    if (correct) b.correct++;
    breakdown.set(q.chapterId, b);
    return {
      questionId: q.id,
      answered: Boolean(answer && (answer.numericValue !== undefined || (answer.selectedOptionIds?.length ?? 0) > 0)),
      correct,
      selectedOptionIds: answer?.selectedOptionIds ?? [],
      numericValue: answer?.numericValue ?? null,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      correctNumericValue: q.type === "numeric" ? q.numericAnswer : null,
      explanation: q.explanation,
    };
  });

  return {
    attempt: dto,
    result: {
      attemptId: attempt.id,
      mode: attempt.mode,
      score: attempt.score ?? 0,
      maxScore: attempt.maxScore ?? questions.length,
      percentage: attempt.percentage ?? 0,
      durationSeconds: attempt.durationSeconds ?? 0,
      submittedAt: attempt.submittedAt,
      results,
      chapterBreakdown: [...breakdown.entries()].map(([chapterId, b]) => ({ chapterId, title: chaptersById.get(chapterId)!.title, ...b })),
      masteryAfter: [...breakdown.keys()]
        .filter((id) => state.mastery[id])
        .map((chapterId) => ({ chapterId, mastery: state.mastery[chapterId]!.score })),
    },
  };
}

function startAttempt(state: DemoState, body: unknown, now: Date) {
  const input = parse(startAttemptSchema, body);
  const existing = Object.values(state.attempts).find((a) => a.clientAttemptId === input.clientAttemptId);
  if (existing) return attemptView(state, existing);

  let trackId: string;
  let subjectId: string;
  let chapters: DemoChapter[];
  if (input.chapterId) {
    const ch = chaptersById.get(input.chapterId);
    if (!ch) throw new ApiError(404, "not_found", "Chapter not found");
    trackId = ch.trackId;
    subjectId = ch.subjectId;
    chapters = [ch];
  } else {
    if (!state.profile.targetTrackId) throw new ApiError(422, "no_track", "Choose an exam track first");
    trackId = state.profile.targetTrackId;
    subjectId = input.subjectId!;
    chapters = trackChapters(trackId).filter((c) => c.subjectId === subjectId);
  }

  // Demo content has no official past papers, matching what the real API would report.
  const candidates = input.mode === "past_paper" ? [] : chapters.flatMap((c) => c.questions.map((q) => q.id));
  if (candidates.length === 0) {
    throw new ApiError(
      404,
      "no_questions",
      input.mode === "past_paper" ? "No past-paper questions are available here yet" : "No questions are available here yet",
    );
  }

  const everWrong = new Set<string>();
  const seen = new Set<string>();
  for (const a of Object.values(state.attempts)) {
    for (const [qid, ok] of Object.entries(a.graded)) {
      seen.add(qid);
      if (!ok) everWrong.add(qid);
    }
  }
  const unseen = candidates.filter((id) => !seen.has(id));
  const wrong = candidates.filter((id) => everWrong.has(id));
  const right = candidates.filter((id) => seen.has(id) && !everWrong.has(id));
  const questionIds = [...shuffle(unseen), ...shuffle(wrong), ...shuffle(right)].slice(0, input.questionCount);

  const attempt: DemoAttempt = {
    id: randomId(),
    clientAttemptId: input.clientAttemptId,
    mode: input.mode,
    trackId,
    subjectId,
    chapterId: input.chapterId ?? null,
    questionIds,
    startedAt: now.toISOString(),
    deadlineAt: input.mode === "mock" ? new Date(now.getTime() + questionIds.length * 90_000).toISOString() : null,
    submittedAt: null,
    saved: {},
    graded: {},
    score: null,
    maxScore: null,
    percentage: null,
    durationSeconds: null,
  };
  state.attempts[attempt.id] = attempt;
  return attemptView(state, attempt);
}

function getAttempt(state: DemoState, id: string): DemoAttempt {
  const attempt = state.attempts[id];
  if (!attempt) throw new ApiError(404, "not_found", "Attempt not found");
  return attempt;
}

function onlyOwnQuestions(attempt: DemoAttempt, answers: AnswerInputDto[]) {
  return answers.filter((a) => attempt.questionIds.includes(a.questionId));
}

function saveAnswers(state: DemoState, id: string, body: unknown, now: Date) {
  const attempt = getAttempt(state, id);
  const { answers } = parse(saveAnswersSchema, body);
  if (attempt.submittedAt) throw new ApiError(409, "already_submitted", "This attempt has already been submitted");
  if (!acceptsAnswersAt(attempt.deadlineAt ? new Date(attempt.deadlineAt) : null, now)) throw new ApiError(409, "time_up", "Time is up");
  const valid = onlyOwnQuestions(attempt, answers);
  for (const a of valid) attempt.saved[a.questionId] = a;
  return { saved: valid.length };
}

function submitAttempt(state: DemoState, id: string, body: unknown, now: Date) {
  const attempt = getAttempt(state, id);
  if (attempt.submittedAt) return { result: attemptView(state, attempt).result! };
  const { answers: incoming } = parse(submitAttemptSchema, body);

  const deadline = attempt.deadlineAt ? new Date(attempt.deadlineAt) : null;
  const accepted = acceptsAnswersAt(deadline, now) ? onlyOwnQuestions(attempt, incoming) : [];
  const answers = mergeAnswers(Object.values(attempt.saved), accepted);
  const questions = attempt.questionIds.map((qid) => questionsById.get(qid)!);
  const summary = scoreAttempt(
    questions.map((q) => ({
      id: q.id,
      type: q.type,
      options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
      numericAnswer: q.numericAnswer,
      numericTolerance: q.numericTolerance,
    })),
    answers,
  );

  attempt.saved = Object.fromEntries(answers.map((a) => [a.questionId, a]));
  attempt.graded = Object.fromEntries(summary.results.map((r) => [r.questionId, r.correct]));
  const endedAt = deadline && now > deadline ? deadline : now;
  attempt.durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000));
  attempt.submittedAt = now.toISOString();
  attempt.score = summary.score;
  attempt.maxScore = summary.maxScore;
  attempt.percentage = summary.percentage;

  const evidence = new Map<string, MasteryEvidence[]>();
  for (const q of questions) {
    const answer = attempt.saved[q.id];
    if (!answer && attempt.mode !== "mock") continue;
    const list = evidence.get(q.chapterId) ?? [];
    list.push({
      correct: attempt.graded[q.id] ?? false,
      difficulty: q.difficulty,
      responseMs: answer?.responseMs,
      hintsUsed: answer?.hintsUsed,
      mode: attempt.mode,
    });
    evidence.set(q.chapterId, list);
  }
  for (const [chapterId, list] of evidence) {
    const prev = state.mastery[chapterId] ? toMastery(state.mastery[chapterId]!) : EMPTY_MASTERY;
    const next = updateMastery(prev, list, now);
    state.mastery[chapterId] = {
      score: next.score,
      confidence: next.confidence,
      attemptsCount: next.attemptsCount,
      lastPracticedAt: next.lastPracticedAt?.toISOString() ?? null,
    };
  }
  recordStudy(state, now, Math.min(attempt.durationSeconds, 3 * 60 * 60));
  return { result: attemptView(state, attempt).result! };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type Handler = (ctx: { state: DemoState; params: string[]; body: unknown; now: Date }) => unknown;

const routes: [method: string, pattern: RegExp, handler: Handler][] = [
  ["GET", /^\/health$/, () => ({ ok: true, service: "eduprep-demo" })],
  ["GET", /^\/me$/, ({ state }) => ({ profile: profileDto(state) })],
  [
    "PATCH",
    /^\/me$/,
    ({ state, body }) => {
      const input = parse(updateProfileSchema, body);
      const p = { ...state.profile };
      const locked = !canChangeProgram(p.onboardingCompleted, p.role);
      const nextExam = input.targetExamId !== undefined ? input.targetExamId : p.targetExamId;
      const nextTrack =
        input.targetTrackId !== undefined ? input.targetTrackId : input.targetExamId !== undefined && input.targetExamId !== p.targetExamId ? null : p.targetTrackId;
      const programChanged = nextExam !== p.targetExamId || nextTrack !== p.targetTrackId;
      if (locked && programChanged) {
        throw new ApiError(403, "program_locked", "Your exam is locked. Message the EduPrep team if you need to change it.");
      }
      if (locked && input.onboardingCompleted === false) {
        throw new ApiError(403, "program_locked", "Onboarding can't be restarted once your exam is set.");
      }
      if (programChanged) p.programSettings = null;
      if (input.targetExamId !== undefined) {
        if (input.targetExamId && !content.exams.some((e) => e.id === input.targetExamId)) throw new ApiError(422, "invalid_exam", "Unknown exam");
        if (input.targetExamId !== p.targetExamId && input.targetTrackId === undefined) p.targetTrackId = null;
        p.targetExamId = input.targetExamId;
      }
      if (input.targetTrackId !== undefined) {
        if (input.targetTrackId) {
          const found = findTrack(input.targetTrackId);
          if (!found || found.exam.id !== p.targetExamId) throw new ApiError(422, "invalid_track", "Track does not belong to the selected exam");
        }
        p.targetTrackId = input.targetTrackId;
      }
      if (input.displayName !== undefined) p.displayName = input.displayName;
      if (input.preferredLanguage !== undefined) p.preferredLanguage = input.preferredLanguage;
      if (input.timezone !== undefined) p.timezone = input.timezone;
      if (input.dailyGoalMinutes !== undefined) p.dailyGoalMinutes = input.dailyGoalMinutes;
      if (input.programSettings !== undefined) {
        const found = p.targetTrackId ? findTrack(p.targetTrackId) : null;
        if (!found) throw new ApiError(422, "no_program", "Choose an exam and a track first");
        try {
          p.programSettings = normalizeProgramSettings(
            programOf(found.exam),
            found.track.subjects.map((sub) => sub.subjectId),
            input.programSettings,
          );
        } catch (err) {
          if (err instanceof ProgramSettingsError) throw new ApiError(422, "invalid_program_settings", err.message);
          throw err;
        }
      }
      if (input.onboardingCompleted !== undefined) {
        if (input.onboardingCompleted && !(p.targetExamId && p.targetTrackId)) {
          throw new ApiError(422, "onboarding_incomplete", "Select an exam and a track to finish onboarding");
        }
        const exam = content.exams.find((e) => e.id === p.targetExamId);
        if (input.onboardingCompleted && !state.profile.onboardingCompleted && programOf(exam).kind === "grades" && !p.programSettings?.subjects?.length) {
          throw new ApiError(422, "subjects_required", "Choose the subjects you are sitting");
        }
        p.onboardingCompleted = input.onboardingCompleted;
      }
      state.profile = p;
      return { profile: profileDto(state) };
    },
  ],
  ["GET", /^\/me\/dashboard$/, ({ state, now }) => dashboard(state, now)],
  [
    "GET",
    /^\/me\/attempts$/,
    ({ state }) => ({
      attempts: Object.values(state.attempts)
        .filter((a) => a.submittedAt)
        .sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))
        .slice(0, 20)
        .map((a) => ({
          id: a.id,
          mode: a.mode,
          title: a.chapterId ? chaptersById.get(a.chapterId)!.title : subjectsById.get(a.subjectId)!.name,
          submittedAt: a.submittedAt!,
          score: a.score ?? 0,
          maxScore: a.maxScore ?? 0,
          percentage: a.percentage ?? 0,
        })),
    }),
  ],
  ["GET", /^\/tracks\/([^/]+)\/subjects$/, ({ state, params, now }) => ({ subjects: subjectSummaries(state, params[0]!, now) })],
  [
    "GET",
    /^\/tracks\/([^/]+)\/subjects\/([^/]+)\/chapters$/,
    ({ state, params, now }) => {
      const subject = subjectsById.get(params[1]!);
      if (!subject) throw new ApiError(404, "not_found", "Subject not found");
      return {
        subject: { id: subject.id, name: subject.name, icon: subject.icon },
        chapters: chaptersFor(state, params[0]!, params[1]!, now),
      };
    },
  ],
  [
    "GET",
    /^\/lessons\/([^/]+)$/,
    ({ state, params }) => {
      const lesson = lessonsById.get(params[0]!);
      if (!lesson) throw new ApiError(404, "not_found", "Lesson not found");
      return {
        lesson: {
          id: lesson.id,
          chapterId: lesson.chapterId,
          title: lesson.title,
          body: lesson.body,
          estimatedMinutes: lesson.estimatedMinutes,
          version: 1,
          completed: Boolean(state.completions[lesson.id]),
        },
      };
    },
  ],
  [
    "POST",
    /^\/lessons\/([^/]+)\/complete$/,
    ({ state, params, body, now }) => {
      const lesson = lessonsById.get(params[0]!);
      if (!lesson) throw new ApiError(404, "not_found", "Lesson not found");
      const input = parse(completeLessonSchema, body);
      if (state.completions[lesson.id]) return { completed: true, firstCompletion: false };
      const at = input.completedAt && daysBetween(localDate(new Date(input.completedAt)), localDate(now)) <= 7 ? new Date(input.completedAt) : now;
      state.completions[lesson.id] = at.toISOString();
      recordStudy(state, at, Math.min(input.secondsSpent, lesson.estimatedMinutes * 180));
      return { completed: true, firstCompletion: true };
    },
  ],
  ["POST", /^\/quiz-attempts$/, ({ state, body, now }) => startAttempt(state, body, now)],
  ["GET", /^\/quiz-attempts\/([^/]+)$/, ({ state, params }) => attemptView(state, getAttempt(state, params[0]!))],
  ["POST", /^\/quiz-attempts\/([^/]+)\/answers$/, ({ state, params, body, now }) => saveAnswers(state, params[0]!, body, now)],
  ["POST", /^\/quiz-attempts\/([^/]+)\/submit$/, ({ state, params, body, now }) => submitAttempt(state, params[0]!, body, now)],
];

export async function demoRequest<T>(method: string, path: string, body: unknown, userId: string | null): Promise<T> {
  // A short delay so loading states look like they would over a real network.
  await new Promise((r) => setTimeout(r, 150));

  if (method === "GET" && path === "/exams") {
    return JSON.parse(JSON.stringify({ exams: content.exams.map(examDto) })) as T;
  }
  if (userId) {
    loadState(userId);
    const messaging = handleMessaging(method, path, userId, body, new Date());
    if (messaging) return JSON.parse(JSON.stringify(messaging.result)) as T;
  }
  for (const [m, pattern, handler] of routes) {
    const match = m === method ? pattern.exec(path) : null;
    if (!match) continue;
    if (!userId) throw new ApiError(401, "unauthenticated", "Sign in required");
    const state = loadState(userId);
    const result = handler({ state, params: match.slice(1), body, now: new Date() });
    saveState(userId, state);
    return JSON.parse(JSON.stringify(result)) as T;
  }
  throw new ApiError(404, "not_found", `No demo route for ${method} ${path}`);
}
