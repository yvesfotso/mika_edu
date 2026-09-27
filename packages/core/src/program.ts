import { z } from "zod";
import type { LocalizedText } from "./i18n";
import type { UserRole } from "./types";

/**
 * How an exam is graded, which decides the settings a learner can adjust:
 * - "grades": letter grades per subject and a free choice of subjects (e.g. GCE O/A Level).
 * - "average": all subjects of the track are compulsory and results are an average (e.g. BAC /20).
 */
export type ProgramConfig =
  | {
      kind: "grades";
      grades: string[];
      passGrades: string[];
      minSubjects: number;
      maxSubjects: number;
    }
  | {
      kind: "average";
      scale: number;
      passMark: number;
      mentions: { min: number; label: LocalizedText }[];
    };

/** A learner's choices within their program. Fields that don't apply to the program are ignored. */
export interface ProgramSettings {
  /** "grades" programs: subjects the learner is sitting. */
  subjects?: string[];
  /** "grades" programs: target grade per subject id. */
  targetGrades?: Record<string, string>;
  /** "average" programs: target overall average on the program's scale. */
  targetAverage?: number;
}

export const DEFAULT_PROGRAM: ProgramConfig = {
  kind: "average",
  scale: 20,
  passMark: 10,
  mentions: [],
};

const localized = z.object({ en: z.string().optional(), fr: z.string().optional() });

export const programConfigSchema: z.ZodType<ProgramConfig> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grades"),
    grades: z.array(z.string().min(1).max(3)).min(2),
    passGrades: z.array(z.string()),
    minSubjects: z.number().int().min(1),
    maxSubjects: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal("average"),
    scale: z.number().positive(),
    passMark: z.number().positive(),
    mentions: z.array(z.object({ min: z.number(), label: localized })),
  }),
]);

export const programSettingsInputSchema = z.object({
  subjects: z.array(z.uuid()).max(20).optional(),
  targetGrades: z.record(z.uuid(), z.string().max(3)).optional(),
  targetAverage: z.number().min(0).max(100).optional(),
});

export class ProgramSettingsError extends Error {}

/**
 * Validates settings against the learner's program and track subjects, keeping only what applies.
 * Throws ProgramSettingsError with a learner-readable message.
 */
export function normalizeProgramSettings(config: ProgramConfig, trackSubjectIds: string[], input: ProgramSettings): ProgramSettings {
  if (config.kind === "grades") {
    const subjects = [...new Set(input.subjects ?? [])];
    const unknown = subjects.filter((id) => !trackSubjectIds.includes(id));
    if (unknown.length > 0) throw new ProgramSettingsError("Some subjects are not part of your track");
    if (subjects.length < config.minSubjects || subjects.length > config.maxSubjects) {
      throw new ProgramSettingsError(`Choose between ${config.minSubjects} and ${config.maxSubjects} subjects`);
    }
    const targetGrades: Record<string, string> = {};
    for (const [subjectId, grade] of Object.entries(input.targetGrades ?? {})) {
      if (!subjects.includes(subjectId)) continue;
      if (!config.grades.includes(grade)) throw new ProgramSettingsError(`Unknown grade ${grade}`);
      targetGrades[subjectId] = grade;
    }
    return { subjects, targetGrades };
  }

  if (input.targetAverage === undefined) return {};
  if (input.targetAverage < config.passMark || input.targetAverage > config.scale) {
    throw new ProgramSettingsError(`Choose a target between ${config.passMark} and ${config.scale}`);
  }
  return { targetAverage: Math.round(input.targetAverage * 2) / 2 };
}

/** Subjects the learner studies: their chosen subjects for "grades" programs, otherwise all of the track. */
export function activeSubjectIds(config: ProgramConfig, trackSubjectIds: string[], settings: ProgramSettings | null | undefined): string[] {
  if (config.kind === "grades" && settings?.subjects && settings.subjects.length > 0) {
    return trackSubjectIds.filter((id) => settings.subjects!.includes(id));
  }
  return trackSubjectIds;
}

/** The mention an average reaches (highest threshold met), or null below all of them. */
export function mentionFor(config: ProgramConfig, average: number): LocalizedText | null {
  if (config.kind !== "average") return null;
  const reached = config.mentions.filter((m) => average >= m.min).sort((a, b) => b.min - a.min);
  return reached[0]?.label ?? null;
}

/** Students can't change their exam or track once onboarding is done; staff can reassign it. */
export function canChangeProgram(onboardingCompleted: boolean, role: UserRole): boolean {
  return !onboardingCompleted || role !== "student";
}
