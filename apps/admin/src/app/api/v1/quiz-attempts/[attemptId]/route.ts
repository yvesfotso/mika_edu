import { idParam, learnerRoute, preflight } from "@/server/http";
import { getAttempt } from "@/server/learner/attempts";

export const GET = learnerRoute<{ attemptId: string }>(async ({ db, userId }, _req, params) =>
  getAttempt(db, userId, idParam(params.attemptId, "Attempt")),
);

export const OPTIONS = preflight;
