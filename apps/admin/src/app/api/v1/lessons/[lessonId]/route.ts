import { idParam, learnerRoute, preflight } from "@/server/http";
import { getLesson } from "@/server/learner/lessons";

export const GET = learnerRoute<{ lessonId: string }>(async ({ db, userId }, _req, params) => ({
  lesson: await getLesson(db, userId, idParam(params.lessonId, "Lesson")),
}));

export const OPTIONS = preflight;
