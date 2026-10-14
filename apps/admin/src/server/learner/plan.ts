import "server-only";
import { assemblePlanInput, planToday, type TodayPlanDto } from "@eduprep/core";
import type { ProfileRow } from "../mappers";
import { recommendations, type TrackState } from "./curriculum";
import type { LearningState } from "./learning";

/** Builds today's plan from the learner's real content and evidence (rules in @eduprep/core plan.ts). */
export function buildTodayPlan(profile: ProfileRow, track: TrackState | null, learning: LearningState | null, now: Date): TodayPlanDto {
  if (!track || !learning) {
    return {
      date: now.toISOString().slice(0, 10),
      sessionMinutes: profile.daily_goal_minutes,
      studyDay: true,
      tasks: [],
      plannedMinutes: 0,
      doneToday: [],
      openMistakes: 0,
    };
  }
  return planToday(
    assemblePlanInput({
      date: learning.today,
      locale: profile.preferred_language,
      sessionMinutes: profile.daily_goal_minutes,
      studyDays: profile.study_days ?? [0, 1, 2, 3, 4, 5, 6],
      diagnosticStatus: profile.diagnostic_status,
      curriculum: {
        ...learning.curriculum,
        lessons: track.lessons.map((l) => ({ id: l.id, chapterId: l.chapter_id, title: l.title, body: l.body, minutes: l.estimated_minutes })),
      },
      activeSubjects: track.activeSubjects,
      completedLessons: track.completedLessons,
      lessonProgress: track.lessonProgress,
      progress: learning.progress,
      openMistakes: learning.openMistakes.map((m) => ({
        id: m.id,
        questionId: m.question_id,
        chapterId: m.chapter_id,
        skillId: m.skill_id,
        createdAt: new Date(m.created_at),
      })),
      recommendations: recommendations(track, now, 3).map((r) => ({ chapterId: r.chapterId, chapterTitle: r.chapterTitle, reason: r.reason })),
      todayAttempts: learning.todayAttempts.map((a) => ({ mode: a.mode, chapterId: a.chapter_id, skillId: a.skill_id })),
      lessonsCompletedToday: learning.lessonsCompletedToday,
    }),
  );
}
