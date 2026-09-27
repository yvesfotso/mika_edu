import "./storage";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { AuthProvider, AuthSession } from "./auth";
import { config } from "./config";

let client: SupabaseClient | null = null;

/** Created on first use so demo mode never needs Supabase settings. Used for authentication only. */
function supabase(): SupabaseClient {
  if (client) return client;
  const created = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Only refresh tokens while the app is in the foreground.
  if (Platform.OS !== "web") {
    AppState.addEventListener("change", (state) => {
      if (state === "active") created.auth.startAutoRefresh();
      else created.auth.stopAutoRefresh();
    });
  }
  client = created;
  return created;
}

const toSession = (s: Session | null): AuthSession | null =>
  s ? { userId: s.user.id, email: s.user.email ?? null, accessToken: s.access_token } : null;

export const supabaseAuth: AuthProvider = {
  async getSession() {
    const { data } = await supabase().auth.getSession();
    return toSession(data.session);
  },
  onChange(listener) {
    const { data } = supabase().auth.onAuthStateChange((_event, session) => listener(toSession(session)));
    return () => data.subscription.unsubscribe();
  },
  // Supabase sessions are always persisted; `remember` is not applied here yet.
  async signIn(email, password) {
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  async signUp(email, password, meta) {
    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { display_name: meta.displayName, preferred_language: meta.preferredLanguage } },
    });
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
  },
  async signOut() {
    await supabase().auth.signOut();
  },
};
