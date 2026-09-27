import type { AuthProvider, AuthSession } from "@/lib/auth";
import { randomId } from "@/lib/ids";
import { store } from "@/lib/storage";
import { DEMO_ACCOUNT, ensureDemoUserState } from "./server";

// Demo-only account store kept on this device. Never used when a real backend is configured.
interface DemoUser {
  id: string;
  password: string;
  displayName: string;
  preferredLanguage: string;
}

const USERS_KEY = "demo:users";
const SESSION_KEY = "demo:session";
const listeners = new Set<(s: AuthSession | null) => void>();
let memorySession: AuthSession | null = null;

function users(): Record<string, DemoUser> {
  const all = store.get<Record<string, DemoUser>>(USERS_KEY) ?? {};
  if (!all[DEMO_ACCOUNT.email]) {
    all[DEMO_ACCOUNT.email] = {
      id: DEMO_ACCOUNT.userId,
      password: DEMO_ACCOUNT.password,
      displayName: DEMO_ACCOUNT.displayName,
      preferredLanguage: "fr",
    };
    store.set(USERS_KEY, all);
  }
  return all;
}

function start(email: string, user: DemoUser, remember = true): AuthSession {
  ensureDemoUserState(user.id, user.displayName, user.preferredLanguage === "fr" ? "fr" : "en");
  const session = { userId: user.id, email, accessToken: `demo-${user.id}` };
  if (remember) {
    memorySession = null;
    store.set(SESSION_KEY, session);
  } else {
    store.remove(SESSION_KEY);
    memorySession = session;
  }
  for (const l of listeners) l(session);
  return session;
}

export const demoAuth: AuthProvider = {
  async getSession() {
    return memorySession ?? store.get<AuthSession>(SESSION_KEY);
  },
  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async signIn(email, password, options) {
    const key = email.trim().toLowerCase();
    const user = users()[key];
    if (!user || user.password !== password) return { error: "Invalid email or password" };
    start(key, user, options?.remember ?? true);
    return { error: null };
  },
  async signUp(email, password, meta) {
    const key = email.trim().toLowerCase();
    const all = users();
    if (all[key]) return { error: "An account with this email already exists", needsConfirmation: false };
    const user: DemoUser = { id: randomId(), password, displayName: meta.displayName, preferredLanguage: meta.preferredLanguage };
    store.set(USERS_KEY, { ...all, [key]: user });
    start(key, user);
    return { error: null, needsConfirmation: false };
  },
  async signOut() {
    store.remove(SESSION_KEY);
    memorySession = null;
    for (const l of listeners) l(null);
  },
};
