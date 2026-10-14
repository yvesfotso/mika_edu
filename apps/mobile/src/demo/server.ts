/**
 * Simulated EduPrep API for demo mode. Implements the same /api/v1 endpoints and response
 * shapes as apps/admin, using the shared rules from @eduprep/core (scoring, mastery states,
 * mistake recovery, the Today plan) and the pilot content from content.json. State lives in this
 * device's storage.
 */
import {
  activeSubjectIds,
  assemblePlanInput,
  buildProgressDto,
  canChangeProgram,
  chapterProgressOf,
  checkpointAnswerSchema,
  computeSkillProgress,
  contentReportSchema,
  DEFAULT_PROGRAM,
  isAnswerCorrect,
  isAnswered,
  lessonProgressSchema,
  NO_HINT_MODES,
  normalizeProgramSettings,
  offlineAttemptSchema,
  packVersion,
  planToday,
  ProgramSettingsError,
  programConfigSchema,
  recoveryUpdates,
  skillKeyFor,
  subjectSkillTotals,
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
  type AttemptQuestionDto,
  type AttemptResultDto,
  type ChapterDto,
  type CheckpointResultDto,
  type CurriculumShape,
  type DashboardDto,
  type DiagnosticStatus,
  type ExamDto,
  type LearnerEvidence,
  type LessonDto,
  type Locale,
  type LocalizedText,
  type MasteryEvidence,
  type MasteryState,
  type MistakeDto,
  type MistakeStatus,
  type PackQuestionDto,
  type ProfileDto,
  type QuestionPurpose,
  type QuestionType,
  type QuizAttemptDto,
  type StreakState,
  type StudyPackDto,
  type SubjectSummaryDto,
  type TodayPlanDto,
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
  skillId: string | null;
  purpose: QuestionPurpose;
  version: number;
  options: { id: string; text: LocalizedText; isCorrect: boolean; misconception: LocalizedText | null }[];
  numericAnswer: number | null;
  numericTolerance: number | null;
  explanation: LocalizedText;
  hint: LocalizedText | null;
}
interface DemoLesson {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  estimatedMinutes: number;
  checkpoints: { questionId: string; afterBlock: number }[];
}
interface DemoChapter {
  id: string;
  trackId: string;
  subjectId: string;
  title: LocalizedText;
  orderIndex: number;
  skills: { id: string; name: LocalizedText }[];
  lessons: DemoLesson[];
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
const skillNames = new Map(content.chapters.flatMap((c) => c.skills.map((s) => [s.id, s.name] as const)));
type Question = DemoQuestion & { chapterId: string };

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
  subjectId: string | null;
  chapterId: string | null;
  skillId?: string | null;
  lessonId?: string | null;
  offline?: boolean;
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
/** One graded answer: the append-only evidence log. */
interface DemoAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  answer: AnswerInputDto;
  correct: boolean;
  hintsUsed: number;
  version: number;
  countsAsEvidence: boolean;
  answeredAt: string;
  mode: AttemptMode;
}
interface DemoMistake {
  id: string;
  answerId: string;
  attemptId: string;
  questionId: string;
  questionVersion: number;
  chapterId: string;
  skillId: string | null;
  response: AnswerInputDto;
  misconception: LocalizedText | null;
  createdAt: string;
  reviewedAt: string | null;
  retriedCorrectAt: string | null;
  recoveredAt: string | null;
}
interface DemoReport {
  id: string;
  questionId: string | null;
  lessonId: string | null;
  reason: string;
  message: string | null;
  createdAt: string;
  status: "open";
}
interface DemoState {
  profile: ProfileDto;
  completions: Record<string, string>;
  mastery: Record<string, StoredMastery>;
  streak: StreakState;
  daily: Record<string, number>;
  attempts: Record<string, DemoAttempt>;
  answers: DemoAnswer[];
  mistakes: DemoMistake[];
  lessonProgress: Record<string, number>;
  reports: DemoReport[];
}

