import "server-only";
import type { ProfileDto, UpdateProfileInput } from "@eduprep/core";
import {
  canChangeProgram,
  normalizeProgramSettings,
  ProgramSettingsError,
  type ProgramConfig,
  type ProgramSettings,
} from "@eduprep/core";
import { ApiError, must, notFound, type Db } from "../db";
import { parseProgram, PROFILE_COLUMNS, toProfileDto, type ProfileRow } from "../mappers";

export async function getProfileRow(db: Db, userId: string): Promise<ProfileRow> {
  const row = must(
    await db.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle<ProfileRow>(),
    "loading profile",
  );
  if (!row) throw notFound("Profile");
  return row;
}

export async function getProfile(db: Db, userId: string): Promise<ProfileDto> {
  return toProfileDto(await getProfileRow(db, userId));
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateProfile(db: Db, userId: string, input: UpdateProfileInput): Promise<ProfileDto> {
  const current = await getProfileRow(db, userId);
  const examId = input.targetExamId !== undefined ? input.targetExamId : current.target_exam_id;
  let trackId = input.targetTrackId !== undefined ? input.targetTrackId : current.target_track_id;

  // Changing exam without choosing a track clears the stale track.
  if (input.targetExamId !== undefined && input.targetTrackId === undefined && examId !== current.target_exam_id) {
    trackId = null;
  }

  const programChanged = examId !== current.target_exam_id || trackId !== current.target_track_id;
  if (!canChangeProgram(current.onboarding_completed, current.role)) {
    if (programChanged) {
      throw new ApiError(403, "program_locked", "Your exam is locked. Message the EduPrep team if you need to change it.");
    }
    if (input.onboardingCompleted === false) {
      throw new ApiError(403, "program_locked", "Onboarding can't be restarted once your exam is set.");
    }
  }

  let program: ProgramConfig | null = null;
  if (examId) {
    const exam = must(
      await db.from("exams").select("id, program_config").eq("id", examId).eq("active", true).maybeSingle<{ id: string; program_config: unknown }>(),
      "checking exam",
    );
    if (!exam) throw new ApiError(422, "invalid_exam", "Unknown or inactive exam");
    program = parseProgram(exam.program_config);
  }
  if (trackId) {
    if (!examId) throw new ApiError(422, "invalid_track", "Choose an exam before a track");
    const track = must(
      await db.from("exam_tracks").select("id").eq("id", trackId).eq("exam_id", examId).maybeSingle(),
      "checking track",
    );
    if (!track) throw new ApiError(422, "invalid_track", "Track does not belong to the selected exam");
  }
  if (input.timezone && !isValidTimezone(input.timezone)) {
    throw new ApiError(422, "invalid_timezone", "Unknown timezone");
  }
  if (input.onboardingCompleted && !(examId && trackId)) {
    throw new ApiError(422, "onboarding_incomplete", "Select an exam and a track to finish onboarding");
  }

  // Settings belong to one program: a new exam/track starts from scratch unless new settings come with it.
  let programSettings: ProgramSettings | null = programChanged ? null : current.program_settings;
  if (input.programSettings !== undefined) {
    if (!program || !trackId) throw new ApiError(422, "no_program", "Choose an exam and a track first");
    const trackSubjects = must(await db.from("track_subjects").select("subject_id").eq("track_id", trackId), "loading track subjects") as {
      subject_id: string;
    }[];
    try {
      programSettings = normalizeProgramSettings(
        program,
        trackSubjects.map((s) => s.subject_id),
        input.programSettings,
      );
    } catch (err) {
      if (err instanceof ProgramSettingsError) throw new ApiError(422, "invalid_program_settings", err.message);
      throw err;
    }
  }
  const finishing = input.onboardingCompleted === true && !current.onboarding_completed;
  if (finishing && program?.kind === "grades" && !(programSettings?.subjects && programSettings.subjects.length > 0)) {
    throw new ApiError(422, "subjects_required", "Choose the subjects you are sitting");
  }

  const patch: Record<string, unknown> = { target_exam_id: examId, target_track_id: trackId, program_settings: programSettings };
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.preferredLanguage !== undefined) patch.preferred_language = input.preferredLanguage;
  if (input.educationLevel !== undefined) patch.education_level = input.educationLevel;
  if (input.schoolName !== undefined) patch.school_name = input.schoolName;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.dailyGoalMinutes !== undefined) patch.daily_goal_minutes = input.dailyGoalMinutes;
  if (input.onboardingCompleted !== undefined) patch.onboarding_completed = input.onboardingCompleted;

  const row = must(
    await db.from("profiles").update(patch).eq("id", userId).select(PROFILE_COLUMNS).single<ProfileRow>(),
    "updating profile",
  );
  return toProfileDto(row);
}
