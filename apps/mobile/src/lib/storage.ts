import "expo-sqlite/localStorage/install";

/**
 * Small JSON store on top of expo-sqlite's synchronous localStorage. Used for the offline
 * response cache, the sync queue and in-progress quiz answers. Failures never crash the app.
 */
export const store = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("[store] write failed", key, err);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  /** Remove every key starting with `prefix` (e.g. one user's cached responses). */
  removePrefix(prefix: string): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(prefix)) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      // ignore
    }
  },
};
