import {
  isAnswerCorrect,
  type AnswerInputDto,
  type ChapterDto,
  type CheckpointResultDto,
  type LessonDto,
  type PackQuestionDto,
  type StudyPackDto,
} from "@eduprep/core";
import { useSyncExternalStore } from "react";
import { api, NetworkError } from "./api";
import { store } from "./storage";

/**
 * Offline study packs: one chapter's lessons, checkpoints and practice questions (with keys) stored on
 * the device. A pack is "ready" only after it was written and read back intact, so an interrupted or
 * failed download never looks usable.
 */
export type PackStatus =
  | { state: "downloading" }
  | { state: "ready"; version: string; bytes: number; downloadedAt: string }
  | { state: "failed"; reason: "network" | "storage" | "server" };

type PackIndex = Record<string, PackStatus>;

const indexKey = (userId: string) => `packs:${userId}`;
const packKey = (userId: string, chapterId: string) => `pack:${userId}:${chapterId}`;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function packIndex(userId: string): PackIndex {
  return store.get<PackIndex>(indexKey(userId)) ?? {};
}

function setStatus(userId: string, chapterId: string, status: PackStatus | null) {
  const index = packIndex(userId);
  if (status) index[chapterId] = status;
  else delete index[chapterId];
  store.set(indexKey(userId), index);
  changed();
}

/** Status per chapter, re-rendering when a download starts, finishes or is deleted. */
export function usePackIndex(userId: string | null): PackIndex {
  const raw = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (userId ? JSON.stringify(packIndex(userId)) : "{}"),
  );
  return JSON.parse(raw) as PackIndex;
}

export function getPack(userId: string, chapterId: string): StudyPackDto | null {
  return packIndex(userId)[chapterId]?.state === "ready" ? store.get<StudyPackDto>(packKey(userId, chapterId)) : null;
}

/** All ready packs, to find a lesson or question offline. */
function readyPacks(userId: string): StudyPackDto[] {
  return Object.entries(packIndex(userId))
    .filter(([, s]) => s.state === "ready")
    .map(([chapterId]) => store.get<StudyPackDto>(packKey(userId, chapterId)))
    .filter((p): p is StudyPackDto => Boolean(p));
}

/** Rough size before downloading: lesson text dominates. Shown as an estimate. */
export function estimatePackBytes(chapter: ChapterDto): number {
  return chapter.lessons.reduce((sum, l) => sum + l.estimatedMinutes * 900, 0) + (chapter.questionCount + 3) * 1600;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function downloadPack(userId: string, chapterId: string): Promise<PackStatus> {
  setStatus(userId, chapterId, { state: "downloading" });
  let pack: StudyPackDto;
  try {
    ({ pack } = await api.get<{ pack: StudyPackDto }>(`/chapters/${chapterId}/pack`));
  } catch (err) {
    const status: PackStatus = { state: "failed", reason: err instanceof NetworkError ? "network" : "server" };
    setStatus(userId, chapterId, status);
    return status;
  }
  const serialized = JSON.stringify(pack);
  const written = store.trySet(packKey(userId, chapterId), pack);
  const readBack = written ? store.get<StudyPackDto>(packKey(userId, chapterId)) : null;
  if (!readBack || readBack.version !== pack.version || readBack.questions.length !== pack.questions.length) {
    store.remove(packKey(userId, chapterId));
    const status: PackStatus = { state: "failed", reason: "storage" };
    setStatus(userId, chapterId, status);
    return status;
  }
  const status: PackStatus = { state: "ready", version: pack.version, bytes: serialized.length, downloadedAt: new Date().toISOString() };
  setStatus(userId, chapterId, status);
  return status;
}

export function deletePack(userId: string, chapterId: string) {
  store.remove(packKey(userId, chapterId));
  setStatus(userId, chapterId, null);
}

/** A downloaded lesson in the same shape as GET /lessons/:id, with this device's progress. */
export function lessonFromPack(userId: string, lessonId: string): LessonDto | null {
  for (const pack of readyPacks(userId)) {
    const lesson = pack.lessons.find((l) => l.id === lessonId);
    if (!lesson) continue;
    const questions = new Map(pack.questions.map((q) => [q.id, q]));
    return {
      id: lesson.id,
      chapterId: pack.chapterId,
      title: lesson.title,
      body: lesson.body,
      estimatedMinutes: lesson.estimatedMinutes,
      version: lesson.version,
      completed: false,
      checkpoints: lesson.checkpoints
        .map((cp) => ({ cp, q: questions.get(cp.questionId) }))
        .filter((x): x is { cp: typeof x.cp; q: PackQuestionDto } => Boolean(x.q))
        .map(({ cp, q }) => ({ afterBlock: cp.afterBlock, question: stripKey(q) })),
      progress: { lastBlock: 0, checkpoints: {} },
    };
  }
  return null;
}

export function packQuestion(userId: string, questionId: string): PackQuestionDto | null {
  for (const pack of readyPacks(userId)) {
    const q = pack.questions.find((x) => x.id === questionId);
    if (q) return q;
  }
  return null;
}

function stripKey(q: PackQuestionDto) {
  const { key: _key, explanation: _explanation, misconceptions: _m, purpose: _p, ...question } = q;
  return question;
}

/** Deterministic marking from the pack's key. Provisional: the server re-marks on sync. */
export function markOffline(q: PackQuestionDto, answer: AnswerInputDto): CheckpointResultDto {
  const correct = isAnswerCorrect(
    {
      id: q.id,
      type: q.type,
      options: q.options.map((o) => ({ id: o.id, isCorrect: q.key.correctOptionIds.includes(o.id) })),
      numericAnswer: q.key.numericAnswer,
      numericTolerance: q.key.numericTolerance,
    },
    answer,
  );
  const picked = answer.selectedOptionIds?.length === 1 ? answer.selectedOptionIds[0]! : null;
  return {
    questionId: q.id,
    correct,
    correctOptionIds: q.key.correctOptionIds,
    correctNumericValue: q.type === "numeric" ? q.key.numericAnswer : null,
    explanation: q.explanation,
    misconception: !correct && picked ? (q.misconceptions[picked] ?? null) : null,
    mistakeId: null,
  };
}
