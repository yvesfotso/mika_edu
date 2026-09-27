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

export const ATTEMPT_MODES = ["practice", "past_paper", "mock"] as const;
export type AttemptMode = (typeof ATTEMPT_MODES)[number];

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
}

export interface LessonDto {
  id: string;
  chapterId: string;
  title: LocalizedText;
  body: LocalizedText;
  estimatedMinutes: number;
  version: number;
  completed: boolean;
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
}

export const ACTIVITY_DAYS = 42;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
