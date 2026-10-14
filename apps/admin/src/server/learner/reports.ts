import "server-only";
import type { ContentReportInput, LocalizedText } from "@eduprep/core";
import { must, notFound, type Db } from "../db";

/** A learner flags a question or lesson that looks wrong. Repeats while open are absorbed. */
export async function reportContent(db: Db, userId: string, input: ContentReportInput) {
  let questionVersion: number | null = null;
  if (input.questionId) {
    const q = must(
      await db.from("questions").select("id, version").eq("id", input.questionId).eq("status", "published").maybeSingle<{ id: string; version: number }>(),
      "checking question",
    );
    if (!q) throw notFound("Question");
    questionVersion = q.version;
  }
  if (input.lessonId) {
    const l = must(await db.from("lessons").select("id").eq("id", input.lessonId).eq("status", "published").maybeSingle(), "checking lesson");
    if (!l) throw notFound("Lesson");
  }
  const res = await db.from("content_issue_reports").insert({
    reporter_id: userId,
    question_id: input.questionId ?? null,
    lesson_id: input.lessonId ?? null,
    question_version: questionVersion,
    reason: input.reason,
    message: input.message || null,
  });
  if (res.error?.code === "23505") return { reported: true, duplicate: true };
  must(res, "saving report");
  return { reported: true, duplicate: false };
}

export interface ContentReportRow {
  id: string;
  reason: string;
  message: string | null;
  created_at: string;
  question_version: number | null;
  question: { id: string; prompt: LocalizedText; version: number } | null;
  lesson: { id: string; title: LocalizedText } | null;
}

/** Open reports for the CMS, oldest first so nothing waits forever. */
export async function listOpenContentReports(db: Db): Promise<ContentReportRow[]> {
  return must(
    await db
      .from("content_issue_reports")
      .select("id, reason, message, created_at, question_version, question:questions(id, prompt, version), lesson:lessons(id, title)")
      .eq("status", "open")
      .order("created_at")
      .limit(200),
    "loading content reports",
  ) as unknown as ContentReportRow[];
}

export async function resolveContentReport(db: Db, staffId: string, reportId: string, status: "resolved" | "dismissed", now: Date) {
  must(
    await db
      .from("content_issue_reports")
      .update({ status, resolved_at: now.toISOString(), resolved_by: staffId })
      .eq("id", reportId)
      .eq("status", "open"),
    "resolving report",
  );
}