export const DEMO_ACCOUNT = {
  email: "demo@eduprep.africa",
  password: "Demo1234!",
  displayName: "Amina",
  userId: "5eed0000-0000-4000-8000-000000000001",
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function loadState(userId: string): DemoState {
  const state = store.get<DemoState>(stateKey(userId));
  if (!state) throw new ApiError(401, "unauthenticated", "Sign in required");
  // Accounts created before messaging or the learning loop existed get the new fields on first use.
  state.profile.friendCode ??= claimFriendCode(userId);
  state.profile.studyDays ??= ALL_DAYS;
  state.profile.diagnosticStatus ??= state.profile.onboardingCompleted ? "skipped" : "pending";
  state.answers ??= [];
  state.mistakes ??= [];
  state.lessonProgress ??= {};
  state.reports ??= [];
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
    studyDays: ALL_DAYS,
    diagnosticStatus: "pending",
  };
  const state: DemoState = {
    profile,
    completions: {},
    mastery: {},
    streak: { currentDays: 0, bestDays: 0, lastActivityDate: null },
    daily: {},
    attempts: {},
    answers: [],
    mistakes: [],
    lessonProgress: {},
    reports: [],
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
      diagnosticStatus: "skipped",
    };
    if (complexes) {
      state.completions[complexes.lessons[0]!.id] = daysAgo(3).toISOString();
      state.mastery[complexes.id] = { score: 0.42, confidence: 0.39, attemptsCount: 6, lastPracticedAt: daysAgo(3).toISOString() };
      seedDemoPractice(state, complexes, daysAgo(3));
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

/**
 * The demo account's earlier practice set on complex numbers: two modulus/argument answers right and
 * the conjugate of 2 − 5i wrong, so the mistake notebook and the Today plan have something to show.
 */
function seedDemoPractice(state: DemoState, chapter: DemoChapter, at: Date) {
  const pick = (en: string) => chapter.questions.find((q) => q.prompt.en?.startsWith(en));
  const modulus = pick("Modulus of z = 3 + 4i");
  const argument = pick("An argument of i");
  const conjugate = pick("Conjugate of 2 − 5i");
  if (!modulus || !argument || !conjugate) return;
  const wrongOption = conjugate.options.find((o) => !o.isCorrect && o.misconception)!;
  const answers: AnswerInputDto[] = [
    { questionId: modulus.id, numericValue: modulus.numericAnswer! },
    { questionId: conjugate.id, selectedOptionIds: [wrongOption.id] },
    { questionId: argument.id, selectedOptionIds: argument.options.filter((o) => o.isCorrect).map((o) => o.id) },
  ];
  const attempt: DemoAttempt = {
    id: randomId(),
    clientAttemptId: randomId(),
    mode: "practice",
    trackId: chapter.trackId,
    subjectId: chapter.subjectId,
    chapterId: chapter.id,
    questionIds: answers.map((a) => a.questionId),
    startedAt: new Date(at.getTime() - 6 * 60_000).toISOString(),
    deadlineAt: null,
    submittedAt: at.toISOString(),
    saved: {},
    graded: {},
    score: 2,
    maxScore: 3,
    percentage: 66.7,
    durationSeconds: 360,
  };
  for (const a of answers) {
    const q = questionsById.get(a.questionId)!;
    attempt.saved[a.questionId] = a;
    attempt.graded[a.questionId] = isAnswerCorrect(scorable(q), a);
  }
  state.attempts[attempt.id] = attempt;
  recordGraded(
    state,
    attempt,
    answers.map((a) => ({ answer: a, correct: attempt.graded[a.questionId]!, version: 1, countsAsEvidence: true, answeredAt: at })),
  );
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

const scorable = (q: DemoQuestion) => ({
  id: q.id,
  type: q.type,
  options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
  numericAnswer: q.numericAnswer,
  numericTolerance: q.numericTolerance,
});

function learnerQuestion(q: DemoQuestion, seed: string, mode: AttemptMode): AttemptQuestionDto {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    sourceType: "original",
    sourceYear: null,
    options: (q.type === "true_false" ? q.options : seededShuffle(q.options, `${seed}:${q.id}`)).map((o) => ({ id: o.id, text: o.text })),
    version: q.version,
    skillId: q.skillId,
    hint: !NO_HINT_MODES.includes(mode) ? q.hint : null,
  };
}

function misconceptionFor(q: DemoQuestion, answer: AnswerInputDto | undefined): LocalizedText | null {
  const picked = answer?.selectedOptionIds ?? [];
  if (picked.length !== 1) return null;
  return q.options.find((o) => o.id === picked[0] && !o.isCorrect)?.misconception ?? null;
}

function retained(state: DemoState, chapterId: string, now: Date): number {
  const m = state.mastery[chapterId];
  return m ? retainedScore(toMastery(m), now) : 0;
}

function trackChapters(trackId: string) {
  return content.chapters.filter((c) => c.trackId === trackId).sort((a, b) => a.orderIndex - b.orderIndex);
}

function curriculumOf(trackId: string): CurriculumShape {
  const chapters = trackChapters(trackId);
  return {
    chapters: chapters.map((c) => ({ id: c.id, subjectId: c.subjectId, title: c.title })),
    skills: chapters.flatMap((c) => c.skills.map((s) => ({ id: s.id, chapterId: c.id, name: s.name }))),
    questions: chapters.flatMap((c) => c.questions.map((q) => ({ id: q.id, chapterId: c.id, skillId: q.skillId, purpose: q.purpose }))),
    lessons: chapters.flatMap((c) => c.lessons.map((l) => ({ id: l.id, chapterId: c.id }))),
  };
}

function evidenceOf(state: DemoState): LearnerEvidence[] {
  return state.answers
    .filter((a) => a.countsAsEvidence)
    .map((a) => {
      const q = questionsById.get(a.questionId)!;
      return { questionId: a.questionId, chapterId: q.chapterId, skillId: q.skillId, correct: a.correct, hintsUsed: a.hintsUsed, at: new Date(a.answeredAt), mode: a.mode };
    });
}

const openMistakes = (state: DemoState) => state.mistakes.filter((m) => !m.recoveredAt);
const completedSet = (state: DemoState) => new Set(Object.keys(state.completions));

function learning(state: DemoState, trackId: string, now: Date) {
  const curriculum = curriculumOf(trackId);
  return { curriculum, progress: computeSkillProgress(curriculum, evidenceOf(state), now, state.profile.timezone) };
}

function subjectSummaries(state: DemoState, trackId: string, now: Date): SubjectSummaryDto[] {
  const found = findTrack(trackId);
  if (!found) throw new ApiError(404, "not_found", "Track not found");
  const chapters = trackChapters(trackId);
  const active = activeSubjects(state, trackId);
  const targets = state.profile.targetTrackId === trackId ? (state.profile.programSettings?.targetGrades ?? {}) : {};
  const { curriculum, progress } = learning(state, trackId, now);
  return found.track.subjects.filter(({ subjectId }) => active.has(subjectId)).map(({ subjectId, coefficient }) => {
    const subject = subjectsById.get(subjectId)!;
    const own = chapters.filter((c) => c.subjectId === subjectId);
    const practicable = own.filter((c) => c.questions.some((q) => q.purpose === "practice"));
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
      skillTotals: subjectSkillTotals(curriculum, progress, subjectId),
    };
  });
}

function chaptersFor(state: DemoState, trackId: string, subjectId: string, now: Date): ChapterDto[] {
  const { curriculum, progress } = learning(state, trackId, now);
  const open = openMistakes(state);
  return trackChapters(trackId)
    .filter((c) => c.subjectId === subjectId)
    .map((c) => {
      const p = chapterProgressOf(curriculum, progress, c.id, completedSet(state), open);
      return {
        id: c.id,
        subjectId: c.subjectId,
        title: c.title,
        orderIndex: c.orderIndex,
        mastery: retained(state, c.id, now),
        questionCount: c.questions.filter((q) => q.purpose === "practice").length,
        lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, estimatedMinutes: l.estimatedMinutes, completed: Boolean(state.completions[l.id]) })),
        status: p.status,
        skills: p.skills,
        openMistakes: p.openMistakes,
      };
    });
}

