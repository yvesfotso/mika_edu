import { startDirectSchema } from "@eduprep/core";
import { learnerRoute, preflight, readJson } from "@/server/http";
import { openDirectConversation } from "@/server/learner/messages";

export const POST = learnerRoute(async ({ db, userId }, request) => {
  const { friendCode } = await readJson(request, startDirectSchema);
  const { id } = await openDirectConversation(db, userId, friendCode);
  return { conversationId: id };
});

export const OPTIONS = preflight;
