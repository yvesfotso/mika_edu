import "server-only";
import {
  NO_HINT_MODES,
  seededShuffle,
  skillKeyFor,
  type AnswerInputDto,
  type AttemptMode,
  type AttemptQuestionDto,
  type LocalizedText,
  type PackQuestionDto,
  type QuestionPurpose,
  type QuestionSource,
  type QuestionType,
  type ScorableQuestion,
} from "@eduprep/core";
import { must, type Db } from "../db";

/** A question with its answer key. Server-side only. */
export interface QuestionRow {
  id: string;
  chapter_id: string | null;
  skill_id: string | null;
  purpose: QuestionPurpose;
  status: string;
  version: number;
  type: QuestionType;
  prompt: LocalizedText;
  difficulty: number;
  source_type: QuestionSource;
  source_year: number | null;
  numeric_answer: number | null;
  numeric_tolerance: number | null;
  question_options: { id: string; text: LocalizedText; is_correct: boolean; order_index: number; misconception: LocalizedText | null }[];
  solutions: { explanation: LocalizedText; hint: LocalizedText | null } | null;
}

export const QUESTION_COLUMNS =
  "id, chapter_id, skill_id, purpose, status, version, type, prompt, difficulty, source_type, source_year, numeric_answer, numeric_tolerance, question_options(id, text, is_correct, order_index, misconception), solutions(explanation, hint)";

/** Questions in the given order (missing ids are dropped). */
export async function loadQuestions(db: Db, ids: string[]): Promise<QuestionRow[]> {
  if (ids.length === 0) return [];
  const rows = must(await db.from("questions").select(QUESTION_COLUMNS).in("id", ids), "loading questions") as unknown as QuestionRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((q): q is QuestionRow => Boolean(q));
}

/**
 * The learner's view of a question: options shuffled per attempt (stable across reloads), no answer
 * key, and a hint only outside exam conditions.
 */
export function toLearnerQuestion(q: QuestionRow, seed: string, mode: AttemptMode): AttemptQuestionDto {
  const authored = [...q.question_options].sort((a, b) => a.order_index - b.order_index);
  const options = q.type === "true_false" ? authored : seededShuffle(authored, `${seed}:${q.id}`);
  const hint = q.solutions?.hint;
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    sourceType: q.source_type,
    sourceYear: q.source_year,
    options: options.map((o) => ({ id: o.id, text: o.text })),
    version: q.version,
    skillId: q.skill_id,
    hint: !NO_HINT_MODES.includes(mode) && hint && Object.keys(hint).length > 0 ? hint : null,
  };
}

/** Pack questions carry their key so they can be marked offline; the server re-marks them on sync. */
export function toPackQuestion(q: QuestionRow): PackQuestionDto {
  return {
    ...toLearnerQuestion(q, "pack", "practice"),
    purpose: q.purpose,
    key: {
      correctOptionIds: q.question_options.filter((o) => o.is_correct).map((o) => o.id),
      numericAnswer: q.numeric_answer,
      numericTolerance: q.numeric_tolerance,
    },
    explanation: q.solutions?.explanation ?? {},
    misconceptions: Object.fromEntries(q.question_options.filter((o) => o.misconception).map((o) => [o.id, o.misconception!])),
  };
}

export function toScorable(q: QuestionRow): ScorableQuestion {
  return {
    id: q.id,
    type: q.type,
    options: q.question_options.map((o) => ({ id: o.id, isCorrect: o.is_correct })),
    numericAnswer: q.numeric_answer,
    numericTolerance: q.numeric_tolerance,
  };
}

/** The authored misconception behind a wrong single-choice pick, if any. Never guessed. */
export function misconceptionFor(q: QuestionRow, answer: AnswerInputDto | undefined): LocalizedText | null {
  const picked = answer?.selectedOptionIds ?? [];
  if (picked.length !== 1) return null;
  const option = q.question_options.find((o) => o.id === picked[0] && !o.is_correct);
  return option?.misconception ?? null;
}

export const questionSkillKey = (q: Pick<QuestionRow, "skill_id" | "chapter_id">) =>
  q.chapter_id ? skillKeyFor(q.skill_id, q.chapter_id) : null;
