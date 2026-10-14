import { checkpointAnswerSchema } from "@eduprep/core";
import { learnerRoute, preflight, readJson } from "@/server/http";
import { answerCheckpoint } from "@/server/learner/checkpoints";

export const POST = learnerRoute(async ({ db, userId, now }, request) => ({
  result: await answerCheckpoint(db, userId, await readJson(request, checkpointAnswerSchema), now),
}));

export const OPTIONS = preflight;