function recordStudy(state: DemoState, at: Date, seconds: number) {
  const day = localDate(at, state.profile.timezone);
  state.daily[day] = (state.daily[day] ?? 0) + Math.max(0, seconds);
  state.streak = recordActivity(state.streak, day);
}

function recommendationsFor(state: DemoState, trackId: string, now: Date) {
  const active = activeSubjects(state, trackId);
  const found = findTrack(trackId);
  const coef = new Map((found?.track.subjects ?? []).map((s) => [s.subjectId, s.coefficient]));
  return recommendChapters(
    trackChapters(trackId)
      .filter((c) => active.has(c.subjectId))
      .map((c) => ({
        chapterId: c.id,
        subjectId: c.subjectId,
        coefficient: coef.get(c.subjectId) ?? 1,
        orderIndex: c.orderIndex,
        hasQuestions: c.questions.some((q) => q.purpose === "practice"),
        mastery: state.mastery[c.id] ? toMastery(state.mastery[c.id]!) : null,
      })),
    now,
    3,
  ).map((r) => {
    const ch = chaptersById.get(r.chapterId)!;
    return { chapterId: r.chapterId, chapterTitle: ch.title, subjectName: subjectsById.get(ch.subjectId)!.name, mastery: r.mastery, reason: r.reason };
  });
}

function todayPlan(state: DemoState, now: Date): TodayPlanDto {
  const trackId = state.profile.targetTrackId;
  const today = localDate(now, state.profile.timezone);
  if (!trackId) {
    return { date: today, sessionMinutes: state.profile.dailyGoalMinutes, studyDay: true, tasks: [], plannedMinutes: 0, doneToday: [], openMistakes: 0 };
  }
  const { curriculum, progress } = learning(state, trackId, now);
  const isToday = (iso: string) => localDate(new Date(iso), state.profile.timezone) === today;
  return planToday(
    assemblePlanInput({
      date: today,
      locale: state.profile.preferredLanguage,
      sessionMinutes: state.profile.dailyGoalMinutes,
      studyDays: state.profile.studyDays,
      diagnosticStatus: state.profile.diagnosticStatus,
      curriculum: {
        ...curriculum,
        lessons: trackChapters(trackId).flatMap((c) =>
          c.lessons.map((l) => ({ id: l.id, chapterId: c.id, title: l.title, body: l.body, minutes: l.estimatedMinutes })),
        ),
      },
      activeSubjects: activeSubjects(state, trackId),
      completedLessons: completedSet(state),
      lessonProgress: new Map(Object.entries(state.lessonProgress)),
      progress,
      openMistakes: openMistakes(state).map((m) => ({
        id: m.id,
        questionId: m.questionId,
        chapterId: m.chapterId,
        skillId: m.skillId,
        createdAt: new Date(m.createdAt),
      })),
      recommendations: recommendationsFor(state, trackId, now),
      todayAttempts: Object.values(state.attempts)
        .filter((a) => a.submittedAt && isToday(a.submittedAt))
        .map((a) => ({ mode: a.mode, chapterId: a.chapterId, skillId: a.skillId ?? null })),
      lessonsCompletedToday: Object.entries(state.completions)
        .filter(([, at]) => isToday(at))
        .map(([id]) => id),
    }),
  );
}

function dashboard(state: DemoState, now: Date): DashboardDto {
  const today = localDate(now, state.profile.timezone);
  const exam = content.exams.find((e) => e.id === state.profile.targetExamId);
  const trackId = state.profile.targetTrackId;
  const subjects = trackId ? subjectSummaries(state, trackId, now) : [];
  const active = trackId ? activeSubjects(state, trackId) : new Set<string>();
  const chapters = trackId ? trackChapters(trackId).filter((c) => active.has(c.subjectId)) : [];
  const recs = trackId ? recommendationsFor(state, trackId, now) : [];

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
    today: todayPlan(state, now),
  };
}

// ---------------------------------------------------------------------------
// Evidence: answers, mistakes, recovery, mastery
// ---------------------------------------------------------------------------

