import { submitAttemptSchema } from "@eduprep/core";
import { idParam, learnerRoute, preflight, readJson } from "@/server/http";
import { submitAttempt } from "@/server/learner/attempts";

export const POST = learnerRoute<{ attemptId: string }>(async ({ db, userId, now }, request, params) => {
  const { answers } = await readJson(request, submitAttemptSchema);
  return { result: await submitAttempt(db, userId, idParam(params.attemptId, "Attempt"), answers, now) };
});

export const OPTIONS = preflight;
