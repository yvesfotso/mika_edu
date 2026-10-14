import { z } from "zod";
import { LOCALES } from "./i18n";
import { programSettingsInputSchema } from "./program";
import { CONTENT_STATUSES, QUESTION_PURPOSES, QUESTION_SOURCES, QUESTION_TYPES, STARTABLE_MODES } from "./types";

export const localeSchema = z.enum(LOCALES);

export const localizedTextSchema = z
  .object({ en: z.string().max(20_000).optional(), fr: z.string().max(20_000).optional() })
  .refine((t) => Boolean(t.en?.trim() || t.fr?.trim()), { message: "Provide text in at least one language" });

const optionalLocalizedText = z.object({
  en: z.string().max(100_000).optional(),
  fr: z.string().max(100_000).optional(),
});

// ---------- Learner API ----------

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  preferredLanguage: localeSchema.optional(),
  educationLevel: z.string().trim().max(80).nullable().optional(),
  schoolName: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().max(64).optional(),
  targetExamId: z.uuid().nullable().optional(),
  targetTrackId: z.uuid().nullable().optional(),
  dailyGoalMinutes: z.number().int().min(5).max(480).optional(),
  onboardingCompleted: z.boolean().optional(),
  programSettings: programSettingsInputSchema.optional(),
  studyDays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, { message: "Each day once" })
    .optional(),
  /** Learners can skip the diagnostic (or ask for it again); "completed" is set by the server. */
  diagnosticStatus: z.enum(["pending", "skipped"]).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const answerInputSchema = z.object({
  questionId: z.uuid(),
  selectedOptionIds: z.array(z.uuid()).max(10).optional(),
  numericValue: z.number().finite().optional(),
  responseMs: z.number().int().min(0).max(3 * 60 * 60 * 1000).optional(),
  hintsUsed: z.number().int().min(0).max(10).optional(),
  /** When the learner answered on the device (offline answers sync later). */
  answeredAt: z.iso.datetime().optional(),
});

export const startAttemptSchema = z
  .object({
    /** Client-generated UUID so a retried request never creates two attempts. */
    clientAttemptId: z.uuid(),
    mode: z.enum(STARTABLE_MODES),
    chapterId: z.uuid().optional(),
    subjectId: z.uuid().optional(),
    /** Practise one skill (recovery sessions use this). */
    skillId: z.uuid().optional(),
    /** Questions to leave out, e.g. the one the learner just got wrong. */
    excludeQuestionIds: z.array(z.uuid()).max(100).default([]),
    questionCount: z.number().int().min(1).max(100).default(10),
  })
  .refine((v) => v.mode === "diagnostic" || Boolean(v.chapterId || v.subjectId || v.skillId), {
    message: "chapterId, subjectId or skillId is required",
  })
  .refine((v) => v.mode !== "recovery" || Boolean(v.skillId || v.chapterId), {
    message: "Recovery sessions need a skillId or chapterId",
  });
export type StartAttemptInput = z.infer<typeof startAttemptSchema>;

export const saveAnswersSchema = z.object({
  answers: z.array(answerInputSchema).max(100),
});