interface GradedInput {
  answer: AnswerInputDto;
  correct: boolean;
  version: number;
  countsAsEvidence: boolean;
  answeredAt: Date;
}

/** Appends graded answers, files wrong ones in the notebook and recovers older mistakes. */
function recordGraded(state: DemoState, attempt: DemoAttempt, rows: GradedInput[]): Map<string, string> {
  const added: DemoAnswer[] = rows.map((r) => ({
    id: randomId(),
    attemptId: attempt.id,
    questionId: r.answer.questionId,
    answer: r.answer,
    correct: r.correct,
    hintsUsed: r.answer.hintsUsed ?? 0,
    version: r.version,
    countsAsEvidence: r.countsAsEvidence,
    answeredAt: r.answeredAt.toISOString(),
    mode: attempt.mode,
  }));
  state.answers.push(...added);
  const counted = added.filter((a) => a.countsAsEvidence);

  const mistakeIds = new Map<string, string>();
  for (const a of counted.filter((x) => !x.correct && isAnswered(x.answer))) {
    const q = questionsById.get(a.questionId)!;
    const mistake: DemoMistake = {
      id: randomId(),
      answerId: a.id,
      attemptId: attempt.id,
      questionId: a.questionId,
      questionVersion: a.version,
      chapterId: q.chapterId,
      skillId: q.skillId,
      response: a.answer,
      misconception: misconceptionFor(q, a.answer),
      createdAt: a.answeredAt,
      reviewedAt: null,
      retriedCorrectAt: null,
      recoveredAt: null,
    };
    state.mistakes.push(mistake);
    mistakeIds.set(a.questionId, mistake.id);
  }

  const updates = recoveryUpdates(
    openMistakes(state).map((m) => ({
      id: m.id,
      questionId: m.questionId,
      skillKey: skillKeyFor(m.skillId, m.chapterId),
      createdAt: new Date(m.createdAt),
      retriedCorrectAt: m.retriedCorrectAt ? new Date(m.retriedCorrectAt) : null,
      attemptId: m.attemptId,
    })),
    counted
      .filter((a) => a.correct)
      .map((a) => {
        const q = questionsById.get(a.questionId)!;
        return {
          questionId: a.questionId,
          skillKey: skillKeyFor(q.skillId, q.chapterId),
          correct: true,
          hintsUsed: a.hintsUsed,
          at: new Date(a.answeredAt),
          answerId: a.id,
          attemptId: attempt.id,
        };
      }),
  );
  for (const u of updates) {
    const m = state.mistakes.find((x) => x.id === u.id)!;
    if (u.retriedCorrectAt) m.retriedCorrectAt = u.retriedCorrectAt.toISOString();
    if (u.recoveredAt) m.recoveredAt = u.recoveredAt.toISOString();
  }
  return mistakeIds;
}

