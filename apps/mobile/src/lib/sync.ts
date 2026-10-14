import { api, ApiError, NetworkError } from "./api";
import { randomId } from "./ids";
import { store } from "./storage";

/**
 * A write made while offline (outbox entry), replayed later. Every endpoint used here is idempotent
 * server-side: lesson completion and progress, and attempts carrying a client-generated id.
 */
export interface SyncJob {
  id: string;
  path: string;
  body: unknown;
  createdAt: string;
}

/** A job the server rejected. Kept so the learner can see it, retry it or discard it. */
export interface FailedJob extends SyncJob {
  error: string;
  failedAt: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let flushing: Promise<number> | null = null;

const queueKey = (userId: string) => `sync:queue:${userId}`;
const failedKey = (userId: string) => `sync:failed:${userId}`;

export function pendingJobs(userId: string): SyncJob[] {
  return store.get<SyncJob[]>(queueKey(userId)) ?? [];
}

export function failedJobs(userId: string): FailedJob[] {
  return store.get<FailedJob[]>(failedKey(userId)) ?? [];
}

function notify() {
  for (const l of listeners) l();
}

function saveQueue(userId: string, jobs: SyncJob[]) {
  store.set(queueKey(userId), jobs);
  notify();
}

function saveFailed(userId: string, jobs: FailedJob[]) {
  store.set(failedKey(userId), jobs);
  notify();
}

export function subscribePending(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns false if the device couldn't store the job (e.g. storage full). */
export function enqueue(userId: string, path: string, body: unknown): boolean {
  const ok = store.trySet(queueKey(userId), [...pendingJobs(userId), { id: randomId(), path, body, createdAt: new Date().toISOString() }]);
  notify();
  return ok;
}

export function retryFailed(userId: string, jobId: string) {
  const job = failedJobs(userId).find((j) => j.id === jobId);
  if (!job) return;
  saveFailed(
    userId,
    failedJobs(userId).filter((j) => j.id !== jobId),
  );
  saveQueue(userId, [...pendingJobs(userId), { id: job.id, path: job.path, body: job.body, createdAt: job.createdAt }]);
}

export function discardFailed(userId: string, jobId: string) {
  saveFailed(
    userId,
    failedJobs(userId).filter((j) => j.id !== jobId),
  );
}

/**
 * Replays queued writes in order. Stops at the first network or server failure so ordering is kept;
 * a job the server rejects outright (4xx) moves to the failed list so one bad job can't block the
 * queue and the learner can still see what didn't sync.
 */
export function flushQueue(userId: string): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    try {
      for (const job of pendingJobs(userId)) {
        try {
          await api.post(job.path, job.body);
          sent++;
        } catch (err) {
          if (err instanceof NetworkError) break;
          if (err instanceof ApiError && (err.status === 401 || err.status === 429 || err.status >= 500)) break;
          saveFailed(userId, [
            ...failedJobs(userId),
            { ...job, error: err instanceof Error ? err.message : String(err), failedAt: new Date().toISOString() },
          ]);
        }
        saveQueue(
          userId,
          pendingJobs(userId).filter((j) => j.id !== job.id),
        );
      }
    } finally {
      flushing = null;
    }
    return sent;
  })();
  return flushing;
}
