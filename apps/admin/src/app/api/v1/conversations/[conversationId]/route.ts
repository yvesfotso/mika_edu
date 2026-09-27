import { idParam, learnerRoute, preflight } from "@/server/http";
import { getConversation } from "@/server/learner/messages";

export const GET = learnerRoute<{ conversationId: string }>(async ({ db, userId }, _req, params) => ({
  conversation: await getConversation(db, userId, idParam(params.conversationId, "Conversation")),
}));

export const OPTIONS = preflight;
