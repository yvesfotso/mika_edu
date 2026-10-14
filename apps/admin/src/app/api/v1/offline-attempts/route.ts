import { offlineAttemptSchema } from "@eduprep/core";
import { learnerRoute, preflight, readJson } from "@/server/http";
import { submitOfflineAttempt } from "@/server/learner/attempts";

export const POST = learnerRoute(async ({ db, userId, now }, request) =>
  submitOfflineAttempt(db, userId, await readJson(request, offlineAttemptSchema), now),
);

export const OPTIONS = preflight;
