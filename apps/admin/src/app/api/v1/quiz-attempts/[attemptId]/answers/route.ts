import { saveAnswersSchema } from "@eduprep/core";
import { idParam, learnerRoute, preflight, readJson } from "@/server/http";
import { saveAnswers } from "@/server/learner/attempts";

export const POST = learnerRoute<{ attemptId: string }>(async ({ db, userId, now }, request, params) => {
  const { answers } = await readJson(request, saveAnswersSchema);
  return saveAnswers(db, userId, idParam(params.attemptId, "Attempt"), answers, now);
});

export const OPTIONS = preflight;
