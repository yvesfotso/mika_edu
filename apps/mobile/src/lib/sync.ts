import { api, ApiError, NetworkError } from "./api";
import { store } from "./storage";
import { randomId } from "./ids";

/** A write made while offline, replayed later. Every endpoint used here is idempotent server-side. */
export interface SyncJob {
  id: string;
  path: string;
  body: unknown;
  createdAt: string;
}

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();
let flushing: Promise<number> | null = null;

const queueKey = (userId: string) => `sync:queue:${userId}`;

export function pendingJobs(userId: string): SyncJob[] {
  return store.get<SyncJob[]>(queueKey(userId)) ?? [];
}

function save(userId: string, jobs: SyncJob[]) {
  store.set(queueKey(userId), jobs);
  for (const l of listeners) l(jobs.length);
}

export function subscribePending(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function enqueue(userId: string, path: string, body: unknown): void {
  save(userId, [...pendingJobs(userId), { id: randomId(), path, body, createdAt: new Date().toISOString() }]);
}

/**
 * Replays queued writes in order. Stops at the first network failure so ordering is kept;
 * drops jobs the server rejects permanently (4xx) so one bad job can't block the queue.
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
          console.warn("[sync] dropping rejected job", job.path, err);
        }
        save(
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
