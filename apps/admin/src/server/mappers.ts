import "server-only";
import {
  canChangeProgram,
  DEFAULT_PROGRAM,
  programConfigSchema,
  type ExamDto,
  type LocalizedText,
  type Locale,
  type ProfileDto,
  type ProgramConfig,
  type ProgramSettings,
  type UserRole,
} from "@eduprep/core";

export function parseProgram(value: unknown): ProgramConfig {
  const parsed = programConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PROGRAM;
}

export interface ExamRow {
  id: string;
  slug: string;
  country_code: string;
  name: LocalizedText;
  description: LocalizedText;
  level: string;
  primary_language: Locale;
  exam_date: string | null;
  registration_deadline: string | null;
  source_url: string | null;
  verified_at: string | null;
  active: boolean;
  program_config: unknown;
  exam_tracks?: {
    id: string;
    slug: string;
    name: LocalizedText;
    order_index: number;
    track_subjects?: { coefficient: number; order_index: number; subjects: { id: string; slug: string; name: LocalizedText; icon: string | null } }[];
  }[];
}

export const EXAM_COLUMNS =
  "id, slug, country_code, name, description, level, primary_language, exam_date, registration_deadline, source_url, verified_at, active, program_config, exam_tracks(id, slug, name, order_index, track_subjects(coefficient, order_index, subjects(id, slug, name, icon)))";

export function toExamDto(row: ExamRow): ExamDto {
  return {
    id: row.id,
    slug: row.slug,
    countryCode: row.country_code,
    name: row.name,
    description: row.description ?? {},
    level: row.level,
    primaryLanguage: row.primary_language,
    // Unverified dates are never shown to learners as official.
    examDate: row.verified_at ? row.exam_date : null,
    registrationDeadline: row.verified_at ? row.registration_deadline : null,
    sourceUrl: row.source_url,
    verifiedAt: row.verified_at,
    program: parseProgram(row.program_config),
    tracks: [...(row.exam_tracks ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        subjects: [...(t.track_subjects ?? [])]
          .sort((a, b) => a.order_index - b.order_index)
          .map((ts) => ({ ...ts.subjects, coefficient: Number(ts.coefficient) })),
      })),
  };
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  preferred_language: Locale;
  role: UserRole;
  country_code: string;
  education_level: string | null;
  school_name: string | null;
  timezone: string;
  target_exam_id: string | null;
  target_track_id: string | null;
  daily_goal_minutes: number;
  onboarding_completed: boolean;
  friend_code: string;
  program_settings: ProgramSettings | null;
}

export const PROFILE_COLUMNS =
  "id, display_name, preferred_language, role, country_code, education_level, school_name, timezone, target_exam_id, target_track_id, daily_goal_minutes, onboarding_completed, friend_code, program_settings";

export function toProfileDto(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    displayName: row.display_name,
    preferredLanguage: row.preferred_language,
    role: row.role,
    countryCode: row.country_code,
    educationLevel: row.education_level,
    schoolName: row.school_name,
    timezone: row.timezone,
    targetExamId: row.target_exam_id,
    targetTrackId: row.target_track_id,
    dailyGoalMinutes: row.daily_goal_minutes,
    onboardingCompleted: row.onboarding_completed,
    friendCode: row.friend_code,
    programSettings: row.program_settings,
    canChangeProgram: canChangeProgram(row.onboarding_completed, row.role),
  };
}
