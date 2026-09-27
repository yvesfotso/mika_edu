import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ApiError } from "../db";
import type { ActionState } from "./state";

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function num(fd: FormData, key: string, fallback = 0): number {
  const v = Number(str(fd, key));
  return Number.isFinite(v) && str(fd, key) !== "" ? v : fallback;
}

export function localized(fd: FormData, key: string): { en?: string; fr?: string } {
  return { en: str(fd, `${key}_en`) || undefined, fr: str(fd, `${key}_fr`) || undefined };
}

/** Runs a mutation and converts expected failures into form state instead of an error page. */
export async function runAction(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true, message: "Saved" };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("\n"),
      };
    }
    if (err instanceof ApiError) return { ok: false, error: err.message };
    console.error("[cms] action failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
