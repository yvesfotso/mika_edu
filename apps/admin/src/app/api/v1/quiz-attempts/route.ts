import { startAttemptSchema } from "@eduprep/core";
import { learnerRoute, preflight, readJson } from "@/server/http";
import { startAttempt } from "@/server/learner/attempts";

export const POST = learnerRoute(async ({ db, userId, now }, request) =>
  startAttempt(db, userId, await readJson(request, startAttemptSchema), now),
);

export const OPTIONS = preflight;
