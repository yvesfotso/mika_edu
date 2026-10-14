import { localDate } from "./dates";
import type { AttemptMode, SkillEvidenceSummary, SkillReason, SkillStatus } from "./types";

/**
 * Rules that turn answers into an understandable skill status. They are a starting point to tune
 * with real data, not a validated measure of learning, and are never shown as a pass probability.
 */
export interface MasteryRules {
  /** Different questions answered correctly without a hint. */
  minDistinctCorrect: number;
  /** Calendar days those answers must span. */
  minSessions: number;
  /** Independent correct answers on other questions needed after a mistake to resolve it. */
  correctToResolveError: number;
  /** A mastered skill not practised for this long is due for review. */
  reviewAfterDays: number;
}

export const MASTERY_RULES: MasteryRules = {
  minDistinctCorrect: 3,
  minSessions: 2,
  correctToResolveError: 2,
  reviewAfterDays: 30,
};

/** One graded answer on a skill. */
export interface SkillEvidence {
  questionId: string;
  correct: boolean;
  hintsUsed: number;
  /** When the learner answered (device time for offline answers). */
  at: Date;
  mode: AttemptMode;
}

export interface SkillMastery {
  status: SkillStatus;
  reason: SkillReason;
  evidence: SkillEvidenceSummary;
  required: { distinctCorrect: number; sessions: number };
}

/** Skills are authored per chapter; chapters without skills count as a single skill. */
export function skillKeyFor(skillId: string | null | undefined, chapterId: string): string {
  return skillId ?? `chapter:${chapterId}`;
}

const isIndependent = (e: SkillEvidence) => e.correct && e.hintsUsed === 0;

/**
 * Status of one skill from its evidence:
 * - not_assessed: no graded answers yet (lack of evidence is not failure);
 * - mastered: ≥ minDistinctCorrect different questions right without hints, over ≥ minSessions days,
 *   no unresolved mistakes and practised within reviewAfterDays;
 * - needs_review: the mastery bar was met but a later mistake is unresolved, or it has gone stale;
 * - learning: anything in between.
 * Hinted answers and repeats of the same question never establish mastery on their own.
 */
export function skillMastery(
  evidence: SkillEvidence[],
  questionCount: number,
  now: Date,
  timeZone: string,
  rules: MasteryRules = MASTERY_RULES,
): SkillMastery {
  const required = { distinctCorrect: rules.minDistinctCorrect, sessions: rules.minSessions };
  const sorted = [...evidence].sort((a, b) => a.at.getTime() - b.at.getTime());

  const correctQuestions = new Set<string>();
  const days = new Set<string>();
  let hintedCorrect = 0;
  let incorrect = 0;
  let lastIndependent: Date | null = null;
  // Each mistake waits for `correctToResolveError` independent correct answers on other questions.
  let pending: { questionId: string; resolvedBy: number }[] = [];

  for (const e of sorted) {
    if (!e.correct) {
      incorrect++;
      pending.push({ questionId: e.questionId, resolvedBy: 0 });
      continue;
    }
    if (!isIndependent(e)) {
      hintedCorrect++;
      continue;
    }
    correctQuestions.add(e.questionId);
    days.add(localDate(e.at, timeZone));
    lastIndependent = e.at;
    pending = pending
      .map((p) => (p.questionId === e.questionId ? p : { ...p, resolvedBy: p.resolvedBy + 1 }))
      .filter((p) => p.resolvedBy < rules.correctToResolveError);
  }

  const last = sorted.at(-1)?.at ?? null;
  const summary: SkillEvidenceSummary = {
    distinctCorrect: correctQuestions.size,
    sessions: days.size,
    hintedCorrect,
    incorrect,
    unresolvedErrors: pending.length,
    lastPracticedAt: last ? last.toISOString() : null,
  };
  const result = (status: SkillStatus, reason: SkillReason): SkillMastery => ({ status, reason, evidence: summary, required });

  if (sorted.length === 0) return result("not_assessed", questionCount < rules.minDistinctCorrect ? "not_enough_questions" : "no_evidence");

  const metBar = correctQuestions.size >= rules.minDistinctCorrect && days.size >= rules.minSessions;
  if (metBar && pending.length > 0) return result("needs_review", "recent_error");
  if (metBar) {
    const idleDays = lastIndependent ? (now.getTime() - lastIndependent.getTime()) / 86_400_000 : Infinity;
    return idleDays > rules.reviewAfterDays ? result("needs_review", "stale") : result("mastered", "mastered");
  }
  if (pending.length > 0) return result("learning", "recent_error");
  if (questionCount < rules.minDistinctCorrect) return result("learning", "not_enough_questions");
  if (correctQuestions.size < rules.minDistinctCorrect) return result("learning", "needs_more_correct");
  return result("learning", "needs_more_sessions");
}

/** A chapter is only as settled as its least settled assessed skill. */
export function chapterStatus(statuses: SkillStatus[]): SkillStatus {
  if (statuses.length === 0 || statuses.every((s) => s === "not_assessed")) return "not_assessed";
  if (statuses.includes("needs_review")) return "needs_review";
  if (statuses.every((s) => s === "mastered")) return "mastered";
  return "learning";
}

export function statusTotals(statuses: SkillStatus[]): Record<SkillStatus, number> {
  const totals: Record<SkillStatus, number> = { not_assessed: 0, learning: 0, needs_review: 0, mastered: 0 };
  for (const s of statuses) totals[s]++;
  return totals;
}