function updateChapterMastery(state: DemoState, mode: AttemptMode, questions: Question[], rows: GradedInput[], now: Date, countSkipped = false) {
  const byQuestion = new Map(rows.map((r) => [r.answer.questionId, r]));
  const evidence = new Map<string, MasteryEvidence[]>();
  for (const q of questions) {
    const row = byQuestion.get(q.id);
    if ((row && !row.countsAsEvidence) || (!row && !countSkipped)) continue;
    const list = evidence.get(q.chapterId) ?? [];
    list.push({ correct: row?.correct ?? false, difficulty: q.difficulty, responseMs: row?.answer.responseMs, hintsUsed: row?.answer.hintsUsed, mode });
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
}

/** Offline answers carry device time: accept it within a week and never in the future. */
function deviceTime(clientTime: string | undefined, now: Date): Date {
  if (!clientTime) return now;
  const t = new Date(clientTime);
  if (Number.isNaN(t.getTime()) || t > now || now.getTime() - t.getTime() > 7 * 86_400_000) return now;
  return t;
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
    questions: questions.map((q) => learnerQuestion(q, attempt.id, attempt.mode)),
    savedAnswers: Object.values(attempt.saved),
  };
  if (!attempt.submittedAt) return { attempt: dto, result: null };

  const mistakesByQuestion = new Map(state.mistakes.filter((m) => m.attemptId === attempt.id).map((m) => [m.questionId, m.id]));
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
      answered: isAnswered(answer),
      correct,
      selectedOptionIds: answer?.selectedOptionIds ?? [],
      numericValue: answer?.numericValue ?? null,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      correctNumericValue: q.type === "numeric" ? q.numericAnswer : null,
      explanation: q.explanation,
      misconception: correct ? null : misconceptionFor(q, answer),
      hintsUsed: answer?.hintsUsed ?? 0,
      mistakeId: mistakesByQuestion.get(q.id) ?? null,
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

/** One easy question per skill of the learner's subjects. */
function diagnosticQuestionIds(state: DemoState): string[] {
  const trackId = state.profile.targetTrackId;
  if (!trackId) throw new ApiError(422, "no_track", "Choose an exam track first");
  const active = activeSubjects(state, trackId);
  const best = new Map<string, DemoQuestion & { chapterId: string }>();
  for (const c of trackChapters(trackId).filter((ch) => active.has(ch.subjectId))) {
    for (const q of c.questions.filter((x) => x.purpose === "practice")) {
      const key = skillKeyFor(q.skillId, c.id);
      const current = best.get(key);
      if (!current || q.difficulty < current.difficulty || (q.difficulty === current.difficulty && q.id < current.id)) best.set(key, { ...q, chapterId: c.id });
    }
  }
  const ids = [...best.values()].map((q) => q.id).slice(0, 8);
  if (ids.length === 0) throw new ApiError(404, "no_questions", "No questions are available for your subjects yet");
  return ids;
}

function startAttempt(state: DemoState, body: unknown, now: Date) {
  const input = parse(startAttemptSchema, body);
  const existing = Object.values(state.attempts).find((a) => a.clientAttemptId === input.clientAttemptId);
  if (existing) return attemptView(state, existing);

  let trackId: string;
  let subjectId: string | null = null;
  let chapterId: string | null = input.chapterId ?? null;
  let questionIds: string[];

  if (input.mode === "diagnostic") {
    trackId = state.profile.targetTrackId ?? "";
    questionIds = diagnosticQuestionIds(state);
  } else {
    let chapters: DemoChapter[];
    if (input.skillId) {
      const ch = content.chapters.find((c) => c.skills.some((s) => s.id === input.skillId));
      if (!ch) throw new ApiError(404, "not_found", "Skill not found");
      trackId = ch.trackId;
      subjectId = ch.subjectId;
      chapterId = ch.id;
      chapters = [ch];
    } else if (input.chapterId) {
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
    const all =
      input.mode === "past_paper"
        ? []
        : chapters.flatMap((c) => c.questions.filter((q) => q.purpose === "practice" && (!input.skillId || q.skillId === input.skillId)).map((q) => q.id));
    const excluded = new Set(input.excludeQuestionIds);
    const candidates = all.filter((id) => !excluded.has(id));
    if (candidates.length === 0) {
      if (input.mode === "recovery" && all.length > 0) throw new ApiError(404, "no_other_questions", "There is no other question on this skill yet");
      throw new ApiError(
        404,
        "no_questions",
        input.mode === "past_paper" ? "No past-paper questions are available here yet" : "No questions are available here yet",
      );
    }

    const everWrong = new Set<string>();
    const seen = new Set<string>();
    for (const a of state.answers) {
      seen.add(a.questionId);
      if (!a.correct) everWrong.add(a.questionId);
    }
    const unseen = candidates.filter((id) => !seen.has(id));
    const wrong = candidates.filter((id) => everWrong.has(id));
    const right = candidates.filter((id) => seen.has(id) && !everWrong.has(id));
    questionIds = [...shuffle(unseen), ...shuffle(wrong), ...shuffle(right)].slice(0, input.questionCount);
  }

  const attempt: DemoAttempt = {
    id: randomId(),
    clientAttemptId: input.clientAttemptId,
    mode: input.mode,
    trackId,
    subjectId,
    chapterId,
    skillId: input.skillId ?? null,
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

function onlyOwnQuestions(attempt: Pick<DemoAttempt, "questionIds">, answers: AnswerInputDto[]) {
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
  const summary = scoreAttempt(questions.map(scorable), answers);

  attempt.saved = Object.fromEntries(answers.map((a) => [a.questionId, a]));
  attempt.graded = Object.fromEntries(summary.results.map((r) => [r.questionId, r.correct]));
  const endedAt = deadline && now > deadline ? deadline : now;
  attempt.durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(attempt.startedAt).getTime()) / 1000));
  attempt.submittedAt = now.toISOString();
  attempt.score = summary.score;
  attempt.maxScore = summary.maxScore;
  attempt.percentage = summary.percentage;

  const rows: GradedInput[] = answers.map((a) => ({
    answer: a,
    correct: attempt.graded[a.questionId] ?? false,
    version: questionsById.get(a.questionId)?.version ?? 1,
    countsAsEvidence: true,
    answeredAt: deviceTime(a.answeredAt, now),
  }));
  updateChapterMastery(state, attempt.mode, questions, rows, now, attempt.mode === "mock");
  recordGraded(state, attempt, rows);
  recordStudy(state, now, Math.min(attempt.durationSeconds, 3 * 60 * 60));
  if (attempt.mode === "diagnostic") state.profile.diagnosticStatus = "completed";
  return { result: attemptView(state, attempt).result! };
}

// ---------------------------------------------------------------------------
// Lessons and checkpoints
// ---------------------------------------------------------------------------

function lessonDto(state: DemoState, lessonId: string): LessonDto {
  const lesson = lessonsById.get(lessonId);
  if (!lesson) throw new ApiError(404, "not_found", "Lesson not found");
  const checkpoints: LessonDto["progress"]["checkpoints"] = {};
  for (const a of state.answers) {
    const attempt = state.attempts[a.attemptId];
    if (attempt?.mode !== "checkpoint" || attempt.lessonId !== lessonId) continue;
    const prev = checkpoints[a.questionId];
    if (!prev || prev.answeredAt < a.answeredAt) checkpoints[a.questionId] = { correct: a.correct, answeredAt: a.answeredAt };
  }
  return {
    id: lesson.id,
    chapterId: lesson.chapterId,
    title: lesson.title,
    body: lesson.body,
    estimatedMinutes: lesson.estimatedMinutes,
    version: 1,
    completed: Boolean(state.completions[lesson.id]),
    checkpoints: lesson.checkpoints
      .map((cp) => ({ cp, q: questionsById.get(cp.questionId) }))
      .filter((x): x is { cp: (typeof lesson.checkpoints)[number]; q: Question } => Boolean(x.q))
      .map(({ cp, q }) => ({ afterBlock: cp.afterBlock, question: learnerQuestion(q, `lesson:${lesson.id}`, "checkpoint") })),
    progress: { lastBlock: state.lessonProgress[lesson.id] ?? 0, checkpoints },
  };
}

function checkpointResult(q: DemoQuestion, answer: AnswerInputDto, correct: boolean, mistakeId: string | null): CheckpointResultDto {
  return {
    questionId: q.id,
    correct,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    correctNumericValue: q.type === "numeric" ? q.numericAnswer : null,
    explanation: q.explanation,
    misconception: correct ? null : misconceptionFor(q, answer),
    mistakeId,
  };
}

function answerCheckpoint(state: DemoState, body: unknown, now: Date): { result: CheckpointResultDto } {
  const input = parse(checkpointAnswerSchema, body);
  const lesson = lessonsById.get(input.lessonId);
  if (!lesson || !lesson.checkpoints.some((c) => c.questionId === input.questionId)) throw new ApiError(404, "not_found", "Checkpoint not found");
  const q = questionsById.get(input.questionId)!;
  const answer: AnswerInputDto = {
    questionId: q.id,
    selectedOptionIds: input.selectedOptionIds,
    numericValue: input.numericValue,
    responseMs: input.responseMs,
    hintsUsed: input.hintsUsed,
    answeredAt: input.answeredAt,
  };
  if (!isAnswered(answer)) throw new ApiError(422, "empty_answer", "Choose an answer first");

  const existing = Object.values(state.attempts).find((a) => a.clientAttemptId === input.clientAttemptId);
  if (existing) {
    const mistake = state.mistakes.find((m) => m.attemptId === existing.id);
    return { result: checkpointResult(q, existing.saved[q.id]!, existing.graded[q.id] ?? false, mistake?.id ?? null) };
  }

  const at = deviceTime(input.answeredAt, now);
  const correct = isAnswerCorrect(scorable(q), answer);
  const attempt: DemoAttempt = {
    id: randomId(),
    clientAttemptId: input.clientAttemptId,
    mode: "checkpoint",
    trackId: chaptersById.get(lesson.chapterId)!.trackId,
    subjectId: chaptersById.get(lesson.chapterId)!.subjectId,
    chapterId: lesson.chapterId,
    skillId: q.skillId,
    lessonId: lesson.id,
    questionIds: [q.id],
    startedAt: at.toISOString(),
    deadlineAt: null,
    submittedAt: at.toISOString(),
    saved: { [q.id]: answer },
    graded: { [q.id]: correct },
    score: correct ? 1 : 0,
    maxScore: 1,
    percentage: correct ? 100 : 0,
    durationSeconds: Math.round((input.responseMs ?? 0) / 1000),
  };
  state.attempts[attempt.id] = attempt;
  const row: GradedInput = {
    answer,
    correct,
    version: input.questionVersion ?? q.version,
    countsAsEvidence: input.questionVersion === undefined || input.questionVersion === q.version,
    answeredAt: at,
  };
  updateChapterMastery(state, "checkpoint", [q], [row], at);
  const mistakes = recordGraded(state, attempt, [row]);
  recordStudy(state, at, Math.min(Math.round((input.responseMs ?? 0) / 1000), 600));
  return { result: checkpointResult(q, answer, correct, mistakes.get(q.id) ?? null) };
}

// ---------------------------------------------------------------------------
// Mistake notebook, progress, packs, offline sync, reports
// ---------------------------------------------------------------------------

const mistakeStatus = (m: DemoMistake): MistakeStatus => (m.recoveredAt ? "recovered" : m.reviewedAt ? "reviewed" : "open");

function listMistakes(state: DemoState, query: URLSearchParams) {
  const status = query.get("status") ?? "all";
  const chapterId = query.get("chapterId");
  const rows = [...state.mistakes].filter((m) => !chapterId || m.chapterId === chapterId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts: Record<MistakeStatus, number> = { open: 0, reviewed: 0, recovered: 0 };
  for (const m of rows) counts[mistakeStatus(m)]++;
  const visible = rows.filter((m) => (status === "recovered" ? mistakeStatus(m) === "recovered" : status === "open" ? mistakeStatus(m) !== "recovered" : true));

  const mistakes = visible.flatMap((m): MistakeDto[] => {
    const q = questionsById.get(m.questionId);
    const chapter = chaptersById.get(m.chapterId);
    if (!q || !chapter) return [];
    const key = skillKeyFor(m.skillId, m.chapterId);
    const lessonWithSkill = chapter.lessons.find((l) => l.checkpoints.some((cp) => m.skillId && questionsById.get(cp.questionId)?.skillId === m.skillId));
    const lesson = lessonWithSkill
      ? { id: lessonWithSkill.id, block: lessonWithSkill.checkpoints.find((cp) => questionsById.get(cp.questionId)?.skillId === m.skillId)!.afterBlock }
      : chapter.lessons[0]
        ? { id: chapter.lessons[0].id, block: 0 }
        : null;
    return [
      {
        id: m.id,
        status: mistakeStatus(m),
        createdAt: m.createdAt,
        question: learnerQuestion(q, `mistake:${m.id}`, "practice"),
        response: m.response,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
        correctNumericValue: q.type === "numeric" ? q.numericAnswer : null,
        explanation: q.explanation,
        misconception: m.misconception,
        subjectName: subjectsById.get(chapter.subjectId)?.name ?? {},
        chapter: { id: chapter.id, title: chapter.title },
        skill: { key, id: m.skillId, name: (m.skillId && skillNames.get(m.skillId)) || chapter.title },
        lesson,
        reviewedAt: m.reviewedAt,
        retriedCorrectAt: m.retriedCorrectAt,
        recoveredAt: m.recoveredAt,
        canRetry: chapter.questions.some((x) => x.purpose === "practice" && skillKeyFor(x.skillId, chapter.id) === key && x.id !== m.questionId),
        questionUpdated: q.version !== m.questionVersion,
      },
    ];
  });
  return { mistakes, counts };
}

function studyPack(chapterId: string, now: Date): StudyPackDto {
  const chapter = chaptersById.get(chapterId);
  if (!chapter) throw new ApiError(404, "not_found", "Chapter not found");
  return {
    chapterId,
    version: packVersion([...chapter.lessons.map((l) => ({ id: l.id, version: 1 })), ...chapter.questions.map((q) => ({ id: q.id, version: q.version }))]),
    generatedAt: now.toISOString(),
    subjectName: subjectsById.get(chapter.subjectId)?.name ?? {},
    title: chapter.title,
    lessons: chapter.lessons.map((l) => ({ id: l.id, title: l.title, body: l.body, estimatedMinutes: l.estimatedMinutes, version: 1, checkpoints: l.checkpoints })),
    questions: chapter.questions.map(
      (q): PackQuestionDto => ({
        ...learnerQuestion(q, "pack", "practice"),
        purpose: q.purpose,
        key: { correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id), numericAnswer: q.numericAnswer, numericTolerance: q.numericTolerance },
        explanation: q.explanation,
        misconceptions: Object.fromEntries(q.options.filter((o) => o.misconception).map((o) => [o.id, o.misconception!])),
      }),
    ),
    skills: chapter.skills,
  };
}

function submitOffline(state: DemoState, body: unknown, now: Date) {
  const input = parse(offlineAttemptSchema, body);
  const existing = Object.values(state.attempts).find((a) => a.clientAttemptId === input.clientAttemptId);
  if (existing) return { result: attemptView(state, existing).result!, duplicate: true, staleQuestions: 0 };
  const chapter = chaptersById.get(input.chapterId);
  if (!chapter) throw new ApiError(404, "not_found", "Chapter not found");

  const requested = new Map(input.questions.map((q) => [q.questionId, q.version]));
  const questions = [...requested.keys()].map((id) => questionsById.get(id)).filter((q): q is Question => Boolean(q) && q!.chapterId === chapter.id);
  if (questions.length === 0) throw new ApiError(422, "no_valid_questions", "None of these questions belong to the chapter any more");
  const stale = new Set(questions.filter((q) => requested.get(q.id) !== q.version).map((q) => q.id));

  const startedAt = deviceTime(input.startedAt, now);
  const submittedAt = deviceTime(input.submittedAt, now);
  // A device that merged two offline sessions can send the same question twice; keep the last answer.
  const answers = mergeAnswers([], onlyOwnQuestions({ questionIds: questions.map((q) => q.id) }, input.answers));
  const summary = scoreAttempt(questions.map(scorable), answers);
  const attempt: DemoAttempt = {
    id: randomId(),
    clientAttemptId: input.clientAttemptId,
    mode: input.mode,
    trackId: chapter.trackId,
    subjectId: chapter.subjectId,
    chapterId: chapter.id,
    skillId: input.skillId ?? null,
    lessonId: input.lessonId ?? null,
    offline: true,
    questionIds: questions.map((q) => q.id),
    startedAt: startedAt.toISOString(),
    deadlineAt: null,
    submittedAt: submittedAt.toISOString(),
    saved: Object.fromEntries(answers.map((a) => [a.questionId, a])),
    graded: Object.fromEntries(summary.results.map((r) => [r.questionId, r.correct])),
    score: summary.score,
    maxScore: summary.maxScore,
    percentage: summary.percentage,
    durationSeconds: Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)),
  };
  state.attempts[attempt.id] = attempt;
  const rows: GradedInput[] = answers.map((a) => ({
    answer: a,
    correct: attempt.graded[a.questionId] ?? false,
    version: requested.get(a.questionId) ?? 1,
    countsAsEvidence: !stale.has(a.questionId),
    answeredAt: deviceTime(a.answeredAt, submittedAt),
  }));
  updateChapterMastery(state, input.mode, questions, rows, submittedAt);
  recordGraded(state, attempt, rows);
  recordStudy(state, submittedAt, Math.min(attempt.durationSeconds ?? 0, 3 * 60 * 60));
  return { result: attemptView(state, attempt).result!, duplicate: false, staleQuestions: stale.size };
}

