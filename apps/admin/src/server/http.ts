import "server-only";
import type { ApiErrorBody } from "@eduprep/core";
import { z, ZodError, type ZodType } from "zod";
import { ApiError, serviceDb, type Db } from "./db";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.API_CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
    return json(body, err.status);
  }
  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: { code: "validation_error", message: "Invalid request", details: err.issues },
    };
    return json(body, 422);
  }
  console.error("[api] unhandled error", err);
  return json({ error: { code: "internal_error", message: "Something went wrong" } } satisfies ApiErrorBody, 500);
}

export interface LearnerContext {
  userId: string;
  db: Db;
  now: Date;
}

/** Verifies the Supabase access token sent by the mobile app as `Authorization: Bearer <jwt>`. */
async function authenticate(request: Request): Promise<LearnerContext> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "unauthenticated", "Sign in required");

  const db = serviceDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "unauthenticated", "Session expired, please sign in again");
  return { userId: data.user.id, db, now: new Date() };
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
  return schema.parse(body);
}

const uuid = z.uuid();

/** Malformed ids are a 404, not a database error. */
export function idParam(value: string | undefined, what: string): string {
  if (!value || !uuid.safeParse(value).success) throw new ApiError(404, "not_found", `${what} not found`);
  return value;
}

/** Wraps a learner endpoint with authentication and uniform error handling. */
export function learnerRoute<P = Record<string, never>>(
  handler: (ctx: LearnerContext, request: Request, params: P) => Promise<unknown>,
) {
  return async (request: Request, route?: { params?: Promise<P> }): Promise<Response> => {
    try {
      const ctx = await authenticate(request);
      const params = (await route?.params) ?? ({} as P);
      return json(await handler(ctx, request, params));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Public endpoints (no sign-in) such as the exam catalogue shown during onboarding. */
export function publicRoute(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    try {
      return json(await handler(request));
    } catch (err) {
      return errorResponse(err);
    }
  };
}
