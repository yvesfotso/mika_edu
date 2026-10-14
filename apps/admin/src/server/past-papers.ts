import "server-only";
import { z } from "zod";
import { must } from "./db";
import type { StaffContext } from "./staff";

export const PAST_PAPER_BUCKET = "past-papers";
/** Keep in sync with serverActions.bodySizeLimit and proxyClientMaxBodySize in next.config.ts. */
export const PAST_PAPER_MAX_BYTES = 15 * 1024 * 1024;

/** The stored PDF of a past paper, or null. The caller must already have checked the staff role. */
export async function loadPastPaperFile(staff: StaffContext, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const paper = must(await staff.db.from("past_papers").select("file_path, file_name").eq("id", id).maybeSingle(), "loading past paper") as {
    file_path: string;
    file_name: string;
  } | null;
  if (!paper) return null;
  const { data, error } = await staff.db.storage.from(PAST_PAPER_BUCKET).download(paper.file_path);
  if (error || !data) {
    console.error("[storage] past paper download failed", paper.file_path, error);
    return null;
  }
  return { name: paper.file_name, body: data };
}
