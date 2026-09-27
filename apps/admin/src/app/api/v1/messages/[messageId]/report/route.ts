import { reportMessageSchema } from "@eduprep/core";
import { idParam, learnerRoute, preflight, readJson } from "@/server/http";
import { reportMessage } from "@/server/learner/messages";

export const POST = learnerRoute<{ messageId: string }>(async ({ db, userId }, request, params) => {
  const { reason } = await readJson(request, reportMessageSchema);
  await reportMessage(db, userId, idParam(params.messageId, "Message"), reason);
  return { ok: true };
});

export const OPTIONS = preflight;
