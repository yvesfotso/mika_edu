import { completeLessonSchema } from "@eduprep/core";
import { idParam, learnerRoute, preflight, readJson } from "@/server/http";
import { completeLesson } from "@/server/learner/lessons";

export const POST = learnerRoute<{ lessonId: string }>(async ({ db, userId, now }, request, params) =>
  completeLesson(db, userId, idParam(params.lessonId, "Lesson"), await readJson(request, completeLessonSchema), now),
);

export const OPTIONS = preflight;
