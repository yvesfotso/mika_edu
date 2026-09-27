import { daysBetween } from "./dates";

export interface StreakState {
  currentDays: number;
  bestDays: number;
  lastActivityDate: string | null;
}

/** Apply a study activity on calendar date `today` (YYYY-MM-DD, learner's timezone). */
export function recordActivity(prev: StreakState, today: string): StreakState {
  if (!prev.lastActivityDate) {
    return { currentDays: 1, bestDays: Math.max(1, prev.bestDays), lastActivityDate: today };
  }
  const gap = daysBetween(prev.lastActivityDate, today);
  // Offline events can sync out of order; an older activity never rewinds the streak.
  if (gap <= 0) return prev;
  const currentDays = gap === 1 ? prev.currentDays + 1 : 1;
  return { currentDays, bestDays: Math.max(prev.bestDays, currentDays), lastActivityDate: today };
}

/** The streak as displayed today: it is broken if the learner skipped yesterday. */
export function displayedStreak(state: StreakState, today: string): { currentDays: number; activeToday: boolean } {
  if (!state.lastActivityDate) return { currentDays: 0, activeToday: false };
  const gap = daysBetween(state.lastActivityDate, today);
  if (gap <= 0) return { currentDays: state.currentDays, activeToday: true };
  if (gap === 1) return { currentDays: state.currentDays, activeToday: false };
  return { currentDays: 0, activeToday: false };
}
