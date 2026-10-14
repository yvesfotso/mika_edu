import { lessonProgressSchema } from "@eduprep/core";
import { idParam, learnerRoute, preflight, readJson } from "@/server/http";
import { saveLessonProgress } from "@/server/learner/lessons";

export const POST = learnerRoute<{ lessonId: string }>(async ({ db, userId, now }, request, params) => {
  const { block } = await readJson(request, lessonProgressSchema);
  return saveLessonProgress(db, userId, idParam(params.lessonId, "Lesson"), block, now);
});

export const OPTIONS = preflight;
