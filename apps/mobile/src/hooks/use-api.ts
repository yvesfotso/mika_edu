import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ApiError, cacheKey, getAndCache, NetworkError } from "@/lib/api";
import { store } from "@/lib/storage";
import { useSession } from "@/providers/session";

export interface ApiState<T> {
  data: T | null;
  /** Showing saved data because the network request failed. */
  offline: boolean;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Cache-first GET: renders the saved copy immediately, then refreshes from the network each
 * time the screen gains focus. Pass `null` to skip.
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const { userId, t } = useSession();
  const key = path && userId ? cacheKey(userId, path) : null;
  const [data, setData] = useState<T | null>(() => (key ? store.get<T>(key) : null));
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState(key);

  if (loadedKey !== key) {
    setLoadedKey(key);
    setData(key ? store.get<T>(key) : null);
    setError(null);
  }

  const refresh = useCallback(async () => {
    if (!path || !userId) return;
    setLoading(true);
    try {
      const fresh = await getAndCache<T>(userId, path);
      setData(fresh);
      setOffline(false);
      setError(null);
    } catch (err) {
      if (err instanceof NetworkError) {
        setOffline(true);
        setError(store.get<T>(cacheKey(userId, path)) ? null : t("offlineNoData"));
      } else {
        setError(err instanceof ApiError ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [path, userId, t]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { data, offline, error, loading, refresh };
}