function reportContent(state: DemoState, body: unknown, now: Date) {
  const input = parse(contentReportSchema, body);
  if (input.questionId && !questionsById.has(input.questionId)) throw new ApiError(404, "not_found", "Question not found");
  if (input.lessonId && !lessonsById.has(input.lessonId)) throw new ApiError(404, "not_found", "Lesson not found");
  const item = input.questionId ?? input.lessonId;
  if (state.reports.some((r) => (r.questionId ?? r.lessonId) === item)) return { reported: true, duplicate: true };
  state.reports.push({
    id: randomId(),
    questionId: input.questionId ?? null,
    lessonId: input.lessonId ?? null,
    reason: input.reason,
    message: input.message || null,
    createdAt: now.toISOString(),
    status: "open",
  });
  return { reported: true, duplicate: false };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

type Handler = (ctx: { state: DemoState; params: string[]; query: URLSearchParams; body: unknown; now: Date }) => unknown;

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
      if (input.studyDays !== undefined) p.studyDays = [...input.studyDays].sort((a, b) => a - b);
      if (input.diagnosticStatus !== undefined && p.diagnosticStatus !== "completed") p.diagnosticStatus = input.diagnosticStatus as DiagnosticStatus;
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
        .filter((a) => a.submittedAt && a.mode !== "checkpoint")
        .sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))
        .slice(0, 20)
        .map((a) => ({
          id: a.id,
          mode: a.mode,
          title: a.chapterId ? chaptersById.get(a.chapterId)!.title : a.subjectId ? subjectsById.get(a.subjectId)!.name : {},
          submittedAt: a.submittedAt!,
          score: a.score ?? 0,
          maxScore: a.maxScore ?? 0,
          percentage: a.percentage ?? 0,
        })),
    }),
  ],
  [
    "GET",
    /^\/me\/progress$/,
    ({ state, now }) => {
      const trackId = state.profile.targetTrackId;
      if (!trackId) return { subjects: [], totals: { not_assessed: 0, learning: 0, needs_review: 0, mastered: 0 } };
      const { curriculum, progress } = learning(state, trackId, now);
      const active = activeSubjects(state, trackId);
      const subjects = findTrack(trackId)!
        .track.subjects.filter((s) => active.has(s.subjectId))
        .map((s) => {
          const subject = subjectsById.get(s.subjectId)!;
          return { id: subject.id, name: subject.name, icon: subject.icon, coefficient: s.coefficient };
        });
      return buildProgressDto(curriculum, progress, subjects, completedSet(state), openMistakes(state));
    },
  ],
  ["GET", /^\/me\/mistakes$/, ({ state, query }) => listMistakes(state, query)],
  [
    "POST",
    /^\/me\/mistakes\/([^/]+)\/review$/,
    ({ state, params, now }) => {
      const m = state.mistakes.find((x) => x.id === params[0]);
      if (!m) throw new ApiError(404, "not_found", "Mistake not found");
      m.reviewedAt ??= now.toISOString();
      return { reviewedAt: m.reviewedAt };
    },
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
  ["GET", /^\/lessons\/([^/]+)$/, ({ state, params }) => ({ lesson: lessonDto(state, params[0]!) })],
  [
    "POST",
    /^\/lessons\/([^/]+)\/progress$/,
    ({ state, params, body }) => {
      if (!lessonsById.has(params[0]!)) throw new ApiError(404, "not_found", "Lesson not found");
      const { block } = parse(lessonProgressSchema, body);
      state.lessonProgress[params[0]!] = Math.max(state.lessonProgress[params[0]!] ?? 0, block);
      return { lastBlock: state.lessonProgress[params[0]!] };
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
  ["POST", /^\/checkpoints$/, ({ state, body, now }) => answerCheckpoint(state, body, now)],
  ["GET", /^\/chapters\/([^/]+)\/pack$/, ({ params, now }) => ({ pack: studyPack(params[0]!, now) })],
  ["POST", /^\/offline-attempts$/, ({ state, body, now }) => submitOffline(state, body, now)],
  ["POST", /^\/content-reports$/, ({ state, body, now }) => reportContent(state, body, now)],
  ["POST", /^\/quiz-attempts$/, ({ state, body, now }) => startAttempt(state, body, now)],
  ["GET", /^\/quiz-attempts\/([^/]+)$/, ({ state, params }) => attemptView(state, getAttempt(state, params[0]!))],
  ["POST", /^\/quiz-attempts\/([^/]+)\/answers$/, ({ state, params, body, now }) => saveAnswers(state, params[0]!, body, now)],
  ["POST", /^\/quiz-attempts\/([^/]+)\/submit$/, ({ state, params, body, now }) => submitAttempt(state, params[0]!, body, now)],
];

export async function demoRequest<T>(method: string, fullPath: string, body: unknown, userId: string | null): Promise<T> {
  // A short delay so loading states look like they would over a real network.
  await new Promise((r) => setTimeout(r, 150));
  const [path, search = ""] = fullPath.split("?");

  if (method === "GET" && path === "/exams") {
    return JSON.parse(JSON.stringify({ exams: content.exams.map(examDto) })) as T;
  }
  if (userId) {
    loadState(userId);
    const messaging = handleMessaging(method, fullPath, userId, body, new Date());
    if (messaging) return JSON.parse(JSON.stringify(messaging.result)) as T;
  }
  for (const [m, pattern, handler] of routes) {
    const match = m === method ? pattern.exec(path!) : null;
    if (!match) continue;
    if (!userId) throw new ApiError(401, "unauthenticated", "Sign in required");
    const state = loadState(userId);
    const result = handler({ state, params: match.slice(1), query: new URLSearchParams(search), body, now: new Date() });
    saveState(userId, state);
    return JSON.parse(JSON.stringify(result)) as T;
  }
  throw new ApiError(404, "not_found", `No demo route for ${method} ${path}`);
}
