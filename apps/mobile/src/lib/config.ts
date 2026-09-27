function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and restart Expo.`);
  }
  return value;
}

/** Demo mode runs a simulated backend on the device, so no Supabase project or API server is needed. */
export const isDemo = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

// EXPO_PUBLIC_* variables are inlined at build time, so they must be referenced literally.
export const config = {
  get apiUrl() {
    return required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, "");
  },
  get supabaseUrl() {
    return required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  },
};
