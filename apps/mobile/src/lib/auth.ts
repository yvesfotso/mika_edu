import { isDemo } from "./config";
import { demoAuth } from "@/demo/auth";
import { supabaseAuth } from "./supabase";

export interface AuthSession {
  userId: string;
  email: string | null;
  accessToken: string;
}

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  onChange(listener: (session: AuthSession | null) => void): () => void;
  /** `remember: false` keeps the session only until the app is closed (where the provider supports it). */
  signIn(email: string, password: string, options?: { remember?: boolean }): Promise<{ error: string | null }>;
  signUp(
    email: string,
    password: string,
    meta: { displayName: string; preferredLanguage: string },
  ): Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

export const auth: AuthProvider = isDemo ? demoAuth : supabaseAuth;
