import type { AnswerInputDto, QuestionType } from "./types";

export interface ScorableQuestion {
  id: string;
  type: QuestionType;
  options: { id: string; isCorrect: boolean }[];
  numericAnswer: number | null;
  numericTolerance: number | null;
}

export interface ScoredAnswer {
  questionId: string;
  answered: boolean;
  correct: boolean;
}

export interface ScoreSummary {
  results: ScoredAnswer[];
  score: number;
  maxScore: number;
  percentage: number;
}

export function isAnswerCorrect(question: ScorableQuestion, answer: AnswerInputDto | undefined): boolean {
  if (!answer) return false;

  if (question.type === "numeric") {
    if (answer.numericValue === undefined || question.numericAnswer === null) return false;
    // Relative tolerance guards against float noise like 0.1 + 0.2.
    const tolerance = Math.max(question.numericTolerance ?? 0, Math.abs(question.numericAnswer) * 1e-9);
    return Math.abs(answer.numericValue - question.numericAnswer) <= tolerance;
  }

  const selected = new Set(answer.selectedOptionIds ?? []);
  const correct = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
  if (selected.size === 0 || selected.size !== correct.size) return false;
  for (const id of selected) if (!correct.has(id)) return false;
  return true;
}

export function isAnswered(answer: AnswerInputDto | undefined): boolean {
  if (!answer) return false;
  return answer.numericValue !== undefined || (answer.selectedOptionIds?.length ?? 0) > 0;
}

/** One point per question, all-or-nothing. Answers for questions outside the attempt are ignored. */
export function scoreAttempt(questions: ScorableQuestion[], answers: AnswerInputDto[]): ScoreSummary {
  const byQuestion = new Map<string, AnswerInputDto>();
  for (const a of answers) byQuestion.set(a.questionId, a);

  const results = questions.map((q) => {
    const answer = byQuestion.get(q.id);
    return { questionId: q.id, answered: isAnswered(answer), correct: isAnswerCorrect(q, answer) };
  });
  const score = results.filter((r) => r.correct).length;
  const maxScore = questions.length;
  return {
    results,
    score,
    maxScore,
    percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 1000) / 10,
  };
}

/** Late submissions get a short network grace period; beyond that only autosaved answers count. */
export const MOCK_SUBMIT_GRACE_MS = 30_000;

export function acceptsAnswersAt(deadlineAt: Date | null, now: Date, graceMs = MOCK_SUBMIT_GRACE_MS): boolean {
  if (!deadlineAt) return true;
  return now.getTime() <= deadlineAt.getTime() + graceMs;
}

/** Later answers for the same question replace earlier ones. */
export function mergeAnswers(saved: AnswerInputDto[], incoming: AnswerInputDto[]): AnswerInputDto[] {
  const merged = new Map<string, AnswerInputDto>();
  for (const a of saved) merged.set(a.questionId, a);
  for (const a of incoming) merged.set(a.questionId, a);
  return [...merged.values()];
}
