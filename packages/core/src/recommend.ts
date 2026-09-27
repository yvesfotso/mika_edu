import { retainedScore, type MasteryState } from "./mastery";

export interface ChapterCandidate {
  chapterId: string;
  subjectId: string;
  /** Subject coefficient in the learner's exam track. */
  coefficient: number;
  orderIndex: number;
  hasQuestions: boolean;
  mastery: MasteryState | null;
}

export interface Recommendation {
  chapterId: string;
  priority: number;
  mastery: number;
  reason: "weak" | "forgetting" | "not_started";
}

const MASTERED = 0.85;

/**
 * Rank chapters to study next: weak and fading chapters in high-coefficient subjects first,
 * then the earliest unstarted chapters so new learners get a sensible starting point.
 */
export function recommendChapters(candidates: ChapterCandidate[], now: Date, limit = 3): Recommendation[] {
  const maxCoef = Math.max(1, ...candidates.map((c) => c.coefficient));
  const ranked: Recommendation[] = [];

  for (const c of candidates) {
    if (!c.hasQuestions) continue;
    const coefWeight = 0.5 + 0.5 * (c.coefficient / maxCoef);

    if (!c.mastery || c.mastery.attemptsCount === 0) {
      ranked.push({
        chapterId: c.chapterId,
        mastery: 0,
        reason: "not_started",
        // Earlier chapters first; below any started-but-weak chapter of equal weight.
        priority: coefWeight * 0.6 - c.orderIndex * 0.001,
      });
      continue;
    }

    const retained = retainedScore(c.mastery, now);
    if (retained >= MASTERED) continue;
    const forgetting = c.mastery.score - retained > 0.1;
    ranked.push({
      chapterId: c.chapterId,
      mastery: retained,
      reason: forgetting ? "forgetting" : "weak",
      priority: coefWeight * (1 - retained) + (forgetting ? 0.1 : 0),
    });
  }

  return ranked.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

/** Coefficient-weighted average mastery across subjects. */
export function weightedMastery(items: { mastery: number; coefficient: number }[]): number {
  const total = items.reduce((sum, i) => sum + i.coefficient, 0);
  if (total === 0) return 0;
  return Math.round((items.reduce((sum, i) => sum + i.mastery * i.coefficient, 0) / total) * 1000) / 1000;
}
