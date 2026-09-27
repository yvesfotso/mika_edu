import type { AttemptMode, AttemptResultDto, ChapterDto, QuizAttemptDto } from "@eduprep/core";
import { api, cacheKey, getAndCache, NetworkError } from "./api";
import { randomId } from "./ids";
import { store } from "./storage";
import { enqueue } from "./sync";

export type AttemptView = { attempt: QuizAttemptDto; result: AttemptResultDto | null };

/** Starts a quiz on the server (retry-safe) and caches it so the quiz screen opens instantly. */
export async function startQuiz(
  userId: string,
  scope: { chapterId?: string; subjectId?: string },
  mode: AttemptMode,
): Promise<string> {
  const view = await api.post<AttemptView>("/quiz-attempts", {
    clientAttemptId: randomId(),
    mode,
    questionCount: mode === "mock" ? 20 : 10,
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

/** Download every lesson of the given chapters for offline reading. Returns how many were saved. */
export async function downloadLessons(userId: string, chapters: ChapterDto[]): Promise<number> {
  let saved = 0;
  for (const lesson of chapters.flatMap((c) => c.lessons)) {
    await getAndCache(userId, `/lessons/${lesson.id}`);
    saved++;
  }
  return saved;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, "0")}`;
}