export const submitAttemptSchema = z.object({
  answers: z.array(answerInputSchema).max(100).default([]),
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

export const lessonProgressSchema = z.object({
  /** Highest block reached; progress never moves backwards. */
  block: z.number().int().min(0).max(500),
});

export const checkpointAnswerSchema = answerInputSchema.extend({
  /** Client-generated UUID per answer so a retried request is recorded once. */
  clientAttemptId: z.uuid(),
  lessonId: z.uuid(),
  questionVersion: z.number().int().min(1).optional(),
});
export type CheckpointAnswerInput = z.infer<typeof checkpointAnswerSchema>;

/** A practice session done offline from a study pack, replayed when the device reconnects. */
export const offlineAttemptSchema = z.object({
  clientAttemptId: z.uuid(),
  mode: z.enum(["practice", "recovery", "checkpoint"]),
  chapterId: z.uuid(),
  lessonId: z.uuid().optional(),
  skillId: z.uuid().optional(),
  packVersion: z.string().max(80),
  questions: z.array(z.object({ questionId: z.uuid(), version: z.number().int().min(1) })).min(1).max(100),
  answers: z.array(answerInputSchema).max(100),
  startedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime(),
});
export type OfflineAttemptInput = z.infer<typeof offlineAttemptSchema>;

export const CONTENT_REPORT_REASONS = ["wrong_answer", "unclear", "typo", "other"] as const;
export const contentReportSchema = z
  .object({
    questionId: z.uuid().optional(),
    lessonId: z.uuid().optional(),
    reason: z.enum(CONTENT_REPORT_REASONS),
    message: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Boolean(v.questionId || v.lessonId), { message: "questionId or lessonId is required" });
export type ContentReportInput = z.infer<typeof contentReportSchema>;

export const completeLessonSchema = z.object({
  /** Seconds the learner spent reading; used for daily-goal progress. */
  secondsSpent: z.number().int().min(0).max(4 * 60 * 60).default(0),
  completedAt: z.iso.datetime().optional(),
});

// ---------- Admin / CMS ----------

export const contentStatusSchema = z.enum(CONTENT_STATUSES);

export const examFormSchema = z.object({
  countryCode: z.string().length(2).toUpperCase(),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, digits and dashes only"),
  name: localizedTextSchema,
  description: optionalLocalizedText,
  level: z.string().trim().min(1).max(60),
  primaryLanguage: localeSchema,
  examDate: z.iso.date().nullable(),
  registrationDeadline: z.iso.date().nullable(),
  sourceUrl: z.url().nullable(),
  active: z.boolean(),
});

export const lessonFormSchema = z.object({
  chapterId: z.uuid(),
  title: localizedTextSchema,
  body: optionalLocalizedText,
  estimatedMinutes: z.number().int().min(1).max(240),
  orderIndex: z.number().int().min(0),
});

export const questionOptionFormSchema = z.object({
  id: z.uuid().optional(),
  text: localizedTextSchema,
  isCorrect: z.boolean(),
  /** For a wrong option: the misconception choosing it reveals. */
  misconception: optionalLocalizedText.optional(),
});

export const questionFormSchema = z
  .object({
    subjectId: z.uuid(),
    chapterId: z.uuid().nullable(),
    type: z.enum(QUESTION_TYPES),
    prompt: localizedTextSchema,
    difficulty: z.number().int().min(1).max(5),
    sourceType: z.enum(QUESTION_SOURCES),
    sourceYear: z.number().int().min(1950).max(2100).nullable(),
    officialSourceUrl: z.url().nullable(),
    numericAnswer: z.number().finite().nullable(),
    numericTolerance: z.number().min(0).nullable(),
    options: z.array(questionOptionFormSchema).max(8),
    explanation: optionalLocalizedText,
    skillId: z.uuid().nullable().default(null),
    purpose: z.enum(QUESTION_PURPOSES).default("practice"),
    hint: optionalLocalizedText.optional(),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.type === "numeric") {
      if (q.numericAnswer === null) {
        ctx.addIssue({ code: "custom", path: ["numericAnswer"], message: "Numeric questions need an answer" });
      }
      return;
    }
    if (q.options.length < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options" });
    }
    if (q.type === "true_false" && q.options.length !== 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "True/false questions need exactly two options" });
    }
    if ((q.type === "single_choice" || q.type === "true_false") && correct !== 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one correct option" });
    }
    if (q.type === "multiple_choice" && correct < 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark at least one correct option" });
    }
    if (q.sourceType === "official_past_paper" && q.sourceYear === null) {
      ctx.addIssue({ code: "custom", path: ["sourceYear"], message: "Past-paper questions need a year" });
    }
  });
export type QuestionFormInput = z.infer<typeof questionFormSchema>;

/**
 * One row of a CSV/JSON question import. Options are `option_1..option_6` (English) and
 * `option_1_fr..option_6_fr`; `correct` lists the 1-based correct option numbers, e.g. "2" or "1;3".
 */
export const questionImportRowSchema = z.object({
  chapter_id: z.uuid().optional().or(z.literal("")),
  type: z.enum(QUESTION_TYPES).default("single_choice"),
  prompt_en: z.string().optional().default(""),
  prompt_fr: z.string().optional().default(""),
  difficulty: z.coerce.number().int().min(1).max(5).default(2),
  source_type: z.enum(QUESTION_SOURCES).default("teacher_created"),
  source_year: z.coerce.number().int().min(1950).max(2100).optional().or(z.literal("")),
  correct: z.string().optional().default(""),
  numeric_answer: z.coerce.number().optional().or(z.literal("")),
  numeric_tolerance: z.coerce.number().optional().or(z.literal("")),
  explanation_en: z.string().optional().default(""),
  explanation_fr: z.string().optional().default(""),
  option_1: z.string().optional(),
  option_2: z.string().optional(),
  option_3: z.string().optional(),
  option_4: z.string().optional(),
  option_5: z.string().optional(),
  option_6: z.string().optional(),
  option_1_fr: z.string().optional(),
  option_2_fr: z.string().optional(),
  option_3_fr: z.string().optional(),
  option_4_fr: z.string().optional(),
  option_5_fr: z.string().optional(),
  option_6_fr: z.string().optional(),
});
export type QuestionImportRow = z.infer<typeof questionImportRowSchema>;
