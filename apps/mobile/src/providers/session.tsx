import { isLocale, type Locale, type ProfileDto, type UpdateProfileInput } from "@eduprep/core";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState } from "react-native";
import { api, cacheKey, NetworkError } from "@/lib/api";
import { translate, type MessageKey } from "@/lib/i18n";
import { store } from "@/lib/storage";
import { auth, type AuthSession } from "@/lib/auth";
import { flushQueue, pendingJobs, subscribePending } from "@/lib/sync";

const LOCALE_KEY = "pref:locale";

interface SessionContextValue {
  session: AuthSession | null;
  userId: string | null;
  profile: ProfileDto | null;
  /** True until the stored session (and cached profile) has been read. */
  initializing: boolean;
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  updateProfile: (patch: UpdateProfileInput) => Promise<ProfileDto>;
  refreshProfile: () => Promise<void>;
  pendingSync: number;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function loadProfile(userId: string): Promise<ProfileDto> {
  const { profile } = await api.get<{ profile: ProfileDto }>("/me");
  store.set(cacheKey(userId, "/me"), profile);
  return profile;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function initialLocale(): Locale {
  const saved = store.get<string>(LOCALE_KEY);
  if (isLocale(saved)) return saved;
  const device = getLocales()[0]?.languageCode;
  return device === "fr" ? "fr" : "en";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profileState, setProfile] = useState<ProfileDto | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const userId = session?.userId ?? null;
  const profile = userId && profileState?.id === userId ? profileState : null;
  const pendingSync = useSyncExternalStore(
    subscribePending,
    () => (userId ? pendingJobs(userId).length : 0),
  );

  useEffect(() => {
    auth.getSession().then((current) => {
      setSession(current);
      if (current) setProfile(store.get<ProfileDto>(cacheKey(current.userId, "/me")));
      setInitializing(false);
    });
    return auth.onChange(setSession);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const fresh = await loadProfile(userId);
      setProfile(fresh);
      setLocaleState(fresh.preferredLanguage);
    } catch (err) {
      if (!(err instanceof NetworkError)) console.warn("[session] profile load failed", err);
      setProfile((p) => (p?.id === userId ? p : store.get<ProfileDto>(cacheKey(userId, "/me"))));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadProfile(userId).then(
      (fresh) => {
        if (!active) return;
        setProfile(fresh);
        setLocaleState(fresh.preferredLanguage);
      },
      (err) => {
        if (!(err instanceof NetworkError)) console.warn("[session] profile load failed", err);
        if (active) setProfile((p) => (p?.id === userId ? p : store.get<ProfileDto>(cacheKey(userId, "/me"))));
      },
    );
    return () => {
      active = false;
    };
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!userId) return;
    await flushQueue(userId);
  }, [userId]);

  // Replay offline writes on sign-in and whenever the app returns to the foreground.
  useEffect(() => {
    if (!userId) return;
    void flushQueue(userId);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void flushQueue(userId);
    });
    const interval = setInterval(() => {
      if (pendingJobs(userId).length > 0) void flushQueue(userId);
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [userId]);

  const updateProfile = useCallback(
    async (patch: UpdateProfileInput) => {
      const { profile: fresh } = await api.patch<{ profile: ProfileDto }>("/me", patch);
      if (userId) store.set(cacheKey(userId, "/me"), fresh);
      setProfile(fresh);
      return fresh;
    },
    [userId],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      store.set(LOCALE_KEY, next);
      if (userId) void updateProfile({ preferredLanguage: next }).catch(() => undefined);
    },
    [userId, updateProfile],
  );

  const signOut = useCallback(async () => {
    if (userId) store.removePrefix(`cache:${userId}:`);
    await auth.signOut();
    setProfile(null);
  }, [userId]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      userId,
      profile,
      initializing,
      locale,
      t: (key, vars) => translate(locale, key, vars),
      setLocale,
      updateProfile,
      refreshProfile,
      pendingSync,
      syncNow,
      signOut,
    }),
    [session, userId, profile, initializing, locale, setLocale, updateProfile, refreshProfile, pendingSync, syncNow, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
