import type { Locale, LocalizedText } from "./i18n";
import type { ProgramConfig, ProgramSettings } from "./program";

export const USER_ROLES = ["student", "teacher", "reviewer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CONTENT_STATUSES = ["draft", "review", "approved", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const QUESTION_TYPES = ["single_choice", "multiple_choice", "true_false", "numeric"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_SOURCES = ["official_past_paper", "teacher_created", "ai_generated", "original"] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

/**
 * How an answer was given. `diagnostic` is the short onboarding check, `checkpoint` a question inside a
 * lesson, and `recovery` a retry on a skill the learner got wrong.
 */
export const ATTEMPT_MODES = ["practice", "past_paper", "mock", "diagnostic", "checkpoint", "recovery"] as const;
export type AttemptMode = (typeof ATTEMPT_MODES)[number];
/** Modes a learner can start through POST /quiz-attempts (checkpoints have their own endpoint). */
export const STARTABLE_MODES = ["practice", "past_paper", "mock", "diagnostic", "recovery"] as const;
/** Exam conditions: no hints are offered. */
export const NO_HINT_MODES: readonly AttemptMode[] = ["mock", "past_paper", "diagnostic"];

/** What a question is for: the practice pool, or a checkpoint inside a lesson. */
export const QUESTION_PURPOSES = ["practice", "checkpoint"] as const;
export type QuestionPurpose = (typeof QUESTION_PURPOSES)[number];

export const DIAGNOSTIC_STATUSES = ["pending", "completed", "skipped"] as const;
export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number];

// ---------- API response shapes shared by the API and the mobile app ----------

export interface TrackSubjectDto {
  id: string;
  slug: string;
  name: LocalizedText;
  icon: string | null;
  coefficient: number;
}

export interface ExamTrackDto {
  id: string;
  slug: string;
  name: LocalizedText;
  /** Every subject of the track, in track order (not filtered by the learner’s choices). */
  subjects: TrackSubjectDto[];
}

export interface ExamDto {
  id: string;
  slug: string;
  countryCode: string;
  name: LocalizedText;
  description: LocalizedText;
  level: string;
  primaryLanguage: Locale;
  examDate: string | null;
  registrationDeadline: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  /** Grading rules that decide which settings the learner can adjust. */
  program: ProgramConfig;
  tracks: ExamTrackDto[];
}

export interface ProfileDto {
  id: string;
  displayName: string | null;
  preferredLanguage: Locale;
  role: UserRole;
  countryCode: string;
  educationLevel: string | null;
  schoolName: string | null;
  timezone: string;
  targetExamId: string | null;
  targetTrackId: string | null;
  dailyGoalMinutes: number;
  onboardingCompleted: boolean;
  /** Share this so friends can start a study chat with you. */
  friendCode: string;
  /** Choices within the learner's program (subjects, target grades or target average). */
  programSettings: ProgramSettings | null;
  /** False once the exam is locked (students after onboarding). */
  canChangeProgram: boolean;
  /** Days of the week the learner plans to study, 0 = Sunday … 6 = Saturday. */
  studyDays: number[];
  diagnosticStatus: DiagnosticStatus;
}

export interface SubjectSummaryDto {
  id: string;
  slug: string;
  name: LocalizedText;
  icon: string | null;
  coefficient: number;
  chapterCount: number;
  mastery: number;
  /** "grades" programs: the learner's target grade for this subject. */
  targetGrade: string | null;
  /** How many of the subject's skills are in each state. */
  skillTotals: Record<SkillStatus, number>;
}

export interface LessonSummaryDto {
  id: string;
  title: LocalizedText;
  estimatedMinutes: number;
  completed: boolean;
}

export interface ChapterDto {
  id: string;
  subjectId: string;
  title: LocalizedText;
  orderIndex: number;
  mastery: number;
  questionCount: number;
  lessons: LessonSummaryDto[];
  status: SkillStatus;
  skills: SkillProgressDto[];
  openMistakes: number;
}

export interface LessonDto {
  id: string;
  chapterId: string;
  title: LocalizedText;
  /** Markdown per locale; `## ` headings split it into blocks (see splitLessonBlocks). */
  body: LocalizedText;
  estimatedMinutes: number;
  version: number;
  completed: boolean;
  /** Questions to answer between blocks. */
  checkpoints: CheckpointDto[];
  /** Where the learner stopped, and how their checkpoint answers went. */
  progress: LessonProgressDto;
}

