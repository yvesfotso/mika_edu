// Writes apps/mobile/src/demo/content.json from content.ts (same IDs as seed.sql).
// Run: node supabase/seed/export-demo.ts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exams, subjects, type L } from "./content.ts";
import { uuidFor } from "./ids.ts";

const clean = (t: L): L => Object.fromEntries(Object.entries(t).filter(([, v]) => v && v.trim() !== "")) as L;

const out = {
  subjects: subjects.map((s) => ({ id: uuidFor(`subject:${s.slug}`), slug: s.slug, name: clean(s.name), icon: s.icon })),
  exams: exams.map((exam) => ({
    id: uuidFor(`exam:${exam.slug}`),
    slug: exam.slug,
    countryCode: "CM",
    name: clean(exam.name),
    description: clean(exam.description),
    level: exam.level,
    primaryLanguage: exam.primaryLanguage,
    program: exam.program,
    tracks: exam.tracks.map((track) => ({
      id: uuidFor(`track:${exam.slug}:${track.slug}`),
      slug: track.slug,
      name: clean(track.name),
      subjects: track.subjects.map(([slug, coefficient]) => ({ subjectId: uuidFor(`subject:${slug}`), coefficient })),
    })),
  })),
  chapters: exams.flatMap((exam) =>
    exam.tracks.flatMap((track) =>
      track.chapters
        .filter((ch) => (ch.status ?? "published") === "published")
        .map((ch, orderIndex) => ({
          id: uuidFor(`chapter:${ch.key}`),
          trackId: uuidFor(`track:${exam.slug}:${track.slug}`),
          subjectId: uuidFor(`subject:${ch.subject}`),
          title: clean(ch.title),
          orderIndex,
          lessons: ch.lessons
            .filter((l) => (l.status ?? "published") === "published")
            .map((l) => ({
              id: uuidFor(`lesson:${ch.key}:${l.key}`),
              title: clean(l.title),
              body: clean(l.body),
              estimatedMinutes: l.minutes,
            })),
          questions: ch.questions.map((q) => ({
            id: uuidFor(`question:${ch.key}:${q.key}`),
            type: q.type,
            prompt: clean(q.prompt),
            difficulty: q.difficulty,
            options: (q.options ?? []).map(([en, fr, correct], i) => ({
              id: uuidFor(`option:${ch.key}:${q.key}:${i}`),
              text: clean({ en, fr }),
              isCorrect: correct === true,
            })),
            numericAnswer: q.numeric?.[0] ?? null,
            numericTolerance: q.numeric?.[1] ?? null,
            explanation: clean(q.explanation),
          })),
        })),
    ),
  ),
};

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "apps", "mobile", "src", "demo", "content.json");
writeFileSync(target, JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${target}: ${out.chapters.length} chapters`);
