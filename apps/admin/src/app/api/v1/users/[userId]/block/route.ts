import { idParam, learnerRoute, preflight } from "@/server/http";
import { blockUser } from "@/server/learner/messages";

export const POST = learnerRoute<{ userId: string }>(async ({ db, userId }, _req, params) => {
  await blockUser(db, userId, idParam(params.userId, "User"));
  return { ok: true };
});

export const OPTIONS = preflight;