export interface CheckpointDto {
  /** Show after this block (0-based; clamp to the last block when a translation has fewer). */
  afterBlock: number;
  question: AttemptQuestionDto;
}

export interface LessonProgressDto {
  lastBlock: number;
  /** Latest checkpoint result per question id. */
  checkpoints: Record<string, { correct: boolean; answeredAt: string }>;
}

export interface CheckpointResultDto {
  questionId: string;
  correct: boolean;
  correctOptionIds: string[];
  correctNumericValue: number | null;
  explanation: LocalizedText;
  /** The misconception the chosen option reveals, when the content authors tagged it. */
  misconception: LocalizedText | null;
  /** Set when the wrong answer went into the mistake notebook. */
  mistakeId: string | null;
}

/** A question as sent to a learner during an attempt: never includes correctness data. */
export interface AttemptQuestionDto {
  id: string;
  type: QuestionType;
  prompt: LocalizedText;
  difficulty: number;
  sourceType: QuestionSource;
  sourceYear: number | null;
  options: { id: string; text: LocalizedText }[];
  /** Content version the learner sees; recorded with the answer. */
  version: number;
  skillId: string | null;
  /** Shown on request (and recorded as a hint used). Never sent in exam conditions. */
  hint: LocalizedText | null;
}

export interface QuizAttemptDto {
  id: string;
  mode: AttemptMode;
  chapterId: string | null;
  subjectId: string | null;
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  questions: AttemptQuestionDto[];
  savedAnswers: AnswerInputDto[];
}

export interface AnswerInputDto {
  questionId: string;
  selectedOptionIds?: string[];
  numericValue?: number;
  responseMs?: number;
  hintsUsed?: number;
  /** When the learner answered on the device (ISO), for answers that sync later. */
  answeredAt?: string;
}

export interface QuestionResultDto {
  questionId: string;
  answered: boolean;
  correct: boolean;
  selectedOptionIds: string[];
  numericValue: number | null;
  correctOptionIds: string[];
  correctNumericValue: number | null;
  explanation: LocalizedText;
  misconception: LocalizedText | null;
  hintsUsed: number;
  /** Mistake-notebook entry created for this wrong answer. */
  mistakeId: string | null;
}

export interface AttemptResultDto {
  attemptId: string;
  mode: AttemptMode;
  score: number;
  maxScore: number;
  percentage: number;
  durationSeconds: number;
  submittedAt: string;
  results: QuestionResultDto[];
  chapterBreakdown: { chapterId: string; title: LocalizedText; correct: number; total: number }[];
  masteryAfter: { chapterId: string; mastery: number }[];
}

export interface RecommendationDto {
  chapterId: string;
  chapterTitle: LocalizedText;
  subjectName: LocalizedText;
  mastery: number;
  reason: "weak" | "forgetting" | "not_started";
}

// ---------- Mastery states, mistakes, Today plan, offline packs ----------

export const SKILL_STATUSES = ["not_assessed", "learning", "needs_review", "mastered"] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/** Why a skill has its status, so the app can explain it in plain words. */
export type SkillReason =
  | "no_evidence"
  | "needs_more_correct"
  | "needs_more_sessions"
  | "recent_error"
  | "stale"
  | "not_enough_questions"
  | "mastered";

export interface SkillEvidenceSummary {
  /** Different questions answered correctly without a hint. */
  distinctCorrect: number;
  /** Calendar days (learner's timezone) with at least one such answer. */
  sessions: number;
  hintedCorrect: number;
  incorrect: number;
  /** Wrong answers not yet followed by enough independent correct answers. */
  unresolvedErrors: number;
  lastPracticedAt: string | null;
}

export interface SkillProgressDto {
  /** Skill id, or `chapter:<chapterId>` for chapters without authored skills. */
  key: string;
  skillId: string | null;
  chapterId: string;
  name: LocalizedText;
  status: SkillStatus;
  reason: SkillReason;
  evidence: SkillEvidenceSummary;
  required: { distinctCorrect: number; sessions: number };
  /** Published practice questions on this skill. */
  questionCount: number;
}

