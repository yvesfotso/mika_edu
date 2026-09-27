import { idParam, learnerRoute, preflight } from "@/server/http";
import { getConversation, markRead } from "@/server/learner/messages";

export const POST = learnerRoute<{ conversationId: string }>(async ({ db, userId, now }, _req, params) => {
  const id = idParam(params.conversationId, "Conversation");
  await getConversation(db, userId, id);
  await markRead(db, userId, id, now);
  return { ok: true };
});

export const OPTIONS = preflight;
