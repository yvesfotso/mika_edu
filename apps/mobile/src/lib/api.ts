import type { ApiErrorBody } from "@eduprep/core";
import { demoRequest } from "@/demo/server";
import { auth } from "./auth";
import { config, isDemo } from "./config";
import { ApiError, NetworkError } from "./errors";
import { store } from "./storage";

export { ApiError, NetworkError };

const TIMEOUT_MS = 20_000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = await auth.getSession();
  if (isDemo) return demoRequest<T>(method, path, body, session?.userId ?? null);
  const token = session?.accessToken;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}/api/v1${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? "http_error", json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
};

export const cacheKey = (userId: string, path: string) => `cache:${userId}:${path}`;

/** GET and remember the response so the screen still works offline next time. */
export async function getAndCache<T>(userId: string, path: string): Promise<T> {
  const data = await api.get<T>(path);
  store.set(cacheKey(userId, path), data);
  return data;
}

export function errorMessage(err: unknown, offlineText: string): string {
  if (err instanceof NetworkError) return offlineText;
  if (err instanceof Error) return err.message;
  return String(err);
}