export interface ChapterProgressDto {
  chapterId: string;
  subjectId: string;
  title: LocalizedText;
  status: SkillStatus;
  skills: SkillProgressDto[];
  lessonCount: number;
  lessonsRead: number;
  openMistakes: number;
}

export interface ProgressDto {
  subjects: { id: string; name: LocalizedText; icon: string | null; coefficient: number; chapters: ChapterProgressDto[] }[];
  totals: Record<SkillStatus, number>;
}

export type MistakeStatus = "open" | "reviewed" | "recovered";

export interface MistakeDto {
  id: string;
  status: MistakeStatus;
  createdAt: string;
  question: AttemptQuestionDto;
  response: AnswerInputDto;
  correctOptionIds: string[];
  correctNumericValue: number | null;
  explanation: LocalizedText;
  misconception: LocalizedText | null;
  subjectName: LocalizedText;
  chapter: { id: string; title: LocalizedText };
  skill: { key: string; id: string | null; name: LocalizedText };
  /** Lesson (and section) that teaches the skill, to re-read the explanation. */
  lesson: { id: string; block: number } | null;
  reviewedAt: string | null;
  retriedCorrectAt: string | null;
  recoveredAt: string | null;
  /** Other practice questions exist on the same skill. */
  canRetry: boolean;
  /** The question has been edited since this mistake. */
  questionUpdated: boolean;
}

export type StudyTaskKind = "diagnostic" | "continue_lesson" | "recover_mistakes" | "review_skill" | "next_lesson" | "practice_chapter";

export interface StudyTaskDto {
  /** Stable for the same target, so the app can track it across refreshes. */
  id: string;
  kind: StudyTaskKind;
  minutes: number;
  title: LocalizedText | null;
  chapterTitle: LocalizedText | null;
  target: { lessonId?: string; chapterId?: string; skillId?: string };
  reason: {
    code: "diagnostic" | "unfinished" | "recent_mistakes" | "needs_review" | "next_in_order" | "weak" | "forgetting" | "not_started";
    count?: number;
    skillName?: LocalizedText;
    block?: number;
    blocks?: number;
  };
  /** What finishes the task. */
  completion: "diagnostic_done" | "lesson_read" | "recovery_attempt" | "practice_attempt";
}

export interface TodayPlanDto {
  date: string;
  sessionMinutes: number;
  /** False on a day the learner didn't pick as a study day: the plan is optional. */
  studyDay: boolean;
  tasks: StudyTaskDto[];
  plannedMinutes: number;
  /** Things finished today, newest first. */
  doneToday: { kind: StudyTaskKind; title: LocalizedText | null }[];
  openMistakes: number;
}

/** Everything needed to study one chapter offline, including answer keys for practice questions. */
export interface StudyPackDto {
  chapterId: string;
  /** Changes whenever any lesson or question in the pack changes. */
  version: string;
  generatedAt: string;
  subjectName: LocalizedText;
  title: LocalizedText;
  lessons: { id: string; title: LocalizedText; body: LocalizedText; estimatedMinutes: number; version: number; checkpoints: { afterBlock: number; questionId: string }[] }[];
  questions: PackQuestionDto[];
  skills: { id: string; name: LocalizedText }[];
}

export interface PackQuestionDto extends AttemptQuestionDto {
  purpose: QuestionPurpose;
  key: { correctOptionIds: string[]; numericAnswer: number | null; numericTolerance: number | null };
  explanation: LocalizedText;
  misconceptions: Record<string, LocalizedText>;
}

export interface DashboardDto {
  profile: ProfileDto;
  exam: ExamDto | null;
  daysUntilExam: number | null;
  streak: { currentDays: number; bestDays: number; activeToday: boolean };
  todayMinutes: number;
  continueLesson: { id: string; title: LocalizedText; chapterTitle: LocalizedText } | null;
  recommendations: RecommendationDto[];
  subjects: SubjectSummaryDto[];
  overallMastery: number;
  /** Study minutes per calendar day for the last ACTIVITY_DAYS days, oldest first, ending today. */
  activity: { date: string; minutes: number }[];
  today: TodayPlanDto;
}

export const ACTIVITY_DAYS = 42;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
