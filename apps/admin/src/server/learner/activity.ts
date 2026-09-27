import "server-only";
import { localDate, recordActivity as nextStreak, type StreakState } from "@eduprep/core";
import { must, type Db } from "../db";

const MAX_BACKDATE_MS = 7 * 86_400_000;

/**
 * Offline events carry the time they happened on the device. Accept it for streaks only within a
 * week and never in the future, so a wrong device clock cannot fabricate a streak.
 */
export function effectiveActivityTime(clientTime: string | undefined, now: Date): Date {
  if (!clientTime) return now;
  const t = new Date(clientTime);
  if (Number.isNaN(t.getTime()) || t > now || now.getTime() - t.getTime() > MAX_BACKDATE_MS) return now;
  return t;
}

export async function recordStudyActivity(
  db: Db,
  user: { id: string; timezone: string },
  at: Date,
  amounts: { seconds: number; questions: number; lessons: number },
): Promise<void> {
  const day = localDate(at, user.timezone);
  must(
    await db.rpc("record_daily_activity", {
      p_user: user.id,
      p_date: day,
      p_seconds: amounts.seconds,
      p_questions: amounts.questions,
      p_lessons: amounts.lessons,
    }),
    "recording daily activity",
  );

  const row = must(
    await db.from("streaks").select("current_days, best_days, last_activity_date").eq("user_id", user.id).maybeSingle(),
    "loading streak",
  ) as { current_days: number; best_days: number; last_activity_date: string | null } | null;

  const prev: StreakState = {
    currentDays: row?.current_days ?? 0,
    bestDays: row?.best_days ?? 0,
    lastActivityDate: row?.last_activity_date ?? null,
  };
  const next = nextStreak(prev, day);
  if (next === prev) return;
  must(
    await db.from("streaks").upsert({
      user_id: user.id,
      current_days: next.currentDays,
      best_days: next.bestDays,
      last_activity_date: next.lastActivityDate,
    }),
    "saving streak",
  );
}
