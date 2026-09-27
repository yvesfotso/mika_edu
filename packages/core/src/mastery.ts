import type { AttemptMode } from "./types";

export interface MasteryState {
  /** 0..1 estimate of how well the learner knows the chapter. */
  score: number;
  /** 0..1 how much evidence backs the score. */
  confidence: number;
  attemptsCount: number;
  lastPracticedAt: Date | null;
}

export interface MasteryEvidence {
  correct: boolean;
  difficulty: number;
  responseMs?: number;
  hintsUsed?: number;
  mode: AttemptMode;
}

export const EMPTY_MASTERY: MasteryState = { score: 0, confidence: 0, attemptsCount: 0, lastPracticedAt: null };

const LEARNING_RATE = 0.2;
const SLOW_ANSWER_MS = 3 * 60 * 1000;
const FORGETTING_HALF_LIFE_DAYS = 45;
const RETENTION_FLOOR = 0.6;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** How strongly one answer should count as proof of knowing the chapter (0..1). */
export function evidenceValue(e: MasteryEvidence): number {
  if (!e.correct) return 0;
  let value = 1;
  if (e.hintsUsed && e.hintsUsed > 0) value -= Math.min(0.5, 0.2 * e.hintsUsed);
  if (e.responseMs !== undefined && e.responseMs > SLOW_ANSWER_MS) value -= 0.15;
  return clamp01(value);
}

/** Harder questions and exam conditions move mastery more. */
export function evidenceWeight(e: MasteryEvidence): number {
  const difficultyWeight = 0.6 + 0.2 * Math.min(5, Math.max(1, e.difficulty));
  const modeWeight = e.mode === "mock" ? 1.3 : e.mode === "past_paper" ? 1.15 : 1;
  return difficultyWeight * modeWeight;
}

/** Exponential moving average over answers so recent performance dominates. */
export function updateMastery(prev: MasteryState, evidence: MasteryEvidence[], now: Date): MasteryState {
  if (evidence.length === 0) return prev;
  let score = prev.attemptsCount === 0 ? 0 : retainedScore(prev, now);
  for (const e of evidence) {
    const rate = clamp01(LEARNING_RATE * evidenceWeight(e));
    score += rate * (evidenceValue(e) - score);
  }
  const attemptsCount = prev.attemptsCount + evidence.length;
  return {
    score: round3(clamp01(score)),
    confidence: round3(1 - Math.exp(-attemptsCount / 12)),
    attemptsCount,
    lastPracticedAt: now,
  };
}

/** Mastery after forgetting: decays toward a floor of the stored score as time passes without practice. */
export function retainedScore(state: MasteryState, now: Date): number {
  if (!state.lastPracticedAt) return state.score;
  const days = Math.max(0, (now.getTime() - state.lastPracticedAt.getTime()) / 86_400_000);
  const retention = RETENTION_FLOOR + (1 - RETENTION_FLOOR) * Math.pow(0.5, days / FORGETTING_HALF_LIFE_DAYS);
  return round3(state.score * retention);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
