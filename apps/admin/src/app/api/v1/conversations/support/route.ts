import { learnerRoute, preflight } from "@/server/http";
import { openSupportConversation } from "@/server/learner/messages";

export const POST = learnerRoute(async ({ db, userId }) => {
  const { id } = await openSupportConversation(db, userId);
  return { conversationId: id };
});

export const OPTIONS = preflight;
