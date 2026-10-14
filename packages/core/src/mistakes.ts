/** An unrecovered mistake-notebook entry, reduced to what recovery needs. */
export interface OpenMistake {
  id: string;
  questionId: string;
  skillKey: string;
  createdAt: Date;
  retriedCorrectAt: Date | null;
  /** Quiz or lesson attempt the mistake was made in. */
  attemptId: string;
}

/** A newly graded answer. */
export interface GradedAnswer {
  questionId: string;
  skillKey: string;
  correct: boolean;
  hintsUsed: number;
  at: Date;
  /** Row id of the answer, kept as the proof of recovery. */
  answerId: string;
  attemptId: string;
}

export interface MistakeUpdate {
  id: string;
  /** Answered the same question correctly later: practice, not proof of the skill. */
  retriedCorrectAt?: Date;
  /** Answered a different question on the same skill correctly without a hint. */
  recoveredAt?: Date;
  recoveredByAnswerId?: string;
}

/**
 * Applies new answers to open mistakes. A mistake is recovered only by an independent correct answer
 * to a *different* question on the same skill, given after the mistake in a later session (not later
 * in the same quiz, before the learner has seen the correction). Getting the very same question right
 * is recorded as a successful retry, which on its own does not recover the skill.
 */
export function recoveryUpdates(open: OpenMistake[], answers: GradedAnswer[]): MistakeUpdate[] {
  const updates = new Map<string, MistakeUpdate>();
  const ordered = [...answers].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const m of open) {
    for (const a of ordered) {
      if (!a.correct || a.skillKey !== m.skillKey || a.attemptId === m.attemptId || a.at.getTime() <= m.createdAt.getTime()) continue;
      const u = updates.get(m.id) ?? { id: m.id };
      if (a.questionId === m.questionId) {
        if (!m.retriedCorrectAt && !u.retriedCorrectAt) u.retriedCorrectAt = a.at;
      } else if (a.hintsUsed === 0 && !u.recoveredAt) {
        u.recoveredAt = a.at;
        u.recoveredByAnswerId = a.answerId;
      }
      updates.set(m.id, u);
    }
  }
  return [...updates.values()].filter((u) => u.retriedCorrectAt || u.recoveredAt);
}

/** Groups open mistakes by skill, most recent first, for the Today plan and the notebook. */
export function groupBySkill<T extends { skillKey: string; createdAt: Date }>(items: T[]): { skillKey: string; items: T[]; latest: Date }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.skillKey, [...(groups.get(item.skillKey) ?? []), item]);
  return [...groups.entries()]
    .map(([skillKey, list]) => ({
      skillKey,
      items: list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      latest: new Date(Math.max(...list.map((i) => i.createdAt.getTime()))),
    }))
    .sort((a, b) => b.latest.getTime() - a.latest.getTime());
}
