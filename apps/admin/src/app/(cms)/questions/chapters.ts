import "server-only";
import { localize, type LocalizedText } from "@eduprep/core";
import { must, type Db } from "@/server/db";

/** Chapters of a subject across all tracks, labelled with their exam and track. */
export async function chapterOptions(db: Db, subjectId: string) {
  const rows = must(
    await db
      .from("chapters")
      .select("id, title, order_index, exam_tracks(name, exams(name))")
      .eq("subject_id", subjectId)
      .order("order_index"),
    "loading chapters",
  ) as unknown as {
    id: string;
    title: LocalizedText;
    exam_tracks: { name: LocalizedText; exams: { name: LocalizedText } } | null;
  }[];
  return rows.map((c) => ({
    id: c.id,
    title: `${localize(c.exam_tracks?.exams.name, "en")} · ${localize(c.exam_tracks?.name, "en")} — ${localize(c.title, "en")}`,
  }));
}
