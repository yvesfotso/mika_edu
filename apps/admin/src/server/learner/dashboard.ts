import "server-only";
import { ACTIVITY_DAYS, addDays, daysUntil, displayedStreak, localDate, weightedMastery, type DashboardDto } from "@eduprep/core";
import { must, type Db } from "../db";
import { EXAM_COLUMNS, toExamDto, toProfileDto, type ExamRow } from "../mappers";
import { loadTrackState, nextLesson, recommendations, subjectSummaries } from "./curriculum";
import { getProfileRow } from "./profile";

export async function getDashboard(db: Db, userId: string, now: Date): Promise<DashboardDto> {
  const profileRow = await getProfileRow(db, userId);
  const today = localDate(now, profileRow.timezone);
  const firstDay = addDays(today, -(ACTIVITY_DAYS - 1));

  const [examRes, streakRes, activityRes] = await Promise.all([
    profileRow.target_exam_id
      ? db.from("exams").select(EXAM_COLUMNS).eq("id", profileRow.target_exam_id).maybeSingle<ExamRow>()
      : Promise.resolve({ data: null, error: null }),
    db.from("streaks").select("current_days, best_days, last_activity_date").eq("user_id", userId).maybeSingle(),
    db.from("daily_activity").select("activity_date, seconds").eq("user_id", userId).gte("activity_date", firstDay).lte("activity_date", today),
  ]);
  const examRow = must(examRes, "loading exam") as ExamRow | null;
  const streakRow = must(streakRes, "loading streak") as {
    current_days: number;
    best_days: number;
    last_activity_date: string | null;
  } | null;
  const secondsByDay = new Map(
    (must(activityRes, "loading activity") as { activity_date: string; seconds: number }[]).map((r) => [r.activity_date, r.seconds]),
  );
  const activity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const date = addDays(firstDay, i);
    return { date, minutes: Math.round((secondsByDay.get(date) ?? 0) / 60) };
  });

  const exam = examRow ? toExamDto(examRow) : null;
  const streak = displayedStreak(
    {
      currentDays: streakRow?.current_days ?? 0,
      bestDays: streakRow?.best_days ?? 0,
      lastActivityDate: streakRow?.last_activity_date ?? null,
    },
    today,
  );

  let subjects: DashboardDto["subjects"] = [];
  let recs: DashboardDto["recommendations"] = [];
  let continueLesson: DashboardDto["continueLesson"] = null;
  if (profileRow.target_track_id) {
    const state = await loadTrackState(db, userId, profileRow.target_track_id);
    subjects = subjectSummaries(state, now);
    recs = recommendations(state, now, 3);
    continueLesson = nextLesson(
      state,
      recs.map((r) => r.chapterId),
    );
  }

  return {
    profile: toProfileDto(profileRow),
    exam,
    daysUntilExam: daysUntil(exam?.examDate ?? null, now, profileRow.timezone),
    streak: { ...streak, bestDays: streakRow?.best_days ?? 0 },
    todayMinutes: Math.round((secondsByDay.get(today) ?? 0) / 60),
    continueLesson,
    recommendations: recs,
    // Subjects with published content first, keeping the track's order otherwise.
    subjects: [...subjects].sort((a, b) => Number(b.chapterCount > 0) - Number(a.chapterCount > 0)),
    overallMastery: weightedMastery(subjects.filter((s) => s.chapterCount > 0)),
    activity,
  };
}

export async function listExams(db: Db) {
  const rows = must(
    await db.from("exams").select(EXAM_COLUMNS).eq("active", true).order("slug"),
    "loading exams",
  ) as ExamRow[];
  return rows.map(toExamDto);
}
