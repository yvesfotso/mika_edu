import "server-only";
import {
  buildProgressDto,
  chapterProgressOf,
  computeSkillProgress,
  localDate,
  subjectSkillTotals,
  type AttemptMode,
  type ChapterProgressDto,
  type CurriculumShape,
  type LearnerEvidence,
  type ProgressDto,
  type SkillProgressDto,
  type SkillStatus,
} from "@eduprep/core";
import { must, type Db } from "../db";
import type { ProfileRow } from "../mappers";
import type { TrackState } from "./curriculum";

export interface OpenMistakeRow {
  id: string;
  question_id: string;
  chapter_id: string | null;
  skill_id: string | null;
  created_at: string;
}

export interface TodayAttempt {
  mode: AttemptMode;
  chapter_id: string | null;
  skill_id: string | null;
  submitted_at: string;
}

/** Evidence-derived view of a learner's track: skill statuses, open mistakes and today's work. */
export interface LearningState {
  track: TrackState;
  curriculum: CurriculumShape;
  timezone: string;
  today: string;
  progress: Map<string, SkillProgressDto>;
  openMistakes: OpenMistakeRow[];
  todayAttempts: TodayAttempt[];
  lessonsCompletedToday: string[];
}

export function curriculumOf(track: TrackState): CurriculumShape {
  return {
    chapters: track.chapters.map((c) => ({ id: c.id, subjectId: c.subject_id, title: c.title })),
    skills: track.skills.map((s) => ({ id: s.id, chapterId: s.chapter_id, name: s.name })),
    questions: track.questions.map((q) => ({ id: q.id, chapterId: q.chapter_id, skillId: q.skill_id, purpose: q.purpose })),
    lessons: track.lessons.map((l) => ({ id: l.id, chapterId: l.chapter_id })),
  };
}

export async function loadLearningState(db: Db, profile: ProfileRow, track: TrackState, now: Date): Promise<LearningState> {
  const chapterIds = track.chapters.map((c) => c.id);
  const since = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  const [evidenceRes, mistakesRes, attemptsRes, completionsRes] = await Promise.all([
    db
      .from("question_attempts")
      .select("question_id, correct, hints_used, answered_at, saved_at, quiz_attempts!inner(mode, submitted_at), questions!inner(chapter_id, skill_id)")
      .eq("user_id", profile.id)
      .eq("counts_as_evidence", true)
      .not("correct", "is", null)
      .not("quiz_attempts.submitted_at", "is", null)
      .in("questions.chapter_id", chapterIds),
    db
      .from("mistake_entries")
      .select("id, question_id, chapter_id, skill_id, created_at")
      .eq("user_id", profile.id)
      .is("recovered_at", null)
      .in("chapter_id", chapterIds)
      .order("created_at", { ascending: false }),
    db.from("quiz_attempts").select("mode, chapter_id, skill_id, submitted_at").eq("user_id", profile.id).gte("submitted_at", since),
    db.from("lesson_completions").select("lesson_id, completed_at").eq("user_id", profile.id).gte("completed_at", since),
  ]);

  const evidence: LearnerEvidence[] = (
    must(evidenceRes, "loading evidence") as unknown as {
      question_id: string;
      correct: boolean;
      hints_used: number;
      answered_at: string | null;
      saved_at: string;
      quiz_attempts: { mode: AttemptMode };
      questions: { chapter_id: string; skill_id: string | null };
    }[]
  ).map((r) => ({
    questionId: r.question_id,
    chapterId: r.questions.chapter_id,
    skillId: r.questions.skill_id,
    correct: r.correct,
    hintsUsed: r.hints_used,
    at: new Date(r.answered_at ?? r.saved_at),
    mode: r.quiz_attempts.mode,
  }));

  const curriculum = curriculumOf(track);
  const today = localDate(now, profile.timezone);
  const isToday = (iso: string) => localDate(new Date(iso), profile.timezone) === today;
  return {
    track,
    curriculum,
    timezone: profile.timezone,
    today,
    progress: computeSkillProgress(curriculum, evidence, now, profile.timezone),
    openMistakes: must(mistakesRes, "loading mistakes") as OpenMistakeRow[],
    todayAttempts: (must(attemptsRes, "loading today's attempts") as TodayAttempt[]).filter((a) => isToday(a.submitted_at)),
    lessonsCompletedToday: (must(completionsRes, "loading today's lessons") as { lesson_id: string; completed_at: string }[])
      .filter((c) => isToday(c.completed_at))
      .map((c) => c.lesson_id),
  };
}

const mistakeChapters = (state: LearningState) => state.openMistakes.map((m) => ({ chapterId: m.chapter_id }));

export function chapterProgress(state: LearningState, chapterId: string): Omit<ChapterProgressDto, "title" | "subjectId"> {
  return chapterProgressOf(state.curriculum, state.progress, chapterId, state.track.completedLessons, mistakeChapters(state));
}

export function skillTotalsFor(state: LearningState, subjectId: string): Record<SkillStatus, number> {
  return subjectSkillTotals(state.curriculum, state.progress, subjectId);
}

export function progressDto(state: LearningState): ProgressDto {
  const subjects = state.track.subjects
    .filter((ts) => state.track.activeSubjects.has(ts.subjects.id))
    .map((ts) => ({ id: ts.subjects.id, name: ts.subjects.name, icon: ts.subjects.icon, coefficient: Number(ts.coefficient) }));
  return buildProgressDto(state.curriculum, state.progress, subjects, state.track.completedLessons, mistakeChapters(state));
}
