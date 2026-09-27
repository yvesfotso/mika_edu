import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export type Db = SupabaseClient;

let serviceClient: Db | null = null;

/**
 * Service-role client: bypasses RLS. Only use after the caller has been authenticated and
 * authorized in this process; never expose it or its key to a browser or device.
 */
export function serviceDb(): Db {
  serviceClient ??= createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);

/** Unwrap a Supabase response, turning database errors into 500s with the original logged. */
export function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }, context: string): T {
  if (res.error) {
    console.error(`[db] ${context}:`, res.error);
    throw new ApiError(500, "db_error", `Database error while ${context}`);
  }
  return res.data as T;
}
