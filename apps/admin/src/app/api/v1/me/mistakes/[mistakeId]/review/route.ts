import { idParam, learnerRoute, preflight } from "@/server/http";
import { reviewMistake } from "@/server/learner/mistakes";

export const POST = learnerRoute<{ mistakeId: string }>(async ({ db, userId, now }, _request, params) =>
  reviewMistake(db, userId, idParam(params.mistakeId, "Mistake"), now),
);

export const OPTIONS = preflight;
