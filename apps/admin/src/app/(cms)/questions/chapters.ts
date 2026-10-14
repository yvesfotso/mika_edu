import "server-only";
import { localize, type LocalizedText } from "@eduprep/core";
import { must, type Db } from "@/server/db";

/** Chapters of a subject across all tracks, labelled with their exam and track, with their skills. */
export async function chapterOptions(db: Db, subjectId: string) {
  const rows = must(
    await db
      .from("chapters")
      .select("id, title, order_index, exam_tracks(name, exams(name)), skills(id, name, order_index)")
      .eq("subject_id", subjectId)
      .order("order_index"),
    "loading chapters",
  ) as unknown as {
    id: string;
    title: LocalizedText;
    exam_tracks: { name: LocalizedText; exams: { name: LocalizedText } } | null;
    skills: { id: string; name: LocalizedText; order_index: number }[];
  }[];
  return rows.map((c) => ({
    id: c.id,
    title: `${localize(c.exam_tracks?.exams.name, "en")} · ${localize(c.exam_tracks?.name, "en")} — ${localize(c.title, "en")}`,
    skills: [...(c.skills ?? [])].sort((a, b) => a.order_index - b.order_index).map((s) => ({ id: s.id, name: localize(s.name, "en") })),
  }));
}
