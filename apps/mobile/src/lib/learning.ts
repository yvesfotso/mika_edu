import type {
  AnswerInputDto,
  AttemptMode,
  AttemptQuestionDto,
  AttemptResultDto,
  CheckpointResultDto,
  ContentReportInput,
  LessonDto,
  QuizAttemptDto,
} from "@eduprep/core";
import { api, cacheKey, NetworkError } from "./api";
import { randomId } from "./ids";
import { markOffline, packQuestion } from "./packs";
import { store } from "./storage";
import { enqueue } from "./sync";

export type AttemptView = { attempt: QuizAttemptDto; result: AttemptResultDto | null };

export interface QuizScope {
  chapterId?: string;
  subjectId?: string;
  skillId?: string;
  excludeQuestionIds?: string[];
}

const DEFAULT_COUNT: Partial<Record<AttemptMode, number>> = { mock: 20, recovery: 3 };

/** Starts a quiz on the server (retry-safe) and caches it so the quiz screen opens instantly. */
export async function startQuiz(userId: string, scope: QuizScope, mode: AttemptMode, questionCount?: number): Promise<string> {
  const view = await api.post<AttemptView>("/quiz-attempts", {
    clientAttemptId: randomId(),
    mode,
    questionCount: questionCount ?? DEFAULT_COUNT[mode] ?? 10,
    ...scope,
  });
  store.set(cacheKey(userId, `/quiz-attempts/${view.attempt.id}`), view);
  return view.attempt.id;
}

/** Returns "online" or "queued" (saved on the phone and replayed later). */
export async function completeLesson(userId: string, lessonId: string, secondsSpent: number): Promise<"online" | "queued"> {
  const body = { secondsSpent: Math.round(secondsSpent), completedAt: new Date().toISOString() };
  try {
    await api.post(`/lessons/${lessonId}/complete`, body);
    return "online";
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    enqueue(userId, `/lessons/${lessonId}/complete`, body);
    return "queued";
  }
}

/** Remembers the furthest block reached (on the device at once, on the server when possible). */
export function saveLessonProgress(userId: string, lesson: LessonDto, block: number) {
  if (block <= lesson.progress.lastBlock) return;
  const key = cacheKey(userId, `/lessons/${lesson.id}`);
  const cached = store.get<{ lesson: LessonDto }>(key);
  if (cached) store.set(key, { lesson: { ...cached.lesson, progress: { ...cached.lesson.progress, lastBlock: block } } });
  api.post(`/lessons/${lesson.id}/progress`, { block }).catch((err) => {
    if (err instanceof NetworkError) enqueue(userId, `/lessons/${lesson.id}/progress`, { block });
  });
}

/**
 * Sends a checkpoint answer. Offline, a downloaded pack marks it on the device and the answer is
 * queued (with its own id, so syncing twice records it once). Without a pack it can't be marked.
 */
export async function answerCheckpoint(
  userId: string,
  lessonId: string,
  question: AttemptQuestionDto,
  answer: Omit<AnswerInputDto, "questionId">,
): Promise<{ result: CheckpointResultDto; queued: boolean }> {
  const body = {
    clientAttemptId: randomId(),
    lessonId,
    questionId: question.id,
    questionVersion: question.version,
    answeredAt: new Date().toISOString(),
    ...answer,
  };
  try {
    const { result } = await api.post<{ result: CheckpointResultDto }>("/checkpoints", body);
    return { result, queued: false };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    const local = packQuestion(userId, question.id);
    if (!local) throw err;
    enqueue(userId, "/checkpoints", body);
    return { result: markOffline(local, { questionId: question.id, ...answer }), queued: true };
  }
}

/** Reports need the server (they go to reviewers); offline, the app says so instead of pretending. */
export function reportContent(input: ContentReportInput) {
  return api.post<{ reported: boolean; duplicate: boolean }>("/content-reports", input);
}

export function reviewMistake(mistakeId: string) {
  return api.post<{ reviewedAt: string }>(`/me/mistakes/${mistakeId}/review`, {});
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}
